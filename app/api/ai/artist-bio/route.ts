import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Artist from "@/models/Artist";
import Song from "@/models/Song";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { requireAuthUser } from "@/lib/mobileAuth";
import { parseOrThrow, aiArtistBioSchema } from "@/lib/validation";
import { redigerBiographie } from "@/lib/ai/artistBio";

/**
 * Brouillon de biographie pour l'artiste connecté.
 *
 * Le nom de scène, les genres et les titres viennent de la base, pas du
 * navigateur : ce sont les seuls éléments vérifiables sur lesquels le
 * texte peut s'appuyer, et les laisser au client reviendrait à permettre
 * de faire écrire la biographie de quelqu'un d'autre.
 *
 * Seules les notes viennent de l'artiste, et c'est voulu : elles sont la
 * seule source biographique, et il en est l'auteur.
 *
 * Rien n'est enregistré. Le texte revient dans le champ, où il se corrige
 * avant d'être publié.
 */
export const dynamic = "force-dynamic";

/** Assez pour situer une discographie, pas assez pour peser dans l'appel. */
const TITRES_MAX = 20;

export const POST = withApiErrors(async (req: Request) => {
  const authUser = await requireAuthUser(req);
  if (authUser.role !== "artist" && authUser.role !== "admin") {
    throw new ApiError("Réservé aux artistes.", 403);
  }

  const { notes, bio } = parseOrThrow(aiArtistBioSchema, await req.json());

  await connectDB();
  const profil = await Artist.findOne({ user: authUser.id }).select("stageName genres bio");
  if (!profil) throw new ApiError("Aucun profil artiste rattaché à ce compte.", 404);

  const titres = await Song.find({ artist: profil._id, status: "published" })
    .select("title")
    .sort({ playsCount: -1 })
    .limit(TITRES_MAX)
    .lean();

  const proposition = await redigerBiographie({
    nomDeScene: profil.stageName,
    genres: profil.genres ?? [],
    titres: titres.map((t) => t.title).filter(Boolean),
    notes,
    // Le champ en cours de saisie prime sur ce qui est enregistré : c'est
    // ce que l'artiste a sous les yeux qu'il demande à reprendre.
    bioActuelle: bio ?? profil.bio,
    compte: authUser.id,
  });

  return NextResponse.json({ proposition }, { headers: { "Cache-Control": "no-store" } });
});
