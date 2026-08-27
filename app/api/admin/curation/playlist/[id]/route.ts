import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Playlist from "@/models/Playlist";
import CurationRun from "@/models/CurationRun";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { requireAdmin } from "@/lib/requireAdmin";
import { parseOrThrow, adminCurationPlaylistPatchSchema } from "@/lib/validation";

/**
 * Retoucher une proposition avant de la publier.
 *
 * Renommer, réécrire la description, retirer un titre qui ne va pas,
 * changer l'ordre, ou écarter la playlist entière. C'est la partie
 * « modifier » de la demande, et elle est volontairement limitée aux
 * playlists **encore en brouillon** : une fois publiées, elles se
 * modifient comme n'importe quelle playlist, depuis sa propre page.
 *
 * Écarter ne supprime pas. La playlist passe en `archivee` et peut être
 * réintégrée tant que l'analyse n'est pas validée — un clic de trop ne
 * doit pas coûter une sélection.
 */
export const PATCH = withApiErrors(async (req: Request, { params }: { params: { id: string } }) => {
  await requireAdmin(req);
  const modifications = parseOrThrow(adminCurationPlaylistPatchSchema, await req.json());

  await connectDB();
  const playlist = await Playlist.findById(params.id);
  if (!playlist) throw new ApiError("Playlist introuvable.", 404);
  if (!playlist.auto) {
    throw new ApiError("Cette playlist n'est pas issue de la curation.", 400);
  }

  const run = await CurationRun.findById(playlist.auto.run);
  if (!run || run.statut !== "a_valider") {
    throw new ApiError(
      "Cette analyse n'est plus en attente de validation : la playlist se modifie depuis sa page.",
      409
    );
  }

  if (modifications.title !== undefined) playlist.title = modifications.title;
  if (modifications.description !== undefined) playlist.description = modifications.description;
  if (modifications.rang !== undefined) playlist.auto.rang = modifications.rang;

  if (modifications.inclure !== undefined) {
    playlist.auto.statut = modifications.inclure ? "brouillon" : "archivee";
  }

  if (modifications.retirerTitre) {
    const avant = playlist.songs.length;
    playlist.songs = playlist.songs.filter((s) => s.toString() !== modifications.retirerTitre);
    if (playlist.songs.length === avant) {
      throw new ApiError("Ce titre ne figure pas dans la playlist.", 404);
    }
  }

  await playlist.save();

  return NextResponse.json({
    _id: playlist._id.toString(),
    title: playlist.title,
    description: playlist.description ?? "",
    statut: playlist.auto.statut,
    rang: playlist.auto.rang,
    titres: playlist.songs.length,
  });
});
