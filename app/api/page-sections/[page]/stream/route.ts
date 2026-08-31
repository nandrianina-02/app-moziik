import { withApiErrors } from "@/lib/apiError";
import { streamPageSections } from "@/lib/sectionStream";
import { getAuthUser } from "@/lib/mobileAuth";
import { universDeLaRequete } from "@/lib/universServer";
import { parseSectionPage } from "@/lib/sectionPage";

/**
 * Sections éditoriales des pages autres que l'accueil (recherche,
 * découvrir, radio, classements, bibliothèque, évènements, pages détail),
 * diffusées au fil de l'eau comme celles de l'accueil.
 *
 * L'accueil garde son propre point d'entrée : il comptabilise ses vues et
 * expose une bannière, deux choses qui ne concernent que lui.
 */
export const GET = withApiErrors(async (req: Request, ctx: { params: { page: string } }) => {
  const page = parseSectionPage(ctx.params.page);
  const authUser = await getAuthUser(req);
  const univers = await universDeLaRequete(req, { compte: authUser?.id });
  return streamPageSections(page, authUser ? { id: authUser.id, role: authUser.role } : null, univers);
});
