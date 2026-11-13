import clsx from "./clsx";
import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

/** Les briques communes : boutons, champs, en-têtes, états. Sobres, natives. */

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
        "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        variante === "plein" && "bg-accent text-sur-accent hover:opacity-90",
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

export function Champ({ libelle, aide, className, ...reste }: InputHTMLAttributes<HTMLInputElement> & { libelle?: string; aide?: string }) {
  return (
    <label className={clsx("block", className)}>
      {libelle && <span className="mb-1 block text-[12px] font-medium text-texte-2">{libelle}</span>}
      <input
        className="h-8 w-full rounded-md border border-filet bg-surface px-2.5 text-[13px] text-texte outline-none placeholder:text-texte-3 focus:border-accent"
        {...reste}
      />
      {aide && <span className="mt-1 block text-[12px] text-texte-3">{aide}</span>}
    </label>
  );
}

export function Selection({ libelle, className, children, ...reste }: SelectHTMLAttributes<HTMLSelectElement> & { libelle?: string }) {
  return (
    <label className={clsx("block", className)}>
      {libelle && <span className="mb-1 block text-[12px] font-medium text-texte-2">{libelle}</span>}
      <select className="h-8 w-full rounded-md border border-filet bg-surface px-2 text-[13px] text-texte outline-none focus:border-accent" {...reste}>
        {children}
      </select>
    </label>
  );
}

export function EnTete({ titre, texte, action }: { titre: string; texte?: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4 border-b border-filet pb-4">
      <div>
        <h1 className="text-[20px] font-semibold tracking-tight">{titre}</h1>
        {texte && <p className="mt-0.5 text-[13px] text-texte-2">{texte}</p>}
      </div>
      {action && <div className="flex shrink-0 gap-2">{action}</div>}
    </div>
  );
}

export function Chargement({ texte = "Chargement" }: { texte?: string }) {
  return (
    <div className="flex items-center gap-2 py-10 text-[13px] text-texte-3">
      <Loader2 size={16} className="animate-spin" /> {texte}…
    </div>
  );
}

export function Erreur({ message }: { message: string | null }) {
  return message ? <p className="animate-paraitre rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-[13px] text-danger">{message}</p> : null;
}

export function Vide({ texte }: { texte: string }) {
  return <p className="py-10 text-center text-[13px] text-texte-3">{texte}</p>;
}

export function Pastille({ texte, ton = "neutre" }: { texte: string; ton?: "neutre" | "succes" | "attention" | "danger" | "accent" }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium",
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

export function Carte({ titre, children, className }: { titre?: string; children: ReactNode; className?: string }) {
  return (
    <section className={clsx("rounded-lg border border-filet bg-surface", className)}>
      {titre && <h2 className="border-b border-filet px-4 py-2.5 text-[13px] font-semibold">{titre}</h2>}
      <div className="p-4">{children}</div>
    </section>
  );
}

/** Une table de données : filets horizontaux, colonnes alignées, lignes denses. */
export function Table({ entetes, children, className }: { entetes: (string | { libelle: string; droite?: boolean; largeur?: string })[]; children: ReactNode; className?: string }) {
  return (
    <div className={clsx("overflow-auto rounded-lg border border-filet bg-surface", className)}>
      <table className="w-full border-collapse text-left text-[13px]">
        <thead className="sticky top-0 bg-surface-2 text-[12px] text-texte-2">
          <tr>
            {entetes.map((e, i) => {
              const c = typeof e === "string" ? { libelle: e } : e;
              return (
                <th key={i} className={clsx("border-b border-filet px-3 py-2 font-medium", c.droite && "text-right")} style={{ width: c.largeur }}>
                  {c.libelle}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-filet">{children}</tbody>
      </table>
    </div>
  );
}

export const formatNombre = (n: number) => n.toLocaleString("fr-FR");
export const formatDuree = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
export const formatDate = (iso: string | number | Date | null | undefined) => (iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" }) : "—");
