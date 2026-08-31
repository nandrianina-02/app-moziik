import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Song from "@/models/Song";
import { ApiError, withApiErrors } from "@/lib/apiError";

/**
 * Titres proches d'un morceau donné.
 *
 * Pas de moteur de recommandation ici : une pondération explicite sur ce
 * que la base sait réellement (artiste, featuring, genre, tags, album),
 * relevée par la popularité. Lisible, prévisible, et suffisante tant que
 * le catalogue tient dans quelques milliers de titres.
 *
 * Le tri final se fait en mémoire sur un vivier borné plutôt qu'en base :
 * exprimer cette pondération en agrégation MongoDB coûterait bien plus
 * cher à lire qu'à exécuter.
 */

const TAILLE_VIVIER = 80;
const RETOUR_MAX = 12;

export const GET = withApiErrors(async (req: Request, { params }: { params: { id: string } }) => {
  await connectDB();

  const limite = Math.min(Number(new URL(req.url).searchParams.get("limit")) || RETOUR_MAX, 30);

  const song = await Song.findById(params.id).select("artist featuring album genre tags title univers");
  if (!song) throw new ApiError("Son introuvable.", 404);

  const artistesLies = [
    song.artist,
    ...(song.featuring ?? []).map((f) => f.artist),
  ].filter(Boolean);

  const criteres: Record<string, unknown>[] = [
    { artist: { $in: artistesLies } },
    { "featuring.artist": { $in: artistesLies } },
  ];
  if (song.genre) criteres.push({ genre: song.genre });
  if (song.tags?.length) criteres.push({ tags: { $in: song.tags } });
  if (song.album) criteres.push({ album: song.album });

  // Les voisins d'un titre sont cherchés dans SON univers, pas dans celui
  // du visiteur : ouvrir un titre de louange depuis un lien partagé doit
  // proposer d'autres titres de louange, sans quoi la page « vous aimerez
  // aussi » n'aurait aucun sens.
  const vivier = await Song.find({
    status: "published",
    univers: song.univers,
    _id: { $ne: song._id },
    $or: criteres,
  })
    .populate("artist", "stageName verified coverUrl")
    .populate("album", "title type")
    .sort({ playsCount: -1 })
    .limit(TAILLE_VIVIER);

  const ecoutesMax = Math.max(1, ...vivier.map((s) => s.playsCount ?? 0));
  const idsArtistes = new Set(artistesLies.map(String));

  const notes = vivier.map((candidat) => {
    let note = 0;
    const raisons: string[] = [];

    const artisteCandidat = candidat.artist as unknown as { _id?: unknown } | null;
    if (artisteCandidat?._id && idsArtistes.has(String(artisteCandidat._id))) {
      note += 5;
      raisons.push("Même artiste");
    }
    if ((candidat.featuring ?? []).some((f) => idsArtistes.has(String(f.artist)))) {
      note += 4;
      raisons.push("Collaboration");
    }
    if (song.album && String(candidat.album ?? "") === String(song.album)) {
      note += 2.5;
      raisons.push("Même album");
    }
    if (song.genre && candidat.genre === song.genre) {
      note += 3;
      raisons.push(candidat.genre);
    }
    const tagsCommuns = (candidat.tags ?? []).filter((t) => song.tags?.includes(t));
    note += Math.min(2, tagsCommuns.length);

    // Popularité : elle départage, elle ne décide pas — d'où le plafond bas.
    note += ((candidat.playsCount ?? 0) / ecoutesMax) * 1.5;

    return { song: candidat, note, raison: raisons[0] ?? candidat.genre ?? "Proche" };
  });

  notes.sort((a, b) => b.note - a.note);

  return NextResponse.json({
    songs: notes.slice(0, limite).map((n) => ({ ...n.song.toObject(), matchReason: n.raison })),
  });
});
