import type { PlayableSong, PlaySource } from "@/context/PlayerProvider";
import { listOfflineSongs } from "@/lib/offlineCache";

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
 */

/** Taille d'un tour de prolongement : environ une heure d'écoute. */
const PAR_TOUR = 20;

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

/** Retient les morceaux jouables, inédits, sans doublon interne. */
function retenir(candidats: unknown[], dejaVus: Set<string>, limite = PAR_TOUR): PlayableSong[] {
  const vus = new Set(dejaVus);
  const sortie: PlayableSong[] = [];
  for (const candidat of candidats) {
    if (sortie.length >= limite) break;
    if (!estJouable(candidat) || vus.has(candidat._id)) continue;
    vus.add(candidat._id);
    sortie.push(candidat);
  }
  return sortie;
}

// ---------- Stratégies par source ----------

/** La suite du catalogue de l'artiste, page après page. */
function davantageDeLArtiste(artistId: string, tour: number) {
  return titres(`/api/songs?artist=${artistId}&limit=${PAR_TOUR}&page=${tour + 1}`);
}

/** La page suivante des résultats — la première est déjà dans la file. */
function suiteDeLaRecherche(query: string, tour: number) {
  return titres(`/api/search?q=${encodeURIComponent(query)}&type=songs&limit=${PAR_TOUR}&page=${tour + 2}`);
}

function davantageDuGenre(genre: string, tour: number) {
  return titres(`/api/songs?genre=${encodeURIComponent(genre)}&sort=popular&limit=${PAR_TOUR}&page=${tour + 1}`);
}

function plusEcoutes(tour: number) {
  return titres(`/api/songs?sort=popular&limit=${PAR_TOUR}&page=${tour + 1}`);
}

/** Voisins du morceau : même artiste, featuring, genre, tags, album. */
function proches(songId: string) {
  return titres(`/api/songs/${songId}/similar?limit=${PAR_TOUR}`);
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
export async function morceauxSuivants(ctx: ContexteProlongement): Promise<PlayableSong[]> {
  // Hors-ligne : seuls les téléchargements existent, et c'est vrai quelle
  // que soit la source d'origine.
  if (!ctx.enLigne || ctx.source?.type === "downloads") {
    try {
      const telecharges = await listOfflineSongs();
      return retenir(telecharges as unknown[], ctx.dejaVus);
    } catch {
      return [];
    }
  }

  const principale = retenir(await selonLaSource(ctx), ctx.dejaVus);
  if (principale.length > 0) return principale;

  // Repli commun, du plus ciblé au plus large.
  if (ctx.dernier) {
    const voisins = retenir(await proches(ctx.dernier._id), ctx.dejaVus);
    if (voisins.length > 0) return voisins;
  }

  const conseils = retenir(await recommandations(), ctx.dejaVus);
  if (conseils.length > 0) return conseils;

  if (ctx.dernier?.genre) {
    const memeGenre = retenir(await davantageDuGenre(ctx.dernier.genre, ctx.tour), ctx.dejaVus);
    if (memeGenre.length > 0) return memeGenre;
  }

  return retenir(await plusEcoutes(ctx.tour), ctx.dejaVus);
}
