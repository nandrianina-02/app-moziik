import { NextResponse } from "next/server";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { checkRateLimitByIp } from "@/lib/rateLimit";
import {
  consommerCodeRelais,
  nomCookieSession,
  cookieSecurise,
  DUREE_SESSION_S,
} from "@/lib/authRelay";

// Étape 7 du relais décrit dans ../route.ts. S'exécute, elle, DANS LA
// WEBVIEW de l'app : c'est tout l'intérêt, puisque c'est là que le cookie
// de session doit atterrir.

export const dynamic = "force-dynamic";

export const GET = withApiErrors(async (req: Request) => {
  // Un code fait 64 caractères hexadécimaux : le forcer est hors de
  // portée, mais cette limite coupe court à toute tentative bruyante.
  checkRateLimitByIp("auth-relais-consommer", { limit: 20, windowMs: 15 * 60 * 1000 });

  const url = new URL(req.url);
  const code = url.searchParams.get("code");

  if (!code) {
    throw new ApiError("Code de connexion manquant.", 400);
  }

  const { jeton } = await consommerCodeRelais(code);

  // Destination après connexion. Restreinte aux chemins internes : sans ce
  // filtre, `?suite=https://exemple.tld` transformerait cette route en
  // redirection ouverte, exploitable pour du hameçonnage depuis un lien
  // portant notre domaine.
  const suite = url.searchParams.get("suite");
  const destination = suite && suite.startsWith("/") && !suite.startsWith("//") ? suite : "/";

  const reponse = NextResponse.redirect(new URL(destination, url.origin));

  reponse.cookies.set({
    name: nomCookieSession(),
    value: jeton,
    httpOnly: true,
    secure: cookieSecurise(),
    // `lax` et non `strict` : c'est exactement le réglage de NextAuth. En
    // `strict`, le cookie ne serait pas envoyé sur la navigation qui suit
    // immédiatement cette redirection, et l'app se croirait déconnectée
    // jusqu'au rechargement suivant.
    sameSite: "lax",
    path: "/",
    maxAge: DUREE_SESSION_S,
  });

  return reponse;
});
