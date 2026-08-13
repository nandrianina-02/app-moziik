import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import Subscription from "@/models/Subscription";
import { notify } from "@/lib/notify";
import { withApiErrors } from "@/lib/apiError";
import { getMvolaTransactionStatus } from "@/lib/mvola";

// MVola appelle cette URL (X-Callback-URL fournie lors de l'initiation)
// pour notifier le résultat final de la transaction.
//
// IMPORTANT (sécurité) : cette route ne fait PAS confiance au contenu du
// payload entrant pour décider d'activer un abonnement. L'API MVola
// n'expose pas de mécanisme de signature de ce webhook sur cette
// intégration, ce qui signifie que n'importe qui connaissant la
// référence d'une transaction (par exemple l'utilisateur qui vient de
// l'initier, puisqu'elle lui est retournée) pourrait sinon forger cet
// appel avec `transactionStatus: "completed"` pour s'activer un
// abonnement premium sans payer. On revérifie donc toujours le statut
// réel directement auprès de l'API MVola avant toute activation.
export const POST = withApiErrors(async (req: Request) => {
  const payload = await req.json();
  const reference = payload.originalTransactionReference ?? payload.requestingOrganisationTransactionReference;

  await connectDB();
  const subscription = await Subscription.findOne({ mobileMoneyReference: reference });
  if (!subscription) return NextResponse.json({ received: true });

  if (!subscription.mvolaServerCorrelationId) {
    // Impossible de revérifier sans identifiant MVola : on ignore le
    // payload plutôt que de l'activer aveuglément.
    return NextResponse.json({ received: true });
  }

  let verifiedStatus: string;
  try {
    const result = await getMvolaTransactionStatus(subscription.mvolaServerCorrelationId);
    verifiedStatus = result.status;
  } catch {
    // En cas d'échec de la vérification auprès de MVola, on ne touche
    // pas à l'abonnement : mieux vaut laisser l'utilisateur relancer
    // le paiement que d'activer sur la foi d'un payload non vérifié.
    return NextResponse.json({ received: true });
  }

  if (verifiedStatus === "completed") {
    subscription.status = "active";
    await subscription.save();
    await notify({
      recipient: subscription.user.toString(),
      type: "payment",
      title: "Abonnement activé",
      message: "Ton paiement Mobile Money a été confirmé. Abonnement premium actif !",
      link: "/compte",
    });
  } else if (verifiedStatus === "failed") {
    subscription.status = "past_due";
    await subscription.save();
    await notify({
      recipient: subscription.user.toString(),
      type: "payment",
      title: "Paiement non abouti",
      message: "Ta transaction Mobile Money n'a pas pu être confirmée. Réessaie depuis ton compte.",
      link: "/abonnement",
    });
  }
  // Statut "pending" ou autre : on ne change rien, on attend un futur
  // callback ou une future vérification.

  return NextResponse.json({ received: true });
});
