import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import Play from "@/models/Play";
import User from "@/models/User";

/**
 * Comptes dont l'activité ne ressemble pas à de l'écoute.
 *
 * AUCUN MODÈLE ICI, ET C'EST DÉLIBÉRÉ
 *
 * Demander à une IA de désigner des comptes suspects reviendrait à
 * fonder un soupçon sur une intuition qu'on ne peut ni vérifier ni
 * expliquer à la personne visée. Les deux signaux retenus se
 * démontrent en une phrase et se recalculent à la main :
 *
 * 1. **Le temps ne suffit pas.** Un compte qui cumule plus d'heures
 *    d'écoute qu'il n'y a d'heures dans la période n'a pas écouté : une
 *    journée fait vingt-quatre heures pour tout le monde.
 *
 * 2. **L'écoute tient à deux morceaux.** Beaucoup de lectures
 *    concentrées sur un ou deux titres est la forme que prend le
 *    gonflage de compteur — et les compteurs alimentent la rémunération
 *    des artistes (voir /api/cron/compute-royalties).
 *
 * ON SIGNALE, ON NE SANCTIONNE PAS
 *
 * Aucun compte n'est suspendu, aucune écoute n'est retirée, aucun
 * versement n'est bloqué par ce module. Le premier signal se retourne
 * contre un lecteur audio qui renvoie des durées fausses ; le second
 * décrit aussi bien un fan qu'un fraudeur. Trancher demande de regarder,
 * et c'est à un humain de le faire.
 */

const HEURE_MS = 3_600_000;
/** Part de la période au-delà de laquelle le temps déclaré devient impossible. */
const PART_IMPOSSIBLE = 0.9;
/** En deçà, le cumul est trop faible pour qu'un ratio veuille dire quelque chose. */
const ECOUTES_MIN = 40;
/** Part des écoutes portée par les deux titres les plus joués. */
const CONCENTRATION = 0.85;

export type CompteSuspect = {
  id: string;
  nom: string;
  email: string;
  /** Ce qui est constaté, sans interprétation. */
  constat: string;
  detail: string;
};

/**
 * Repère les comptes à regarder sur une période.
 *
 * `from` inclus, `to` exclu, comme partout dans lib/insights/.
 */
export async function comptesSuspects(from: Date, to: Date, limite = 8): Promise<CompteSuspect[]> {
  await connectDB();

  const heuresDeLaPeriode = (to.getTime() - from.getTime()) / HEURE_MS;
  if (heuresDeLaPeriode <= 0) return [];

  const lignes = await Play.aggregate<{
    _id: Types.ObjectId;
    ecoutes: number;
    secondes: number;
    parTitre: { n: number }[];
  }>([
    { $match: { playedAt: { $gte: from, $lt: to }, user: { $ne: null } } },
    {
      $group: {
        _id: { user: "$user", song: "$song" },
        n: { $sum: 1 },
        secondes: { $sum: "$secondsListened" },
      },
    },
    {
      $group: {
        _id: "$_id.user",
        ecoutes: { $sum: "$n" },
        secondes: { $sum: "$secondes" },
        parTitre: { $push: { n: "$n" } },
      },
    },
    { $match: { ecoutes: { $gte: ECOUTES_MIN } } },
  ]);

  const retenus: { id: string; constat: string; detail: string; poids: number }[] = [];

  for (const l of lignes) {
    const heures = l.secondes / 3600;
    const parts = l.parTitre.map((t) => t.n).sort((a, b) => b - a);
    const deuxPremiers = (parts[0] ?? 0) + (parts[1] ?? 0);
    const concentration = deuxPremiers / l.ecoutes;

    if (heures >= heuresDeLaPeriode * PART_IMPOSSIBLE) {
      retenus.push({
        id: String(l._id),
        constat: "Plus d'heures d'écoute déclarées que la période n'en compte.",
        detail: `${Math.round(heures)} h cumulées sur une période de ${Math.round(heuresDeLaPeriode)} h.`,
        poids: heures / heuresDeLaPeriode,
      });
      continue;
    }

    if (concentration >= CONCENTRATION && parts.length >= 1) {
      retenus.push({
        id: String(l._id),
        constat: "Écoute presque entièrement concentrée sur un ou deux titres.",
        detail: `${deuxPremiers} des ${l.ecoutes} écoutes de la période portent sur deux titres (${Math.round(concentration * 100)} %).`,
        poids: concentration,
      });
    }
  }

  if (retenus.length === 0) return [];

  const tries = retenus.sort((a, b) => b.poids - a.poids).slice(0, limite);
  const comptes = new Map(
    (await User.find({ _id: { $in: tries.map((r) => new Types.ObjectId(r.id)) } }).select("name email"))
      .map((u) => [u._id.toString(), { nom: u.name, email: u.email }])
  );

  return tries.map((r) => ({
    id: r.id,
    nom: comptes.get(r.id)?.nom ?? "Compte supprimé",
    // L'adresse sert à retrouver le compte en administration ; elle n'est
    // renvoyée qu'à un administrateur authentifié.
    email: comptes.get(r.id)?.email ?? "",
    constat: r.constat,
    detail: r.detail,
  }));
}
