import { fenetreHebdomadaire, libelleFenetre, type Fenetre } from "@/lib/curation/window";
import {
  audience,
  catalogue,
  comportement,
  artistesEnMouvement,
  tendancesGenres,
  type Audience,
  type Catalogue,
  type Comportement,
  type ArtisteEnMouvement,
  type TendanceGenre,
} from "@/lib/insights/metrics";
import { retentionParCohortes, type Cohorte } from "@/lib/insights/retention";
import { detecterAnomalies, type Anomalie } from "@/lib/insights/anomalies";
import { comptesSuspects, type CompteSuspect } from "@/lib/insights/suspects";
import { previsionAudience, titresQuiMontent, type PrevisionAudience, type TitreQuiMonte } from "@/lib/insights/forecast";

/**
 * Le rapport d'exploitation : tout ce qui se mesure, rassemblé.
 *
 * La fenêtre est la même que celle de la curation
 * (lib/curation/window.ts) : sept jours pleins, bornés à minuit UTC, le
 * jour en cours exclu. Deux fenêtres différentes dans la même
 * administration produiraient deux chiffres d'audience pour la même
 * semaine, et personne ne saurait lequel croire.
 */

export type Rapport = {
  fenetre: { from: Date; to: Date; libelle: string };
  audience: Audience;
  /** L'audience de la semaine précédente, pour situer. */
  audiencePrecedente: Audience;
  comportement: Comportement;
  catalogue: Catalogue;
  artistes: { montent: ArtisteEnMouvement[]; decrochent: ArtisteEnMouvement[] };
  genres: TendanceGenre[];
  cohortes: Cohorte[];
  anomalies: Anomalie[];
  /** Comptes dont l'activité mérite un regard. Signalement, jamais sanction. */
  suspects: CompteSuspect[];
  /** `null` quand l'historique est trop court pour prolonger quoi que ce soit. */
  prevision: PrevisionAudience | null;
  titresQuiMontent: TitreQuiMonte[];
};

/** Calcule le rapport d'une fenêtre. Aucune écriture, aucun appel à un modèle. */
export async function construireRapport(fenetre: Fenetre = fenetreHebdomadaire()): Promise<Rapport> {
  const [
    audienceCourante,
    audiencePrecedente,
    comportementCourant,
    catalogueCourant,
    artistes,
    genres,
    cohortes,
    anomalies,
    prevision,
    montants,
    suspects,
  ] = await Promise.all([
    audience(fenetre.from, fenetre.to),
    audience(fenetre.precedenteFrom, fenetre.precedenteTo),
    comportement(fenetre.from, fenetre.to),
    catalogue(fenetre.from, fenetre.to),
    artistesEnMouvement(fenetre.from, fenetre.to, fenetre.precedenteFrom, fenetre.precedenteTo),
    tendancesGenres(fenetre.from, fenetre.to, fenetre.precedenteFrom, fenetre.precedenteTo),
    retentionParCohortes(),
    detecterAnomalies(fenetre.from, fenetre.to),
    previsionAudience(),
    titresQuiMontent(),
    comptesSuspects(fenetre.from, fenetre.to),
  ]);

  return {
    fenetre: {
      from: fenetre.from,
      to: fenetre.to,
      libelle: libelleFenetre(fenetre.from, fenetre.to),
    },
    audience: audienceCourante,
    audiencePrecedente,
    comportement: comportementCourant,
    catalogue: catalogueCourant,
    artistes,
    genres,
    cohortes,
    anomalies,
    suspects,
    prevision,
    titresQuiMontent: montants,
  };
}

/**
 * Le rapport réduit à ce qui se raconte, pour le modèle.
 *
 * Volontairement **sans aucun nombre** : des directions, des noms, des
 * ordres de grandeur qualitatifs. Voir lib/ai/analyst.ts pour la raison —
 * elle tient à ce qu'un chiffre mal recopié dans un rapport
 * d'exploitation devient un chiffre sur lequel on décide.
 */
export function resumerPourLeModele(r: Rapport): string {
  const sens = (a: number, b: number) => {
    if (b === 0) return a > 0 ? "en hausse depuis rien" : "à l'arrêt";
    const rapport = a / b;
    if (rapport > 1.15) return "en nette hausse";
    if (rapport > 1.03) return "en légère hausse";
    if (rapport < 0.85) return "en nette baisse";
    if (rapport < 0.97) return "en légère baisse";
    return "stable";
  };

  const part = (v: number) => (v > 0.66 ? "la plupart" : v > 0.33 ? "environ la moitié" : "une minorité");

  const lignes = [
    `Audience : ${sens(r.audience.ecoutes, r.audiencePrecedente.ecoutes)}.`,
    `Auditeurs distincts : ${sens(r.audience.auditeurs, r.audiencePrecedente.auditeurs)}.`,
    `Écoutes menées jusqu'au bout : ${part(r.audience.tauxCompletion)}.`,
    `Écoutes coupées très tôt : ${r.comportement.tauxAbandon > 0.3 ? "beaucoup" : r.comportement.tauxAbandon > 0.15 ? "une part notable" : "peu"}.`,
    r.genres.length ? `Genres les plus écoutés : ${r.genres.slice(0, 3).map((g) => g.genre).join(", ")}.` : "",
    r.artistes.montent.length ? `Artistes en progression : ${r.artistes.montent.map((a) => a.nom).join(", ")}.` : "",
    r.artistes.decrochent.length ? `Artistes en recul : ${r.artistes.decrochent.map((a) => a.nom).join(", ")}.` : "",
    r.titresQuiMontent.length
      ? `Titres en progression continue : ${r.titresQuiMontent.map((t) => `${t.titre} (${t.artiste})`).join(", ")}.`
      : "",
    r.catalogue.jamaisEcoutes > 0 ? `Une partie du catalogue publié n'a jamais été écoutée.` : "",
    r.anomalies.length ? `Points d'attention relevés : ${r.anomalies.map((a) => a.constat).join(" ")}` : "",
    // Les comptes ne sont pas nommés au modèle : un soupçon n'a pas à
    // passer par un service tiers, et il n'a rien à en dire de plus que
    // leur nombre.
    r.suspects.length ? `Des comptes présentent une activité d'écoute inhabituelle.` : "",
    r.prevision
      ? `Tendance d'audience sur les dernières semaines : ${r.prevision.penteHebdo > 0 ? "orientée à la hausse" : r.prevision.penteHebdo < 0 ? "orientée à la baisse" : "plate"}.`
      : `Historique trop court pour dégager une tendance.`,
  ];

  return lignes.filter(Boolean).join("\n");
}
