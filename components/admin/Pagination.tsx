"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Pagination des tables d'administration.
 *
 * Les numéros affichés se limitent aux extrémités et au voisinage
 * immédiat de la page courante : sur treize pages, aligner les treize
 * boutons déborde de la ligne sur un écran étroit.
 */
export function Pagination({
  page,
  pages,
  onChange,
}: {
  page: number;
  pages: number;
  onChange: (page: number) => void;
}) {
  if (pages <= 1) return null;

  const numeros: (number | "…")[] = [];
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - page) <= 1) numeros.push(i);
    else if (numeros[numeros.length - 1] !== "…") numeros.push("…");
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, page - 1))}
        disabled={page === 1}
        aria-label="Page précédente"
        className="grid h-8 w-8 place-items-center rounded-lg border border-border text-ink-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-40"
      >
        <ChevronLeft size={15} />
      </button>

      {numeros.map((n, i) =>
        n === "…" ? (
          <span key={`e${i}`} className="px-1 text-xs text-ink-muted">
            …
          </span>
        ) : (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-current={n === page ? "page" : undefined}
            className={`h-8 min-w-8 rounded-lg border px-2 text-xs font-medium transition-colors ${
              n === page ? "border-accent text-accent" : "border-border text-ink-muted hover:text-ink"
            }`}
          >
            {n}
          </button>
        )
      )}

      <button
        type="button"
        onClick={() => onChange(Math.min(pages, page + 1))}
        disabled={page === pages}
        aria-label="Page suivante"
        className="grid h-8 w-8 place-items-center rounded-lg border border-border text-ink-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-40"
      >
        <ChevronRight size={15} />
      </button>
    </div>
  );
}

/** Variation de pourcentage sur un mois, en vert ou en rouge. */
export function Tendance({ valeur, suffixe }: { valeur: number; suffixe: string }) {
  if (valeur === 0) return <span className="text-ink-muted">stable {suffixe}</span>;
  const positif = valeur > 0;
  return (
    <span className={positif ? "text-verified" : "text-danger"}>
      {positif ? "+" : ""}
      {valeur} % {suffixe}
    </span>
  );
}
