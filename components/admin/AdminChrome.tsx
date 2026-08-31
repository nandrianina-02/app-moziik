"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Le cadre commun à toutes les pages d'administration.
 *
 * Chaque écran avait jusqu'ici son propre en-tête, ou pas d'en-tête du
 * tout : la mise en page dépendait de la page qu'on regardait. Ici, le
 * titre et la description viennent de la table des routes (voir le layout),
 * les actions se glissent dans l'en-tête par un portail, et les blocs de
 * réglages passent tous par la même carte. Une page d'administration
 * ressemble donc à toutes les autres, sans que chacune ait à le redire.
 */

const ID_ACTIONS = "admin-header-actions";

/** Réceptacle des actions, rendu par le layout à droite du titre. */
export function AdminHeaderSlot() {
  return <div id={ID_ACTIONS} className="flex shrink-0 flex-wrap items-center gap-2" />;
}

/**
 * Place ses enfants dans l'en-tête de la page, d'où qu'ils soient rendus.
 *
 * Le bouton principal d'un écran vit dans le composant qui connaît son
 * état (formulaire modifié, enregistrement en cours) ; il doit pourtant
 * s'afficher en haut, hors de ce composant. Le portail évite d'avoir à
 * faire remonter cet état jusqu'au layout.
 */
export function AdminHeaderActions({ children }: { children: React.ReactNode }) {
  const [cible, setCible] = useState<HTMLElement | null>(null);

  // Après le montage seulement : le réceptacle appartient au layout, il
  // n'existe pas encore au premier rendu de la page.
  useEffect(() => {
    setCible(document.getElementById(ID_ACTIONS));
  }, []);

  if (!cible) return null;
  return createPortal(children, cible);
}

/** Carte de réglages : un titre, une aide facultative, du contenu. */
export function AdminCard({
  title,
  description,
  children,
  className = "",
}: {
  title?: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl2 border border-border bg-surface p-5 ${className}`}>
      {title && <h2 className="text-base font-semibold text-ink">{title}</h2>}
      {description && <p className="mt-1 text-xs text-ink-muted">{description}</p>}
      <div className={title || description ? "mt-4" : ""}>{children}</div>
    </section>
  );
}

/** Rangée d'onglets, même forme partout. */
export function AdminTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { value: T; label: string; icon?: React.ComponentType<{ size?: number | string }> }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div role="tablist" className="flex w-max items-center gap-1 border-b border-border">
        {tabs.map((tab) => {
          const actif = tab.value === value;
          const Icon = tab.icon;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={actif}
              onClick={() => onChange(tab.value)}
              className={`relative flex items-center gap-1.5 whitespace-nowrap px-3.5 py-2.5 text-sm font-medium transition-colors ${
                actif ? "text-accent" : "text-ink-muted hover:text-ink"
              }`}
            >
              {Icon && <Icon size={14} />}
              {tab.label}
              <span
                className={`absolute inset-x-0 -bottom-px h-[2px] rounded-full ${actif ? "bg-accent" : "bg-transparent"}`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
