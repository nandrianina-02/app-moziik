import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import Song from "@/models/Song";
import Artist from "@/models/Artist";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { requireAuthUser } from "@/lib/mobileAuth";

/**
 * « Ce titre est-il déjà au catalogue de cet artiste ? »
 *
 * L'import groupé posait déjà la question pour tout un lot de fichiers
 * (app/api/admin/import/inspect), mais la publication d'un seul son n'avait
 * rien : republier deux fois le même morceau ne déclenchait aucun
 * avertissement et le doublon n'était découvert qu'une fois en ligne.
 *
 * La recherche est volontairement bornée au catalogue de l'artiste
 * concerné. Un artiste n'a pas à découvrir, en tapant un titre, ce que les
 * autres ont publié — et deux artistes ont parfaitement le droit de sortir
 * un morceau du même nom. C'est aussi pourquoi cette route est distincte de
 * celle de l'import : celle-ci est ouverte aux artistes, et ne peut rien
 * révéler d'autre que leur propre catalogue.
 *
 * Même collation que l'import groupé : insensible à la casse, sensible aux
 * accents. « HIALAO » retrouve « Hialao », mais « Mamela » et « Maméla »
 * restent deux morceaux distincts — le bon arbitrage pour un catalogue
 * malgache et francophone.
 */
const COLLATION = { locale: "fr", strength: 2 as const };

export const GET = withApiErrors(async (req: Request) => {
  const authUser = await requireAuthUser(req);
  if (authUser.role !== "artist" && authUser.role !== "admin") {
    throw new ApiError("Seuls les artistes peuvent consulter leur catalogue.", 403);
  }

  const { searchParams } = new URL(req.url);
  const title = (searchParams.get("title") ?? "").trim();
  const artistId = searchParams.get("artistId");
  /** Titre en cours de modification : il ne doit pas se signaler lui-même. */
  const exclude = searchParams.get("exclude");

  if (!title) return NextResponse.json({ doublon: null });

  await connectDB();

  let artistObjectId: mongoose.Types.ObjectId;
  if (authUser.role === "admin") {
    // L'admin publie pour autrui : tant qu'aucun artiste n'est désigné, il
    // n'existe aucun catalogue où chercher. Ce n'est pas une erreur, juste
    // une question sans objet.
    if (!artistId || !mongoose.Types.ObjectId.isValid(artistId)) {
      return NextResponse.json({ doublon: null });
    }
    artistObjectId = new mongoose.Types.ObjectId(artistId);
  } else {
    const profil = await Artist.findOne({ user: authUser.id }).select("_id");
    if (!profil) return NextResponse.json({ doublon: null });
    artistObjectId = profil._id as mongoose.Types.ObjectId;
  }

  const query: Record<string, unknown> = { title, artist: artistObjectId };
  if (exclude && mongoose.Types.ObjectId.isValid(exclude)) query._id = { $ne: exclude };

  // Tous les statuts, brouillons compris : reprendre une publication
  // abandonnée en brouillon est précisément l'erreur qu'on veut éviter.
  const existant = await Song.findOne(query)
    .collation(COLLATION)
    .select("title status releaseDate coverUrl createdAt")
    .sort({ createdAt: -1 });

  return NextResponse.json({
    doublon: existant
      ? {
          _id: String(existant._id),
          title: existant.title,
          status: existant.status,
          releaseDate: existant.releaseDate,
          coverUrl: existant.coverUrl,
        }
      : null,
  });
});
