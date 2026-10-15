"use client";

import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";

/**
 * Réclame le lot de sections suivant quand le bas de la page approche.
 *
 * POURQUOI UNE ANCRE PLUTÔT QU'UN BOUTON
 *
 * Les sections d'une page d'accueil se parcourent, elles ne se consultent
 * pas : demander un clic pour continuer à faire défiler casserait le seul
 * geste que l'utilisateur est en train de faire. L'ancre est posée 600 px
 * sous le dernier bloc — le lot part donc avant que le vide ne soit
 * visible, et le défilement ne s'arrête jamais sur une page qui charge.
 *
 * L'observateur est recréé à la fin de chaque lot. C'est volontaire : une
 * tranche peut n'apporter aucune section visible (toutes vides), auquel
 * cas rien ne bouge à l'écran et aucun nouveau franchissement ne serait
 * signalé. Réobserver relance la mesure, et la chaîne se poursuit jusqu'à
 * ce qu'il y ait du contenu — ou plus rien à demander.
 *
 * Rien n'est rendu quand le serveur a tout envoyé : pas de zone morte en
 * bas de page.
 */
export function SuiteSections({
  encore,
  suite,
  charger,
}: {
  encore: boolean;
  suite: boolean;
  charger: () => void;
}) {
  const ancre = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ancre.current;
    if (!encore || !element) return;
    // Les très vieux navigateurs n'ont pas l'observateur : la page reste
    // utilisable, elle s'arrête simplement au premier lot.
    if (typeof IntersectionObserver === "undefined") return;

    const observateur = new IntersectionObserver(
      (entrees) => {
        if (entrees.some((e) => e.isIntersecting)) charger();
      },
      { rootMargin: "600px 0px" }
    );
    observateur.observe(element);
    return () => observateur.disconnect();
  }, [encore, suite, charger]);

  if (!encore) return null;

  return (
    <div ref={ancre} className="flex justify-center py-6" aria-live="polite">
      {suite && (
        <span className="flex items-center gap-2 text-xs text-ink-muted">
          <Loader2 size={14} className="animate-spin" />
          Chargement de la suite
        </span>
      )}
    </div>
  );
}
