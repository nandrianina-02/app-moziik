import { headers } from "next/headers";

/**
 * Détection de la coquille Android CÔTÉ SERVEUR, via le User-Agent.
 *
 * `capacitor.config.ts` ajoute le suffixe `MoziikAndroid` au User-Agent de
 * la WebView (`android.appendUserAgent`). C'est la seule information dont
 * dispose le rendu serveur : `window.Capacitor` n'existe évidemment pas
 * ici.
 *
 * POURQUOI NE PAS SE CONTENTER DE `estNatif()` CÔTÉ CLIENT
 *
 * Parce qu'un composant qui rendrait un arbre différent selon un test fait
 * dans un `useEffect` produirait, au mieux, un changement visible après
 * l'hydratation, au pire une erreur d'hydratation React. Pour tout ce qui
 * touche au RENDU — masquer l'invite d'installation de la PWA, retirer les
 * raccourcis clavier, réserver la place de la barre de navigation Android —
 * c'est cette fonction qu'il faut, prise au niveau d'un composant serveur.
 *
 * Marque le rendu comme dynamique (lecture des en-têtes) : à n'appeler que
 * dans des pages qui le sont déjà, ou dans le layout racine.
 */
export function estAppAndroid(): boolean {
  return headers().get("user-agent")?.includes("MoziikAndroid") ?? false;
}
