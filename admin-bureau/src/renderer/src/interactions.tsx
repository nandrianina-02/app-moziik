import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { X, type LucideIcon } from "lucide-react";
import clsx from "./clsx";
import { usePageActive } from "./page";

/*
 * Les gestes de souris, comme dans l'Explorateur Windows :
 * - clic simple : sélectionner (Ctrl pour ajouter, Maj pour une plage) ;
 * - double-clic : ouvrir ;
 * - clic droit : le menu des actions de l'élément, ou de la sélection.
 * Ctrl + A sélectionne tout, Échap désélectionne, Entrée ouvre.
 */

// --- Menu contextuel ----------------------------------------------------------

export interface ElementMenu {
  libelle: string;
  icone?: LucideIcon;
  action: () => void;
  danger?: boolean;
  desactive?: boolean;
  /** Indication affichée à droite (« Entrée », « Ctrl + C »). */
  raccourci?: string;
}
export type EntreeMenu = ElementMenu | "separateur" | null | false | undefined | "";

type Ouvrir = (x: number, y: number, titre: string | undefined, entrees: ElementMenu[][]) => void;
let ouvrirGlobal: Ouvrir | null = null;

/** Ouvre le menu à l'endroit du clic droit. Les entrées nulles sont ignorées, « separateur » coupe en groupes. */
export function ouvrirMenu(e: MouseEvent, entrees: EntreeMenu[], titre?: string) {
  e.preventDefault();
  e.stopPropagation();
  const groupes: ElementMenu[][] = [[]];
  for (const entree of entrees) {
    if (!entree) continue;
    if (entree === "separateur") groupes.push([]);
    else groupes[groupes.length - 1].push(entree);
  }
  ouvrirGlobal?.(e.clientX, e.clientY, titre, groupes.filter((g) => g.length > 0));
}

/** L'hôte unique du menu, posé une fois dans la coquille. */
export function HoteMenu() {
  const [menu, setMenu] = useState<{ x: number; y: number; titre?: string; groupes: ElementMenu[][] } | null>(null);
  const [actif, setActif] = useState(-1);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ouvrirGlobal = (x, y, titre, groupes) => {
      setPosition(null);
      setActif(-1);
      setMenu({ x, y, titre, groupes });
    };
    return () => {
      ouvrirGlobal = null;
    };
  }, []);

  // Le menu reste dans la fenêtre : il s'ouvre vers la gauche ou vers le
  // haut quand il manque de place, comme un menu de Windows.
  useLayoutEffect(() => {
    if (!menu || !ref.current) return;
    const { offsetWidth: l, offsetHeight: h } = ref.current;
    setPosition({
      left: Math.max(6, menu.x + l > window.innerWidth - 6 ? menu.x - l : menu.x),
      top: Math.max(6, menu.y + h > window.innerHeight - 6 ? menu.y - h : menu.y),
    });
  }, [menu]);

  const plats = menu ? menu.groupes.flat() : [];
  const fermer = useCallback(() => setMenu(null), []);

  useEffect(() => {
    if (!menu) return;
    const clic = (e: globalThis.MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) fermer();
    };
    const touche = (e: KeyboardEvent) => {
      if (e.key === "Escape") return fermer();
      const utilisables = plats.map((p, i) => (p.desactive ? -1 : i)).filter((i) => i >= 0);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const pos = utilisables.indexOf(actif);
        const suivant = e.key === "ArrowDown" ? utilisables[(pos + 1) % utilisables.length] : utilisables[(pos - 1 + utilisables.length) % utilisables.length];
        setActif(suivant ?? -1);
      } else if (e.key === "Enter" && actif >= 0) {
        e.preventDefault();
        fermer();
        plats[actif].action();
      }
    };
    window.addEventListener("mousedown", clic);
    window.addEventListener("keydown", touche, true);
    window.addEventListener("blur", fermer);
    window.addEventListener("resize", fermer);
    document.addEventListener("scroll", fermer, true);
    return () => {
      window.removeEventListener("mousedown", clic);
      window.removeEventListener("keydown", touche, true);
      window.removeEventListener("blur", fermer);
      window.removeEventListener("resize", fermer);
      document.removeEventListener("scroll", fermer, true);
    };
  }, [menu, actif, plats, fermer]);

  if (!menu) return null;
  let rang = -1;
  return (
    <div
      ref={ref}
      role="menu"
      onContextMenu={(e) => e.preventDefault()}
      className="animate-ouvrir fixed z-[60] min-w-[220px] max-w-[320px] rounded-xl border border-filet bg-surface py-1.5 shadow-2xl shadow-black/35"
      style={{ left: position?.left ?? menu.x, top: position?.top ?? menu.y, visibility: position ? "visible" : "hidden", transformOrigin: "top left" }}
    >
      {menu.titre && <div className="truncate px-3.5 pt-1 pb-1.5 text-[11px] font-semibold tracking-wide text-texte-3 uppercase">{menu.titre}</div>}
      {menu.groupes.map((groupe, g) => (
        <div key={g} className={clsx(g > 0 && "mt-1.5 border-t border-filet pt-1.5")}>
          {groupe.map((el) => {
            rang += 1;
            const i = rang;
            const Icone = el.icone;
            return (
              <button
                key={el.libelle}
                role="menuitem"
                disabled={el.desactive}
                onMouseEnter={() => setActif(i)}
                onClick={() => {
                  fermer();
                  el.action();
                }}
                className={clsx(
                  "flex w-full items-center gap-2.5 px-3.5 py-1.5 text-left text-[13px] disabled:opacity-40",
                  actif === i && !el.desactive && "bg-surface-2",
                  el.danger ? "text-danger" : "text-texte",
                )}
              >
                <span className="grid w-4 shrink-0 place-items-center">{Icone && <Icone size={15} />}</span>
                <span className="flex-1 truncate">{el.libelle}</span>
                {el.raccourci && <span className="text-[11px] text-texte-3">{el.raccourci}</span>}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// --- Sélection ----------------------------------------------------------------

const CIBLES_INTERACTIVES = "button, select, input, textarea, a, label, [data-sans-selection]";

/** Vrai si le clic vise une commande à l'intérieur de l'élément (un bouton d'une ligne), pas l'élément lui-même. */
function surCommande(e: MouseEvent) {
  const cible = (e.target as HTMLElement).closest(CIBLES_INTERACTIVES);
  return cible !== null && cible !== e.currentTarget;
}

/**
 * La sélection d'une liste affichée : clic, Ctrl + clic, Maj + clic,
 * Ctrl + A, Échap ; Entrée appelle `ouvrir` sur l'élément courant. Les
 * identifiants qui quittent la liste (page suivante, filtre) quittent
 * aussi la sélection.
 */
export function useSelection(ids: string[], ouvrir?: (id: string) => void) {
  const [choisis, setChoisis] = useState<Set<string>>(() => new Set());
  const pageActive = usePageActive();
  // Le pivot d'une plage (Maj) et la position courante (flèches, Entrée) :
  // distincts, comme dans l'Explorateur, où Maj + flèche étend depuis le pivot.
  const ancre = useRef<number | null>(null);
  const curseur = useRef<number | null>(null);
  const cle = ids.join("|");

  useEffect(() => {
    setChoisis((avant) => {
      const garde = new Set([...avant].filter((id) => ids.includes(id)));
      return garde.size === avant.size ? avant : garde;
    });
    // La clé résume la liste : inutile de relancer à chaque rendu.
  }, [cle]);

  const surClic = useCallback(
    (e: MouseEvent, index: number) => {
      if (surCommande(e)) return;
      const id = ids[index];
      curseur.current = index;
      if (e.shiftKey && ancre.current !== null) {
        const [a, b] = [Math.min(ancre.current, index), Math.max(ancre.current, index)];
        const plage = ids.slice(a, b + 1);
        setChoisis((avant) => new Set(e.ctrlKey ? [...avant, ...plage] : plage));
        return;
      }
      ancre.current = index;
      if (e.ctrlKey || e.metaKey) {
        setChoisis((avant) => {
          const n = new Set(avant);
          if (n.has(id)) n.delete(id);
          else n.add(id);
          return n;
        });
      } else setChoisis(new Set([id]));
    },
    [cle],
  );

  const surDoubleClic = useCallback(
    (e: MouseEvent, index: number) => {
      if (surCommande(e)) return;
      ouvrir?.(ids[index]);
    },
    [cle, ouvrir],
  );

  /** Au clic droit : un élément hors sélection devient la sélection ; sinon on garde le groupe. Rend les éléments visés. */
  const surMenu = useCallback(
    (index: number): string[] => {
      const id = ids[index];
      if (choisis.has(id)) return [...choisis];
      ancre.current = index;
      curseur.current = index;
      setChoisis(new Set([id]));
      return [id];
    },
    [cle, choisis],
  );

  const vider = useCallback(() => setChoisis(new Set()), []);

  useEffect(() => {
    // Une page quittée reste montée : son clavier se tait tant qu'elle est masquée.
    if (!pageActive) return;
    const touche = (e: KeyboardEvent) => {
      const cible = e.target as HTMLElement;
      if (cible.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "a" && e.ctrlKey && ids.length > 0) {
        e.preventDefault();
        setChoisis(new Set(ids));
      } else if (e.key === "Escape") setChoisis(new Set());
      else if (e.key === "Enter" && curseur.current !== null && ouvrir) {
        const id = ids[curseur.current];
        if (id && choisis.has(id)) ouvrir(id);
      } else if ((e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Home" || e.key === "End") && ids.length > 0) {
        // Les flèches suivent l'ordre de la liste, en liste comme en grille ;
        // Début et Fin vont aux extrémités ; Maj étend depuis le pivot.
        e.preventDefault();
        const depuis = curseur.current ?? -1;
        const suivant =
          e.key === "Home" ? 0 : e.key === "End" ? ids.length - 1 : Math.min(ids.length - 1, Math.max(0, depuis + (e.key === "ArrowDown" ? 1 : -1)));
        curseur.current = suivant;
        if (e.shiftKey && ancre.current !== null) {
          const [a, b] = [Math.min(ancre.current, suivant), Math.max(ancre.current, suivant)];
          setChoisis(new Set(ids.slice(a, b + 1)));
        } else {
          ancre.current = suivant;
          setChoisis(new Set([ids[suivant]]));
        }
        // Le défilement suit : l'élément choisi reste à l'écran, sous la barre collante.
        requestAnimationFrame(() => document.querySelector(`main[data-actif] [data-rang="${suivant}"]`)?.scrollIntoView({ block: "nearest" }));
      }
    };
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
  }, [cle, choisis, ouvrir, pageActive]);

  return { choisis, estChoisi: (id: string) => choisis.has(id), nombre: choisis.size, surClic, surDoubleClic, surMenu, vider };
}

/** Classes d'un élément sélectionné : ligne de table ou carte de grille. */
export const classeChoisi = (choisi: boolean, genre: "ligne" | "carte") =>
  choisi ? (genre === "ligne" ? "!bg-accent/10 shadow-[inset_3px_0_0_var(--accent)]" : "!border-accent ring-2 ring-accent/40") : undefined;

/** La barre des actions groupées, en bas de l'écran, dès que deux éléments ou plus sont choisis. */
export function BarreSelection({ nombre, libelle, onVider, children }: { nombre: number; libelle: (n: number) => string; onVider: () => void; children: ReactNode }) {
  if (nombre < 2) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-40 flex justify-center px-6">
      <div className="animate-monter pointer-events-auto flex max-w-full flex-wrap items-center gap-2 rounded-2xl border border-filet bg-surface py-2 pr-2 pl-4 shadow-2xl shadow-black/35">
        <span className="mr-2 text-[13px] font-semibold tabular-nums">{libelle(nombre)}</span>
        {children}
        <button onClick={onVider} title="Désélectionner (Échap)" className="grid h-9 w-9 place-items-center rounded-lg text-texte-3 hover:bg-surface-2 hover:text-texte">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

/** Copie un texte dans le presse-papiers ; rend vrai si c'est fait. */
export async function copier(texte: string) {
  try {
    await navigator.clipboard.writeText(texte);
    return true;
  } catch {
    return false;
  }
}

// --- Messages brefs -------------------------------------------------------------

let annoncerGlobal: ((texte: string) => void) | null = null;

/** Branche l'affichage des messages brefs (la coquille s'en charge). */
export function brancherAnnonces(f: ((texte: string) => void) | null) {
  annoncerGlobal = f;
}

/** Un message bref en bas de l'écran : « Lien copié », « 3 titres validés ». */
export function annoncer(texte: string) {
  annoncerGlobal?.(texte);
}

// --- Confirmations --------------------------------------------------------------

export interface DemandeConfirmation {
  titre: string;
  message?: ReactNode;
  /** Libellé du bouton qui confirme : le verbe de l'action (« Suspendre »), jamais « OK ». */
  confirmer?: string;
  danger?: boolean;
}

let demanderGlobal: ((d: DemandeConfirmation) => Promise<boolean>) | null = null;

/**
 * Demande confirmation avant une action importante. Rend vrai si la
 * personne confirme. Sans hôte monté (essai), on ne bloque rien.
 */
export function confirmer(d: DemandeConfirmation): Promise<boolean> {
  return demanderGlobal ? demanderGlobal(d) : Promise.resolve(true);
}

/** L'hôte unique des confirmations, posé une fois dans la coquille. */
export function HoteConfirmation() {
  const [demande, setDemande] = useState<(DemandeConfirmation & { repondre: (v: boolean) => void }) | null>(null);
  const annuler = useRef<HTMLButtonElement>(null);
  const valider = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    demanderGlobal = (d) =>
      new Promise<boolean>((repondre) => {
        setDemande({ ...d, repondre });
      });
    return () => {
      demanderGlobal = null;
    };
  }, []);

  const repondre = useCallback(
    (v: boolean) => {
      demande?.repondre(v);
      setDemande(null);
    },
    [demande],
  );

  // Une action dangereuse met le focus sur « Annuler » : un Entrée machinal
  // ne supprime ni ne suspend rien.
  useEffect(() => {
    if (!demande) return;
    requestAnimationFrame(() => (demande.danger ? annuler : valider).current?.focus());
    const touche = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        repondre(false);
      }
    };
    window.addEventListener("keydown", touche, true);
    return () => window.removeEventListener("keydown", touche, true);
  }, [demande, repondre]);

  if (!demande) return null;
  return (
    <div className="animate-paraitre fixed inset-0 z-[70] grid place-items-center bg-black/50 p-6" onMouseDown={() => repondre(false)}>
      <div
        role="alertdialog"
        aria-modal="true"
        className="animate-monter w-full max-w-[440px] rounded-2xl border border-filet bg-surface p-6 shadow-2xl shadow-black/40"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 className="font-titre text-[17px] font-semibold">{demande.titre}</h2>
        {demande.message && <div className="mt-2 text-[13px] leading-relaxed text-texte-2">{demande.message}</div>}
        <div className="mt-6 flex justify-end gap-2">
          <button
            ref={annuler}
            onClick={() => repondre(false)}
            className="h-9 rounded-lg px-3.5 text-[13px] font-semibold text-texte-2 outline-none hover:bg-surface-2 hover:text-texte focus-visible:ring-2 focus-visible:ring-accent/50"
          >
            Annuler
          </button>
          <button
            ref={valider}
            onClick={() => repondre(true)}
            className={clsx(
              "h-9 rounded-lg px-3.5 text-[13px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
              demande.danger ? "bg-danger text-white hover:opacity-90" : "bg-accent text-sur-accent hover:bg-accent-fort",
            )}
          >
            {demande.confirmer ?? "Confirmer"}
          </button>
        </div>
      </div>
    </div>
  );
}
