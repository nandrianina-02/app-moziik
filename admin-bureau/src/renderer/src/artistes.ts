import { api } from "./api";

export interface ArtisteOption {
  _id: string;
  stageName: string;
  verified?: boolean;
  coverUrl?: string | null;
}

/**
 * Recherche d'artistes pour l'administration. /api/artists filtre par
 * univers (paramètre, puis cookie, puis univers par défaut du site) : sans
 * rien préciser, un artiste de l'univers Évangélique restait introuvable.
 * On interroge donc les deux univers et on fusionne.
 */
export async function chercherArtistes(q: string): Promise<ArtisteOption[]> {
  const terme = q.trim();
  if (terme.length < 2) return [];
  const listes = await Promise.all(
    ["general", "christian"].map((u) =>
      api<{ artists?: ArtisteOption[] }>(`/api/artists?search=${encodeURIComponent(terme)}&univers=${u}`)
        .then((r) => r.artists ?? [])
        .catch(() => [] as ArtisteOption[]),
    ),
  );
  const vus = new Set<string>();
  return listes.flat().filter((a) => (vus.has(a._id) ? false : (vus.add(a._id), true)));
}

/**
 * Un artiste absent du catalogue : un compte artiste, comme le fait le site
 * (CreateArtistModal), avec une adresse @moziik.app que personne ne lit.
 */
export async function creerArtiste(nom: string): Promise<ArtisteOption> {
  const propre = nom.trim();
  const slug = propre.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  const { artist } = await api<{ artist: { _id: string; stageName: string } }>("/api/admin/users", {
    corps: { name: propre, email: `${slug || "artiste"}-${Date.now().toString(36)}@moziik.app`, role: "artist" },
  });
  return { _id: artist._id, stageName: artist.stageName, verified: true };
}
