import clsx from "./clsx";
import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
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
        "inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
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
export function Table({ entetes, children, className }: { entetes: (string | { libelle: string; droite?: boolean; largeur?: string })[]; children: ReactNode; className?: string }) {
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
        <tbody className="divide-y divide-filet [&>tr]:transition-colors [&>tr:hover]:bg-surface-2/60 [&_td]:px-4 [&_td]:py-2">{children}</tbody>
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

export const formatNombre = (n: number) => n.toLocaleString("fr-FR");
export const formatCompact = (n: number) => (n >= 10000 ? n.toLocaleString("fr-FR", { notation: "compact", maximumFractionDigits: 1 }) : formatNombre(n));
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
