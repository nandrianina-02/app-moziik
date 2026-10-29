import { NextResponse } from "next/server";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { getAuthUser } from "@/lib/mobileAuth";
import { universDeLaRequete } from "@/lib/universServer";
import { selectionDe } from "@/lib/selections";

/** Une sélection (« mix-1 », « decouvertes », « radar ») et ses titres publiés, dans leur ordre. */
export const GET = withApiErrors(async (req: Request, { params }: { params: { cle: string } }) => {
  if (!/^(mix-[1-6]|decouvertes|radar)$/.test(params.cle)) throw new ApiError("Sélection inconnue.", 404);
  const compte = await getAuthUser(req);
  const univers = await universDeLaRequete(req, { compte: compte?.id });
  const resultat = await selectionDe(compte?.id ?? null, univers, params.cle);
  if (!resultat) throw new ApiError("Cette sélection n'existe pas, ou plus.", 404);
  return NextResponse.json(resultat, { headers: { "Cache-Control": "private, no-store" } });
});
