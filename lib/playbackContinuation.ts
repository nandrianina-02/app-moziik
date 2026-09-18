import type { PlayableSong, PlaySource } from "@/context/PlayerProvider";
import { listOfflineSongs } from "@/lib/offlineCache";
import { titresDuJour } from "@/lib/journalDuJour";

/**
 * De quoi prolonger la lecture quand la file arrive à son terme.
 *
 * Le lecteur s'arrêtait net sur le dernier morceau : un album de neuf
 * titres, une recherche, une page d'artiste, et le silence. Ce module
 * répond à une seule question — « qu'est-ce qui vient après ? » — et la
 * réponse dépend de ce qui a lancé la lecture. Prolonger un album par
 * d'autres titres du même artiste n'a rien à voir avec prolonger une
 * recherche, qui se poursuit à la page suivante des résultats.
 *
 * Chaque source a sa stratégie propre, puis toutes retombent sur la même
 * chaîne de repli : les titres proches du dernier morceau joué, les
 * recommandations du compte, enfin les plus écoutés. Il y a donc toujours
 * une suite, y compris pour un catalogue qui ne connaît pas encore
 * l'auditeur.
 *
 * Hors-ligne, une seule source est possible — les téléchargements. Le
 * service worker ne met jamais `/api/` en cache (deux comptes sur un même
 * appareil se reverraient l'un l'autre), donc tout appel réseau échoue
 * franchement et il n'y a rien à récupérer ailleurs.
 *
 * CE QUI A DÉJÀ ÉTÉ ENTENDU AUJOURD'HUI NE REVIENT PAS
 *
 * Un titre n'est servi automatiquement qu'une fois par jour
 * (lib/journalDuJour.ts). C'est ici, et nulle part ailleurs, que le
 * filtre s'applique : lancer un album, une playlist ou un titre reste un
 * geste de l'auditeur, et rien ne le lui refuse.
 *
 * MAIS LA MUSIQUE NE S'ARRÊTE JAMAIS POUR AUTANT
 *
 * Sur un petit catalogue, une journée d'écoute suffit à tout épuiser. Si
 * chaque stratégie revient vide une fois le filtre appliqué, un second
 * passage le lève. Une répétition vaut mieux qu'un silence — c'est le
 * même arbitrage que la station, qui relâche ses contraintes une par une
 * plutôt que de rendre une file trop courte.
 */

/** Taille d'un tour de prolongement : environ une heure d'écoute. */
const PAR_TOUR = 20;

/**
 * Ce qu'on demande au serveur avant de choisir.
 *
 * On en réclamait exactement vingt, qu'on servait dans l'ordre reçu : la
 * même page, le même tri, donc la **même suite à chaque écoute**. Demander
 * trois fois plus laisse de quoi choisir — par le tempo d'abord, au
 * hasard ensuite — et deux passages dans le même contexte ne donnent plus
 * la même file. Le surcoût est d'environ quatre kilo-octets comprimés,
 * une fois par heure d'écoute.
 *
 * Certaines routes plafonnent plus bas : `similar` à 30, `search` à 50.
 * On ne demande jamais plus que ce qu'elles acceptent, sans quoi elles
 * retomberaient sur leur propre défaut.
 */
const VIVIER = PAR_TOUR * 3;
const VIVIER_SIMILAIRES = 30;
const VIVIER_RECHERCHE = 50;

/**
 * L'AMBIANCE SE PROLONGE PAR LE TEMPO
 *
 * Enchaîner un morceau à 150 sur une ballade à 70 casse ce qu'on venait
 * d'installer. À défaut de savoir décrire une ambiance, le tempo en est
 * le meilleur indice mesurable, et le seul dont dispose le catalogue.
 *
 * Deux réserves l'empêchent d'être un filtre :
 *
 * - **Il manque sur la majorité du catalogue.** Trente-sept pour cent des
 *   titres publiés portent un tempo — les imports antérieurs à l'analyse
 *   automatique n'en ont pas. Écarter les autres viderait la file.
 * - **Un tempo proche ne fait pas une ambiance.** Il ordonne, il ne
 *   décide pas : les stratégies par source (même artiste, même genre,
 *   suite de la station) restent ce qui choisit QUOI proposer.
 *
 * D'où un classement en quatre paquets, mélangés chacun de leur côté :
 * proche, acceptable, tempo inconnu, éloigné. Le tempo inconnu passe
 * avant l'éloigné — ne pas savoir vaut mieux que savoir que ça ne colle
 * pas.
 */
const ECART_PROCHE = 8;
const ECART_ACCEPTABLE = 20;

/**
 * Écart de tempo entre deux morceaux, moitié et double compris.
 *
 * Un morceau à 140 partage sa pulsation avec un morceau à 70 : c'est la
 * même ambiance comptée deux fois plus vite. Les traiter comme éloignés
 * de 70 battements écarterait des enchaînements que l'oreille trouve
 * naturels.
 */
function ecartTempo(a: number, b: number): number {
  return Math.min(Math.abs(a - b), Math.abs(a - 2 * b), Math.abs(2 * a - b));
}

/** Mélange en place, façon Fisher-Yates. */
function melanger<T>(liste: T[]): T[] {
  for (let i = liste.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [liste[i], liste[j]] = [liste[j], liste[i]];
  }
  return liste;
}

/**
 * Range les candidats par proximité de tempo, au hasard à l'intérieur.
 *
 * Sans tempo de référence — le cas le plus fréquent — il ne reste que le
 * mélange, ce qui suffit déjà à ne pas resservir la même file.
 */
function ordonnerParAmbiance(candidats: PlayableSong[], tempoRef?: number): PlayableSong[] {
  if (!tempoRef || tempoRef <= 0) return melanger([...candidats]);

  const proches: PlayableSong[] = [];
  const acceptables: PlayableSong[] = [];
  const inconnus: PlayableSong[] = [];
  const eloignes: PlayableSong[] = [];

  for (const c of candidats) {
    if (!c.bpm || c.bpm <= 0) {
      inconnus.push(c);
      continue;
    }
    const ecart = ecartTempo(c.bpm, tempoRef);
    if (ecart <= ECART_PROCHE) proches.push(c);
    else if (ecart <= ECART_ACCEPTABLE) acceptables.push(c);
    else eloignes.push(c);
  }

  return [
    ...melanger(proches),
    ...melanger(acceptables),
    ...melanger(inconnus),
    ...melanger(eloignes),
  ];
}

export type ContexteProlongement = {
  source: PlaySource;
  /** Dernier morceau joué : socle de toutes les stratégies de repli. */
  dernier: PlayableSong | null;
  /** Identifiants déjà présents dans la file, à ne pas resservir. */
  dejaVus: Set<string>;
  enLigne: boolean;
  /** Nombre de prolongements déjà servis pour cette file — sert à paginer. */
  tour: number;
};

async function lireJson(url: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    // Réseau coupé, requête annulée, réponse illisible : dans tous les cas
    // cette stratégie n'a rien à offrir, et la suivante prend le relais.
    return null;
  }
}

async function titres(url: string): Promise<unknown[]> {
  const data = await lireJson(url);
  return Array.isArray(data?.songs) ? (data.songs as unknown[]) : [];
}

/** Un morceau n'est jouable que s'il a une source audio. */
function estJouable(valeur: unknown): valeur is PlayableSong {
  const s = valeur as PlayableSong | null;
  return !!s && typeof s._id === "string" && typeof s.audioUrl === "string" && s.audioUrl.length > 0;
}

/**
 * Retient les morceaux jouables, inédits, sans doublon interne.
 *
 * Le tri par ambiance s'applique à TOUT le vivier avant la coupe, et non
 * aux vingt premiers : trancher d'abord reviendrait à mélanger ce que le
 * serveur avait déjà choisi pour nous, sans jamais atteindre les morceaux
 * qui collent vraiment au tempo.
 */
function retenir(
  candidats: unknown[],
  dejaVus: Set<string>,
  tempoRef?: number,
  limite = PAR_TOUR
): PlayableSong[] {
  const vus = new Set(dejaVus);
  const eligibles: PlayableSong[] = [];
  for (const candidat of candidats) {
    if (!estJouable(candidat) || vus.has(candidat._id)) continue;
    vus.add(candidat._id);
    eligibles.push(candidat);
  }
  return ordonnerParAmbiance(eligibles, tempoRef).slice(0, limite);
}

/**
 * Les exclusions d'un passage : ce qui est déjà dans la file, et — au
 * premier passage seulement — ce qui a été entendu aujourd'hui.
 */
function exclusions(ctx: ContexteProlongement, avecLeJour: boolean): Set<string> {
  if (!avecLeJour) return ctx.dejaVus;
  const tout = new Set(ctx.dejaVus);
  for (const id of titresDuJour()) tout.add(id);
  return tout;
}

// ---------- Stratégies par source ----------

/** La suite du catalogue de l'artiste, page après page. */
function davantageDeLArtiste(artistId: string, tour: number) {
  return titres(`/api/songs?artist=${artistId}&limit=${VIVIER}&page=${tour + 1}`);
}

/**
 * Les résultats suivants.
 *
 * La première page est déjà dans la file, mais on ne la saute plus : à
 * soixante résultats par page, la sauter passerait par-dessus des titres
 * jamais joués. C'est `retenir` qui écarte ce qui est déjà en file, et il
 * le fait mieux qu'une arithmétique de pagination.
 */
function suiteDeLaRecherche(query: string, tour: number) {
  return titres(
    `/api/search?q=${encodeURIComponent(query)}&type=songs&limit=${VIVIER_RECHERCHE}&page=${tour + 1}`
  );
}

function davantageDuGenre(genre: string, tour: number) {
  return titres(`/api/songs?genre=${encodeURIComponent(genre)}&sort=popular&limit=${VIVIER}&page=${tour + 1}`);
}

function plusEcoutes(tour: number) {
  return titres(`/api/songs?sort=popular&limit=${VIVIER}&page=${tour + 1}`);
}

/** Voisins du morceau : même artiste, featuring, genre, tags, album. */
function proches(songId: string) {
  return titres(`/api/songs/${songId}/similar?limit=${VIVIER_SIMILAIRES}`);
}

/** Recommandations du compte, d'après ses écoutes des trente derniers jours. */
function recommandations() {
  return titres("/api/recommendations");
}

/**
 * La suite d'une station personnalisée.
 *
 * On transmet ce qui est déjà dans la file : c'est ce qui évite qu'un
 * prolongement resserve les mêmes morceaux, et c'est aussi ce qui permet
 * à la station de tourner indéfiniment. L'heure locale repart à chaque
 * tour : une écoute qui commence le soir et se poursuit la nuit suit le
 * moment de la journée.
 */
function suiteDeLaStation(dejaVus: Set<string>) {
  // Seule la file part ici, pas le journal du jour. Deux raisons : le
  // serveur tient déjà ce registre pour les comptes connectés, avec
  // l'avantage de couvrir tous leurs appareils ; et surtout, mélanger les
  // deux listes lui retirerait le moyen de distinguer « déjà dans la
  // file » de « déjà entendu aujourd'hui » — donc de relâcher le second
  // quand le catalogue est épuisé. Pour un visiteur anonyme, le filtrage
  // se fait au retour, dans `retenir`.
  const exclus = [...dejaVus].slice(0, 400).join(",");
  const heure = new Date().getHours();
  return titres(`/api/station?suite=1&heure=${heure}&exclus=${encodeURIComponent(exclus)}`);
}

/**
 * Stratégie principale, celle qui respecte l'intention de départ.
 * Renvoie une liste vide dès qu'elle ne s'applique pas : le repli suivra.
 */
async function selonLaSource(ctx: ContexteProlongement): Promise<unknown[]> {
  const { source, dernier, tour } = ctx;
  const artisteDuDernier = dernier?.artist?._id;

  switch (source?.type) {
    case "artist":
      // L'identifiant de la source d'abord : la file peut contenir des
      // featurings dont l'artiste principal n'est pas celui de la page.
      return davantageDeLArtiste(source.id ?? artisteDuDernier ?? "", tour);

    case "album":
      // Un album est fini par nature. On enchaîne sur le reste de l'œuvre
      // de son auteur, ce qui est le prolongement le plus attendu.
      return artisteDuDernier ? davantageDeLArtiste(artisteDuDernier, tour) : [];

    case "search":
      return source.query ? suiteDeLaRecherche(source.query, tour) : [];

    case "chart":
      return plusEcoutes(tour);

    case "radio":
      // Une station personnalisée se prolonge par elle-même ; les
      // stations de genre par leur genre ; la station générale par les
      // plus écoutés.
      if (source.station) return suiteDeLaStation(ctx.dejaVus);
      return source.genre ? davantageDuGenre(source.genre, tour) : plusEcoutes(tour);

    case "favorites":
    case "history":
      // Ces deux files disent le goût de l'auditeur mieux que n'importe
      // quel critère de catalogue : on suit les recommandations du compte.
      return recommandations();

    case "playlist":
      // Une playlist n'a pas de « suite » : sa radio se déduit de ce qui
      // vient d'être joué. Le repli commun fait exactement cela.
      return [];

    default:
      return [];
  }
}

/**
 * Les morceaux à ajouter à la file, ou une liste vide si le catalogue n'a
 * plus rien à proposer pour cette source.
 */
/** Un passage complet des stratégies, avec un jeu d'exclusions donné. */
async function unPassage(ctx: ContexteProlongement, exclus: Set<string>): Promise<PlayableSong[]> {
  // Le tempo du dernier morceau joué sert de repère à toutes les
  // stratégies : c'est lui qui vient de s'installer dans l'oreille.
  const tempo = ctx.dernier?.bpm;

  const principale = retenir(await selonLaSource(ctx), exclus, tempo);
  if (principale.length > 0) return principale;

  // Repli commun, du plus ciblé au plus large.
  if (ctx.dernier) {
    const voisins = retenir(await proches(ctx.dernier._id), exclus, tempo);
    if (voisins.length > 0) return voisins;
  }

  const conseils = retenir(await recommandations(), exclus, tempo);
  if (conseils.length > 0) return conseils;

  if (ctx.dernier?.genre) {
    const memeGenre = retenir(await davantageDuGenre(ctx.dernier.genre, ctx.tour), exclus, tempo);
    if (memeGenre.length > 0) return memeGenre;
  }

  return retenir(await plusEcoutes(ctx.tour), exclus, tempo);
}

export async function morceauxSuivants(ctx: ContexteProlongement): Promise<PlayableSong[]> {
  // Hors-ligne : seuls les téléchargements existent, et c'est vrai quelle
  // que soit la source d'origine. Le filtre du jour s'y applique aussi,
  // mais il cède immédiatement — une bibliothèque téléchargée est petite,
  // et elle est faite pour tourner en boucle.
  if (!ctx.enLigne || ctx.source?.type === "downloads") {
    try {
      const telecharges = (await listOfflineSongs()) as unknown[];
      const tempo = ctx.dernier?.bpm;
      const inedits = retenir(telecharges, exclusions(ctx, true), tempo);
      // Une bibliothèque téléchargée est petite et tourne en boucle : le
      // mélange y compte encore plus qu'en ligne, sinon c'est le même
      // ordre à chaque fois qu'on arrive au bout.
      return inedits.length > 0 ? inedits : retenir(telecharges, ctx.dejaVus, tempo);
    } catch {
      return [];
    }
  }

  const inedits = await unPassage(ctx, exclusions(ctx, true));
  if (inedits.length > 0) return inedits;

  // Tout ce que le catalogue avait à offrir a déjà tourné aujourd'hui. On
  // relâche le filtre du jour plutôt que de laisser le silence : la file
  // reprendra des titres entendus ce matin, ce qui reste préférable à un
  // lecteur qui s'arrête sans rien dire.
  return unPassage(ctx, ctx.dejaVus);
}

