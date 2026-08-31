import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import Playlist from "@/models/Playlist";
import CurationRun from "@/models/CurationRun";
import User from "@/models/User";
import { getSiteConfig } from "@/lib/siteConfig";
import { notifyMany } from "@/lib/notify";
import { fenetreHebdomadaire, libelleFenetre, type Fenetre } from "@/lib/curation/window";
import { collecterSignaux, type Signaux, type TitreCandidat } from "@/lib/curation/signals";
import { recettesDe } from "@/lib/curation/recipes";
import { selectionsDesModes } from "@/lib/curation/modes";
import { intentionRecette, libelleRecette } from "@/lib/curation/labels";
import { MODES_INFO, type Mode } from "@/lib/modes";
import { UNIVERS, UNIVERS_INFO, type Univers } from "@/lib/univers";
import { nommerLaSemaine, type PlaylistANommer } from "@/lib/curation/naming";
import { publierAnalyse } from "@/lib/curation/publish";

/**
 * L'analyse hebdomadaire, de bout en bout.
 *
 * L'enchaînement est toujours le même : mesurer, sélectionner, nommer,
 * enregistrer en brouillon. La publication est un acte distinct
 * (lib/curation/publish.ts), déclenché par un humain — ou par le réglage
 * `autoPublish` pour qui l'assume.
 *
 * DEUX ANALYSES NE TOURNENT PAS EN MÊME TEMPS
 *
 * Le cron et le bouton « Lancer maintenant » peuvent tomber ensemble. La
 * seconde exécution produirait un second jeu de playlists sur les mêmes
 * données, et l'admin en validerait un sans savoir que l'autre existe.
 * Une analyse déjà `en_cours` fait donc échouer la suivante, sans rien
 * écrire. Le verrou porte sur un univers : les deux analyses de la
 * semaine peuvent se dérouler l'une après l'autre sans se bloquer.
 *
 * UNE ANALYSE PAR UNIVERS
 *
 * Les mêmes recettes tournent deux fois, sur deux catalogues disjoints,
 * et produisent deux jeux de playlists nommés différemment. Une analyse
 * unique classerait le gospel et la variété dans le même palmarès : le
 * répertoire le moins fourni n'apparaîtrait jamais, et l'auditeur qui a
 * choisi cet univers verrait une section d'accueil vide.
 */

/** Au-delà, une analyse `en_cours` est tenue pour morte (processus interrompu). */
const VERROU_MS = 15 * 60 * 1000;

export type ResultatAnalyse = {
  run: string;
  univers: Univers;
  playlists: number;
  publiee: boolean;
  parIA: boolean;
};

export class CurationIndisponible extends Error {}

/** Propriétaire des playlists produites. */
async function proprietaire(lancePar?: string): Promise<Types.ObjectId> {
  if (lancePar) return new Types.ObjectId(lancePar);
  // Exécution par le cron : personne ne l'a demandée, on rattache au
  // premier compte administrateur. Créer un compte « système » dédié
  // ouvrirait une identité connectable pour un seul champ obligatoire.
  const admin = await User.findOne({ role: "admin" }).select("_id").sort({ createdAt: 1 });
  if (!admin) {
    throw new CurationIndisponible(
      "Aucun compte administrateur : les playlists produites n'auraient pas de propriétaire."
    );
  }
  return admin._id as Types.ObjectId;
}

/** Refuse de démarrer si une analyse est déjà en route pour cet univers. */
async function verifierVerrou(univers: Univers) {
  const encours = await CurationRun.findOne({ statut: "en_cours", univers }).sort({ createdAt: -1 });
  if (!encours) return;

  if (Date.now() - encours.createdAt.getTime() < VERROU_MS) {
    throw new CurationIndisponible(
      `Une analyse est déjà en cours pour l'univers ${UNIVERS_INFO[univers].label.toLowerCase()}. Réessaie dans quelques minutes.`
    );
  }

  // Plus vieille que le verrou : le processus qui l'a lancée n'existe
  // plus. On la marque échouée plutôt que de la laisser bloquer
  // indéfiniment toutes les suivantes.
  encours.statut = "echouee";
  encours.erreur = "Interrompue avant la fin (analyse restée en cours au-delà du délai).";
  encours.updatedAt = new Date();
  await encours.save();
}

/**
 * Écarte la proposition précédente restée en attente.
 *
 * Sans cela, relancer une analyse pendant qu'une autre attend validation
 * laissait derrière elle des brouillons que plus rien n'atteignait :
 * l'écran n'affiche que la dernière analyse, la publication ne touche que
 * la sienne, et la purge ne connaît que les archives. Ils s'entassaient
 * dans la collection des playlists à chaque clic, invisibles.
 *
 * Une nouvelle analyse remplace donc la proposition en attente : c'est
 * aussi ce qu'on attend d'elle, puisqu'elle porte sur les mêmes données.
 */
async function ecarterPropositionEnAttente(univers: Univers): Promise<number> {
  const enAttente = await CurationRun.find({ statut: "a_valider", univers }).select("_id");
  if (enAttente.length === 0) return 0;

  const ids = enAttente.map((r) => r._id);
  const { deletedCount } = await Playlist.deleteMany({
    "auto.run": { $in: ids },
    "auto.statut": "brouillon",
  });
  await CurationRun.updateMany(
    { _id: { $in: ids } },
    { $set: { statut: "annulee", updatedAt: new Date() } }
  );

  if (deletedCount) {
    console.warn(
      `[curation] ${deletedCount} proposition(s) non validée(s) remplacée(s) par la nouvelle analyse.`
    );
  }
  return deletedCount ?? 0;
}

/** Prévient les administrateurs qu'une sélection attend leur avis. */
async function avertirAdministrateurs(nb: number, fenetre: Fenetre, univers: Univers) {
  const admins = await User.find({ role: "admin" }).select("_id");
  if (admins.length === 0) return;
  await notifyMany(
    admins.map((a) => a._id.toString()),
    {
      type: "system",
      title: `Sélections ${UNIVERS_INFO[univers].label.toLowerCase()} à valider`,
      message: `${nb} playlist(s) proposée(s) ${libelleFenetre(fenetre.from, fenetre.to)} pour l'univers ${UNIVERS_INFO[univers].label.toLowerCase()}. Rien n'est publié tant que tu n'as pas validé.`,
      link: `/admin/selections?univers=${univers}`,
    }
  );
}

type SelectionRetenue = PlaylistANommer & { titres: string[]; rang: number; mode?: Mode };

/**
 * Construit les sélections de la semaine : les recettes globales
 * d'abord, les modes d'écoute ensuite.
 *
 * L'ordre compte : les sélections générales occupent la section
 * historique de l'accueil, celle que tout le monde voit quel que soit son
 * mode. Les sections de mode viennent après, et une seule s'affiche à la
 * fois (lib/homeContentEngine.ts).
 */
function selectionner(signaux: Signaux, eteintes: Set<string>, univers: Univers): SelectionRetenue[] {
  const retenues: SelectionRetenue[] = [];

  recettesDe(univers).forEach((recette) => {
    if (eteintes.has(recette.id)) return;

    let selection;
    try {
      selection = recette.construire(signaux);
    } catch (err) {
      // Une recette qui échoue ne doit pas emporter les six autres.
      console.error(`[curation] recette « ${recette.id} » en erreur, ignorée.`, err);
      return;
    }
    if (!selection) return;

    retenues.push({
      id: recette.id,
      // Le libellé de repli dépend de l'univers : « Top de la semaine »
      // d'un côté, « Gospel de la semaine » de l'autre.
      libelle: selection.libelle ?? libelleRecette(recette.id, univers),
      detail: recette.detail,
      intention: intentionRecette(recette.id, univers),
      motif: selection.motif,
      extraits: extraitsDe(signaux, selection.titres),
      titres: selection.titres,
      rang: retenues.length,
    });
  });

  for (const selection of selectionsDesModes(signaux, univers, eteintes)) {
    retenues.push({
      id: selection.id,
      mode: selection.mode,
      libelle: selection.libelle,
      detail: MODES_INFO[selection.mode].detail,
      intention: selection.intention,
      motif: selection.motif,
      extraits: extraitsDe(signaux, selection.titres),
      titres: selection.titres,
      rang: retenues.length,
    });
  }

  return retenues;
}

/** Les titres d'une sélection, résolus sur le catalogue mesuré. */
function extraitsDe(signaux: Signaux, ids: string[]): TitreCandidat[] {
  return ids.map((id) => signaux.catalogue.get(id)).filter((t): t is TitreCandidat => Boolean(t));
}

/**
 * Lance une analyse et enregistre ses propositions.
 *
 * `reference` sert aux essais : elle décale la fenêtre analysée sans
 * toucher à l'horloge.
 */
export async function lancerAnalyse({
  declencheur,
  lancePar,
  reference,
  univers,
}: {
  declencheur: "cron" | "admin";
  lancePar?: string;
  reference?: Date;
  univers: Univers;
}): Promise<ResultatAnalyse> {
  await connectDB();

  const config = await getSiteConfig();
  const reglages = config.curation;
  if (reglages && reglages.enabled === false) {
    throw new CurationIndisponible("La curation hebdomadaire est désactivée dans les réglages.");
  }

  await verifierVerrou(univers);
  await ecarterPropositionEnAttente(univers);

  const fenetre = fenetreHebdomadaire(reference);
  const owner = await proprietaire(lancePar);

  const run = await CurationRun.create({
    from: fenetre.from,
    to: fenetre.to,
    univers,
    statut: "en_cours",
    declencheur,
    lancePar: lancePar ? new Types.ObjectId(lancePar) : undefined,
  });

  try {
    const signaux = await collecterSignaux(fenetre, univers);
    const eteintes = new Set(reglages?.disabled ?? []);
    const selections = selectionner(signaux, eteintes, univers);

    if (selections.length === 0) {
      run.statut = "echouee";
      run.erreur = `Aucune sélection n'atteint son minimum de titres dans l'univers ${UNIVERS_INFO[univers].label.toLowerCase()}. La semaine est trop calme, ou le catalogue trop petit de ce côté.`;
      run.stats = {
        ecoutes: signaux.ecoutes,
        auditeurs: signaux.auditeurs,
        recherches: signaux.volumeRecherches,
        nouveautes: 0,
        titresConsideres: signaux.catalogue.size,
      };
      run.updatedAt = new Date();
      await run.save();
      throw new CurationIndisponible(run.erreur);
    }

    const nommage = await nommerLaSemaine(selections, {
      from: fenetre.from,
      to: fenetre.to,
      compte: lancePar ?? "cron",
      univers,
    });

    // Les playlists arrivent en brouillon : `isPublic: false` les rend
    // invisibles partout où le site filtre déjà sur ce champ, sans
    // qu'aucune page n'ait à connaître la curation.
    const creees = await Promise.all(
      selections.map(async (s, index) => {
        const mots = nommage.playlists.get(s.id);
        return Playlist.create({
          title: mots?.titre || s.libelle,
          description: mots?.description || s.detail,
          coverUrl: s.extraits[0]?.pochette || undefined,
          owner,
          songs: s.titres.map((id) => new Types.ObjectId(id)),
          isPublic: false,
          univers,
          auto: {
            kind: s.id,
            mode: s.mode,
            run: run._id,
            statut: "brouillon",
            motif: s.motif,
            genereeLe: new Date(),
            rang: index,
          },
        });
      })
    );

    const nouveautes = selections.find((s) => s.id === "nouveautes")?.titres.length ?? 0;

    run.stats = {
      ecoutes: signaux.ecoutes,
      auditeurs: signaux.auditeurs,
      recherches: signaux.volumeRecherches,
      nouveautes,
      titresConsideres: signaux.catalogue.size,
    };
    run.titreSection = nommage.titreSection;
    run.resume = nommage.resume;
    run.redigeParIA = nommage.parIA;
    run.statut = "a_valider";
    run.updatedAt = new Date();
    await run.save();

    if (reglages?.autoPublish) {
      await publierAnalyse({ runId: run._id.toString() });
      return { run: run._id.toString(), univers, playlists: creees.length, publiee: true, parIA: nommage.parIA };
    }

    await avertirAdministrateurs(creees.length, fenetre, univers);
    return { run: run._id.toString(), univers, playlists: creees.length, publiee: false, parIA: nommage.parIA };
  } catch (err) {
    if (run.statut === "en_cours") {
      run.statut = "echouee";
      run.erreur = err instanceof Error ? err.message : "Échec inattendu.";
      run.updatedAt = new Date();
      await run.save().catch(() => {});
    }
    throw err;
  }
}

export type ResultatSemaine = {
  analyses: ResultatAnalyse[];
  /** Univers pour lesquels rien n'a pu être produit, et pourquoi. */
  echecs: { univers: Univers; raison: string }[];
};

/**
 * L'analyse de la semaine, pour les deux univers.
 *
 * Séquentielle, et non parallèle : les deux passes lisent la même
 * collection d'écoutes avec des agrégations lourdes, et le nommage passe
 * par le même plafond d'appels au modèle. Les enchaîner coûte quelques
 * secondes de plus et évite de doubler la charge d'un coup — sur une
 * tâche qui tourne une fois par semaine, c'est le bon arbitrage.
 *
 * Un univers qui n'a rien à proposer — catalogue trop mince, semaine trop
 * calme — n'empêche pas l'autre d'aboutir. C'est le cas normal d'un
 * démarrage : le répertoire évangélique peut être vide pendant que le
 * général tourne déjà.
 */
export async function lancerAnalyseHebdomadaire({
  declencheur,
  lancePar,
  reference,
}: {
  declencheur: "cron" | "admin";
  lancePar?: string;
  reference?: Date;
}): Promise<ResultatSemaine> {
  const analyses: ResultatAnalyse[] = [];
  const echecs: { univers: Univers; raison: string }[] = [];

  for (const univers of UNIVERS) {
    try {
      analyses.push(await lancerAnalyse({ declencheur, lancePar, reference, univers }));
    } catch (err) {
      const raison = err instanceof Error ? err.message : "Échec inattendu.";
      echecs.push({ univers, raison });
      // La curation entièrement désactivée vaut pour les deux univers :
      // insister sur le second n'apporterait qu'un second message
      // identique.
      if (err instanceof CurationIndisponible && raison.includes("désactivée")) break;
      if (!(err instanceof CurationIndisponible)) console.error(`[curation] univers ${univers} en échec`, err);
    }
  }

  return { analyses, echecs };
}
