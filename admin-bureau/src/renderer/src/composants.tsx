import clsx from "./clsx";
import { ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { adresseImage } from "./session";

/** Les briques communes : boutons, champs, panneaux, états. */

export function Bouton({
  variante = "plein",
  enCours,
  className,
  children,
  disabled,
  ...reste
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: "plein" | "trait" | "danger" | "discret"; enCours?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled || enCours}
      className={clsx(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3.5 text-[13px] font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        variante === "plein" && "bg-accent text-sur-accent hover:bg-accent-fort",
        variante === "trait" && "border border-filet bg-surface text-texte hover:bg-surface-2",
        variante === "danger" && "border border-danger/40 text-danger hover:bg-danger/10",
        variante === "discret" && "text-texte-2 hover:bg-surface-2 hover:text-texte",
        className,
      )}
      {...reste}
    >
      {enCours && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  );
}

const CLASSE_CHAMP = "h-9 w-full rounded-lg border border-filet bg-surface-2 px-3 text-[13px] text-texte outline-none placeholder:text-texte-3 focus:border-accent";

export function Champ({ libelle, aide, className, ...reste }: InputHTMLAttributes<HTMLInputElement> & { libelle?: string; aide?: string }) {
  return (
    <label className={clsx("block", className)}>
      {libelle && <span className="mb-1.5 block text-[12px] font-medium text-texte-2">{libelle}</span>}
      <input className={CLASSE_CHAMP} {...reste} />
      {aide && <span className="mt-1 block text-[12px] text-texte-3">{aide}</span>}
    </label>
  );
}

export function Selection({ libelle, className, children, ...reste }: SelectHTMLAttributes<HTMLSelectElement> & { libelle?: string }) {
  return (
    <label className={clsx("block", className)}>
      {libelle && <span className="mb-1.5 block text-[12px] font-medium text-texte-2">{libelle}</span>}
      <select className={clsx(CLASSE_CHAMP, "px-2.5")} {...reste}>
        {children}
      </select>
    </label>
  );
}

export function EnTete({ titre, texte, action }: { titre: string; texte?: string; action?: ReactNode }) {
  return (
    <div className="animate-monter mb-6 flex items-end justify-between gap-4">
      <div>
        <h1 className="font-titre text-[24px] font-semibold tracking-tight">{titre}</h1>
        {texte && <p className="mt-1 text-[13px] text-texte-2">{texte}</p>}
      </div>
      {action && <div className="flex shrink-0 gap-2">{action}</div>}
    </div>
  );
}

/**
 * Le chargement de Moziik : les trois barres du logo qui montent l'une
 * après l'autre, plutôt qu'une roue générique.
 */
export function Barres({ taille = 18 }: { taille?: number }) {
  return (
    <span className="inline-flex items-end gap-[3px]" style={{ height: taille }} aria-hidden>
      {[0.45, 0.7, 1].map((h, i) => (
        <span key={i} className="animate-barre w-[4px] rounded-full bg-accent" style={{ height: `${h * 100}%`, animationDelay: `${i * 140}ms` }} />
      ))}
    </span>
  );
}

export function Chargement({ texte = "Chargement" }: { texte?: string }) {
  return (
    <div className="animate-paraitre flex items-center gap-3 py-10 text-[13px] text-texte-3">
      <Barres /> {texte}…
    </div>
  );
}

export function Erreur({ message }: { message: string | null }) {
  return message ? <p className="animate-paraitre rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-[13px] text-danger">{message}</p> : null;
}

export function Vide({ texte }: { texte: string }) {
  return <p className="py-10 text-center text-[13px] text-texte-3">{texte}</p>;
}

export function Pastille({ texte, ton = "neutre" }: { texte: string; ton?: "neutre" | "succes" | "attention" | "danger" | "accent" }) {
  return (
    <span
      className={clsx(
        "ml-1.5 inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold",
        ton === "neutre" && "bg-surface-2 text-texte-2",
        ton === "succes" && "bg-succes/12 text-succes",
        ton === "attention" && "bg-attention/12 text-attention",
        ton === "danger" && "bg-danger/12 text-danger",
        ton === "accent" && "bg-accent/12 text-accent",
      )}
    >
      {texte}
    </span>
  );
}

/** Un panneau : titre, action éventuelle à droite, contenu. */
export function Carte({ titre, action, children, className, corps = "p-5" }: { titre?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; corps?: string }) {
  return (
    <section className={clsx("rounded-2xl border border-filet bg-surface", className)}>
      {titre && (
        <div className="flex items-center justify-between gap-3 px-5 pt-4">
          <h2 className="font-titre text-[15px] font-semibold">{titre}</h2>
          {action}
        </div>
      )}
      <div className={corps}>{children}</div>
    </section>
  );
}

/** Une table de données : filets horizontaux, colonnes alignées, lignes denses. */
export function Table({
  entetes,
  children,
  className,
  densite = "moyenne",
}: {
  entetes: (string | { libelle: string; droite?: boolean; largeur?: string })[];
  children: ReactNode;
  className?: string;
  /** Hauteur des lignes : la taille choisie dans le sélecteur de vue. */
  densite?: "petite" | "moyenne" | "grande";
}) {
  return (
    <div className={clsx("animate-monter overflow-auto rounded-2xl border border-filet bg-surface", className)}>
      <table className="w-full border-collapse text-left text-[13px]">
        <thead className="sticky top-0 z-10 bg-surface text-[11px] tracking-wide text-texte-3 uppercase">
          <tr>
            {entetes.map((e, i) => {
              const c = typeof e === "string" ? { libelle: e } : e;
              return (
                <th key={i} className={clsx("border-b border-filet px-4 py-3 font-semibold", c.droite && "text-right")} style={{ width: c.largeur }}>
                  {c.libelle}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody
          className={clsx(
            "divide-y divide-filet [&_td]:px-4 [&>tr]:transition-colors [&>tr:hover]:bg-surface-2/60",
            densite === "petite" && "[&_td]:py-1",
            densite === "moyenne" && "[&_td]:py-2",
            densite === "grande" && "[&_td]:py-3",
          )}
        >
          {children}
        </tbody>
      </table>
    </div>
  );
}

/** Une photo de profil, ou l'initiale sur un fond de teinte stable pour la personne. */
export function Avatar({ nom, image, taille = 36 }: { nom: string; image?: string | null; taille?: number }) {
  const src = adresseImage(image);
  const teinte = TEINTES[[...nom].reduce((s, c) => s + c.charCodeAt(0), 0) % TEINTES.length];
  return src ? (
    <img src={src} alt="" className="shrink-0 rounded-full object-cover" style={{ width: taille, height: taille }} />
  ) : (
    <span
      className="grid shrink-0 place-items-center rounded-full font-semibold text-white"
      style={{ width: taille, height: taille, background: `var(--${teinte})`, fontSize: taille * 0.4 }}
    >
      {nom.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

/** Les teintes, dans l'ordre fixe : une même position désigne toujours la même série. */
export const TEINTES = ["teinte-1", "teinte-2", "teinte-3", "teinte-4", "teinte-5", "teinte-6"] as const;

// Un nombre absent d'une réponse (site plus ancien, champ renommé) s'affiche
// « — » plutôt que de faire tomber la page entière.
export const formatNombre = (n: number | null | undefined) => (typeof n === "number" && Number.isFinite(n) ? n.toLocaleString("fr-FR") : "—");
export const formatCompact = (n: number | null | undefined) =>
  typeof n === "number" && n >= 10000 ? n.toLocaleString("fr-FR", { notation: "compact", maximumFractionDigits: 1 }) : formatNombre(n);
export const formatDuree = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
export const formatDate = (iso: string | number | Date | null | undefined) => (iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "—");

const relatif = new Intl.RelativeTimeFormat("fr-FR", { numeric: "auto" });
/** « il y a 3 heures », « hier » : pour les listes d'activité. */
export function formatRelatif(iso: string | number | Date) {
  const s = (new Date(iso).getTime() - Date.now()) / 1000;
  const pas: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unite, duree] of pas) if (Math.abs(s) >= duree) return relatif.format(Math.round(s / duree), unite);
  return "à l'instant";
}

/** Une fenêtre modale : Échap ou un clic à côté la ferment. */
export function Dialogue({ titre, children, onFermer }: { titre: string; children: ReactNode; onFermer: () => void }) {
  useEffect(() => {
    const touche = (e: KeyboardEvent) => e.key === "Escape" && onFermer();
    document.addEventListener("keydown", touche);
    return () => document.removeEventListener("keydown", touche);
  }, [onFermer]);
  return (
    <div className="animate-paraitre fixed inset-0 z-40 grid place-items-center bg-black/50 p-6" onMouseDown={onFermer}>
      <div className="animate-monter w-[440px] rounded-2xl border border-filet bg-surface p-6 shadow-2xl shadow-black/40" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-titre text-[18px] font-semibold">{titre}</h2>
          <button onClick={onFermer} className="grid h-8 w-8 place-items-center rounded-lg text-texte-3 hover:bg-surface-2 hover:text-texte" title="Fermer">
            <X size={17} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}


/** Un panneau latéral, pour éditer une fiche sans quitter la liste. */
export function Tiroir({ titre, sousTitre, children, pied, onFermer, largeur = 460 }: { titre: string; sousTitre?: string; children: ReactNode; pied?: ReactNode; onFermer: () => void; largeur?: number }) {
  useEffect(() => {
    const touche = (e: KeyboardEvent) => e.key === "Escape" && onFermer();
    document.addEventListener("keydown", touche);
    return () => document.removeEventListener("keydown", touche);
  }, [onFermer]);
  return (
    <div className="animate-paraitre fixed inset-0 z-40 flex justify-end bg-black/45" onMouseDown={onFermer}>
      <aside className="animate-monter flex h-full flex-col border-l border-filet bg-surface" style={{ width: largeur }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-filet px-6 py-4">
          <div className="min-w-0">
            <h2 className="truncate font-titre text-[18px] font-semibold">{titre}</h2>
            {sousTitre && <p className="mt-0.5 truncate text-[12px] text-texte-3">{sousTitre}</p>}
          </div>
          <button onClick={onFermer} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-texte-3 hover:bg-surface-2 hover:text-texte" title="Fermer">
            <X size={17} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {pied && <div className="flex justify-end gap-2 border-t border-filet px-6 py-3">{pied}</div>}
      </aside>
    </div>
  );
}

/** Un interrupteur : un réglage qui vaut oui ou non, avec son explication. */
export function Bascule({ libelle, aide, valeur, onChange, disabled }: { libelle: string; aide?: string; valeur: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className={clsx("flex cursor-pointer items-start justify-between gap-4 py-2.5", disabled && "cursor-not-allowed opacity-60")}>
      <span className="min-w-0">
        <span className="block text-[13px] font-medium">{libelle}</span>
        {aide && <span className="mt-0.5 block text-[12px] text-texte-3">{aide}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={valeur}
        disabled={disabled}
        onClick={() => onChange(!valeur)}
        className={clsx("relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors", valeur ? "bg-accent" : "bg-filet")}
      >
        <span className={clsx("absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-150", valeur && "translate-x-5")} />
      </button>
    </label>
  );
}

/** Une zone de texte sur plusieurs lignes, au style des champs. */
export function ZoneTexte({ libelle, className, ...reste }: TextareaHTMLAttributes<HTMLTextAreaElement> & { libelle?: string }) {
  return (
    <label className={clsx("block", className)}>
      {libelle && <span className="mb-1.5 block text-[12px] font-medium text-texte-2">{libelle}</span>}
      <textarea className="min-h-[96px] w-full resize-y rounded-lg border border-filet bg-surface-2 px-3 py-2 text-[13px] leading-relaxed text-texte outline-none placeholder:text-texte-3 focus:border-accent" {...reste} />
    </label>
  );
}

/**
 * Les numéros à montrer : la première, la dernière, et deux de part et
 * d'autre de la page courante ; « … » pour les trous. Au-delà, une barre
 * de pagination devient une liste à parcourir.
 */
function numerosAffiches(page: number, pages: number): (number | "…")[] {
  const garder = new Set([1, pages, page - 2, page - 1, page, page + 1, page + 2].filter((n) => n >= 1 && n <= pages));
  const tries = [...garder].sort((a, b) => a - b);
  const sortie: (number | "…")[] = [];
  tries.forEach((n, i) => {
    if (i > 0 && n - tries[i - 1] > 1) sortie.push("…");
    sortie.push(n);
  });
  return sortie;
}

/** La barre de pagination : position dans la liste, pages voisines, précédente et suivante. */
export function Pagination({ page, pages, total, taille, onPage, className }: { page: number; pages: number; total: number; taille: number; onPage: (p: number) => void; className?: string }) {
  if (total === 0) return null;
  const debut = (page - 1) * taille + 1;
  const fin = Math.min(total, page * taille);
  return (
    <div className={clsx("flex flex-wrap items-center justify-between gap-3 text-[12.5px]", className)}>
      <span className="text-texte-3 tabular-nums">
        {formatNombre(debut)}–{formatNombre(fin)} sur {formatNombre(total)}
      </span>
      {pages > 1 && (
        <nav className="flex items-center gap-1" aria-label="Pagination">
          <button
            onClick={() => onPage(page - 1)}
            disabled={page <= 1}
            className="grid h-8 w-8 place-items-center rounded-lg border border-filet bg-surface text-texte-2 hover:text-texte disabled:opacity-40"
            title="Page précédente"
          >
            <ChevronLeft size={15} />
          </button>
          {numerosAffiches(page, pages).map((n, i) =>
            n === "…" ? (
              <span key={`t${i}`} className="w-6 text-center text-texte-3">
                …
              </span>
            ) : (
              <button
                key={n}
                onClick={() => onPage(n)}
                aria-current={n === page ? "page" : undefined}
                className={clsx(
                  "h-8 min-w-8 rounded-lg px-2 font-semibold tabular-nums transition-colors",
                  n === page ? "bg-accent text-sur-accent" : "border border-filet bg-surface text-texte-2 hover:text-texte",
                )}
              >
                {n}
              </button>
            ),
          )}
          <button
            onClick={() => onPage(page + 1)}
            disabled={page >= pages}
            className="grid h-8 w-8 place-items-center rounded-lg border border-filet bg-surface text-texte-2 hover:text-texte disabled:opacity-40"
            title="Page suivante"
          >
            <ChevronRight size={15} />
          </button>
        </nav>
      )}
    </div>
  );
}

/**
 * Découpe en pages une liste déjà chargée. La page revient à la première
 * quand `cle` change (un filtre, une recherche) ; une suppression, elle,
 * laisse sur la même page, ramenée à la dernière si celle-ci disparaît.
 */
export function usePages<T>(liste: T[] | null | undefined, taille: number, cle?: string) {
  const [page, setPage] = useState(1);
  const total = liste?.length ?? 0;
  const pages = Math.max(1, Math.ceil(total / taille));
  useEffect(() => setPage(1), [cle]);
  const courante = Math.min(page, pages);
  const tranche = useMemo(() => (liste ?? []).slice((courante - 1) * taille, courante * taille), [liste, courante, taille]);
  return { page: courante, pages, total, taille, tranche, setPage };
}
