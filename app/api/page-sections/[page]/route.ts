import { NextResponse } from "next/server";
import { withApiErrors } from "@/lib/apiError";
import { getPageSectionsData } from "@/lib/homeContentEngine";
import { getAuthUser } from "@/lib/mobileAuth";
import { universDeLaRequete } from "@/lib/universServer";
import { parseSectionPage } from "@/lib/sectionPage";

/**
 * Payload complet en une réponse. Repli des clients qui ne peuvent pas
 * lire un flux (application mobile, navigateur sans ReadableStream,
 * intermédiaire réseau qui tamponne) — voir la route /stream voisine.
 */
export const GET = withApiErrors(async (req: Request, ctx: { params: { page: string } }) => {
  const page = parseSectionPage(ctx.params.page);
  const authUser = await getAuthUser(req);
  const univers = await universDeLaRequete(req, { compte: authUser?.id });
  const data = await getPageSectionsData(page, authUser ? { id: authUser.id, role: authUser.role } : null, univers);

  return NextResponse.json(data);
});
