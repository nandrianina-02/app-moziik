import { NextResponse } from "next/server";
import { Types, type AnyBulkWriteOperation } from "mongoose";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Subscription, { type ISubscription } from "@/models/Subscription";
import { requireAdmin } from "@/lib/requireAdmin";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { parseOrThrow, octroiPremiumSchema } from "@/lib/validation";
import { construireFiltreComptes } from "@/lib/adminUserQuery";
import { notifyMany } from "@/lib/notify";
import { formatDate } from "@/lib/dates";
import { getSiteConfig } from "@/lib/siteConfig";

/**
 * Offrir ou retirer l'accès premium, à un compte, à une sélection, ou à
 * tous les comptes que le filtre courant retient.
 *
 * L'accès offert est un abonnement comme un autre — même modèle, même
 * lecture par `hasPremiumAccess` — simplement sans paiement derrière. Rien
 * de nouveau n'a donc à être branché du côté qui *consomme* le premium.
 */

/**
 * Plafond d'une seule opération.
 *
 * Assez haut pour couvrir « tout le monde » sur une plateforme naissante,
 * assez bas pour qu'une requête reste sous le plafond de durée de
 * l'hébergeur. Au-delà, l'administration affine ses filtres — et sait
 * combien de comptes restent à traiter.
 */
const MAX_COMPTES = 5000;

/** Un accès offert ne remplace jamais un abonnement payé. */
const PAYANTS = ["stripe", "mobile_money"];

function echeance(duree: { type: string; jours?: number; date?: Date } | undefined): Date | undefined {
  if (!duree || duree.type === "illimite") return undefined;
  if (duree.type === "jours" && duree.jours) {
    return new Date(Date.now() + duree.jours * 24 * 60 * 60 * 1000);
  }
  if (duree.type === "jusqu_au" && duree.date) return duree.date;
  return undefined;
}

export const POST = withApiErrors(async (req: Request) => {
  const { user: admin } = await requireAdmin(req);

  const { action, duree, cible } = parseOrThrow(octroiPremiumSchema, await req.json());

  if (action === "offrir" && !duree) {
    throw new ApiError("Précise la durée de l'accès offert.", 400);
  }
  const fin = echeance(duree);
  if (fin && fin.getTime() <= Date.now()) {
    throw new ApiError("La date de fin doit être dans le futur.", 400);
  }

  await connectDB();

  // La cible est résolue côté serveur, même pour une sélection : le client
  // envoie des identifiants, jamais la liste des comptes à modifier.
  const filtre =
    cible.type === "selection"
      ? { _id: { $in: cible.ids } }
      : construireFiltreComptes(cible.filtres);

  const concernes = await User.countDocuments(filtre);
  if (concernes === 0) throw new ApiError("Aucun compte ne correspond.", 400);
  if (concernes > MAX_COMPTES) {
    throw new ApiError(
      `${concernes} comptes correspondent, au-delà des ${MAX_COMPTES} traitables en une fois. Affine les filtres.`,
      400
    );
  }

  const utilisateurs = await User.find(filtre).select("_id").lean();
  const ids = utilisateurs.map((u) => u._id);

  // Les abonnements payés sont mis de côté avant toute écriture : les
  // écraser ferait perdre les identifiants Stripe et rendrait le compte
  // impossible à rapprocher de sa facturation.
  const payes = await Subscription.find({
    user: { $in: ids },
    paymentMethod: { $in: PAYANTS },
    status: "active",
  })
    .select("user")
    .lean();
  const intouchables = new Set(payes.map((s) => s.user.toString()));
  const cibles = ids.filter((id) => !intouchables.has(id.toString()));

  if (cibles.length === 0) {
    return NextResponse.json({
      traites: 0,
      ignores: intouchables.size,
      message: "Tous les comptes visés ont un abonnement payant : rien n'a été modifié.",
    });
  }

  if (action === "retirer") {
    // Seuls les accès offerts sont retirés, et ils sont conservés en
    // « canceled » plutôt que supprimés : on garde la trace de qui les
    // avait accordés, et quand.
    const resultat = await Subscription.updateMany(
      { user: { $in: cibles }, paymentMethod: "offert" },
      { $set: { status: "canceled" } }
    );

    return NextResponse.json({
      traites: resultat.modifiedCount,
      ignores: intouchables.size,
      message: `Accès retiré à ${resultat.modifiedCount} compte(s).`,
    });
  }

  /** Ce qu'un accès offert écrit, quelle que soit sa durée. */
  const champs = {
    plan: "premium" as const,
    paymentMethod: "offert" as const,
    status: "active" as const,
    grantedBy: new Types.ObjectId(admin.id),
    startedAt: new Date(),
  };

  const operations: AnyBulkWriteOperation<ISubscription>[] = cibles.map((user) =>
    fin
      ? {
          updateOne: {
            filter: { user },
            update: { $set: { ...champs, user, currentPeriodEnd: fin } },
            upsert: true,
          },
        }
      : {
          updateOne: {
            filter: { user },
            update: {
              $set: { ...champs, user },
              // Champs retirés, pas mis à null : `hasPremiumAccess` lit
              // l'absence d'échéance comme « sans fin », et un accès offert
              // n'a ni montant, ni devise, ni région de facturation.
              $unset: { currentPeriodEnd: "", amount: "", currency: "", region: "" },
            },
            upsert: true,
          },
        }
  );
  await Subscription.bulkWrite(operations);

  const config = await getSiteConfig();
  const jusquA = fin
    ? `Il est valable jusqu'au ${formatDate(fin, { dateFormat: config.dateFormat, timezone: config.timezone })}.`
    : "Il est sans date de fin.";

  await notifyMany(
    cibles.map((id) => id.toString()),
    {
      type: "system",
      title: "Accès Premium offert",
      message: `L'équipe vous offre l'accès Premium. ${jusquA}`,
      link: "/compte",
    }
  );

  return NextResponse.json({
    traites: cibles.length,
    ignores: intouchables.size,
    message: `Premium offert à ${cibles.length} compte(s).`,
  });
});
