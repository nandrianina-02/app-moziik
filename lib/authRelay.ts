import { createHash, randomBytes } from "crypto";
import { encode } from "next-auth/jwt";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import AuthRelay from "@/models/AuthRelay";
import { ApiError } from "@/lib/apiError";
import type { UserRole } from "@/models/User";

/**
 * Relais de session navigateur système → WebView Android.
 *
 * Voir models/AuthRelay.ts pour le pourquoi. En deux phrases : Google
 * refuse OAuth dans une WebView, la connexion se fait donc dans Chrome, et
 * le cookie qui en résulte n'est pas visible par l'app. Ces fonctions
 * transportent la session d'un pot à cookies à l'autre, sans jamais faire
 * transiter d'identifiants.
 */

/** Une minute : le rebond Chrome → app prend moins d'une seconde. */
const DUREE_CODE_MS = 60 * 1000;

/** Aligné sur le défaut de NextAuth, pour que l'app ne se déconnecte pas plus tôt que le web. */
const DUREE_SESSION_S = 30 * 24 * 60 * 60;

function hacher(code: string): string {
  // sha256 suffit : le code fait 256 bits d'aléa (randomBytes), il n'est
  // pas devinable par dictionnaire. Même raisonnement que pour les refresh
  // tokens dans lib/mobileAuth.ts.
  return createHash("sha256").update(code).digest("hex");
}

/**
 * Émet un code à usage unique pour l'utilisateur donné. Appelé côté
 * navigateur système, sur une session déjà authentifiée.
 */
export async function emettreCodeRelais(userId: string): Promise<string> {
  await connectDB();
  const code = randomBytes(32).toString("hex");
  await AuthRelay.create({
    user: userId,
    codeHash: hacher(code),
    expiresAt: new Date(Date.now() + DUREE_CODE_MS),
  });
  return code;
}

/**
 * Échange un code contre un jeton de session NextAuth prêt à être posé en
 * cookie. Appelé côté WebView.
 *
 * Le jeton produit est volontairement identique, champ pour champ, à celui
 * qu'aurait fabriqué le callback `jwt` de lib/auth.ts après une connexion
 * ordinaire : c'est ce qui garantit que l'app et le site se comportent
 * exactement pareil ensuite — mêmes droits, même revalidation périodique
 * du rôle, même expiration.
 */
export async function consommerCodeRelais(code: string): Promise<{ jeton: string; role: UserRole }> {
  await connectDB();

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new ApiError("Connexion indisponible (NEXTAUTH_SECRET manquante).", 500);
  }

  // findOneAndUpdate plutôt que find puis save : l'opération est atomique
  // côté Mongo, donc deux requêtes simultanées avec le même code ne
  // peuvent pas réussir toutes les deux. `used: false` dans le filtre est
  // ce qui rend le code réellement à usage unique.
  const relais = await AuthRelay.findOneAndUpdate(
    { codeHash: hacher(code), used: false, expiresAt: { $gt: new Date() } },
    { used: true },
    { new: true }
  );

  if (!relais) {
    throw new ApiError("Lien de connexion expiré ou déjà utilisé. Reconnecte-toi.", 401);
  }

  const user = await User.findById(relais.user).select("name email avatarUrl role suspended");
  if (!user || user.suspended) {
    throw new ApiError("Compte introuvable ou suspendu.", 401);
  }

  const jeton = await encode({
    secret,
    maxAge: DUREE_SESSION_S,
    token: {
      // `sub` et `picture` sont les noms attendus par NextAuth lui-même ;
      // `id` et `role` sont les ajouts du callback `jwt` de ce projet, lus
      // par le callback `session`.
      sub: user._id.toString(),
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      picture: user.avatarUrl,
      role: user.role,
      suspended: false,
      // L'utilisateur vient d'être relu en base, juste au-dessus : inutile
      // de refaire la requête au premier appel du callback `jwt`.
      lastValidated: Date.now(),
    },
  });

  return { jeton, role: user.role };
}

/**
 * Nom du cookie de session, tel que NextAuth le choisit lui-même : le
 * préfixe `__Secure-` n'est utilisé qu'en https, et un cookie qui le porte
 * est rejeté par le navigateur s'il arrive sans l'attribut Secure. Se
 * tromper ici donne une session qui « ne prend pas », sans erreur visible.
 */
export function nomCookieSession(): string {
  const securise = (process.env.NEXTAUTH_URL ?? "").startsWith("https://");
  return securise ? "__Secure-next-auth.session-token" : "next-auth.session-token";
}

export function cookieSecurise(): boolean {
  return (process.env.NEXTAUTH_URL ?? "").startsWith("https://");
}

export { DUREE_SESSION_S };
