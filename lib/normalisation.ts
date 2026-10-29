/**
 * Le volume égal : chaque titre ramené à la même sonie perçue, pour qu'on
 * n'ait pas à toucher au volume d'un morceau à l'autre.
 *
 * La sonie de chaque titre est mesurée à l'import (EBU R128, en mono, sur la
 * minute centrale) et gardée dans `Song.loudness`. La cible, −17 LUFS en
 * mono, équivaut à peu près aux −14 LUFS en stéréo des grandes plateformes ;
 * c'est aussi celle de l'application Android, pour que le site et l'app
 * sonnent pareil.
 *
 * On ne fait qu'atténuer : relever un titre trop faible demanderait de
 * dépasser le niveau d'origine, donc de risquer la saturation. Un titre sans
 * mesure passe tel quel.
 */

export const CIBLE_SONIE_LUFS = -17;

/** Plus bas, un titre deviendrait presque inaudible : une mesure aberrante ne doit pas le faire taire. */
const GAIN_MINIMUM = 0.2;

export function gainNormalisation(sonie: number | null | undefined): number {
  if (typeof sonie !== "number" || !Number.isFinite(sonie)) return 1;
  const gain = Math.pow(10, (CIBLE_SONIE_LUFS - sonie) / 20);
  return Math.min(1, Math.max(GAIN_MINIMUM, gain));
}

/** Les durées de fondu enchaîné proposées, en secondes ; 0 le désactive. */
export const DUREES_FONDU = [0, 3, 6, 9, 12] as const;
export type DureeFondu = (typeof DUREES_FONDU)[number];

export function estDureeFondu(valeur: unknown): valeur is DureeFondu {
  return DUREES_FONDU.includes(valeur as DureeFondu);
}
