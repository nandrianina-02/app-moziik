import { useEffect, useState, type CSSProperties } from "react";
import { flushSync } from "react-dom";
import { Grid2x2, Grid3x3, LayoutGrid, LayoutList, Rows2, Rows3, Rows4, type LucideIcon } from "lucide-react";
import clsx from "./clsx";
import { usePageActive } from "./page";

/*
 * Les vues des listes : en liste ou en grille, chacune en trois tailles.
 * Le choix est retenu par page sur ce poste.
 *
 * Le passage d'une vue à l'autre est animé par l'API View Transitions de
 * Chromium : chaque pochette et chaque titre portent un nom de transition
 * (`nomTransition`), si bien que le moteur les fait glisser de leur place
 * en liste à leur place en grille, au lieu de remplacer l'écran d'un coup.
 */

export type ModeVue = "liste" | "grille";
export type TailleVue = "petite" | "moyenne" | "grande";
export interface Vue {
  mode: ModeVue;
  taille: TailleVue;
}

const CLE = "moziik-admin:vues";

function toutes(): Record<string, Vue> {
  try {
    return JSON.parse(localStorage.getItem(CLE) ?? "{}") as Record<string, Vue>;
  } catch {
    return {};
  }
}

export function reinitialiserVues() {
  try {
    localStorage.removeItem(CLE);
  } catch {
    // Rien à effacer.
  }
}

/**
 * Exécute un changement d'affichage dans une transition de vue. flushSync
 * force React à peindre le nouvel état pendant la capture, sans quoi le
 * navigateur comparerait deux fois l'ancien. Sans l'API, ou animations
 * coupées, le changement se fait simplement.
 */
export function avecTransition(changement: () => void) {
  const doc = document as Document & { startViewTransition?: (f: () => void) => unknown };
  if (!doc.startViewTransition || document.documentElement.classList.contains("sans-animation")) return changement();
  // Pendant le passage, les animations d'entrée des blocs (une table qui
  // réapparaît) sont suspendues : elles se superposaient au glissement.
  const racine = document.documentElement;
  racine.classList.add("vue-en-transition");
  const transition = doc.startViewTransition(() => flushSync(changement)) as { finished?: Promise<void> } | undefined;
  const fin = () => racine.classList.remove("vue-en-transition");
  if (transition?.finished) transition.finished.then(fin, fin);
  else fin();
}

export function useVue(page: string, defaut: Vue): [Vue, (v: Partial<Vue>) => void] {
  const [vue, setVue] = useState<Vue>(() => ({ ...defaut, ...toutes()[page] }));
  const changer = (changement: Partial<Vue>) =>
    avecTransition(() => {
      setVue((avant) => {
        const apres = { ...avant, ...changement };
        try {
          localStorage.setItem(CLE, JSON.stringify({ ...toutes(), [page]: apres }));
        } catch {
          // Le choix vaut pour la session.
        }
        return apres;
      });
    });
  return [vue, changer];
}

/** Nom de transition d'un élément : unique dans la page, stable d'une vue à l'autre. */
/**
 * Nom de transition d'une pochette : unique dans la page, stable d'une vue
 * à l'autre. Seules les premières de la page glissent (le haut de l'écran,
 * ce qu'on regarde) : chaque élément nommé est photographié avant et après,
 * et en nommer cinquante rendait le passage saccadé. Les autres, comme les
 * textes, se fondent avec la page.
 */
export const RANG_MAX_TRANSITION = 24;
export const nomTransition = (_genre: "c", id: string, rang: number): CSSProperties =>
  rang < RANG_MAX_TRANSITION ? ({ viewTransitionName: `vt-c-${id.replace(/[^A-Za-z0-9_-]/g, "")}`, viewTransitionClass: "pochette" } as CSSProperties) : {};

/** Largeur minimale d'une carte de grille, selon la taille choisie. */
export const largeurCarte: Record<TailleVue, number> = { petite: 140, moyenne: 184, grande: 248 };
/** Côté de la vignette d'une ligne de liste, selon la taille choisie. */
export const coteVignette: Record<TailleVue, number> = { petite: 28, moyenne: 40, grande: 56 };

const TAILLES: { cle: TailleVue; libelle: string; liste: LucideIcon; grille: LucideIcon }[] = [
  { cle: "petite", libelle: "Petite", liste: Rows4, grille: Grid3x3 },
  { cle: "moyenne", libelle: "Moyenne", liste: Rows3, grille: LayoutGrid },
  { cle: "grande", libelle: "Grande", liste: Rows2, grille: Grid2x2 },
];

/** Le sélecteur : liste ou grille, puis la taille. */
export function SelecteurVue({ vue, onChange }: { vue: Vue; onChange: (v: Partial<Vue>) => void }) {
  return (
    <div className="flex items-center gap-2" role="group" aria-label="Affichage">
      <div className="flex rounded-lg border border-filet bg-surface p-0.5">
        {(
          [
            ["liste", "Liste", LayoutList],
            ["grille", "Grille", LayoutGrid],
          ] as const
        ).map(([mode, libelle, Icone]) => (
          <button
            key={mode}
            onClick={() => vue.mode !== mode && onChange({ mode })}
            title={libelle}
            aria-pressed={vue.mode === mode}
            className={clsx("grid h-7 w-8 place-items-center rounded-md transition-colors", vue.mode === mode ? "bg-accent text-sur-accent" : "text-texte-3 hover:text-texte")}
          >
            <Icone size={15} />
          </button>
        ))}
      </div>
      <div className="flex rounded-lg border border-filet bg-surface p-0.5">
        {TAILLES.map((t) => {
          const Icone = vue.mode === "liste" ? t.liste : t.grille;
          return (
            <button
              key={t.cle}
              onClick={() => vue.taille !== t.cle && onChange({ taille: t.cle })}
              title={`${t.libelle} taille`}
              aria-pressed={vue.taille === t.cle}
              className={clsx("grid h-7 w-8 place-items-center rounded-md transition-colors", vue.taille === t.cle ? "bg-surface-2 text-texte" : "text-texte-3 hover:text-texte")}
            >
              <Icone size={15} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

/*
 * Ctrl + molette, comme dans l'Explorateur Windows : les six affichages se
 * suivent, de la liste compacte à la grande grille. La page qui montre une
 * liste s'inscrit ici ; ailleurs, la coquille fait de Ctrl + molette un
 * zoom de l'interface.
 */
export const ORDRE_VUES: Vue[] = [
  { mode: "liste", taille: "petite" },
  { mode: "liste", taille: "moyenne" },
  { mode: "liste", taille: "grande" },
  { mode: "grille", taille: "petite" },
  { mode: "grille", taille: "moyenne" },
  { mode: "grille", taille: "grande" },
];

export const libelleVue = (v: Vue) => `${v.mode === "liste" ? "Liste" : "Grille"} · ${v.taille}`;

let raccourciActif: ((sens: 1 | -1) => Vue | null) | null = null;

/** Appelé par la coquille : rend la nouvelle vue si une liste a pris le raccourci. */
export function raccourciVue(sens: 1 | -1): Vue | null {
  return raccourciActif ? raccourciActif(sens) : null;
}

/** Inscrit la liste de la page courante comme cible de Ctrl + molette. */
export function useRaccourciVue(vue: Vue, changer: (v: Partial<Vue>) => void) {
  // Les pages quittées restent montées : seule celle à l'écran prend le raccourci.
  const active = usePageActive();
  useEffect(() => {
    if (!active) return;
    const cible = (sens: 1 | -1) => {
      const i = ORDRE_VUES.findIndex((v) => v.mode === vue.mode && v.taille === vue.taille);
      const suivante = ORDRE_VUES[Math.min(ORDRE_VUES.length - 1, Math.max(0, i + sens))];
      if (suivante.mode !== vue.mode || suivante.taille !== vue.taille) changer(suivante);
      return suivante;
    };
    raccourciActif = cible;
    return () => {
      if (raccourciActif === cible) raccourciActif = null;
    };
  }, [vue, changer, active]);
}
