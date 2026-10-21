import jwt from "jsonwebtoken";
import { createPublicKey, type JsonWebKey, type KeyObject } from "crypto";
import { ApiError } from "@/lib/apiError";

/**
 * Vérification d'un jeton d'identité Google (ID token), tel que le rend la
 * fenêtre de connexion Google intégrée à Android (Credential Manager).
 *
 * Le jeton est un JWT signé par Google : on vérifie la signature avec les
 * clés publiques de Google, l'émetteur, l'audience (l'identifiant client
 * web du site, celui que l'app déclare comme « serveur ») et l'expiration.
 * Rien d'autre ne prouve qui est la personne : un jeton non vérifié ne
 * vaut rien.
 */

const CLES_GOOGLE = "https://www.googleapis.com/oauth2/v3/certs";
const EMETTEURS: [string, ...string[]] = ["accounts.google.com", "https://accounts.google.com"];

let cache: { cles: Map<string, KeyObject>; expire: number } | null = null;

/** Les clés de Google changent régulièrement : gardées le temps qu'indique leur Cache-Control. */
async function clesGoogle(forcer = false): Promise<Map<string, KeyObject>> {
  if (!forcer && cache && cache.expire > Date.now()) return cache.cles;
  const reponse = await fetch(CLES_GOOGLE, { cache: "no-store" });
  if (!reponse.ok) throw new ApiError("Connexion Google momentanément indisponible.", 503);
  const { keys } = (await reponse.json()) as { keys: (JsonWebKey & { kid: string })[] };
  const cles = new Map(keys.map((k) => [k.kid, createPublicKey({ key: k, format: "jwk" })]));
  const maxAge = Number(reponse.headers.get("cache-control")?.match(/max-age=(\d+)/)?.[1] ?? 3600);
  cache = { cles, expire: Date.now() + maxAge * 1000 };
  return cles;
}

export type ProfilGoogle = { email: string; nom: string | null; image: string | null; googleId: string };

export async function verifierJetonGoogle(idToken: string): Promise<ProfilGoogle> {
  const audience = process.env.GOOGLE_CLIENT_ID;
  if (!audience) throw new ApiError("Connexion Google indisponible (GOOGLE_CLIENT_ID manquante).", 500);

  const entete = jwt.decode(idToken, { complete: true })?.header;
  if (!entete?.kid) throw new ApiError("Jeton Google invalide.", 401);
  // Clé inconnue : Google vient peut-être d'en publier une nouvelle.
  const cle = (await clesGoogle()).get(entete.kid) ?? (await clesGoogle(true)).get(entete.kid);
  if (!cle) throw new ApiError("Jeton Google invalide.", 401);

  let charge: jwt.JwtPayload;
  try {
    charge = jwt.verify(idToken, cle, { algorithms: ["RS256"], audience, issuer: EMETTEURS }) as jwt.JwtPayload;
  } catch {
    throw new ApiError("Jeton Google invalide ou expiré.", 401);
  }
  if (typeof charge.email !== "string" || charge.email_verified !== true || typeof charge.sub !== "string") {
    throw new ApiError("Ce compte Google n'a pas d'adresse email vérifiée.", 401);
  }
  return {
    email: charge.email.toLowerCase(),
    nom: typeof charge.name === "string" ? charge.name : null,
    image: typeof charge.picture === "string" ? charge.picture : null,
    googleId: charge.sub,
  };
}
