import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import Play from "@/models/Play";
import Song from "@/models/Song";

/**
 * Ce qui sort de l'ordinaire.
 *
 * Une anomalie n'est pas une alerte : c'est une invitation à regarder.
 * Le module dit ce qui s'écarte, de combien, et laisse conclure. Aucun
 * compte n'est suspendu, aucun chiffre n'est corrigé — décider à la place
 * de l'exploitant sur la foi d'un écart-type serait une faute.
 *
 * L'ÉCART SE MESURE SUR LA MÉDIANE, PAS SUR LA MOYENNE
 *
 * Le pic qu'on cherche à détecter est précisément ce qui tire la moyenne
 * vers le haut : avec elle, un pic énorme relève son propre seuil et
 * finit par ne plus être détecté. La médiane et l'écart absolu médian
 * (MAD) ne bougent pas pour quelques valeurs extrêmes — c'est ce qui les
 * rend utilisables ici.
 */

const JOUR_MS = 86_400_000;
/** Écarts robustes au-delà desquels une journée est signalée. */
const SEUIL_ECARTS = 3.5;
/** Facteur ramenant le MAD à l'échelle d'un écart-type pour une loi normale. */
const MAD_VERS_SIGMA = 1.4826;
/** En deçà, la série est trop courte pour qu'un écart signifie quelque chose. */
const JOURS_MIN = 14;

function mediane(valeurs: number[]): number {
  if (valeurs.length === 0) return 0;
  const tri = [...valeurs].sort((a, b) => a - b);
  const milieu = Math.floor(tri.length / 2);
  return tri.length % 2 ? tri[milieu] : (tri[milieu - 1] + tri[milieu]) / 2;
}

export type Anomalie = {
  type: "journee" | "titre_mono_auditeur";
  /** Ce qui est constaté, en une phrase, sans interprétation. */
  constat: string;
  /** Détail chiffré, tel que mesuré. */
  detail: string;
  /** Plus la valeur est haute, plus l'écart est marqué. */
  intensite: number;
};

/**
 * Journées dont l'audience s'écarte nettement de l'ordinaire.
 *
 * Vaut dans les deux sens : une chute est aussi digne d'attention qu'un
 * pic — elle peut signaler une panne que personne n'a vue.
 */
async function journeesAtypiques(jours: number): Promise<Anomalie[]> {
  const depuis = new Date(Date.now() - jours * JOUR_MS);
  const lignes = await Play.aggregate<{ _id: string; n: number }>([
    { $match: { playedAt: { $gte: depuis } } },
    { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$playedAt" } }, n: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

  if (lignes.length < JOURS_MIN) return [];

  const valeurs = lignes.map((l) => l.n);
  const med = mediane(valeurs);
  const mad = mediane(valeurs.map((v) => Math.abs(v - med)));
  const sigma = mad * MAD_VERS_SIGMA;

  // Un MAD nul signifie une série constante : tout écart y paraîtrait
  // infini. On ne signale rien plutôt que de tout signaler.
  if (sigma <= 0) return [];

  return lignes
    .map((l) => ({ jour: l._id, n: l.n, ecarts: (l.n - med) / sigma }))
    .filter((x) => Math.abs(x.ecarts) >= SEUIL_ECARTS)
    .map((x) => ({
      type: "journee" as const,
      constat:
        x.ecarts > 0
          ? `Le ${x.jour}, l'écoute a nettement dépassé l'ordinaire.`
          : `Le ${x.jour}, l'écoute est tombée nettement en dessous de l'ordinaire.`,
      detail: `${x.n} écoutes, contre ${Math.round(med)} en journée médiane.`,
      intensite: Math.abs(x.ecarts),
    }))
    .sort((a, b) => b.intensite - a.intensite)
    .slice(0, 5);
}

/** Part des écoutes d'un titre venant d'un seul compte, au-delà de laquelle on regarde. */
const CONCENTRATION = 0.8;
/** En deçà, la concentration est normale : c'est simplement peu écouté. */
const ECOUTES_MIN = 30;

/**
 * Titres dont l'écoute tient à une seule personne.
 *
 * Le constat est neutre et il faut qu'il le reste : ce peut être un
 * auditeur passionné comme un gonflage de compteur. La différence ne se
 * lit pas dans les données, elle se tranche en regardant — d'où une
 * formulation qui ne conclut pas. Comme les compteurs d'écoute nourrissent
 * la rémunération des artistes (voir /api/cron/compute-royalties), le
 * signalement a une valeur réelle.
 */
async function titresMonoAuditeur(from: Date, to: Date): Promise<Anomalie[]> {
  const lignes = await Play.aggregate<{
    _id: Types.ObjectId;
    total: number;
    meilleur: number;
  }>([
    { $match: { playedAt: { $gte: from, $lt: to }, user: { $ne: null } } },
    { $group: { _id: { song: "$song", user: "$user" }, n: { $sum: 1 } } },
    { $group: { _id: "$_id.song", total: { $sum: "$n" }, meilleur: { $max: "$n" } } },
    { $match: { total: { $gte: ECOUTES_MIN } } },
  ]);

  const suspects = lignes
    .map((l) => ({ ...l, part: l.meilleur / l.total }))
    .filter((l) => l.part >= CONCENTRATION)
    .sort((a, b) => b.part - a.part)
    .slice(0, 5);

  if (suspects.length === 0) return [];

  const titres = new Map(
    (await Song.find({ _id: { $in: suspects.map((s) => s._id) } })
      .select("title")
      .populate("artist", "stageName"))
      .map((s) => [
        s._id.toString(),
        `${s.title} — ${(s.artist as unknown as { stageName?: string })?.stageName ?? "?"}`,
      ])
  );

  return suspects.map((s) => ({
    type: "titre_mono_auditeur" as const,
    constat: `« ${titres.get(String(s._id)) ?? "Titre supprimé"} » est écouté presque uniquement par un seul compte.`,
    detail: `${s.meilleur} des ${s.total} écoutes de la période viennent du même auditeur (${Math.round(s.part * 100)} %).`,
    intensite: s.part,
  }));
}

/** Tout ce qui mérite un regard sur la période. */
export async function detecterAnomalies(from: Date, to: Date, joursHistorique = 45): Promise<Anomalie[]> {
  await connectDB();
  const [journees, titres] = await Promise.all([
    journeesAtypiques(joursHistorique),
    titresMonoAuditeur(from, to),
  ]);
  return [...journees, ...titres];
}
