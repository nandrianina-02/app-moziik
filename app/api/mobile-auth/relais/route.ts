import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { withApiErrors } from "@/lib/apiError";
import { checkRateLimitByIp } from "@/lib/rateLimit";
import { emettreCodeRelais } from "@/lib/authRelay";

// Cette route s'exécute dans le NAVIGATEUR SYSTÈME, pas dans l'app.
//
// Enchaînement complet d'une connexion Google depuis Android :
//
//   1. app         « Continuer avec Google » ouvre Chrome sur
//                  /connexion?relais=android
//   2. Chrome      connexion Google habituelle (autorisée : c'est un vrai
//                  navigateur, pas une WebView — Google refuse la seconde)
//   3. Chrome      /connexion redirige ici une fois la session posée
//   4. ICI         émission d'un code à usage unique, valable 60 s
//   5. Chrome      redirection vers moziik://auth?code=...
//   6. Android     le schéma `moziik` est déclaré dans AndroidManifest.xml,
//                  l'app est ramenée au premier plan avec l'URL
//   7. WebView     appelle /api/mobile-auth/relais/consommer?code=...
//                  qui pose enfin le cookie de session côté app
//
// Rien de secret ne circule : le code ne vaut que 60 secondes, ne sert
// qu'une fois, et ne permet que d'obtenir la session de l'utilisateur qui
// vient lui-même de s'authentifier.

// Le rendu doit être recalculé à chaque appel (session + code à usage
// unique) : sans ceci, Next.js pourrait servir une redirection mise en
// cache, donc un code déjà consommé.
export const dynamic = "force-dynamic";

export const GET = withApiErrors(async () => {
  // Empêche qu'une IP moissonne des codes en boucle. Large, car un
  // utilisateur légitime peut réessayer plusieurs fois de suite si son
  // rebond échoue.
  checkRateLimitByIp("auth-relais", { limit: 20, windowMs: 15 * 60 * 1000 });

  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    // Arrivée ici sans session : la connexion a échoué ou a été
    // abandonnée. On renvoie l'app vers son écran de connexion plutôt que
    // de laisser un onglet Chrome orphelin devant une erreur JSON.
    return NextResponse.redirect(new URL("moziik://auth?erreur=session"));
  }

  const code = await emettreCodeRelais(session.user.id);

  return NextResponse.redirect(new URL(`moziik://auth?code=${encodeURIComponent(code)}`));
});
