import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { genererUsername } from "@/lib/username";

/**
 * Ce qu'une connexion Google fait d'un compte, quel que soit le chemin :
 * le site (callback signIn de NextAuth, lib/auth.ts) ou l'app Android
 * (jeton Google vérifié, /api/mobile-auth/google). Une seule règle, sans
 * quoi les deux finiraient par diverger.
 *
 * - Compte suspendu : refusé (null).
 * - Compte inconnu : créé, avec un nom d'utilisateur ; Google ayant déjà
 *   confirmé la propriété de l'adresse, elle est vérifiée d'office.
 * - Compte existant jamais confirmé : confirmé par cette connexion.
 */
export async function compteGoogle(profil: { email: string; nom?: string | null; image?: string | null; googleId: string }) {
  await connectDB();
  const existant = await User.findOne({ email: profil.email });
  if (existant?.suspended) return null;

  let compte = existant;
  if (!compte) {
    compte = await User.create({
      name: profil.nom,
      username: await genererUsername(profil.nom ?? profil.email ?? "membre"),
      email: profil.email,
      googleId: profil.googleId,
      avatarUrl: profil.image,
      role: "member",
      emailVerified: true,
    });
  } else if (!compte.emailVerified) {
    compte.emailVerified = true;
    await compte.save();
  }
  // Même trace que pour la connexion par mot de passe.
  User.updateOne({ email: profil.email }, { lastLoginAt: new Date() }).catch(() => undefined);
  return compte;
}
