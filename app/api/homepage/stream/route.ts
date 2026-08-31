import { withApiErrors } from "@/lib/apiError";
import { streamPageSections } from "@/lib/sectionStream";
import { recordHomepageView } from "@/lib/homepageStats";
import { getAuthUser } from "@/lib/mobileAuth";
import { universDeLaRequete } from "@/lib/universServer";

/** Accueil diffusé section par section. Format et intention : lib/sectionStream.ts. */
export const GET = withApiErrors(async (req: Request) => {
  const authUser = await getAuthUser(req);
  const univers = await universDeLaRequete(req, { compte: authUser?.id });
  const response = await streamPageSections(
    "home",
    authUser ? { id: authUser.id, role: authUser.role } : null,
    univers
  );

  recordHomepageView().catch(() => {});

  return response;
});
