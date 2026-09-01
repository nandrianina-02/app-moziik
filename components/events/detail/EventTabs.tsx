"use client";

import { useEffect, useState } from "react";

/**
 * Barre d'onglets de la fiche.
 *
 * Les onglets ne masquent rien : ils font défiler jusqu'à la rubrique
 * correspondante, et se surlignent au passage. Sur une page qu'on parcourt
 * de haut en bas, cacher le programme derrière un onglet obligerait à
 * cliquer pour découvrir qu'il existe.
 */
export function EventTabs({ sections }: { sections: { id: string; label: string }[] }) {
  const [actif, setActif] = useState(sections[0]?.id);

  useEffect(() => {
    const cibles = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (cibles.length === 0) return;

    // La marge haute décale la ligne de détection sous la barre collante :
    // sans elle, la rubrique passée derrière la barre resterait « active ».
    const observateur = new IntersectionObserver(
      (entrees) => {
        const visible = entrees
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActif(visible.target.id);
      },
      { rootMargin: "-120px 0px -60% 0px", threshold: 0 }
    );

    cibles.forEach((cible) => observateur.observe(cible));
    return () => observateur.disconnect();
  }, [sections]);

  function allerA(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActif(id);
  }

  if (sections.length < 2) return null;

  return (
    <div
      // Collée sous l'en-tête de l'application, pas sous le haut de la
      // fenêtre : celui-ci est lui-même collant — 56 px en mobile, 64 en
      // bureau — et masquerait la barre d'onglets.
      className="sticky top-14 z-10 mb-8 overflow-x-auto border-b border-border bg-base/95 backdrop-blur md:top-16"
    >
      <div className="flex gap-1">
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            onClick={() => allerA(section.id)}
            aria-current={actif === section.id}
            className={`shrink-0 border-b-2 px-3 py-3.5 text-sm font-medium transition-colors ${
              actif === section.id
                ? "border-accent text-accent"
                : "border-transparent text-ink-muted hover:text-ink"
            }`}
          >
            {section.label}
          </button>
        ))}
      </div>
    </div>
  );
}
