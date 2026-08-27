import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import Play from "@/models/Play";
import { cleSemaine } from "@/lib/insights/metrics";

/**
 * Qui revient.
 *
 * La rétention se mesure par cohortes : on regroupe les auditeurs selon
 * la semaine de leur **première écoute**, puis on regarde combien
 * reviennent la semaine suivante, celle d'après, et la troisième.
 *
 * POURQUOI PAS « AUDITEURS ACTIFS CETTE SEMAINE / SEMAINE DERNIÈRE »
 *
 * Parce que ce rapport-là monte quand on recrute et descend quand on
 * cesse, sans rien dire de la fidélité. Une plateforme qui perd tout le
 * monde au bout d'une semaine mais recrute deux fois plus affiche une
 * belle courbe. Les cohortes ne se laissent pas berner : elles suivent
 * les mêmes personnes dans le temps.
 *
 * CE QU'ON NE PUBLIE PAS
 *
 * Une cohorte de moins de cinq personnes. Sur trois auditeurs, « 33 % de
 * rétention » ne mesure rien — c'est une personne — et invite à décider
 * sur du bruit. Ces cohortes-là sont rendues avec `suffisante: false` et
 * l'écran l'affiche comme tel plutôt que de montrer un pourcentage.
 */

/** En deçà, le pourcentage n'a aucun sens statistique. */
const COHORTE_MIN = 5;

export type Cohorte = {
  /** Semaine d'arrivée, au format lisible (lundi de la semaine). */
  semaine: string;
  arrivants: number;
  /** Part revenue en semaine +1, +2, +3. `null` quand la semaine n'est pas encore écoulée. */
  retours: (number | null)[];
  /** Faux quand la cohorte est trop petite pour qu'un taux veuille dire quelque chose. */
  suffisante: boolean;
};

const SEMAINE_MS = 7 * 86_400_000;
const LUNDI_ZERO = Date.UTC(2024, 0, 1);

function libelleSemaine(cle: number): string {
  const lundi = new Date(LUNDI_ZERO + cle * SEMAINE_MS);
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" }).format(lundi);
}

/**
 * Rétention par cohortes hebdomadaires sur les `semaines` dernières.
 *
 * Coût : un regroupement par auditeur sur tout l'historique d'écoute.
 * C'est le prix de la première écoute — on ne peut pas savoir qui est
 * nouveau sans regarder tout ce qui précède. Appelé une fois par semaine
 * par le rapport, et à l'ouverture d'un écran d'administration : c'est
 * tenable, mais ce n'est pas une requête à mettre sur une page publique.
 */
export async function retentionParCohortes(semaines = 6): Promise<Cohorte[]> {
  await connectDB();

  const lignes = await Play.aggregate<{ _id: Types.ObjectId; premiere: Date; jours: Date[] }>([
    { $match: { user: { $ne: null } } },
    { $group: { _id: "$user", premiere: { $min: "$playedAt" }, jours: { $addToSet: "$playedAt" } } },
  ]);

  const maintenant = cleSemaine(new Date());
  const premiereCle = maintenant - semaines;

  const cohortes = new Map<number, { arrivants: number; retours: number[] }>();
  for (let c = premiereCle; c < maintenant; c++) {
    cohortes.set(c, { arrivants: 0, retours: [0, 0, 0] });
  }

  for (const l of lignes) {
    const cle = cleSemaine(l.premiere);
    const cohorte = cohortes.get(cle);
    if (!cohorte) continue;

    cohorte.arrivants += 1;
    const semainesActives = new Set(l.jours.map((d) => cleSemaine(d)));
    for (let decalage = 1; decalage <= 3; decalage++) {
      if (semainesActives.has(cle + decalage)) cohorte.retours[decalage - 1] += 1;
    }
  }

  return [...cohortes.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([cle, c]) => ({
      semaine: libelleSemaine(cle),
      arrivants: c.arrivants,
      // Une semaine qui n'est pas encore écoulée ne se mesure pas : rendre
      // 0 % ferait croire à un décrochage là où il n'y a qu'un calendrier.
      retours: c.retours.map((n, i) =>
        cle + i + 1 >= maintenant ? null : c.arrivants > 0 ? n / c.arrivants : 0
      ),
      suffisante: c.arrivants >= COHORTE_MIN,
    }));
}
