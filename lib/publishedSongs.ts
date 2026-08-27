import mongoose from "mongoose";
import Song from "@/models/Song";
import { connectDB } from "@/lib/db";

/**
 * Filtre une liste d'identifiants sur les morceaux réellement publiés.
 *
 * Dans son propre fichier, et non dans lib/ai/playlistBuilder.ts d'où
 * l'usage vient : /api/playlists s'en sert aussi, et l'importer de là
 * embarquerait le SDK du fournisseur d'IA dans le paquet d'une route qui
 * n'appelle aucune IA.
 *
 * Les identifiants mal formés sont écartés avant la requête : passés tels
 * quels à MongoDB, ils lèveraient une CastError sur tout le lot.
 */
export async function idsPublies(ids: string[]): Promise<string[]> {
  const valides = ids.filter((id) => mongoose.Types.ObjectId.isValid(id));
  if (valides.length === 0) return [];

  await connectDB();
  const trouves = await Song.find({ _id: { $in: valides }, status: "published" }).select("_id").lean();
  const connus = new Set(trouves.map((s) => String(s._id)));

  // L'ordre demandé est conservé : c'est l'ordre d'écoute voulu.
  return valides.filter((id) => connus.has(id));
}
