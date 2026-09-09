"use client";

import { useEffect, useState } from "react";
import { useLecteurStable } from "@/context/PlayerProvider";
import { ligneActive, motActif, type LigneParoles } from "@/lib/lyrics";

/**
 * Quelle ligne — et quel mot — sont chantés en ce moment.
 *
 * POURQUOI CE HOOK NE LIT PAS `progress`
 *
 * `usePlayer().progress` est un état React réécrit à chaque `timeupdate`,
 * soit environ quatre fois par seconde. Un composant qui s'y abonne se
 * redessine à cette cadence — et une liste de paroles peut compter
 * plusieurs centaines de lignes. Sur un mix d'une heure, cela fait des
 * dizaines de milliers de nœuds recalculés par minute pour un affichage
 * qui, lui, ne change qu'à chaque vers.
 *
 * Le hook s'abonne donc à l'élément audio directement et n'appelle
 * `setState` **que lorsque l'index change** : une poignée de rendus par
 * minute au lieu de deux cent quarante.
 *
 * POURQUOI `seeked` ET `seeking` EN PLUS DE `timeupdate`
 *
 * Après un déplacement dans le morceau, `timeupdate` peut mettre jusqu'à
 * 250 ms à arriver — un quart de seconde pendant lequel la ligne
 * surlignée est celle d'avant le saut. Les deux évènements de recherche
 * ferment cette fenêtre : la bonne ligne s'allume immédiatement.
 *
 * POURQUOI PAS DE `requestAnimationFrame`
 *
 * Il tournerait soixante fois par seconde, y compris à l'arrêt et onglet
 * caché, pour une information qui change toutes les trois secondes. Le
 * mot à mot lui-même n'en a pas besoin : la granularité utile est le mot,
 * pas l'image.
 */
export type PositionChantee = {
  /** Index dans `lignes`, ou -1 avant la première. */
  ligne: number;
  /** Index dans `lignes[ligne].mots`, ou -1 si la ligne n'est pas enrichie. */
  mot: number;
};

const AUCUNE: PositionChantee = { ligne: -1, mot: -1 };

export function useLigneChantee(lignes: LigneParoles[], actif: boolean): PositionChantee {
  const { audioRef } = useLecteurStable();
  const [position, setPosition] = useState<PositionChantee>(AUCUNE);

  useEffect(() => {
    if (!actif) {
      setPosition(AUCUNE);
      return;
    }
    const audio = audioRef.current;
    if (!audio) return;

    // Réinitialisé à chaque nouveau morceau, puisque l'effet se rejoue
    // quand `lignes` change d'identité : la première mesure ci-dessous
    // repose donc la bonne ligne tout de suite, sans attendre le premier
    // `timeupdate` du morceau suivant.
    let dernier = AUCUNE;

    const calculer = () => {
      const seconde = audio.currentTime;
      const ligne = ligneActive(lignes, seconde);
      const mot = ligne >= 0 ? motActif(lignes[ligne]?.mots, seconde) : -1;
      // Le test d'égalité est ce qui fait tout l'intérêt du hook : sans
      // lui, on remplacerait un rendu par `progress` par un rendu par
      // `timeupdate`, ce qui est exactement la même chose.
      if (ligne === dernier.ligne && mot === dernier.mot) return;
      dernier = { ligne, mot };
      setPosition(dernier);
    };

    calculer();
    audio.addEventListener("timeupdate", calculer);
    audio.addEventListener("seeking", calculer);
    audio.addEventListener("seeked", calculer);
    // Un changement de source remet la position à zéro sans forcément
    // émettre de `timeupdate` : sans cela, la dernière ligne du morceau
    // précédent resterait allumée sur le premier silence du suivant.
    audio.addEventListener("loadedmetadata", calculer);
    audio.addEventListener("emptied", calculer);

    return () => {
      audio.removeEventListener("timeupdate", calculer);
      audio.removeEventListener("seeking", calculer);
      audio.removeEventListener("seeked", calculer);
      audio.removeEventListener("loadedmetadata", calculer);
      audio.removeEventListener("emptied", calculer);
    };
  }, [audioRef, actif, lignes]);

  return position;
}
