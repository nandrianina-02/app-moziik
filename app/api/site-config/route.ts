import { NextResponse } from "next/server";
import { getSiteConfig } from "@/lib/siteConfig";
import { withApiErrors } from "@/lib/apiError";
import { liensSociauxUtilisables } from "@/lib/socialPlatforms";
import { fonctionnalitesIADisponibles } from "@/lib/ai/client";
import { normaliserTheme } from "@/lib/theme";

// Sans ça, cette route (qui ne lit ni cookies ni headers) est traitée
// comme statique par Next.js et figée au build : les modifications de
// l'admin (ex. changement de logo) en base ne seraient jamais reflétées.
export const dynamic = "force-dynamic";

export const GET = withApiErrors(async () => {
  const config = await getSiteConfig();
  // Ce que l'IA peut servir maintenant, pour que les pages n'affichent pas
  // un bouton qui repondrait par une erreur. Aucun secret n'y transite :
  // c'est une liste d'identifiants de fonctionnalites.
  const aiFeatures = await fonctionnalitesIADisponibles();
  return NextResponse.json(
    {
      aiFeatures,
      siteName: config.siteName,
      tagline: config.tagline,
      logoUrl: config.logoUrl,
      supportEmail: config.supportEmail,
      copyrightText: config.copyrightText,
      plans: config.plans,
      genres: config.genres,
      // Le thème par défaut du site : c'est lui que voit tout visiteur qui
      // n'a rien personnalisé, y compris déconnecté.
      theme: normaliserTheme(config.theme),
      legalEntityName: config.legalEntityName,
      legalCapital: config.legalCapital,
      legalRcsCity: config.legalRcsCity,
      legalRcsNumber: config.legalRcsNumber,
      legalAddress: config.legalAddress,
      legalWebsite: config.legalWebsite,
      legalUpdatedAt: config.legalUpdatedAt,
      // Nettoyes ici et pas seulement a la saisie : la base peut
      // contenir des liens ecrits avant que le schema ne filtre.
      socialLinks: liensSociauxUtilisables(config.socialLinks),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
});
