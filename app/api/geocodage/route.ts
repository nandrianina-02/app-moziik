import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/mobileAuth";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { checkRateLimitByIp } from "@/lib/rateLimit";
import { chercherLieux } from "@/lib/geocodage";

/**
 * Cherche les coordonnées d'une adresse, pour le formulaire d'évènement.
 *
 * L'enregistrement les trouve déjà tout seul (`lib/geocodage.ts`) : cette
 * route sert à *choisir* quand le premier résultat n'est pas le bon, et à
 * voir ce qui a été trouvé avant d'enregistrer.
 */

/**
 * Nominatim demande de ne pas dépasser une requête par seconde pour toute
 * l'application. Ce plafond par adresse IP est plus large : il protège
 * d'un script, pas du service — d'où l'usage réservé aux comptes
 * connectés, peu nombreux à créer des évènements.
 */
const LIMITE = { limit: 20, windowMs: 60 * 1000 };

export const GET = withApiErrors(async (req: Request) => {
  await requireAuthUser(req);
  checkRateLimitByIp("geocodage", LIMITE);

  const requete = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (requete.length < 3) throw new ApiError("Précise une adresse à chercher.", 400);

  return NextResponse.json({ lieux: await chercherLieux(requete) });
});
