import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import Play from "@/models/Play";
import { getSiteConfig } from "@/lib/siteConfig";

/**
 * Ce qu'un compte a déjà entendu aujourd'hui, vu du serveur.
 *
 * POURQUOI CE DOUBLON DU JOURNAL LOCAL
 *
 * lib/journalDuJour.ts tient le même registre dans le navigateur, et il
 * couvre le cas le plus fréquent — une seule personne, un seul appareil,
 * y compris déconnectée. Mais il est par appareil : quelqu'un qui écoute
 * le matin sur son téléphone et l'après-midi sur son ordinateur
 * retrouverait l'après-midi tout ce qu'il a entendu le matin. Or c'est
 * exactement la répétition qu'on cherche à supprimer.
 *
 * Les deux registres se complètent donc : le local vaut pour tout le
 * monde, celui-ci ajoute la continuité entre appareils pour les comptes.
 *
 * LA JOURNÉE EST CELLE DU SITE
 *
 * Faute de connaître le fuseau de chaque auditeur — `Play` porte un pays,
 * pas un fuseau — la coupure suit celui du site, comme la mesure horaire
 * des modes d'écoute (lib/curation/signals.ts). La très grande majorité
 * du public est dans ce fuseau, et le décalage éventuel ne fait que
 * déplacer l'heure de remise à zéro de quelques heures.
 */

/**
 * L'instant de minuit, dans un fuseau donné.
 *
 * Calculé en retirant le temps écoulé depuis minuit local plutôt qu'en
 * manipulant un décalage : c'est la seule façon d'être juste sans table
 * des fuseaux, et elle traverse correctement les changements d'heure.
 */
export function debutDuJour(timezone: string, maintenant = new Date()): Date {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(maintenant);

    const lire = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
    // Minuit se formate « 24 » dans certains environnements : la valeur
    // désigne bien le début du jour, pas sa fin.
    const heures = lire("hour") % 24;
    const depuisMinuit =
      ((heures * 60 + lire("minute")) * 60 + lire("second")) * 1000 + maintenant.getMilliseconds();

    return new Date(maintenant.getTime() - depuisMinuit);
  } catch {
    // Fuseau inconnu : on retombe sur minuit UTC. Une coupure décalée
    // vaut mieux qu'une erreur au milieu d'une lecture.
    return new Date(
      Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth(), maintenant.getUTCDate())
    );
  }
}

/**
 * Les titres que ce compte a écoutés depuis minuit.
 *
 * Rend un ensemble vide plutôt que de lever : ce filtre améliore la
 * lecture, il ne doit jamais l'empêcher.
 */
export async function titresEcoutesAujourdhui(userId: string): Promise<Set<string>> {
  if (!userId || !Types.ObjectId.isValid(userId)) return new Set();

  try {
    await connectDB();
    const config = await getSiteConfig().catch(() => null);
    const depuis = debutDuJour(config?.timezone || "Indian/Antananarivo");

    // `distinct` sur l'index { user, playedAt } : une seule journée d'un
    // seul compte, la requête reste minuscule.
    const ids = await Play.distinct("song", { user: userId, playedAt: { $gte: depuis } });
    return new Set(ids.map((id) => String(id)));
  } catch {
    return new Set();
  }
}
