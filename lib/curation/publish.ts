import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import Playlist from "@/models/Playlist";
import CurationRun from "@/models/CurationRun";
import HomepageSection from "@/models/HomepageSection";
import HomepagePinned from "@/models/HomepagePinned";
import { getSiteConfig } from "@/lib/siteConfig";

/**
 * Publier une analyse : rendre visible ce qui a été validé, retirer ce
 * qui l'était la semaine d'avant.
 *
 * SE BRANCHER PLUTÔT QU'AJOUTER
 *
 * L'accueil sait déjà afficher une section `custom` en mode `manual`
 * dont le contenu est épinglé (models/HomepagePinned.ts). La curation
 * n'écrit donc rien de neuf sur l'accueil : elle remplit ce mécanisme.
 * Aucune ligne de lib/homeContentEngine.ts n'a eu à changer, et une
 * section produite se déplace, se renomme ou s'éteint depuis
 * /admin/accueil comme n'importe quelle autre.
 *
 * CE QU'ON NE SUPPRIME JAMAIS
 *
 * Une playlist que quelqu'un suit. Elle est dans sa bibliothèque ; la
 * faire disparaître parce que la semaine est passée reviendrait à retirer
 * de chez lui quelque chose qu'il a rangé. Ces playlists-là restent
 * publiques et accessibles, elles quittent simplement l'accueil.
 */

/** Identifiant de la section produite. Stable : une seule section, pas une par semaine. */
export const SLUG_SECTION = "selections-hebdo";

/** Sécurité : au-delà, on n'épingle plus. Une section d'accueil ne défile pas à l'infini. */
const EPINGLES_MAX = 12;

export type ResultatPublication = {
  publiees: number;
  archivees: number;
  supprimees: number;
  section: string;
};

/**
 * Retire de l'accueil les playlists de l'analyse précédente.
 *
 * Elles ne sont pas supprimées ici : `purgerAnciennes` s'en charge plus
 * tard, et seulement pour celles que personne n'a gardées.
 */
async function archiverPrecedentes(runCourant: Types.ObjectId): Promise<number> {
  const { modifiedCount } = await Playlist.updateMany(
    {
      "auto.statut": "publiee",
      "auto.run": { $ne: runCourant },
    },
    { $set: { "auto.statut": "archivee" } }
  );

  // Une playlist archivée que personne ne suit sort de la vue publique.
  // Celle qui a des abonnés y reste : elle figure dans leur
  // bibliothèque, et `isPublic: false` la leur rendrait introuvable.
  await Playlist.updateMany(
    { "auto.statut": "archivee", followers: { $size: 0 } },
    { $set: { isPublic: false } }
  );

  return modifiedCount;
}

/**
 * Supprime les playlists archivées depuis assez longtemps que personne
 * ne suit.
 *
 * Sans cela, la collection gagne une poignée de playlists par semaine
 * pour toujours — et l'écran d'administration finit par lister trois cents
 * sélections mortes.
 */
export async function purgerAnciennes(semaines: number): Promise<number> {
  await connectDB();
  const limite = new Date(Date.now() - semaines * 7 * 24 * 60 * 60 * 1000);

  const { deletedCount } = await Playlist.deleteMany({
    "auto.statut": "archivee",
    "auto.genereeLe": { $lt: limite },
    followers: { $size: 0 },
  });

  return deletedCount ?? 0;
}

/**
 * Crée ou met à jour la section d'accueil, et y épingle les playlists.
 *
 * LE TITRE, ET À QUI IL APPARTIENT
 *
 * Deux torts symétriques à éviter. Écraser le titre à chaque publication
 * efface le renommage de l'admin, semaine après semaine. Ne jamais y
 * toucher fige sur l'accueil le titre de la toute première semaine, même
 * quand personne ne l'a choisi — c'est ce qui se produisait, et une
 * deuxième exécution suffit à le voir.
 *
 * On compare donc le titre en place à celui que la publication
 * précédente avait posé : identiques, personne n'y a touché et le
 * nouveau titre s'applique ; différents, c'est une décision humaine et
 * elle reste.
 *
 * La position, elle, ne s'impose qu'à la création : elle se règle depuis
 * /admin/accueil comme celle de n'importe quelle section.
 */
async function installerSection(
  titre: string,
  titrePrecedent: string,
  playlists: { _id: Types.ObjectId; rang: number }[],
  createdBy: Types.ObjectId
): Promise<string> {
  const config = await getSiteConfig();
  const position = config.curation?.sectionPosition ?? 6;

  const existante = await HomepageSection.findOne({ slug: SLUG_SECTION });

  if (!existante) {
    await HomepageSection.create({
      key: "custom",
      page: "home",
      slug: SLUG_SECTION,
      title: titre,
      enabled: true,
      position,
      // `manual` : le contenu vient exclusivement des épinglés
      // ci-dessous. En `auto`, le moteur de l'accueil recalculerait la
      // section et ignorerait la sélection validée.
      mode: "manual",
      algorithm: "curation",
      limit: Math.max(playlists.length, 1),
      filters: { publicOnly: true, verifiedOnly: false, premiumOnly: false },
    });
  } else {
    if (!titrePrecedent || existante.title === titrePrecedent) existante.title = titre;
    existante.limit = Math.max(playlists.length, 1);
    // Une analyse retirée a éteint la section (voir `retirerAnalyse`) :
    // publier de nouveau doit la rallumer, sans quoi la publication
    // suivante n'aurait aucun effet visible.
    existante.enabled = true;
    existante.updatedAt = new Date();
    await existante.save();
  }

  // Remplacement, pas ajout : sans cette suppression, les playlists de
  // la semaine passée resteraient épinglées sous celles de la nouvelle.
  await HomepagePinned.deleteMany({ section: SLUG_SECTION });

  if (playlists.length > 0) {
    await HomepagePinned.insertMany(
      playlists.slice(0, EPINGLES_MAX).map((p) => ({
        contentType: "playlist",
        contentId: p._id,
        section: SLUG_SECTION,
        // `priority` décroissante : le rang 0 doit s'afficher en
        // premier, et l'accueil trie par priorité décroissante.
        priority: EPINGLES_MAX - p.rang,
        createdBy,
      }))
    );
  }

  return SLUG_SECTION;
}

/**
 * Valide une analyse.
 *
 * Seules les playlists encore en brouillon sont publiées : celles que
 * l'admin a écartées ont été passées à `archivee` avant l'appel, et le
 * restent.
 */
export async function publierAnalyse({
  runId,
  publieePar,
}: {
  runId: string;
  publieePar?: string;
}): Promise<ResultatPublication> {
  await connectDB();

  const run = await CurationRun.findById(runId);
  if (!run) throw new Error("Analyse introuvable.");

  // Lu AVANT d'archiver quoi que ce soit : c'est le titre que la
  // publication précédente avait posé sur la section.
  const precedente = await CurationRun.findOne({
    statut: "publiee",
    _id: { $ne: run._id },
  }).sort({ publieeLe: -1 });

  const brouillons = await Playlist.find({
    "auto.run": run._id,
    "auto.statut": "brouillon",
  }).sort({ "auto.rang": 1 });

  // Une playlist vidée de tous ses titres par l'admin ne s'affiche pas :
  // la publier mettrait une pochette vide sur l'accueil.
  const publiables = brouillons.filter((p) => p.songs.length > 0);

  const archivees = await archiverPrecedentes(run._id as Types.ObjectId);

  await Promise.all(
    publiables.map((p) => {
      p.isPublic = true;
      if (p.auto) p.auto.statut = "publiee";
      return p.save();
    })
  );

  const proprietaire = (run.lancePar ?? publiables[0]?.owner) as Types.ObjectId | undefined;
  const section = proprietaire
    ? await installerSection(
        run.titreSection || "Les sélections de la semaine",
        precedente?.titreSection ?? "",
        publiables.map((p) => ({ _id: p._id as Types.ObjectId, rang: p.auto?.rang ?? 0 })),
        proprietaire
      )
    : SLUG_SECTION;

  const config = await getSiteConfig();
  const supprimees = await purgerAnciennes(config.curation?.retentionWeeks ?? 4);

  run.statut = "publiee";
  run.publieeLe = new Date();
  if (publieePar) run.publieePar = new Types.ObjectId(publieePar);
  run.updatedAt = new Date();
  await run.save();

  return { publiees: publiables.length, archivees, supprimees, section };
}

/**
 * Retire de l'accueil une analyse déjà publiée.
 *
 * Le geste inverse de la validation, pour l'admin qui s'aperçoit après
 * coup qu'une sélection ne va pas. Les playlists suivies restent
 * accessibles à ceux qui les ont gardées.
 */
export async function retirerAnalyse(runId: string): Promise<number> {
  await connectDB();

  const run = await CurationRun.findById(runId);
  if (!run) throw new Error("Analyse introuvable.");

  const { modifiedCount } = await Playlist.updateMany(
    { "auto.run": run._id, "auto.statut": "publiee" },
    { $set: { "auto.statut": "archivee" } }
  );
  await Playlist.updateMany(
    { "auto.run": run._id, "auto.statut": "archivee", followers: { $size: 0 } },
    { $set: { isPublic: false } }
  );

  await HomepagePinned.deleteMany({ section: SLUG_SECTION });
  // La section reste en place, vide : la supprimer perdrait le titre et
  // la position que l'admin y a peut-être ajustés.
  await HomepageSection.updateOne({ slug: SLUG_SECTION }, { $set: { enabled: false } });

  run.statut = "annulee";
  run.updatedAt = new Date();
  await run.save();

  return modifiedCount;
}
