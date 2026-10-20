import type { HydratedDocument } from "mongoose";
import Song, { type ISong } from "@/models/Song";
import Artist from "@/models/Artist";
import { ApiError } from "@/lib/apiError";
import { getAuthUser, requireAuthUser } from "@/lib/mobileAuth";

/**
 * « Ce compte peut-il modifier ce titre ? »
 *
 * La règle vivait en clair dans `PATCH /api/songs/[id]` : l'artiste
 * propriétaire, ou un administrateur. La recopier dans chaque nouvelle
 * route qui touche un titre finirait par la faire diverger — et une règle
 * d'accès qui diverge se remarque le jour où elle laisse passer quelqu'un.
 *
 * Ne crée aucun mécanisme d'authentification : s'appuie sur
 * `requireAuthUser`, qui sert déjà le site et la coquille Android.
 */
export async function requireGestionTitre(
  req: Request,
  songId: string,
  champs?: string
): Promise<HydratedDocument<ISong>> {
  const authUser = await requireAuthUser(req);

  const song = champs ? await Song.findById(songId).select(champs) : await Song.findById(songId);
  if (!song) throw new ApiError("Son introuvable.", 404);

  // Garde-fou : `artist` est requis en base, mais un document créé avant
  // cette contrainte plantait ici en 500 opaque au lieu de le dire.
  if (!song.artist) {
    throw new ApiError("Ce son n'a pas d'artiste associé et ne peut pas être modifié en l'état.", 500);
  }

  if (authUser.role === "admin") return song;

  const ownerArtist = await Artist.findOne({ user: authUser.id }).select("_id");
  if (!ownerArtist || !song.artist.equals(ownerArtist._id)) {
    throw new ApiError("Tu ne peux modifier que tes propres sons.", 403);
  }
  return song;
}

/**
 * La même règle pour une lecture, sans lever d'erreur : le visiteur gère-t-il
 * l'œuvre de cet artiste (titre, album) ? Décide de ce qu'une réponse montre :
 * un brouillon, un titre refusé ou planifié ne se voit que de son artiste et
 * de l'administration.
 *
 * `artiste` : identifiant, ou artiste peuplé.
 */
export async function gereArtiste(req: Request, artiste: unknown): Promise<boolean> {
  const authUser = await getAuthUser(req);
  if (!authUser) return false;
  if (authUser.role === "admin") return true;
  const id = artiste && typeof artiste === "object" && "_id" in artiste ? (artiste as { _id: unknown })._id : artiste;
  if (!id) return false;
  const sien = await Artist.findOne({ user: authUser.id }).select("_id").lean();
  return Boolean(sien && String(sien._id) === String(id));
}
