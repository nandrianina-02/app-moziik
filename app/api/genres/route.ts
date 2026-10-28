import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { withApiErrors } from "@/lib/apiError";
import { universDeLaRequete } from "@/lib/universServer";
import { getGenreTiles } from "@/lib/homeContentEngine";

/**
 * Les genres de l'univers servi, du plus fourni au moins fourni, avec leur
 * nombre de titres publiés : la grille « Parcourir tout » de la recherche.
 * « Autre » et les titres sans genre n'y figurent pas : ce n'est pas une
 * porte d'entrée.
 */
export const GET = withApiErrors(async (req: Request) => {
  await connectDB();
  const univers = await universDeLaRequete(req);
  const genres = (await getGenreTiles(60, univers)).filter((g) => g.genre && g.genre !== "Autre");
  return NextResponse.json({ genres }, { headers: { "Cache-Control": "private, max-age=600" } });
});
