import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/mobileAuth";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { checkRateLimitByIp } from "@/lib/rateLimit";
import { getSiteConfig } from "@/lib/siteConfig";

/**
 * Retrouve les coordonnées d'une adresse.
 *
 * La carte d'un évènement ne s'affiche qu'avec une latitude et une
 * longitude (components/events/detail/EventSections.tsx). Jusqu'ici il
 * fallait les saisir à la main — autant dire que personne ne le faisait,
 * et qu'aucune carte n'apparaissait jamais.
 *
 * POURQUOI PASSER PAR LE SERVEUR
 *
 * Nominatim, le service d'OpenStreetMap, impose une identification de
 * l'application appelante et refuse les requêtes anonymes en masse.
 * Appelé depuis le navigateur, chaque visiteur solliciterait le service
 * en son nom propre, sans en-tête d'identification — et se ferait
 * bloquer. Ici, l'appel part une fois, identifié, et sous limite de débit.
 */

/**
 * Nominatim demande de ne pas dépasser une requête par seconde pour toute
 * l'application. Ce plafond par adresse IP est plus large que cela : il
 * protège d'un script, pas du service — d'où l'usage réservé aux comptes
 * connectés, qui sont peu nombreux à créer des évènements.
 */
const LIMITE = { limit: 20, windowMs: 60 * 1000 };

type ResultatNominatim = {
  display_name?: string;
  lat?: string;
  lon?: string;
  type?: string;
};

export const GET = withApiErrors(async (req: Request) => {
  await requireAuthUser(req);
  checkRateLimitByIp("geocodage", LIMITE);

  const requete = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (requete.length < 3) throw new ApiError("Précise une adresse à chercher.", 400);

  const config = await getSiteConfig();

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", requete);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "5");
  url.searchParams.set("addressdetails", "0");

  let reponse: Response;
  try {
    reponse = await fetch(url, {
      headers: {
        // Exigé par la politique d'usage de Nominatim : une application
        // qui ne se nomme pas est refusée.
        "User-Agent": `${config.siteName} (${config.supportEmail || "contact"})`,
        "Accept-Language": "fr",
      },
      // Une même adresse cherchée deux fois ne doit pas repartir sur le
      // réseau : la réponse ne change pas d'une heure à l'autre.
      next: { revalidate: 60 * 60 },
    });
  } catch {
    throw new ApiError("Service de géocodage injoignable. Réessaie dans un instant.", 503);
  }

  if (!reponse.ok) {
    throw new ApiError(`Le service de géocodage a répondu ${reponse.status}.`, 502);
  }

  const brut = (await reponse.json().catch(() => [])) as ResultatNominatim[];

  const lieux = brut
    .map((r) => ({
      nom: r.display_name ?? "",
      latitude: Number(r.lat),
      longitude: Number(r.lon),
    }))
    // Une entrée sans coordonnées exploitables n'a rien à proposer.
    .filter((l) => l.nom && Number.isFinite(l.latitude) && Number.isFinite(l.longitude));

  return NextResponse.json({ lieux });
});
