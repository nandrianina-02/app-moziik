import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import Playlist from "@/models/Playlist";
import CurationRun from "@/models/CurationRun";
import User from "@/models/User";
import { getSiteConfig } from "@/lib/siteConfig";
import { notifyMany } from "@/lib/notify";
import { fenetreHebdomadaire, libelleFenetre, type Fenetre } from "@/lib/curation/window";
import { collecterSignaux, type Signaux, type TitreCandidat } from "@/lib/curation/signals";
import { RECETTES } from "@/lib/curation/recipes";
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
 * écrire.
 */

/** Au-delà, une analyse `en_cours` est tenue pour morte (processus interrompu). */
const VERROU_MS = 15 * 60 * 1000;

export type ResultatAnalyse = {
  run: string;
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

/** Refuse de démarrer si une analyse est déjà en route. */
async function verifierVerrou() {
  const encours = await CurationRun.findOne({ statut: "en_cours" }).sort({ createdAt: -1 });
  if (!encours) return;

  if (Date.now() - encours.createdAt.getTime() < VERROU_MS) {
    throw new CurationIndisponible("Une analyse est déjà en cours. Réessaie dans quelques minutes.");
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
async function ecarterPropositionEnAttente(): Promise<number> {
  const enAttente = await CurationRun.find({ statut: "a_valider" }).select("_id");
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
async function avertirAdministrateurs(nb: number, fenetre: Fenetre) {
  const admins = await User.find({ role: "admin" }).select("_id");
  if (admins.length === 0) return;
  await notifyMany(
    admins.map((a) => a._id.toString()),
    {
      type: "system",
      title: "Sélections de la semaine à valider",
      message: `${nb} playlist(s) proposée(s) ${libelleFenetre(fenetre.from, fenetre.to)}. Rien n'est publié tant que tu n'as pas validé.`,
      link: "/admin/selections",
    }
  );
}

/** Construit les sélections des recettes actives. */
function selectionner(signaux: Signaux, eteintes: Set<string>) {
  const retenues: (PlaylistANommer & { titres: string[]; rang: number })[] = [];

  RECETTES.forEach((recette) => {
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

    const extraits = selection.titres
      .map((id) => signaux.catalogue.get(id))
      .filter((t): t is TitreCandidat => Boolean(t));

    retenues.push({
      recette,
      libelle: selection.libelle ?? recette.libelle,
      motif: selection.motif,
      extraits,
      titres: selection.titres,
      rang: retenues.length,
    });
  });

  return retenues;
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
}: {
  declencheur: "cron" | "admin";
  lancePar?: string;
  reference?: Date;
}): Promise<ResultatAnalyse> {
  await connectDB();

  const config = await getSiteConfig();
  const reglages = config.curation;
  if (reglages && reglages.enabled === false) {
    throw new CurationIndisponible("La curation hebdomadaire est désactivée dans les réglages.");
  }

  await verifierVerrou();
  await ecarterPropositionEnAttente();

  const fenetre = fenetreHebdomadaire(reference);
  const owner = await proprietaire(lancePar);

  const run = await CurationRun.create({
    from: fenetre.from,
    to: fenetre.to,
    statut: "en_cours",
    declencheur,
    lancePar: lancePar ? new Types.ObjectId(lancePar) : undefined,
  });

  try {
    const signaux = await collecterSignaux(fenetre);
    const eteintes = new Set(reglages?.disabled ?? []);
    const selections = selectionner(signaux, eteintes);

    if (selections.length === 0) {
      run.statut = "echouee";
      run.erreur =
        "Aucune sélection n'atteint son minimum de titres. La semaine est trop calme, ou le catalogue trop petit.";
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
    });

    // Les playlists arrivent en brouillon : `isPublic: false` les rend
    // invisibles partout où le site filtre déjà sur ce champ, sans
    // qu'aucune page n'ait à connaître la curation.
    const creees = await Promise.all(
      selections.map(async (s, index) => {
        const mots = nommage.playlists.get(s.recette.id);
        return Playlist.create({
          title: mots?.titre || s.libelle,
          description: mots?.description || s.recette.detail,
          coverUrl: s.extraits[0]?.pochette || undefined,
          owner,
          songs: s.titres.map((id) => new Types.ObjectId(id)),
          isPublic: false,
          auto: {
            kind: s.recette.id,
            run: run._id,
            statut: "brouillon",
            motif: s.motif,
            genereeLe: new Date(),
            rang: index,
          },
        });
      })
    );

    const nouveautes = selections.find((s) => s.recette.id === "nouveautes")?.titres.length ?? 0;

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
      return { run: run._id.toString(), playlists: creees.length, publiee: true, parIA: nommage.parIA };
    }

    await avertirAdministrateurs(creees.length, fenetre);
    return { run: run._id.toString(), playlists: creees.length, publiee: false, parIA: nommage.parIA };
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
