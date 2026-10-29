import { NextResponse } from "next/server";
import { withApiErrors } from "@/lib/apiError";
import { getAuthUser } from "@/lib/mobileAuth";
import { universDeLaRequete } from "@/lib/universServer";
import { resumeDe, selectionsDe } from "@/lib/selections";

/**
 * Les sélections du jour : Mix du jour, Découvertes de la semaine, Radar
 * des sorties pour un compte ; mix communs pour un visiteur. Sans les
 * titres : la page d'une sélection les demande (/api/selections/[cle]).
 */
export const GET = withApiErrors(async (req: Request) => {
  const compte = await getAuthUser(req);
  const univers = await universDeLaRequete(req, { compte: compte?.id });
  const selections = await selectionsDe(compte?.id ?? null, univers);
  return NextResponse.json(
    { selections: selections.map(resumeDe) },
    // Personnelles : jamais dans un cache partagé.
    { headers: { "Cache-Control": "private, no-store" } }
  );
});
