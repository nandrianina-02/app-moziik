import { getSiteConfig } from "@/lib/siteConfig";

/**
 * Retrouver les coordonnées d'une adresse, côté serveur.
 *
 * Nominatim, le service d'OpenStreetMap, exige que l'application
 * appelante s'identifie et refuse les requêtes anonymes en masse. Appelé
 * depuis le navigateur, chaque visiteur l'interrogerait en son nom propre,
 * sans en-tête d'identification, et se ferait bloquer. Tout passe donc par
 * ici.
 */

export type LieuTrouve = {
  nom: string;
  latitude: number;
  longitude: number;
};

type ResultatNominatim = { display_name?: string; lat?: string; lon?: string };

/** Compose une adresse cherchable à partir des champs d'un évènement. */
export function adresseCherchable(parties: {
  address?: string | null;
  postalCode?: string | null;
  city?: string | null;
  country?: string | null;
  location?: string | null;
}): string {
  return [parties.address, parties.postalCode, parties.city, parties.country, parties.location]
    .map((v) => (v ?? "").trim())
    .filter(Boolean)
    .join(", ");
}

/**
 * Cherche jusqu'à `limite` lieux correspondant à cette adresse.
 *
 * Renvoie une liste vide plutôt que de lever : ne pas trouver un lieu
 * n'est pas une panne, et ne doit jamais empêcher d'enregistrer
 * l'évènement auquel il se rattache.
 */
export async function chercherLieux(requete: string, limite = 5): Promise<LieuTrouve[]> {
  const q = requete.trim();
  if (q.length < 3) return [];

  const config = await getSiteConfig();

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", String(limite));
  url.searchParams.set("addressdetails", "0");

  try {
    const reponse = await fetch(url, {
      headers: {
        // Exigé par la politique d'usage de Nominatim : une application
        // qui ne se nomme pas est refusée.
        "User-Agent": `${config.siteName} (${config.supportEmail || "contact"})`,
        "Accept-Language": "fr",
      },
      // Une même adresse cherchée deux fois ne repart pas sur le réseau :
      // elle ne déménage pas d'une heure à l'autre.
      next: { revalidate: 60 * 60 },
    });
    if (!reponse.ok) return [];

    const brut = (await reponse.json().catch(() => [])) as ResultatNominatim[];
    return brut
      .map((r) => ({
        nom: r.display_name ?? "",
        latitude: Number(r.lat),
        longitude: Number(r.lon),
      }))
      .filter((l) => l.nom && Number.isFinite(l.latitude) && Number.isFinite(l.longitude));
  } catch {
    return [];
  }
}

/**
 * Le premier lieu correspondant, ou rien.
 *
 * Utilisé à l'enregistrement d'un évènement : sans coordonnées, la carte
 * de sa fiche ne s'affiche pas, et attendre qu'on les saisisse à la main
 * revenait à ne jamais en avoir. Le premier résultat de Nominatim est le
 * mieux classé ; quand il se trompe, le formulaire permet de choisir
 * parmi les autres, et cette valeur-là n'est plus réécrite.
 */
export async function premierLieu(requete: string): Promise<LieuTrouve | null> {
  const lieux = await chercherLieux(requete, 1);
  return lieux[0] ?? null;
}
