import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import Doublon from "@/models/Doublon";
import Song from "@/models/Song";
import Album from "@/models/Album";
import Playlist from "@/models/Playlist";
import User from "@/models/User";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { requireAdmin } from "@/lib/requireAdmin";
import { parseOrThrow } from "@/lib/validation";
import { oublierSectionsPubliees } from "@/lib/cacheSections";

/**
 * Les doublons du catalogue, pour l'administration.
 *
 * Les paires sont proposées par l'analyse des empreintes sonores (même
 * fichier importé deux fois, parfois sous un autre titre ou un autre
 * artiste) ; rien n'est écarté sans passer par ici.
 *
 * Écarter un doublon ne le supprime pas : il passe en « rejected », hors de
 * toute lecture publique (CDC 5.2), avec `doublonDe` pointant vers le titre
 * gardé. Les playlists et les titres aimés qui le contenaient reçoivent le
 * titre gardé à sa place, et ses écoutes s'ajoutent à celles du titre gardé :
 * c'était le même morceau.
 *
 * GET   ?page=
 * PATCH { id, garder } écarte l'autre titre de la paire ; { id, distincts: true }
 *       classe la paire comme deux morceaux différents.
 */

const PAR_PAGE = 20;
const CHAMPS = "title coverUrl duration playsCount likesCount status createdAt releaseDate album artist";
const identifiant = z.string().regex(/^[a-f0-9]{24}$/);

const corpsSchema = z
  .object({
    id: identifiant,
    garder: identifiant.optional(),
    distincts: z.literal(true).optional(),
  })
  .refine((v) => (v.garder !== undefined) !== (v.distincts === true), { message: "Un seul choix : garder ou distincts." });

export const GET = withApiErrors(async (req: Request) => {
  await requireAdmin(req);
  await connectDB();
  const page = Math.max(1, Number(new URL(req.url).searchParams.get("page")) || 1);

  const [paires, total, traitees] = await Promise.all([
    Doublon.find({ statut: "a-traiter" })
      .sort({ similarite: -1, createdAt: 1 })
      .skip((page - 1) * PAR_PAGE)
      .limit(PAR_PAGE + 1)
      .populate({ path: "a", select: CHAMPS, populate: [{ path: "artist", select: "stageName" }, { path: "album", select: "title" }] })
      .populate({ path: "b", select: CHAMPS, populate: [{ path: "artist", select: "stageName" }, { path: "album", select: "title" }] })
      .lean(),
    Doublon.countDocuments({ statut: "a-traiter" }),
    Doublon.countDocuments({ statut: { $ne: "a-traiter" } }),
  ]);

  return NextResponse.json(
    { paires: paires.slice(0, PAR_PAGE), suite: paires.length > PAR_PAGE, page, compteurs: { aTraiter: total, traitees } },
    { headers: { "Cache-Control": "no-store" } }
  );
});

export const PATCH = withApiErrors(async (req: Request) => {
  await requireAdmin(req);
  await connectDB();
  const corps = parseOrThrow(corpsSchema, await req.json());

  const paire = await Doublon.findById(corps.id);
  if (!paire) throw new ApiError("Paire introuvable.", 404);
  if (paire.statut !== "a-traiter") throw new ApiError("Cette paire a déjà été traitée.", 409);

  if (corps.distincts) {
    paire.statut = "distincts";
    paire.traiteLe = new Date();
    await paire.save();
    return NextResponse.json({ ok: true });
  }

  const garde = String(corps.garder);
  if (garde !== String(paire.a) && garde !== String(paire.b)) throw new ApiError("Ce titre n'appartient pas à la paire.", 400);
  const ecarte = garde === String(paire.a) ? paire.b : paire.a;

  const titreEcarte = await Song.findById(ecarte).select("playsCount status album");
  if (!titreEcarte) throw new ApiError("Titre introuvable.", 404);

  await Song.updateOne({ _id: ecarte }, { $set: { status: "rejected", doublonDe: garde } });
  if (titreEcarte.status === "published" && titreEcarte.playsCount > 0) {
    await Song.updateOne({ _id: garde }, { $inc: { playsCount: titreEcarte.playsCount } });
  }

  // Le titre gardé prend la place de l'écarté là où il n'y était pas déjà ;
  // là où les deux étaient, l'écarté est simplement retiré.
  await Playlist.updateMany({ songs: { $all: [ecarte, garde] } }, { $pull: { songs: ecarte } });
  await Playlist.updateMany({ songs: ecarte }, { $set: { "songs.$": garde } });
  await User.updateMany({ likedSongs: { $all: [ecarte, garde] } }, { $pull: { likedSongs: ecarte } });
  await User.updateMany({ likedSongs: ecarte }, { $set: { "likedSongs.$": garde } });
  if (titreEcarte.album) await Album.updateOne({ _id: titreEcarte.album }, { $pull: { songs: ecarte } });

  const maintenant = new Date();
  paire.statut = "resolu";
  paire.garde = paire.a.equals(garde) ? paire.a : paire.b;
  paire.traiteLe = maintenant;
  await paire.save();
  // Les autres paires du titre écarté n'ont plus d'objet.
  await Doublon.updateMany(
    { statut: "a-traiter", $or: [{ a: ecarte }, { b: ecarte }] },
    { $set: { statut: "resolu", garde, traiteLe: maintenant } }
  );
  oublierSectionsPubliees();
  return NextResponse.json({ ok: true });
});
