import { MESSAGE_PREMIUM } from "@/lib/acces";

/**
 * Le garde-fou du hors-ligne, au plus près du téléchargement.
 *
 * Quatre entrées mènent au cache hors-ligne (un titre, un album, une
 * playlist, une reprise différée). Poser la condition sur les boutons
 * seulement laisserait passer la cinquième, celle qu'on ajoutera un jour
 * sans y penser : elle est donc posée dans `lib/offlineCache.ts`, que
 * toutes traversent.
 *
 * L'état d'abonnement est publié ici par `AccesProvider` plutôt que lu
 * dans un contexte React : `offlineCache` n'est pas un composant, et le
 * téléchargement se passe entièrement dans le navigateur — ce drapeau
 * n'est pas un secret, seulement l'état courant de l'application.
 */

let abonne = false;

/** Appelé par AccesProvider à chaque changement d'abonnement. */
export function publierAccesPremium(valeur: boolean) {
  abonne = valeur;
}

export class HorsLigneReserve extends Error {
  constructor() {
    super(MESSAGE_PREMIUM);
    this.name = "HorsLigneReserve";
  }
}

/** Lève `HorsLigneReserve` si le visiteur n'est pas abonné. */
export function assurerAccesHorsLigne(): void {
  if (!abonne) throw new HorsLigneReserve();
}
