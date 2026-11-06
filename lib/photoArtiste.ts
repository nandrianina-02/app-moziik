import { Types } from "mongoose";
import Artist from "@/models/Artist";

/**
 * Un artiste sans photo prend la pochette de son titre ou de son album.
 *
 * Sans photo, son profil, les classements et les listes d'artistes
 * montraient une image barrée, qu'on prend pour une panne. Une pochette
 * porte souvent son portrait : c'est la meilleure image disponible, en
 * attendant la sienne.
 *
 * La mise à jour est conditionnelle, en une seule requête : seul un artiste
 * sans photo est touché, jamais une photo choisie par lui ou par un admin.
 * La photo ainsi posée est marquée `photoAuto` : elle sera remplacée sans
 * état d'âme par la première vraie photo.
 */
export async function photoDepuisPochette(artistId: Types.ObjectId | string, pochette: string | null | undefined): Promise<void> {
  if (!pochette) return;
  await Artist.updateOne(
    { _id: artistId, $or: [{ coverUrl: { $exists: false } }, { coverUrl: null }, { coverUrl: "" }] },
    { $set: { coverUrl: pochette, photoAuto: true } },
  );
}
