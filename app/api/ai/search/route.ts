import { NextResponse } from "next/server";
import { withApiErrors } from "@/lib/apiError";
import { getSiteConfig } from "@/lib/siteConfig";
import { getClientIp } from "@/lib/rateLimit";
import { parseOrThrow, aiSearchSchema } from "@/lib/validation";
import { rechercheParIntention } from "@/lib/ai/searchIntent";

/**
 * Repli de la recherche, quand la recherche du site n'a rien trouvé.
 *
 * Ouverte aux visiteurs sans compte : quelqu'un qui découvre le site est
 * précisément celui qui tape une phrase plutôt qu'un nom d'artiste. La
 * cadence est donc mesurée par adresse, à défaut de compte — c'est la
 * seule identification disponible, avec ses limites (plusieurs personnes
 * derrière une même sortie réseau partagent la limite).
 *
 * La page n'appelle cette route que sur un résultat vide : sans cela,
 * chaque recherche du site coûterait un appel au modèle pour rien.
 */
export const dynamic = "force-dynamic";

/** Langues proposées à la publication, dupliquées côté formulaire de titre. */
const LANGUES = ["Malagasy", "Français", "Anglais"];

export const POST = withApiErrors(async (req: Request) => {
  const { demande } = parseOrThrow(aiSearchSchema, await req.json());

  const config = await getSiteConfig();

  const resultat = await rechercheParIntention({
    demande,
    genresConnus: config.genres ?? [],
    languesConnues: LANGUES,
    compte: getClientIp(),
  });

  return NextResponse.json(resultat ?? { interpretation: null, songs: [] }, {
    headers: { "Cache-Control": "no-store" },
  });
});
