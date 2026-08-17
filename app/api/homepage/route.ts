import { NextResponse } from "next/server";
import { withApiErrors } from "@/lib/apiError";
import { getHomepageData } from "@/lib/homeContentEngine";
import { recordHomepageView } from "@/lib/homepageStats";
import { getAuthUser } from "@/lib/mobileAuth";

/**
 * Payload complet en une réponse. Conservé pour les clients qui ne peuvent
 * pas lire un flux (application mobile, prérendu, repli du navigateur) :
 * l'accueil web consomme /api/homepage/stream, qui affiche chaque section
 * dès qu'elle est prête au lieu d'attendre la plus lente.
 */
export const GET = withApiErrors(async (req: Request) => {
  const authUser = await getAuthUser(req);
  const data = await getHomepageData(authUser ? { id: authUser.id, role: authUser.role } : null);

  recordHomepageView().catch(() => {});

  return NextResponse.json(data);
});
