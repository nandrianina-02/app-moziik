"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

/**
 * L'en-tête de l'accueil : deux onglets, et rien d'autre.
 *
 * CE QU'IL REMPLACE
 *
 * Un titre de deux lignes (« Bon retour sur Moziik » et la signature du
 * site) suivi d'un champ de recherche — champ qui faisait doublon avec
 * celui de la barre d'application, présente sur tous les écrans. Trois
 * bandeaux avant le premier contenu, sur un téléphone où la hauteur est
 * la ressource rare.
 *
 * Deux onglets disent la même chose en une ligne : où l'on est, et où
 * l'on peut aller. « Chart » mène au classement réel (/classements), pas
 * à un second flux à maintenir.
 */
export function AccueilEntete({ peutPublier }: { peutPublier: boolean }) {
  const router = useRouter();

  return (
    <header className="mb-5 flex items-center gap-3">
      <nav className="flex min-w-0 items-center gap-3" aria-label="Sections de l'accueil">
        <span
          aria-current="page"
          className="relative shrink-0 pb-1.5 font-display text-2xl text-accent md:text-3xl"
        >
          Pour toi
          <span className="absolute inset-x-0 bottom-0 h-[3px] rounded-full bg-accent" />
        </span>
        <span aria-hidden className="h-6 w-px shrink-0 bg-border" />
        <Link
          href="/classements"
          className="shrink-0 pb-1.5 font-display text-2xl text-ink-muted transition-colors hover:text-ink md:text-3xl"
        >
          Chart
        </Link>
      </nav>

      {peutPublier && (
        <button
          onClick={() => router.push("/son/nouveau")}
          // Pastille seule sur téléphone : le libellé y coûtait la moitié
          // de la place restante à côté des deux onglets.
          className="ml-auto flex shrink-0 items-center gap-1.5 rounded-full bg-accent p-2.5 text-sm font-medium text-base transition-colors hover:bg-accent-hover sm:px-4 sm:py-2"
          aria-label="Publier un titre"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">Publier</span>
        </button>
      )}
    </header>
  );
}
