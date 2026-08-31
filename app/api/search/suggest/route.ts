import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { withApiErrors } from "@/lib/apiError";
import { suggestionsRapides } from "@/lib/search";
import { universDeLaRequete } from "@/lib/universServer";

/**
 * Suggestions instantanées : GET /api/search/suggest?q=…
 *
 * Appelée à chaque pause de frappe (300 ms côté interface). Elle ne
 * touche que quatre collections et ne calcule aucune relation — le
 * contraire de /api/search, qui elle répond à une recherche validée.
 */
export const GET = withApiErrors(async (req: Request) => {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim().slice(0, 60) ?? "";
  const limit = Math.min(12, Math.max(1, Number(searchParams.get("limit")) || 8));

  if (q.length < 2) return NextResponse.json({ suggestions: [] });

  await connectDB();
  const suggestions = await suggestionsRapides(q, limit, await universDeLaRequete(req));
  return NextResponse.json({ suggestions });
});
