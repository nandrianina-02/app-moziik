import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Play from "@/models/Play";
import Song from "@/models/Song";
import { withApiErrors } from "@/lib/apiError";
import { getAuthUser } from "@/lib/mobileAuth";
import { libelleMotif, type Motif } from "@/lib/taste/motifs";
import { universDeLaRequete } from "@/lib/universServer";
import { modeDeLaRequete } from "@/lib/modesServer";
import { MODES_INFO, raisonAmbiance, scoreAmbiance } from "@/lib/modes";
import type { Mode } from "@/lib/modes";

/**
 * Recommandation par contenu : on regarde les genres des sons écoutés
 * par l'utilisateur ces 30 derniers jours, on pondère par fréquence,
 * puis on propose des sons publiés dans ces genres qu'il n'a pas
 * encore écoutés. Pas de ML ici — une base solide, remplaçable plus
 * tard par un moteur de recommandation dédié si besoin.
 */
/** Sans historique, la seule raison honnête est « tout le monde l'écoute ». */
function motifsPopulaires(songs: { _id: { toString: () => string } }[]) {
  const motif: Motif = { type: "populaire" };
  return songs.map((s) => ({ songId: s._id.toString(), motif, libelle: libelleMotif(motif) }));
}

type SongLu = {
  _id: unknown;
  bpm?: number;
  genre?: string;
  tags?: string[];
  title?: string;
  duration?: number;
  explicit?: boolean;
};

/**
 * Remonte les titres qui collent au mode d'écoute, sans écarter les autres.
 *
 * Le mode INFLÉCHIT la recommandation, il ne la remplace pas : le profil
 * de goûts reste ce qui décide, et un titre que l'auditeur aime ne doit
 * pas disparaître parce qu'il fait douze battements de trop. On réordonne
 * donc une liste déjà constituée plutôt que de filtrer la requête — ce
 * qui ne coûte aucun aller-retour de plus.
 *
 * Les modes qui ne se lisent pas sur un titre — Matin, Nuit, Découverte,
 * Tendance — laissent l'ordre intact : ils se mesurent sur les écoutes,
 * ce que cette fonction n'a pas sous la main.
 */
function reordonnerSelonLeMode<T>(songs: T[], mode: Mode): T[] {
  if (MODES_INFO[mode].strategie !== "ambiance") return songs;

  const note = (song: T) => {
    const s = song as unknown as SongLu;
    return (
      scoreAmbiance(mode, {
        bpm: s.bpm,
        genre: s.genre,
        tags: s.tags,
        titre: s.title,
        duree: s.duration,
        explicite: s.explicit,
      }) ?? 0
    );
  };

  // Tri stable : à affinité égale, l'ordre d'origine — celui de la
  // popularité — est conservé.
  return songs
    .map((song, rang) => ({ song, note: note(song), rang }))
    .sort((a, b) => b.note - a.note || a.rang - b.rang)
    .map((x) => x.song);
}

export const GET = withApiErrors(async (req: Request) => {
  const authUser = await getAuthUser(req);
  await connectDB();
  const univers = await universDeLaRequete(req, { compte: authUser?.id });
  const mode = await modeDeLaRequete(req, { compte: authUser?.id });

  if (!authUser) {
    // Utilisateur anonyme : on renvoie simplement les sons les plus populaires.
    // On lit plus large que nécessaire avant de réordonner : sinon le
    // mode ne pourrait remonter que ce que la popularité a déjà retenu.
    const vivier = await Song.find({ status: "published", univers })
      .populate("artist", "stageName verified")
      .sort({ playsCount: -1 })
      .limit(40);
    const popular = reordonnerSelonLeMode(vivier, mode).slice(0, 12);
    return NextResponse.json({ songs: popular, basis: "popular", mode, motifs: motifsPopulaires(popular) });
  }

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  // Historique du seul univers courant : les deux profils de goût
  // restent étanches, comme les catalogues qu'ils décrivent.
  const recentPlays = await Play.find({ user: authUser.id, univers, playedAt: { $gte: since } })
    .populate({ path: "song", select: "genre" });

  const genreCounts = new Map<string, number>();
  const listenedSongIds = new Set<string>();
  for (const play of recentPlays) {
    const song = play.song as unknown as { _id: { toString: () => string }; genre?: string } | null;
    if (!song) continue;
    listenedSongIds.add(song._id.toString());
    if (song.genre) genreCounts.set(song.genre, (genreCounts.get(song.genre) ?? 0) + 1);
  }

  const topGenres = [...genreCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([g]) => g);

  if (topGenres.length === 0) {
    const vivier = await Song.find({ status: "published", univers })
      .populate("artist", "stageName verified")
      .sort({ playsCount: -1 })
      .limit(40);
    const popular = reordonnerSelonLeMode(vivier, mode).slice(0, 12);
    return NextResponse.json({ songs: popular, basis: "popular", mode, motifs: motifsPopulaires(popular) });
  }

  const vivier = await Song.find({
    status: "published",
    univers,
    genre: { $in: topGenres },
    _id: { $nin: [...listenedSongIds] },
  })
    .populate("artist", "stageName verified")
    .sort({ playsCount: -1 })
    .limit(40);

  const recommendations = reordonnerSelonLeMode(vivier, mode).slice(0, 12);

  // Chaque proposition dit d'où elle vient. Une recommandation qu'on ne
  // peut pas interroger se subit ; celle-ci s'explique par la mesure qui
  // l'a produite, et non par une phrase écrite après coup.
  const ambiance = MODES_INFO[mode].strategie === "ambiance";
  const motifs = recommendations.map((song) => {
    const motif: Motif = { type: "genre_habituel", genre: song.genre ?? "" };
    const base = libelleMotif(motif);
    // Quand le mode a réellement pesé, la proposition le dit : une
    // recommandation qu'on ne peut pas interroger se subit.
    const parLeMode =
      ambiance &&
      scoreAmbiance(mode, {
        bpm: song.bpm,
        genre: song.genre,
        tags: song.tags,
        titre: song.title,
        duree: song.duration,
        explicite: song.explicit,
      }) !== null;
    return {
      songId: song._id.toString(),
      motif,
      libelle: parLeMode
        ? `${base} · ${MODES_INFO[mode].label} (${raisonAmbiance(mode, { bpm: song.bpm, genre: song.genre, tags: song.tags, titre: song.title })})`
        : base,
    };
  });

  return NextResponse.json({ songs: recommendations, basis: "genres", genres: topGenres, mode, motifs });
});
