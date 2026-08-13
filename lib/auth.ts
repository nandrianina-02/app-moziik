import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { checkRateLimit } from "@/lib/rateLimit";

// Le rôle et le statut "suspendu" ne sont revalidés en base qu'au bout de
// ce délai, pas à chaque requête (coût DB), pour rester réactif sans
// alourdir chaque page vue. Un admin qui suspend un compte ou change un
// rôle voit donc l'effet appliqué en quelques minutes maximum, plutôt
// qu'à la prochaine reconnexion (jusqu'à 30 jours avec la config JWT
// par défaut de NextAuth).
const SESSION_REVALIDATE_MS = 5 * 60 * 1000;

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/connexion",
  },
  providers: [
    CredentialsProvider({
      name: "Identifiants",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email et mot de passe requis.");
        }

        const email = credentials.email.toLowerCase();

        // 10 tentatives / 15 min / email : ralentit le brute force sans
        // bloquer un utilisateur qui se trompe deux ou trois fois de mot
        // de passe. La clé est l'email (pas l'IP) car NextAuth n'expose
        // pas facilement l'IP ici, et cibler l'email protège aussi contre
        // un attaquant distribué sur plusieurs IP visant un seul compte.
        checkRateLimit(`login:${email}`, { limit: 10, windowMs: 15 * 60 * 1000 });

        await connectDB();
        const user = await User.findOne({ email });

        if (!user || !user.passwordHash) {
          throw new Error("Aucun compte associé à cet email.");
        }

        if (user.suspended) {
          throw new Error("Ce compte a été suspendu.");
        }

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) {
          throw new Error("Mot de passe incorrect.");
        }

        // Un compte créé par email/mot de passe doit avoir confirmé son
        // adresse avant de pouvoir se connecter (voir /api/auth/register
        // et /api/auth/verify-email). Les comptes Google sont vérifiés
        // d'office (cf. callback signIn ci-dessous).
        if (!user.emailVerified) {
          throw new Error("EMAIL_NOT_VERIFIED");
        }

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          image: user.avatarUrl,
          role: user.role,
        };
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        await connectDB();
        const existing = await User.findOne({ email: user.email });
        if (existing?.suspended) {
          // Bloque explicitement la connexion Google d'un compte suspendu
          // (jusqu'ici seul le provider Credentials vérifiait ce statut).
          return false;
        }
        if (!existing) {
          await User.create({
            name: user.name,
            email: user.email,
            googleId: account.providerAccountId,
            avatarUrl: user.image,
            role: "member",
            // Google a déjà confirmé la propriété de l'adresse email.
            emailVerified: true,
          });
        } else if (!existing.emailVerified) {
          // Un compte créé par email/mot de passe puis jamais confirmé :
          // se connecter avec Google sur la même adresse suffit à la
          // valider, Google en garantissant déjà la propriété.
          existing.emailVerified = true;
          await existing.save();
        }
      }
      return true;
    },
    async jwt({ token, user, trigger, session }) {
      // Déclenché par un appel client à useSession().update(...) — utilisé
      // après une modification du profil (nom / photo / email) pour que la
      // session reflète immédiatement les nouvelles infos, sans recharger
      // la page ni attendre la prochaine revalidation périodique.
      if (trigger === "update" && session) {
        if (typeof session.name === "string") token.name = session.name;
        if (typeof session.picture === "string") token.picture = session.picture;
        if (typeof session.email === "string") token.email = session.email;
        return token;
      }

      const now = Date.now();
      const lastValidated = (token.lastValidated as number | undefined) ?? 0;

      // À la connexion initiale (user présent), ou périodiquement au-delà
      // de SESSION_REVALIDATE_MS, on relit le rôle et le statut suspendu
      // en base. Pour Google, `user.id` est l'identifiant OAuth, pas
      // l'_id MongoDB : on résout donc toujours via l'email pour être sûr
      // de pointer vers le bon document utilisateur.
      const email = user?.email ?? (token.email as string | undefined);
      const shouldRevalidate = !!user || now - lastValidated > SESSION_REVALIDATE_MS;

      if (email && shouldRevalidate) {
        await connectDB();
        const dbUser = await User.findOne({ email });
        if (dbUser) {
          if (dbUser.suspended) {
            // Compte suspendu après coup : on invalide la session dès la
            // prochaine revalidation plutôt que d'attendre l'expiration
            // du JWT.
            token.suspended = true;
          } else {
            token.suspended = false;
            token.id = dbUser._id.toString();
            token.role = dbUser.role;
            // Garde le nom/la photo affichés en session synchronisés avec
            // la base (ex. modifiés depuis un autre onglet, ou par un
            // admin) même sans passer par update().
            token.name = dbUser.name;
            token.picture = dbUser.avatarUrl;
          }
        }
        token.lastValidated = now;
      }

      return token;
    },
    async session({ session, token }) {
      if (token.suspended) {
        // Vide la session côté client : `useSession()`/`getServerSession()`
        // renverront un utilisateur non authentifiable pour les vérifs
        // qui dépendent de session.user.id/role.
        return { ...session, user: undefined, expires: session.expires };
      }
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as "member" | "artist" | "admin";
      }
      return session;
    },
  },
};
