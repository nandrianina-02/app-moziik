import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { connectDB } from "@/lib/db";
import Subscription from "@/models/Subscription";
import { notify } from "@/lib/notify";
import { ApiError, withApiErrors } from "@/lib/apiError";

export const POST = withApiErrors(async (req: Request) => {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!signature) throw new ApiError("Signature Stripe manquante.", 400);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET as string);
  } catch {
    throw new ApiError("Signature Stripe invalide.", 400);
  }

  await connectDB();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const plan = session.metadata?.plan as "premium" | "premium_annual" | undefined;
      if (!userId || !plan) break;

      const periodDays = plan === "premium_annual" ? 365 : 30;

      await Subscription.findOneAndUpdate(
        { user: userId },
        {
          user: userId,
          plan,
          amount: (session.amount_total ?? 0) / 100,
          currency: (session.currency ?? "usd").toUpperCase(),
          paymentMethod: "stripe",
          region: "international",
          status: "active",
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: session.subscription as string,
          startedAt: new Date(),
          currentPeriodEnd: new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000),
        },
        { upsert: true }
      );

      await notify({
        recipient: userId,
        type: "payment",
        title: "Abonnement activé",
        message: "Ton abonnement premium est actif. Merci pour ton soutien !",
        link: "/compte",
      });
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const stripeSubscriptionId = invoice.subscription as string;
      if (!stripeSubscriptionId) break;

      await Subscription.findOneAndUpdate(
        { stripeSubscriptionId },
        {
          status: "active",
          currentPeriodEnd: new Date((invoice.period_end ?? 0) * 1000),
        }
      );
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await Subscription.findOneAndUpdate(
        { stripeSubscriptionId: subscription.id },
        { status: "canceled" }
      );
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
});
