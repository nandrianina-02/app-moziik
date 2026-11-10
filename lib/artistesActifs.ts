import { Types } from "mongoose";
import Song from "@/models/Song";

/**
 * Les artistes qui ont quelque chose à écouter : au moins un titre publié,
 * en leur nom ou en featuring.
 *
 * Le catalogue a été amorcé avec plusieurs centaines d'artistes sans titre,
 * en attendant leurs musiques. Tant qu'ils n'ont rien publié, ils n'ont pas
 * leur place dans les listes publiques (artistes en vedette, recherche,
 * « Vous aimerez aussi ») : un visiteur y cliquait et ne trouvait qu'une
 * page vide. Les sélecteurs de l'administration et de la publication
 * (featuring, import, évènements) ne passent pas par ici : on doit pouvoir
 * choisir un artiste avant son premier titre.
 *
 * Le résultat est gardé cinq minutes : chaque page d'accueil ou recherche
 * n'a pas à recompter le catalogue.
 */
const DUREE_CACHE_MS = 5 * 60_000;
let cache: { ids: Types.ObjectId[]; jusqua: number } | null = null;

export async function idsArtistesActifs(): Promise<Types.ObjectId[]> {
  if (cache && cache.jusqua > Date.now()) return cache.ids;
  const [principaux, invites] = await Promise.all([
    Song.distinct("artist", { status: "published" }),
    Song.distinct("featuring.artist", { status: "published" }),
  ]);
  const vus = new Set<string>();
  const ids: Types.ObjectId[] = [];
  for (const id of [...principaux, ...invites]) {
    if (!id || vus.has(String(id))) continue;
    vus.add(String(id));
    ids.push(id as Types.ObjectId);
  }
  cache = { ids, jusqua: Date.now() + DUREE_CACHE_MS };
  return ids;
}

/** Condition à ajouter à une requête `Artist.find` publique. */
export async function filtreArtistesActifs(): Promise<{ _id: { $in: Types.ObjectId[] } }> {
  return { _id: { $in: await idsArtistesActifs() } };
}

/** Pour les tests et la publication d'un premier titre : le prochain appel recompte. */
export function oublierArtistesActifs() {
  cache = null;
}
