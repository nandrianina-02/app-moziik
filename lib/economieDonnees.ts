import type { AudioQuality } from "@/lib/offlineSettings";

/**
 * L'économie de données.
 *
 * POURQUOI CE MODULE EXISTE
 *
 * Mesuré sur le catalogue : une heure d'écoute coûte 57,6 Mo en 128 kb/s
 * et 28,8 Mo en 64 kb/s. Tout le reste est du bruit à côté — le flux
 * d'accueil pèse 7,8 Ko une fois comprimé, les pochettes quelques
 * centaines de kilooctets. Diviser le débit audio par deux est le seul
 * levier qui change l'ordre de grandeur de la facture.
 *
 * Jusqu'ici la qualité était un réglage manuel, posé une fois, enterré
 * dans la page bibliothèque, et par défaut au maximum. Autrement dit :
 * personne ne l'a jamais baissé, et l'application consommait autant sur
 * un forfait mobile que sur une fibre.
 *
 * CE QUE LE NAVIGATEUR SAIT DIRE, ET CE QU'IL NE SAIT PAS
 *
 * L'API Network Information n'existe que sur Chromium — donc sur la
 * coquille Android et sur la plupart des navigateurs Android, mais pas
 * sur Safari ni Firefox. Quand elle manque, on ne devine pas : dégrader
 * le son d'un poste de bureau sur fibre, sans que personne ait rien
 * demandé et sans moyen de comprendre pourquoi, serait pire que de ne
 * rien faire. Le mode « auto » est donc volontairement timide, et c'est
 * précisément pour cela que « toujours » doit rester accessible en deux
 * gestes depuis le lecteur.
 *
 * CE QUE CE MODULE NE TOUCHE PAS
 *
 * Les téléchargements hors-ligne. Un téléchargement est un geste
 * délibéré, il a déjà son propre garde-fou (`wifiOnlyDownload`), et
 * surtout le fichier est rangé dans le cache sous l'adresse exacte de sa
 * qualité : la faire varier tout seul ferait manquer le cache et
 * retélécharger un morceau déjà sur l'appareil — l'exact contraire du
 * but poursuivi ici.
 */

export type ModeEconomie = "auto" | "toujours" | "jamais";

export const MODE_ECONOMIE_PAR_DEFAUT: ModeEconomie = "auto";

export const MODES_ECONOMIE: { id: ModeEconomie; titre: string; detail: string }[] = [
  { id: "auto", titre: "Automatique", detail: "64 kb/s hors Wi-Fi, qualité choisie sinon." },
  { id: "toujours", titre: "Toujours", detail: "64 kb/s en permanence — moitié moins de données." },
  { id: "jamais", titre: "Jamais", detail: "Garde la qualité choisie, quelle que soit la connexion." },
];

export type EtatReseau = {
  /**
   * Vrai sur un lien mobile, faux sur Wi-Fi ou Ethernet, **null** quand le
   * navigateur ne le dit pas. Les trois cas sont distincts : « on ne sait
   * pas » ne doit jamais être traité comme « oui ».
   */
  cellulaire: boolean | null;
  /** Le mode économiseur du navigateur lui-même, quand il en a un. */
  economiseurNavigateur: boolean;
  /** Débit estimé par le navigateur : "slow-2g" | "2g" | "3g" | "4g". */
  vitesse: string | null;
};

export const RESEAU_INCONNU: EtatReseau = {
  cellulaire: null,
  economiseurNavigateur: false,
  vitesse: null,
};

type Connexion = {
  type?: string;
  effectiveType?: string;
  saveData?: boolean;
  addEventListener?: (type: string, ecouteur: () => void) => void;
  removeEventListener?: (type: string, ecouteur: () => void) => void;
};

function connexion(): Connexion | null {
  if (typeof navigator === "undefined") return null;
  const nav = navigator as unknown as {
    connection?: Connexion;
    mozConnection?: Connexion;
    webkitConnection?: Connexion;
  };
  return nav.connection ?? nav.mozConnection ?? nav.webkitConnection ?? null;
}

/** Ce que le navigateur veut bien dire de la connexion, à cet instant. */
export function lireReseau(): EtatReseau {
  const c = connexion();
  if (!c) return RESEAU_INCONNU;

  return {
    // `type` est la seule information fiable sur la nature du lien, et
    // c'est aussi la plus souvent absente : Chrome ne l'expose pas sur
    // poste de bureau. D'où le null, plutôt qu'un faux « ce n'est pas du
    // mobile » qui désactiverait l'économie là où elle sert.
    cellulaire: typeof c.type === "string" ? c.type === "cellular" : null,
    economiseurNavigateur: c.saveData === true,
    vitesse: typeof c.effectiveType === "string" ? c.effectiveType : null,
  };
}

/**
 * Prévient quand la connexion change, et rend de quoi se désabonner.
 *
 * Passer du Wi-Fi aux données mobiles en pleine écoute est le cas qui
 * compte : sans cet écouteur, l'économie ne s'appliquerait qu'au morceau
 * suivant, c'est-à-dire trop tard pour une heure de mix.
 */
export function surChangementReseau(rappel: () => void): () => void {
  const c = connexion();
  if (!c?.addEventListener) return () => undefined;
  c.addEventListener("change", rappel);
  return () => c.removeEventListener?.("change", rappel);
}

/** Les débits estimés qui ne tiendraient de toute façon pas le 128 kb/s. */
const LENTES = new Set(["slow-2g", "2g", "3g"]);

/**
 * L'économie doit-elle s'appliquer, ici et maintenant ?
 *
 * En « auto », trois signaux suffisent, et chacun est une affirmation du
 * navigateur — jamais une déduction de notre part :
 *
 * 1. l'économiseur du navigateur est allumé : la demande vient de
 *    l'utilisateur, elle prime sur tout le reste ;
 * 2. le lien est déclaré cellulaire ;
 * 3. le débit estimé est en dessous de la 4G — auquel cas le 128 kb/s
 *    ne passerait pas sans coupures de toute façon, et le 64 kb/s est
 *    autant un service rendu qu'une économie.
 */
export function economieActive(mode: ModeEconomie, reseau: EtatReseau): boolean {
  if (mode === "toujours") return true;
  if (mode === "jamais") return false;

  if (reseau.economiseurNavigateur) return true;
  if (reseau.cellulaire === true) return true;
  if (reseau.vitesse && LENTES.has(reseau.vitesse)) return true;
  return false;
}

/**
 * La qualité réellement demandée.
 *
 * Ne remonte jamais : quelqu'un qui a choisi « Économe » à la main garde
 * son 64 kb/s même sur fibre.
 */
export function qualiteEconome(voulue: AudioQuality, active: boolean): AudioQuality {
  return active ? "low" : voulue;
}
