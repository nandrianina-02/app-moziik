"use client";

import { Loader2, Pause, Play } from "lucide-react";
import { useDominantColor } from "@/components/song/useDominantColor";

/**
 * L'en-tête d'une page d'album, de playlist ou de titre, à la manière de
 * Spotify : il occupe toute la largeur du panneau, sous la barre du haut,
 * dans la couleur dominante de la pochette qui s'efface vers le bas. Grande
 * pochette, petite étiquette (« Album »), très grand titre, une seule ligne
 * d'informations ; la barre d'actions suit.
 *
 * Les marges négatives compensent celles des pages (px-4 sm:px-6 md:px-10,
 * py-6 md:py-10) : le dégradé touche les bords du panneau.
 */
export function EnteteMedia({
  pochette,
  fond,
  etiquette,
  titre,
  description,
  edition,
  infos,
  coinHaut,
  children,
}: {
  /** La pochette, déjà dimensionnée par l'appelant (elle peut porter un bouton d'édition). */
  pochette: React.ReactNode;
  /** L'image d'où tirer la couleur (bannière ou pochette), et la bannière à montrer en fond. */
  fond: { couleurDe?: string | null; banniere?: string | null };
  etiquette: React.ReactNode;
  titre: string;
  /** Une phrase sous le titre (description d'une playlist). */
  description?: string | null;
  /** Remplace le titre et la description : le formulaire du mode édition. */
  edition?: React.ReactNode;
  infos: React.ReactNode;
  /** Ce qui se pose en haut à droite (mode édition). */
  coinHaut?: React.ReactNode;
  /** La barre d'actions. */
  children?: React.ReactNode;
}) {
  const couleur = useDominantColor(fond.couleurDe);
  const teinte = couleur
    ? `linear-gradient(180deg, rgba(${couleur.r}, ${couleur.g}, ${couleur.b}, 0.75) 0%, rgba(${couleur.r}, ${couleur.g}, ${couleur.b}, 0.28) 60%, transparent 100%)`
    : "linear-gradient(180deg, rgb(var(--color-accent) / 0.35) 0%, rgb(var(--color-accent) / 0.08) 60%, transparent 100%)";

  return (
    <header className="relative -mx-4 -mt-6 mb-2 px-4 pb-4 pt-8 sm:-mx-6 sm:px-6 md:-mx-10 md:-mt-10 md:px-10 md:pt-14">
      {fond.banniere && (
        <div aria-hidden className="absolute inset-x-0 top-0 h-full bg-cover bg-center opacity-40" style={{ backgroundImage: `url(${fond.banniere})` }} />
      )}
      <div aria-hidden className="absolute inset-0" style={{ backgroundImage: teinte }} />
      {coinHaut && <div className="absolute right-4 top-4 z-10 flex items-center gap-2 md:right-10">{coinHaut}</div>}

      <div className="relative flex flex-col items-center gap-5 text-center animate-fade-in-up sm:flex-row sm:items-end sm:text-left">
        <div className="w-44 shrink-0 sm:w-48 md:w-56 [&_img]:shadow-[0_16px_48px_rgba(0,0,0,0.5)]">{pochette}</div>
        <div className="min-w-0 flex-1 pb-1">
          <div className="text-xs font-semibold text-ink">{etiquette}</div>
          {edition ?? (
            <>
              <h1 className="mt-1 line-clamp-2 break-words font-display text-3xl font-bold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
                {titre}
              </h1>
              {description && <p className="mt-3 line-clamp-2 max-w-2xl text-sm text-ink/70">{description}</p>}
            </>
          )}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 text-sm text-ink/80 sm:justify-start">{infos}</div>
        </div>
      </div>

      {children && <div className="relative mt-6 flex flex-wrap items-center justify-center gap-3 sm:justify-start">{children}</div>}
    </header>
  );
}

/** Un point entre deux informations de la ligne d'en-tête. */
export function Point() {
  return <span aria-hidden className="text-ink/50">·</span>;
}

/** Le grand bouton rond de lecture de la barre d'actions. */
export function BoutonLectureMedia({ enCours, chargement, onClick, libelle }: { enCours: boolean; chargement?: boolean; onClick: () => void; libelle: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={enCours ? `Mettre en pause ${libelle}` : `Écouter ${libelle}`}
      className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-accent text-base shadow-[0_8px_24px_rgba(0,0,0,0.35)] transition-all duration-200 hover:scale-105 hover:bg-accent-hover"
    >
      {chargement ? <Loader2 size={22} className="animate-spin" /> : enCours ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" className="translate-x-0.5" />}
    </button>
  );
}

/** Un bouton secondaire de la barre d'actions : une icône seule, sans bordure. */
export function BoutonActionMedia({
  libelle,
  onClick,
  actif = false,
  disabled = false,
  children,
}: {
  libelle: string;
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  actif?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={libelle}
      title={libelle}
      className={`grid h-11 min-w-[44px] place-items-center rounded-full px-2.5 transition-colors duration-200 disabled:opacity-60 ${
        actif ? "text-accent" : "text-ink-muted hover:text-ink"
      }`}
    >
      <span className="flex items-center gap-1.5 text-sm">{children}</span>
    </button>
  );
}
