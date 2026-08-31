/**
 * Ce qu'on a déjà entendu aujourd'hui, sur cet appareil.
 *
 * LE PROBLÈME QU'IL RÈGLE
 *
 * La lecture automatique se prolonge indéfiniment en puisant dans le
 * catalogue. Sur une plateforme de quelques milliers de titres, elle
 * finit par reservir le même morceau trois fois dans la journée : la file
 * du matin est oubliée dès qu'on ferme l'onglet, et rien ne s'en
 * souvient. Ce journal s'en souvient.
 *
 * CE QU'IL N'EMPÊCHE JAMAIS
 *
 * Qu'un auditeur relance ce qu'il veut. Le filtre ne s'applique qu'au
 * remplissage AUTOMATIQUE de la file (lib/playbackContinuation.ts) :
 * cliquer un titre, lancer un album, une playlist ou « écouter le
 * prochain » ne passe pas par là et n'est donc jamais bloqué. La règle
 * est « ne pas resservir tout seul », pas « interdire ».
 *
 * POURQUOI LE SEUIL EST CELUI DE L'ÉCOUTE
 *
 * Un titre n'entre au journal que lorsqu'il compte comme une écoute — le
 * même seuil de trente secondes qui alimente les statistiques. Un morceau
 * sauté au bout de trois secondes n'a pas été entendu : il pourra
 * revenir, et c'est le profil de goûts qui décidera s'il faut cesser de
 * le proposer (lib/taste/profile.ts traite les abandons répétés comme un
 * refus).
 *
 * POURQUOI LA JOURNÉE EST CELLE DE L'AUDITEUR
 *
 * La coupure est à minuit chez lui, pas à minuit UTC. Quelqu'un qui
 * écoute jusqu'à deux heures du matin est encore dans sa soirée ; lui
 * remettre à zéro son journal à trois heures du matin locales — ce que
 * ferait une coupure UTC à Madagascar — le ferait tourner en rond.
 */

const CLE = "moziik-joues-du-jour";

/**
 * Au-delà, on cesse d'accumuler. Cinq cents titres représentent plus de
 * vingt-quatre heures d'écoute continue : la borne n'est pas une limite
 * fonctionnelle, elle empêche seulement le stockage local de gonfler si
 * quelque chose tourne mal.
 */
const MAX_TITRES = 500;

type Journal = { jour: string; ids: string[] };

/** La date locale au format AAAA-MM-JJ. C'est elle qui définit « aujourd'hui ». */
function jourLocal(): string {
  const d = new Date();
  const mois = String(d.getMonth() + 1).padStart(2, "0");
  const jour = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mois}-${jour}`;
}

function lire(): Journal {
  const vide = { jour: jourLocal(), ids: [] };
  if (typeof window === "undefined") return vide;
  try {
    const brut = localStorage.getItem(CLE);
    if (!brut) return vide;
    const journal = JSON.parse(brut) as Journal;
    // Le jour a changé : le journal d'hier ne dit plus rien d'aujourd'hui.
    // La remise à zéro se fait à la lecture plutôt que par un minuteur,
    // ce qui la rend correcte même après une nuit d'onglet ouvert.
    if (journal?.jour !== vide.jour || !Array.isArray(journal.ids)) return vide;
    return journal;
  } catch {
    // Stockage indisponible ou contenu illisible : on repart d'un journal
    // vide plutôt que d'empêcher la lecture.
    return vide;
  }
}

function ecrire(journal: Journal) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CLE, JSON.stringify(journal));
  } catch {
    // Quota atteint ou navigation privée stricte : le filtre ne
    // s'appliquera pas, la lecture continue. C'est le bon compromis.
  }
}

/** Note qu'un titre a été réellement écouté aujourd'hui. */
export function marquerJoue(songId: string) {
  if (!songId) return;
  const journal = lire();
  if (journal.ids.includes(songId)) return;
  journal.ids.push(songId);
  if (journal.ids.length > MAX_TITRES) journal.ids = journal.ids.slice(-MAX_TITRES);
  ecrire(journal);
}

/** Les titres déjà entendus aujourd'hui sur cet appareil. */
export function titresDuJour(): string[] {
  return lire().ids;
}


/** Efface le journal. Réservé à la déconnexion : un autre compte, une autre journée d'écoute. */
export function oublierLeJour() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(CLE);
  } catch {
    // Sans effet.
  }
}
