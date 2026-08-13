import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import Subscription from "@/models/Subscription";
import { getSiteConfig } from "@/lib/siteConfig";
import { initiateMvolaPayment } from "@/lib/mvola";
import { ApiError, withApiErrors } from "@/lib/apiError";

export const POST = withApiErrors(async (req: Request) => {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new ApiError("Non authentifié.", 401);

  const { plan, phoneNumber } = await req.json();
  if (!["premium", "premium_annual"].includes(plan) || !phoneNumber) {
    throw new ApiError("Plan et numéro de téléphone requis.");
  }

  const config = await getSiteConfig();
  const pricing = config.plans.find((p) => p.plan === plan);
  if (!pricing) throw new ApiError("Ce plan n'est pas configuré.", 404);

  const reference = randomUUID();

  const mvolaResponse = await initiateMvolaPayment({
    amountMGA: pricing.amountMGA,
    payerMsisdn: phoneNumber,
    reference,
    callbackUrl: `${process.env.NEXTAUTH_URL}/api/webhooks/mvola`,
  });

  await connectDB();
  const periodDays = plan === "premium_annual" ? 365 : 30;

  // En attente de confirmation via le callback MVola (l'utilisateur
  // valide le paiement sur son téléphone).
  await Subscription.findOneAndUpdate(
    { user: session.user.id },
    {
      user: session.user.id,
      plan,
      amount: pricing.amountMGA,
      currency: "MGA",
      paymentMethod: "mobile_money",
      region: "MG",
      status: "past_due",
      mobileMoneyReference: reference,
      mvolaServerCorrelationId: mvolaResponse.serverCorrelationId,
      startedAt: new Date(),
      currentPeriodEnd: new Date(Date.now() + periodDays * 24 * 60 * 60 * 1000),
    },
    { upsert: true }
  );

  return NextResponse.json({
    message: "Paiement initié. Valide la transaction sur ton téléphone.",
    reference,
  });
});
