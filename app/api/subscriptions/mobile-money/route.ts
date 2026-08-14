import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { connectDB } from "@/lib/db";
import Subscription from "@/models/Subscription";
import { getSiteConfig } from "@/lib/siteConfig";
import { initiateMvolaPayment } from "@/lib/mvola";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { parseOrThrow, mobileMoneySchema } from "@/lib/validation";
import { requireAuthUser } from "@/lib/mobileAuth";

export const POST = withApiErrors(async (req: Request) => {
  const authUser = await requireAuthUser(req);

  const { plan, phoneNumber } = parseOrThrow(mobileMoneySchema, await req.json());

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
    { user: authUser.id },
    {
      user: authUser.id,
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
