import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import Song from "@/models/Song";
import Artist from "@/models/Artist";
import Album from "@/models/Album";
import Playlist from "@/models/Playlist";
import Play from "@/models/Play";
import SiteConfigModel from "@/models/SiteConfig";
import { UNIVERS_PAR_DEFAUT, type Univers } from "@/lib/univers";

/**
 * Donner un univers à ce qui existait avant les univers.
 *
 * LE PROBLÈME, EN UNE PHRASE
 *
 * Une valeur par défaut Mongoose ne s'applique qu'à la création. Les
 * documents déjà en base n'ont donc pas de champ `univers` du tout — et
 * `find({ univers: "general" })` ne les voit pas. Sans ce rattrapage, le
 * déploiement de la séparation viderait l'accueil, la recherche, les
 * classements et la lecture automatique d'un seul coup, sur un catalogue
 * pourtant intact.
 *
 * POURQUOI ICI ET PAS DANS UN SCRIPT
 *
 * La base de production n'est joignable que depuis l'application, comme
 * l'explique déjà lib/homepageSections.ts pour son propre rattrapage. Un
 * script existe malgré tout (scripts/backfill-univers.mjs) pour qui
 * préfère le lancer à la main et voir ce qu'il fait.
 *
 * POURQUOI UN DRAPEAU EN BASE
 *
 * Le filtre « champ absent » ne peut s'appuyer sur aucun index : sur une
 * collection d'écoutes qui grossit, le laisser s'exécuter à chaque
 * démarrage à froid coûterait un balayage complet pour ne rien trouver.
 * Le drapeau vit dans la configuration du site, déjà lue et mise en cache
 * à chaque requête : le coût du cas normal est donc nul.
 */

const CONFIG_ID = "000000000000000000000001";

/** Identifiants passés à `$in` en une fois. Au-delà, le document de requête devient énorme. */
const LOT = 500;

let faitDansCeProcessus = false;

async function marquerFait() {
  await SiteConfigModel.updateOne(
    { _id: CONFIG_ID },
    { $set: { universBackfilledAt: new Date() } },
    { upsert: true }
  );
}

/**
 * Recopie l'univers des titres sur les écoutes qui les concernent.
 *
 * Exporté : une passe de classement change l'univers de titres, et
 * l'historique doit suivre — sans quoi le profil de goûts d'un auditeur
 * continuerait de compter ses écoutes de gospel du mauvais côté.
 *
 * Le travail se fait par lots d'identifiants plutôt qu'en une seule
 * requête : `$in` sur plusieurs milliers d'objets produit un document de
 * requête que le serveur refuse.
 */
export async function resynchroniserEcoutes(univers: Univers): Promise<number> {
  const ids = (await Song.find({ univers }).select("_id").lean()).map((s) => s._id as Types.ObjectId);
  let modifiees = 0;

  for (let i = 0; i < ids.length; i += LOT) {
    const lot = ids.slice(i, i + LOT);
    const { modifiedCount } = await Play.updateMany(
      { song: { $in: lot }, univers: { $ne: univers } },
      { $set: { univers } }
    );
    modifiees += modifiedCount ?? 0;
  }

  return modifiees;
}

export type ResultatRattrapage = {
  deja: boolean;
  artistes: number;
  titres: number;
  albums: number;
  playlists: number;
  ecoutes: number;
};

/**
 * Pose l'univers par défaut partout où le champ manque.
 *
 * Ne classe rien : tout part dans l'univers général, et c'est la
 * détection (/admin/univers) qui répartit ensuite. Séparer les deux est
 * délibéré — le rattrapage doit être rapide, sûr et sans surprise, alors
 * que la détection est un acte éditorial qu'un humain déclenche et
 * relit.
 */
export async function rattraperUnivers({ force = false } = {}): Promise<ResultatRattrapage> {
  await connectDB();

  if (!force) {
    const config = await SiteConfigModel.findById(CONFIG_ID).select("universBackfilledAt").lean();
    if ((config as { universBackfilledAt?: Date } | null)?.universBackfilledAt) {
      faitDansCeProcessus = true;
      return { deja: true, artistes: 0, titres: 0, albums: 0, playlists: 0, ecoutes: 0 };
    }
  }

  const absent = { univers: { $exists: false } };

  const [artistes, titres, albums, playlists, ecoutes] = await Promise.all([
    Artist.updateMany(absent, { $set: { univers: UNIVERS_PAR_DEFAUT, universSource: "auto" } }),
    Song.updateMany(absent, { $set: { univers: UNIVERS_PAR_DEFAUT, universSource: "artiste" } }),
    Album.updateMany(absent, { $set: { univers: UNIVERS_PAR_DEFAUT } }),
    Playlist.updateMany(absent, { $set: { univers: UNIVERS_PAR_DEFAUT } }),
    Play.updateMany(absent, { $set: { univers: UNIVERS_PAR_DEFAUT } }),
  ]);

  await marquerFait();
  faitDansCeProcessus = true;

  return {
    deja: false,
    artistes: artistes.modifiedCount ?? 0,
    titres: titres.modifiedCount ?? 0,
    albums: albums.modifiedCount ?? 0,
    playlists: playlists.modifiedCount ?? 0,
    ecoutes: ecoutes.modifiedCount ?? 0,
  };
}

/**
 * Garantit que le rattrapage a eu lieu, une fois par processus.
 *
 * Appelé sur le chemin de lecture de l'univers (lib/universServer.ts) :
 * c'est le point que traversent toutes les routes qui filtrent, et donc
 * le seul endroit où l'oubli serait impossible.
 */
export async function assurerUnivers(): Promise<void> {
  if (faitDansCeProcessus) return;
  // Posé avant l'attente : deux requêtes concurrentes sur une instance
  // froide ne doivent pas lancer deux balayages. Un échec le remettra à
  // faux, la requête suivante réessaiera.
  faitDansCeProcessus = true;
  try {
    await rattraperUnivers();
  } catch (err) {
    faitDansCeProcessus = false;
    // Non bloquant : une page à moitié filtrée vaut mieux qu'une erreur.
    console.error("[univers] rattrapage impossible", err);
  }
}
