"use client";

import { SafeImage } from "@/components/ui/SafeImage";
import { estEnLigne, initiales } from "@/lib/messagerie";

/**
 * L'avatar d'un membre, avec sa pastille de présence.
 *
 * LA PASTILLE N'APPARAÎT QUE SI ELLE DIT QUELQUE CHOSE
 *
 * Elle est verte quand la personne est active, et absente sinon — plutôt
 * que grise. Une pastille grise sur chaque avatar transformerait la liste
 * en champ de points sans signal, et donnerait à croire qu'on sait que la
 * personne est partie alors qu'on sait seulement qu'on ne l'a pas vue.
 *
 * L'image de repli est le monogramme, jamais une silhouette générique :
 * dans une liste de conversations, c'est l'initiale qui permet de
 * retrouver quelqu'un du coin de l'œil.
 */
export function AvatarMembre({
  nom,
  avatarUrl,
  vuLe,
  taille = 44,
  presence = true,
  className = "",
}: {
  nom: string;
  avatarUrl?: string | null;
  vuLe?: string | null;
  taille?: number;
  /** Faux pour un groupe, dont la présence n'a pas de sens. */
  presence?: boolean;
  className?: string;
}) {
  const enLigne = presence && estEnLigne(vuLe);
  const pastille = Math.max(9, Math.round(taille * 0.26));

  return (
    <span className={`relative inline-flex shrink-0 ${className}`} style={{ width: taille, height: taille }}>
      {avatarUrl ? (
        <SafeImage
          src={avatarUrl}
          alt=""
          width={taille}
          height={taille}
          className="h-full w-full rounded-full object-cover"
        />
      ) : (
        <span
          aria-hidden
          className="flex h-full w-full items-center justify-center rounded-full bg-accent/15 font-semibold text-accent"
          style={{ fontSize: Math.max(11, Math.round(taille * 0.36)) }}
        >
          {initiales(nom) || "?"}
        </span>
      )}

      {enLigne && (
        <span
          // ring-surface : la pastille se détache du fond de la carte,
          // sinon elle se confond avec les avatars sombres.
          className="absolute bottom-0 right-0 rounded-full bg-verified ring-2 ring-surface"
          style={{ width: pastille, height: pastille }}
          title="En ligne"
        >
          <span className="sr-only">En ligne</span>
        </span>
      )}
    </span>
  );
}

/**
 * L'image d'un groupe : sa pochette, ou les initiales de son nom.
 *
 * Empiler les avatars des membres était tentant, et c'est ce que font
 * beaucoup de messageries. À la taille où la liste les affiche, cela
 * donne trois vignettes illisibles ; le monogramme du nom du groupe se
 * reconnaît, lui, d'un coup d'œil.
 */
export function AvatarGroupe({
  nom,
  imageUrl,
  taille = 44,
}: {
  nom: string;
  imageUrl?: string | null;
  taille?: number;
}) {
  return (
    <span className="relative inline-flex shrink-0" style={{ width: taille, height: taille }}>
      {imageUrl ? (
        <SafeImage
          src={imageUrl}
          alt=""
          width={taille}
          height={taille}
          className="h-full w-full rounded-xl object-cover"
        />
      ) : (
        <span
          aria-hidden
          className="flex h-full w-full items-center justify-center rounded-xl bg-tint-blue/15 font-semibold text-tint-blue"
          style={{ fontSize: Math.max(11, Math.round(taille * 0.34)) }}
        >
          {initiales(nom) || "#"}
        </span>
      )}
    </span>
  );
}
