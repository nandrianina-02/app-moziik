"use client";

import { useUnivers } from "@/context/UniversProvider";
import { UNIVERS, UNIVERS_INFO } from "@/lib/univers";

/**
 * La bascule entre les deux univers musicaux.
 *
 * Un interrupteur à deux positions, toujours visible, plutôt qu'un
 * réglage enfoui dans les préférences : c'est le choix qui décide de tout
 * ce que la page affiche, et quelqu'un doit pouvoir passer du répertoire
 * général au répertoire de louange en une seconde, un dimanche matin.
 *
 * Les deux libellés sont écrits en toutes lettres, jamais réduits à une
 * icône. « Général » et « Évangélique » ne se devinent pas, et un
 * pictogramme religieux poserait le second comme une option particulière
 * du premier — alors que les deux sont à égalité.
 */
export function UniversToggle({ compact = false }: { compact?: boolean }) {
  const { univers, setUnivers, pret } = useUnivers();

  return (
    <div
      role="radiogroup"
      aria-label="Univers musical"
      className="flex shrink-0 items-center rounded-full border border-border p-0.5"
    >
      {UNIVERS.map((u) => {
        const actif = u === univers;
        return (
          <button
            key={u}
            type="button"
            role="radio"
            aria-checked={actif}
            // Tant que le choix réel n'est pas connu (cookie et compte non
            // lus), cliquer figerait une valeur qui n'est peut-être pas
            // celle de l'auditeur.
            disabled={!pret}
            onClick={() => setUnivers(u)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              actif ? "bg-accent text-base" : "text-ink-muted hover:text-ink"
            } ${!pret ? "opacity-60" : ""}`}
          >
            {compact ? UNIVERS_INFO[u].court : UNIVERS_INFO[u].label}
          </button>
        );
      })}
    </div>
  );
}
