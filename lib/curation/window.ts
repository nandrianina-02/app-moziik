/**
 * La fenêtre analysée, et celle qui lui sert de point de comparaison.
 *
 * Convention tenue partout dans lib/curation/ : `from` inclus, `to`
 * exclu. Sans elle, un titre écouté à la seconde pile du changement de
 * semaine compterait deux fois — une fois dans chaque fenêtre — et
 * « en progression » comparerait deux ensembles qui se recouvrent.
 *
 * Les bornes sont calées sur minuit UTC. Le contraire ferait dépendre le
 * classement de l'heure à laquelle le cron s'exécute : deux analyses
 * lancées le même jour ne compareraient pas les mêmes journées, et la
 * progression d'un titre changerait sans qu'aucune écoute n'ait eu lieu.
 */

const JOUR_MS = 24 * 60 * 60 * 1000;

export type Fenetre = {
  /** Semaine analysée. */
  from: Date;
  to: Date;
  /** Les sept jours qui la précèdent, pour mesurer une progression. */
  precedenteFrom: Date;
  precedenteTo: Date;
};

/** Minuit UTC du jour de `date`. */
export function minuitUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * Les sept derniers jours pleins précédant `reference`.
 *
 * Le jour en cours est exclu : il est incomplet, et l'inclure ferait
 * qu'une analyse lancée à 9 h et la même relancée à 18 h ne donneraient
 * pas le même classement.
 */
export function fenetreHebdomadaire(reference = new Date()): Fenetre {
  const to = minuitUTC(reference);
  const from = new Date(to.getTime() - 7 * JOUR_MS);
  return {
    from,
    to,
    precedenteFrom: new Date(from.getTime() - 7 * JOUR_MS),
    precedenteTo: from,
  };
}

/** Libellé lisible d'une fenêtre, pour l'administration. */
export function libelleFenetre(from: Date, to: Date): string {
  const format = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
  // `to` est exclu : la dernière journée réellement couverte est la
  // veille. Afficher `to` tel quel annoncerait un jour de plus que ce qui
  // a été mesuré.
  const dernierJour = new Date(to.getTime() - JOUR_MS);
  return `du ${format.format(from)} au ${format.format(dernierJour)}`;
}
