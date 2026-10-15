import { withApiErrors } from "@/lib/apiError";
import { fenetreDemandee, streamPageSections } from "@/lib/sectionStream";
import { recordHomepageView } from "@/lib/homepageStats";
import { getAuthUser } from "@/lib/mobileAuth";
import { universDeLaRequete } from "@/lib/universServer";
import { modeDeLaRequete } from "@/lib/modesServer";

/** Accueil diffusé section par section. Format et intention : lib/sectionStream.ts. */
export const GET = withApiErrors(async (req: Request) => {
  const authUser = await getAuthUser(req);
  const univers = await universDeLaRequete(req, { compte: authUser?.id });
  const fenetre = fenetreDemandee(req);
  const response = await streamPageSections(
    "home",
    authUser ? { id: authUser.id, role: authUser.role } : null,
    univers,
    await modeDeLaRequete(req, { compte: authUser?.id }),
    fenetre
  );

  // Une visite, pas un lot : sans ce garde-fou, faire défiler l'accueil
  // compterait autant de vues que de tranches chargées.
  if (!fenetre || fenetre.depuis === 0) recordHomepageView().catch(() => {});

  return response;
});
