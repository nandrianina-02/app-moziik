import { NextResponse } from "next/server";
import mongoose, { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import Playlist from "@/models/Playlist";
import { ApiError, withApiErrors } from "@/lib/apiError";
import {
  parseOrThrow,
  playlistSongsSchema,
  playlistReorderSchema,
} from "@/lib/validation";
import { requireAuthUser, type AuthUser } from "@/lib/mobileAuth";

/**
 * Charge une playlist que l'utilisateur a le droit de modifier.
 * L'admin est inclus, par cohérence avec PATCH /api/playlists/[id] :
 * il peut déjà renommer une playlist, il serait incohérent qu'il ne
 * puisse pas en modifier le contenu.
 */
async function loadManagedPlaylist(id: string, user: AuthUser) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError("Identifiant de playlist invalide.");
  }
  const playlist = await Playlist.findById(id);
  if (!playlist) throw new ApiError("Playlist introuvable.", 404);
  if (playlist.owner.toString() !== user.id && user.role !== "admin") {
    throw new ApiError("Tu ne peux modifier que tes propres playlists.", 403);
  }
  return playlist;
}

/** Renvoie la playlist repeuplée : le client remplace son état d'un bloc. */
async function respondWithPopulated(playlist: { _id: unknown }) {
  const populated = await Playlist.findById(playlist._id)
    .populate({
      path: "songs",
      populate: [
        { path: "artist", select: "stageName verified" },
        // Alimente la colonne « Album » du tableau des titres : sans ce
        // peuplement, `song.album` n'est qu'un identifiant et la colonne
        // restait vide.
        { path: "album", select: "title" },
      ],
    })
    .populate("owner", "name avatarUrl");
  return NextResponse.json({ playlist: populated });
}

/** Ids demandés, dédoublonnés, en conservant l'ordre d'arrivée. */
function requestedIds(data: { songId?: string; songIds?: string[] }) {
  const ids = data.songIds?.length ? data.songIds : [data.songId as string];
  const uniques = [...new Set(ids)];
  const invalide = uniques.find((id) => !mongoose.Types.ObjectId.isValid(id));
  if (invalide) throw new ApiError("Identifiant de morceau invalide.");
  return uniques;
}

export const POST = withApiErrors(
  async (req: Request, { params }: { params: { id: string } }) => {
    const authUser = await requireAuthUser(req);
    const ids = requestedIds(parseOrThrow(playlistSongsSchema, await req.json()));

    await connectDB();
    const playlist = await loadManagedPlaylist(params.id, authUser);

    // Les doublons sont ignorés en silence plutôt que refusés : ajouter
    // un titre déjà présent n'est pas une erreur du point de vue de
    // l'utilisateur, la playlist est simplement déjà dans l'état voulu.
    const presents = new Set(playlist.songs.map((s) => s.toString()));
    const nouveaux = ids.filter((id) => !presents.has(id));
    if (nouveaux.length) {
      playlist.songs.push(...nouveaux.map((id) => new Types.ObjectId(id)));
      await playlist.save();
    }

    return respondWithPopulated(playlist);
  }
);

export const DELETE = withApiErrors(
  async (req: Request, { params }: { params: { id: string } }) => {
    const authUser = await requireAuthUser(req);
    const ids = requestedIds(parseOrThrow(playlistSongsSchema, await req.json()));

    await connectDB();
    const playlist = await loadManagedPlaylist(params.id, authUser);

    const aRetirer = new Set(ids);
    playlist.songs = playlist.songs.filter(
      (s) => !aRetirer.has(s.toString())
    ) as typeof playlist.songs;
    await playlist.save();

    return respondWithPopulated(playlist);
  }
);

/**
 * Réorganisation par glisser-déposer. Le corps porte la liste complète
 * réordonnée, pas un déplacement : c'est ce que produit naturellement
 * l'interface, et cela évite toute ambiguïté d'index.
 */
export const PUT = withApiErrors(
  async (req: Request, { params }: { params: { id: string } }) => {
    const authUser = await requireAuthUser(req);
    const { songIds } = parseOrThrow(playlistReorderSchema, await req.json());

    await connectDB();
    const playlist = await loadManagedPlaylist(params.id, authUser);

    const actuels = playlist.songs.map((s) => s.toString());
    const connus = new Set(actuels);

    // Une réorganisation ne peut que déplacer : un identifiant absent de
    // la playlist signale un client désynchronisé, on refuse.
    const intrus = songIds.find((id) => !connus.has(id));
    if (intrus) {
      throw new ApiError(
        "La playlist a été modifiée entre-temps. Recharge la page avant de réorganiser.",
        409
      );
    }

    // En revanche, la liste reçue peut légitimement être INCOMPLÈTE : la
    // page affiche `songs` peuplé, et populate omet les références vers
    // des morceaux supprimés depuis. Exiger une correspondance exacte
    // rendait toute playlist contenant une référence orpheline
    // impossible à réorganiser. Les identifiants non cités sont donc
    // conservés, ajoutés à la fin dans leur ordre d'origine — jamais
    // supprimés en silence.
    const cites = new Set(songIds);
    const conserves = actuels.filter((id) => !cites.has(id));
    playlist.songs = [...songIds, ...conserves].map(
      (id) => new Types.ObjectId(id)
    ) as typeof playlist.songs;
    await playlist.save();

    return respondWithPopulated(playlist);
  }
);
