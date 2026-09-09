import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import Song from "@/models/Song";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { parseOrThrow } from "@/lib/validation";
import { requireGestionTitre } from "@/lib/songAccess";
import { structurerParoles, versLRC, type LigneEditable } from "@/lib/lyrics";

/**
 * Les paroles d'un titre, lues et écrites sans passer par le titre entier.
 *
 * `PATCH /api/songs/[id]` sait déjà écrire le champ `lyrics`, et continue
 * de le faire : le formulaire d'édition envoie le morceau complet. Mais
 * l'éditeur de synchronisation enregistre trois cents fois pendant qu'on
 * cale un refrain — lui faire renvoyer la pochette, les crédits et la
 * date de sortie à chaque fois n'aurait aucun sens, et la moindre
 * divergence entre deux onglets ouverts écraserait des champs qu'on n'a
 * pas touchés.
 *
 * L'accès repose sur `requireGestionTitre`, la même règle que le PATCH.
 */

/**
 * 20 000 caractères, comme `patchSongSchema.lyrics`.
 *
 * Ce n'est pas une coïncidence à maintenir mentalement : les deux routes
 * écrivent le même champ, et un plafond plus haut ici ferait passer par
 * une porte ce que l'autre refuse.
 */
const MAX = 20_000;

const ligneSchema = z.object({
  text: z.string().max(500),
  // `null` : la ligne existe mais n'est pas encore calée. L'éditeur doit
  // pouvoir enregistrer un travail à moitié fait.
  startTime: z.number().min(0).max(24 * 3600).nullable(),
});

const corpsSchema = z
  .object({
    /** Texte libre ou LRC complet, enregistré tel quel. */
    raw: z.string().max(MAX).optional(),
    /** Lignes structurées, réécrites en LRC avant enregistrement. */
    lines: z.array(ligneSchema).max(2000).optional(),
    /** Balises d'en-tête à conserver (`by`, `offset`…). */
    meta: z.record(z.string().max(200)).optional(),
  })
  .refine((v) => v.raw !== undefined || v.lines !== undefined, {
    message: "Fournir soit `raw`, soit `lines`.",
  });

export const GET = withApiErrors(async (_req: Request, { params }: { params: { id: string } }) => {
  await connectDB();
  const song = await Song.findById(params.id).select("lyrics status").lean();
  if (!song) throw new ApiError("Son introuvable.", 404);

  // Pas de contrôle d'accès en lecture : les paroles d'un titre publié
  // sont publiques, exactement comme sur sa page. Un brouillon n'a pas
  // d'adresse publique — le seul moyen d'arriver ici est d'en connaître
  // l'identifiant, ce que la page d'édition a déjà.
  return NextResponse.json({ lyrics: structurerParoles(song.lyrics), raw: song.lyrics ?? "" });
});

export const PUT = withApiErrors(async (req: Request, { params }: { params: { id: string } }) => {
  await connectDB();
  const song = await requireGestionTitre(req, params.id, "lyrics artist");
  const corps = parseOrThrow(corpsSchema, await req.json());

  const brut =
    corps.raw !== undefined
      ? corps.raw
      : versLRC(
          (corps.lines ?? []).map<LigneEditable>((l) => ({ temps: l.startTime, texte: l.text })),
          corps.meta
        );

  // Le plafond se vérifie sur ce qu'on écrit, pas sur ce qu'on reçoit :
  // deux mille lignes valides séparément peuvent dépasser une fois
  // réécrites avec leurs horodatages.
  if (brut.length > MAX) {
    throw new ApiError(`Paroles trop longues (${brut.length} caractères, maximum ${MAX}).`, 400);
  }

  song.lyrics = brut.trim() ? brut : undefined;
  await song.save();

  return NextResponse.json({ lyrics: structurerParoles(song.lyrics), raw: song.lyrics ?? "" });
});

export const DELETE = withApiErrors(async (req: Request, { params }: { params: { id: string } }) => {
  await connectDB();
  const song = await requireGestionTitre(req, params.id, "lyrics artist");
  song.lyrics = undefined;
  await song.save();
  return NextResponse.json({ lyrics: structurerParoles(null), raw: "" });
});
