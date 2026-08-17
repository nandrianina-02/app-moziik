import { NextResponse } from "next/server";
import { withApiErrors } from "@/lib/apiError";
import { getPageSectionsData } from "@/lib/homeContentEngine";
import { getAuthUser } from "@/lib/mobileAuth";
import { parseSectionPage } from "@/lib/sectionPage";

/**
 * Payload complet en une réponse. Repli des clients qui ne peuvent pas
 * lire un flux (application mobile, navigateur sans ReadableStream,
 * intermédiaire réseau qui tamponne) — voir la route /stream voisine.
 */
export const GET = withApiErrors(async (req: Request, ctx: { params: { page: string } }) => {
  const page = parseSectionPage(ctx.params.page);
  const authUser = await getAuthUser(req);
  const data = await getPageSectionsData(page, authUser ? { id: authUser.id, role: authUser.role } : null);

  return NextResponse.json(data);
});
