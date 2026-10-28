"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { CalendarDays, Mic2, Plus, Radio, Trophy } from "lucide-react";

/** Ce que l'accueil montre : tout, ou une seule sorte de contenu. */
export type FiltreAccueil = "tout" | "titres" | "albums" | "playlists";

export const FILTRES_ACCUEIL: { valeur: FiltreAccueil; libelle: string }[] = [
  { valeur: "tout", libelle: "Tout" },
  { valeur: "titres", libelle: "Titres" },
  { valeur: "albums", libelle: "Albums" },
  { valeur: "playlists", libelle: "Playlists" },
];

/** Les sections de l'accueil gardées par chaque filtre (clés de components/home/sectionMeta.ts). */
export const SECTIONS_PAR_FILTRE: Record<Exclude<FiltreAccueil, "tout">, string[]> = {
  titres: ["recently_played", "new_releases", "recommendations"],
  albums: ["albums"],
  playlists: ["playlists"],
};

const RACCOURCIS = [
  { href: "/classements", libelle: "Classements", icone: Trophy },
  { href: "/classements?type=artists", libelle: "Artistes", icone: Mic2 },
  { href: "/radio", libelle: "Radio", icone: Radio },
  { href: "/evenements", libelle: "Évènements", icone: CalendarDays },
];

function salutation() {
  const h = new Date().getHours();
  if (h < 5) return "Bonne nuit";
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
}

/**
 * L'en-tête de l'accueil : une salutation à l'heure du jour, puis une rangée
 * de puces. Les premières filtrent l'accueil lui-même (comme les puces de
 * Spotify) ; les suivantes, après un filet, mènent aux pages de découverte,
 * qui avaient jusque-là quatre grosses pastilles rondes à elles seules.
 */
export function AccueilEntete({
  peutPublier,
  filtre,
  onFiltre,
}: {
  peutPublier: boolean;
  filtre: FiltreAccueil;
  onFiltre: (f: FiltreAccueil) => void;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const prenom = (session?.user?.name ?? "").trim().split(/\s+/)[0];

  return (
    <header className="mb-5 space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="min-w-0 flex-1 truncate font-display text-2xl md:text-3xl" suppressHydrationWarning>
          {salutation()}
          {prenom ? `, ${prenom}` : ""}
        </h1>
        {peutPublier && (
          <button
            onClick={() => router.push("/son/nouveau")}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-accent p-2.5 text-sm font-medium text-base transition-colors hover:bg-accent-hover sm:px-4 sm:py-2"
            aria-label="Publier un titre"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Publier</span>
          </button>
        )}
      </div>

      <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" role="toolbar" aria-label="Filtrer l'accueil">
        {FILTRES_ACCUEIL.map(({ valeur, libelle }) => (
          <button
            key={valeur}
            type="button"
            aria-pressed={filtre === valeur}
            onClick={() => onFiltre(valeur)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors duration-200 ${
              filtre === valeur ? "bg-ink text-base" : "bg-ink/[0.08] text-ink hover:bg-ink/[0.14]"
            }`}
          >
            {libelle}
          </button>
        ))}
        <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-border" />
        {RACCOURCIS.map(({ href, libelle, icone: Icone }) => (
          <Link
            key={href}
            href={href}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-ink/[0.08] px-3.5 py-1.5 text-sm font-medium text-ink-muted transition-colors duration-200 hover:bg-ink/[0.14] hover:text-ink"
          >
            <Icone size={14} />
            {libelle}
          </Link>
        ))}
      </div>
    </header>
  );
}
