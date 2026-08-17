"use client";

import { Reveal } from "@/components/layout/Reveal";
import { SectionBlock } from "@/components/home/SectionBlock";
import { HomeSectionSkeleton } from "@/components/home/HomeSectionSkeleton";
import { usePageSectionsStream } from "@/components/home/useHomepageStream";

/**
 * Sections éditoriales pilotées par l'admin, montées en bas d'une page
 * autre que l'accueil.
 *
 * Elles arrivent par le même flux progressif que l'accueil : la structure
 * apparaît en squelettes, puis chaque bloc se remplit. Placées après le
 * contenu propre de la page, elles ne retardent donc jamais ce que
 * l'utilisateur est venu chercher.
 *
 * Tant que l'admin n'a rien activé pour cette page (c'est l'état de
 * départ), le composant ne rend strictement rien : la page garde
 * exactement son apparence actuelle.
 */
export function PageSections({ page, className = "" }: { page: string; className?: string }) {
  const { slots, starting, failed } = usePageSectionsStream(page);

  // Rien tant que la liste n'est pas connue : ces blocs sont secondaires et
  // situés hors du premier écran. Rendre un conteneur vide avec sa marge
  // décalerait la page pour finalement n'afficher, le plus souvent, rien.
  if (failed || starting || slots.length === 0) return null;

  return (
    <div className={`space-y-10 ${className}`}>
      {slots.map((slot) =>
        slot.status === "ready" ? (
          <Reveal key={slot.key}>
            <SectionBlock section={{ key: slot.key, title: slot.title, data: slot.data }} sourceLabel={page} />
          </Reveal>
        ) : (
          <HomeSectionSkeleton key={slot.key} sectionKey={slot.key} title={slot.title} />
        )
      )}
    </div>
  );
}
