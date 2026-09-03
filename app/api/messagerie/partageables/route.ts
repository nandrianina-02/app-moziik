import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Song from "@/models/Song";
import Album from "@/models/Album";
import Playlist from "@/models/Playlist";
import Artist from "@/models/Artist";
import Event from "@/models/Event";
import { withApiErrors } from "@/lib/apiError";
import { requireAuthUser } from "@/lib/mobileAuth";
import { escapeRegex } from "@/lib/regex";
import { estPodcast } from "@/lib/albums";
import { STATIONS, cheminStation } from "@/lib/radios";
import { universDeLaRequete } from "@/lib/universServer";
import type { ContenuPartage, TypePartage } from "@/lib/messagerie";

/**
 * Ce qu'on peut joindre à un message.
 *
 * Une seule route pour les sept familles, parce que le sélecteur les
 * présente ensemble : une personne qui veut envoyer « Mandigny » ne sait
 * pas, en tapant, si c'est un album ou un titre, et devoir choisir
 * l'onglet avant de chercher est exactement le genre de détour qui fait
 * abandonner le partage.
 *
 * Les fiches renvoyées ont la forme de celles qui seront enregistrées
 * dans le message, mais elles ne font pas foi : c'est la route d'envoi
 * qui les relit en base avant d'écrire (lib/messagerieServer.ts). Ici,
 * elles ne servent qu'à l'aperçu.
 *
 * L'univers actif filtre les résultats, comme partout ailleurs : quelqu'un
 * qui écoute le répertoire évangélique ne cherche pas un titre de club, et
 * l'inverse est tout aussi vrai.
 */

const PAR_FAMILLE = 8;

/**
 * Les documents d'un schéma antérieur n'ont pas de titre lisible par le
 * code d'aujourd'hui (leur champ s'appelle `titre`, pas `title`). Ils
 * n'apparaissent donc pas dans le sélecteur : proposer une ligne vide
 * qu'on ne peut pas identifier ne rend service à personne, et la route
 * d'envoi les refuserait de toute façon.
 */
const nomme = { $exists: true, $nin: ["", null] };

// Une recherche fait le même travail au passage : une expression
// régulière ne correspond jamais à un champ absent. C'est donc l'un ou
// l'autre, jamais les deux — les écrire côte à côte donnerait l'illusion
// qu'ils s'ajoutent, alors que le second écraserait le premier.

type Brut = Record<string, unknown>;
const texte = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);

export const GET = withApiErrors(async (req: Request) => {
  await requireAuthUser(req);
  await connectDB();

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const familleDemandee = searchParams.get("type") as TypePartage | null;
  const univers = await universDeLaRequete(req);

  const motif = q ? new RegExp(escapeRegex(q), "i") : null;
  const veut = (t: TypePartage) => !familleDemandee || familleDemandee === t;

  const resultats: ContenuPartage[] = [];

  if (veut("song")) {
    const titres = (await Song.find({
      status: "published",
      univers,
      title: motif ?? nomme,
    })
      .select("title coverUrl artist")
      .populate("artist", "stageName")
      .sort(motif ? { playsCount: -1 } : { createdAt: -1 })
      .limit(PAR_FAMILLE)
      .lean()) as unknown as Brut[];

    for (const s of titres) {
      const artiste = s.artist as Brut | null;
      resultats.push({
        type: "song",
        refId: String(s._id),
        titre: String(s.title ?? ""),
        sousTitre: texte(artiste?.stageName),
        imageUrl: texte(s.coverUrl),
        chemin: `/son/${String(s._id)}`,
      });
    }
  }

  if (veut("album") || veut("podcast")) {
    const albums = (await Album.find({
      univers,
      title: motif ?? nomme,
    })
      .select("title coverUrl type artist songs")
      .populate("artist", "stageName")
      .sort({ releaseDate: -1 })
      .limit(PAR_FAMILLE * 2)
      .lean()) as unknown as Brut[];

    for (const a of albums) {
      const type: TypePartage = estPodcast(texte(a.type)) ? "podcast" : "album";
      if (!veut(type)) continue;
      const artiste = a.artist as Brut | null;
      const pistes = Array.isArray(a.songs) ? a.songs.length : 0;
      resultats.push({
        type,
        refId: String(a._id),
        titre: String(a.title ?? ""),
        sousTitre: [texte(artiste?.stageName), pistes ? `${pistes} piste${pistes > 1 ? "s" : ""}` : null]
          .filter(Boolean)
          .join(" · "),
        imageUrl: texte(a.coverUrl),
        chemin: `/album/${String(a._id)}`,
      });
    }
  }

  if (veut("playlist")) {
    // Publiques uniquement : envoyer une playlist privée offrirait un lien
    // que le destinataire ne pourrait pas ouvrir.
    const listes = (await Playlist.find({
      isPublic: true,
      title: motif ?? nomme,
    })
      .select("title coverUrl songs")
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(PAR_FAMILLE)
      .lean()) as unknown as Brut[];

    for (const p of listes) {
      const pistes = Array.isArray(p.songs) ? p.songs.length : 0;
      resultats.push({
        type: "playlist",
        refId: String(p._id),
        titre: String(p.title ?? ""),
        sousTitre: `${pistes} titre${pistes > 1 ? "s" : ""}`,
        imageUrl: texte(p.coverUrl),
        chemin: `/playlist/${String(p._id)}`,
      });
    }
  }

  if (veut("artist")) {
    const artistes = (await Artist.find({
      univers,
      stageName: motif ?? nomme,
    })
      .select("stageName coverUrl genres")
      .sort({ totalPlays: -1 })
      .limit(PAR_FAMILLE)
      .lean()) as unknown as Brut[];

    for (const a of artistes) {
      const genres = Array.isArray(a.genres) ? (a.genres as string[]) : [];
      resultats.push({
        type: "artist",
        refId: String(a._id),
        titre: String(a.stageName ?? ""),
        sousTitre: genres.slice(0, 2).join(" · ") || undefined,
        imageUrl: texte(a.coverUrl),
        chemin: `/artiste/${String(a._id)}`,
      });
    }
  }

  if (veut("event")) {
    const evenements = (await Event.find({
      status: "published",
      title: motif ?? nomme,
    })
      .select("title coverUrl date location")
      .sort({ date: 1 })
      .limit(PAR_FAMILLE)
      .lean()) as unknown as Brut[];

    for (const e of evenements) {
      const quand = e.date
        ? new Date(String(e.date)).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })
        : null;
      resultats.push({
        type: "event",
        refId: String(e._id),
        titre: String(e.title ?? ""),
        sousTitre: [quand, texte(e.location)].filter(Boolean).join(" · ") || undefined,
        imageUrl: texte(e.coverUrl),
        chemin: `/evenements/${String(e._id)}`,
      });
    }
  }

  if (veut("radio")) {
    const stations = motif ? STATIONS.filter((s) => motif.test(s.label)) : STATIONS;
    for (const s of stations.slice(0, PAR_FAMILLE)) {
      resultats.push({
        type: "radio",
        refId: s.cle,
        titre: s.label,
        sousTitre: s.description,
        chemin: cheminStation(s.cle),
      });
    }
  }

  return NextResponse.json({ resultats });
});
