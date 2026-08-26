import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Artist from "@/models/Artist";
import { withApiErrors } from "@/lib/apiError";
import { escapeRegex } from "@/lib/regex";

export const GET = withApiErrors(async (req: Request) => {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search");

  await connectDB();
  // Échappement obligatoire : la saisie passe telle quelle dans un $regex.
  // Un nom contenant une parenthèse — « Ceis (Officiel) » — produisait une
  // expression invalide et faisait échouer la requête au lieu de ne rien
  // trouver.
  const query = search ? { stageName: { $regex: escapeRegex(search), $options: "i" } } : {};
  const artists = await Artist.find(query).select("stageName verified coverUrl").limit(20);

  return NextResponse.json({ artists });
});
