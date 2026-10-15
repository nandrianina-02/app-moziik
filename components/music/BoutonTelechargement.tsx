"use client";

import { Check, Download, Loader2 } from "lucide-react";
import type { PlayableSong } from "@/context/PlayerProvider";
import { useTelechargementHorsLigne } from "@/hooks/useTelechargementHorsLigne";

/**
 * La pastille de téléchargement, sur une pochette ou dans une ligne.
 *
 * DEUX PLACEMENTS, UN SEUL COMPORTEMENT
 *
 * - `pochette` : posée en bas à gauche de l'image, par-dessus. Le coin
 *   opposé porte déjà la durée, et le centre le bouton de lecture —
 *   c'est le seul angle libre, et le pouce y tombe naturellement sur un
 *   téléphone tenu d'une main.
 * - `ligne` : à droite, avant le menu à trois points, là où l'œil va
 *   déjà chercher les actions d'une rangée.
 *
 * POURQUOI IL EST TOUJOURS VISIBLE
 *
 * Le hors-ligne est réservé au Premium. On pourrait le masquer aux
 * autres ; on ne le fait pas. Un bouton absent laisse croire que la
 * fonction n'existe pas, là où un bouton qui explique au clic dit à la
 * fois ce que l'abonnement apporte et comment l'obtenir. Le clic ne ment
 * jamais : il emmène vers l'abonnement, il ne fait pas semblant de
 * télécharger.
 *
 * Trois états, trois formes — absent, en cours, présent — parce qu'un
 * téléchargement de plusieurs mégaoctets prend un temps visible, et
 * qu'une pastille qui ne bouge pas pendant ce temps-là passe pour un
 * bouton mort sur lequel on reclique.
 */
export function BoutonTelechargement({
  song,
  placement = "ligne",
  className = "",
}: {
  song: PlayableSong;
  placement?: "pochette" | "ligne";
  className?: string;
}) {
  const { etat, basculer } = useTelechargementHorsLigne(song);

  const libelle =
    etat === "present"
      ? `Retirer « ${song.title} » des téléchargements`
      : etat === "encours"
        ? "Téléchargement en cours"
        : `Télécharger « ${song.title} » pour l'écoute hors connexion`;

  const surPochette = placement === "pochette";

  return (
    <button
      type="button"
      title={libelle}
      aria-label={libelle}
      aria-busy={etat === "encours"}
      onClick={(e) => {
        // La pastille vit à l'intérieur d'une carte ou d'une rangée qui
        // lance la lecture : sans cela, télécharger ferait aussi jouer.
        e.preventDefault();
        e.stopPropagation();
        basculer();
      }}
      className={`pressable grid shrink-0 place-items-center rounded-full transition-colors ${
        surPochette ? "h-9 w-9 backdrop-blur-sm" : "h-8 w-8"
      } ${
        etat === "present"
          ? surPochette
            ? "bg-accent text-base"
            : "border border-accent bg-accent/15 text-accent"
          : surPochette
            ? "bg-black/55 text-white hover:bg-black/75"
            : "border border-border text-ink-muted hover:border-accent hover:text-accent"
      } ${className}`}
    >
      {etat === "encours" ? (
        <Loader2 size={surPochette ? 16 : 14} className="animate-spin" />
      ) : etat === "present" ? (
        <Check size={surPochette ? 16 : 14} />
      ) : (
        <Download size={surPochette ? 16 : 14} />
      )}
    </button>
  );
}
