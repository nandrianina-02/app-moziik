/**
 * Le moment de la journée, et ce qu'il change à l'écoute.
 *
 * Ce fichier n'importe RIEN : la page qui lance une station tourne dans
 * le navigateur, et c'est **son** heure qui compte, pas celle du serveur.
 * Un auditeur à Antananarivo et un serveur à Francfort ne sont pas au
 * même moment de la journée ; décider côté serveur reviendrait à proposer
 * de la musique de nuit à quelqu'un qui prend son petit-déjeuner.
 *
 * L'heure locale est donc lue par le client et transmise à l'API.
 *
 * CE QU'ON N'AFFIRME PAS
 *
 * Que l'heure détermine le goût. Elle l'infléchit, faiblement : le
 * profil d'écoute reste prépondérant. Le moment ne fait que départager
 * deux titres également plausibles — il n'écarte jamais un morceau que
 * l'auditeur aime.
 */

export const MOMENTS = ["matin", "journee", "soiree", "nuit"] as const;

export type Moment = (typeof MOMENTS)[number];

export type DescriptionMoment = {
  label: string;
  /** Ce que la station cherche à ce moment-là, en une phrase. */
  intention: string;
  /**
   * Tempo recherché, en battements par minute. Sert uniquement à
   * départager : un titre sans `bpm` renseigné n'est jamais écarté pour
   * autant — la moitié du catalogue n'a pas cette donnée, et l'absence
   * d'information n'est pas une information.
   */
  bpm: { min: number; max: number };
};

export const DESCRIPTION_MOMENTS: Record<Moment, DescriptionMoment> = {
  matin: {
    label: "Ce matin",
    intention: "de quoi démarrer la journée, sans brusquer",
    bpm: { min: 85, max: 115 },
  },
  journee: {
    label: "Dans la journée",
    intention: "de quoi accompagner sans occuper toute l'attention",
    bpm: { min: 95, max: 130 },
  },
  soiree: {
    label: "Ce soir",
    intention: "de quoi tenir une soirée, plus rythmé",
    bpm: { min: 110, max: 150 },
  },
  nuit: {
    label: "Cette nuit",
    intention: "de quoi écouter tard, plus calme",
    bpm: { min: 60, max: 100 },
  },
};

/**
 * Le moment correspondant à une heure locale (0–23).
 *
 * Les bornes sont volontairement larges et sans prétention : elles
 * découpent une journée ordinaire, pas la vie de chacun.
 */
export function momentDeLHeure(heure: number): Moment {
  const h = Math.max(0, Math.min(23, Math.floor(heure)));
  if (h < 5) return "nuit";
  if (h < 11) return "matin";
  if (h < 18) return "journee";
  if (h < 23) return "soiree";
  return "nuit";
}

/** Le moment courant, d'après l'horloge du navigateur. */
export function momentCourant(): Moment {
  return momentDeLHeure(new Date().getHours());
}

export function estMoment(valeur: string): valeur is Moment {
  return (MOMENTS as readonly string[]).includes(valeur);
}
