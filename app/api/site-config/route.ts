import { NextResponse } from "next/server";
import { withApiErrors } from "@/lib/apiError";
import { configPublique } from "@/lib/configPublique";

// Sans ça, cette route (qui ne lit ni cookies ni headers) est traitée
// comme statique par Next.js et figée au build : les modifications de
// l'admin (ex. changement de logo) en base ne seraient jamais reflétées.
export const dynamic = "force-dynamic";

export const GET = withApiErrors(async () => {
  return NextResponse.json(await configPublique(), {
    headers: {
      // Identique pour tous les visiteurs, et demandée après chaque
      // modification : le réseau de Vercel la garde une minute, et la sert
      // encore cinq pendant qu'il la rafraîchit.
      "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
    },
  });
});
