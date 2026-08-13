import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { getSiteConfig } from "@/lib/siteConfig";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { ApiError, withApiErrors } from "@/lib/apiError";

export const POST = withApiErrors(async (req: Request) => {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new ApiError("Non authentifié.", 401);

  const { plan } = await req.json(); // "premium" | "premium_annual"
  if (!["premium", "premium_annual"].includes(plan)) throw new ApiError("Plan invalide.");

  const config = await getSiteConfig();
  const pricing = config.plans.find((p) => p.plan === plan);
  if (!pricing) throw new ApiError("Ce plan n'est pas configuré.", 404);

  await connectDB();
  const user = await User.findById(session.user.id);
  if (!user) throw new ApiError("Utilisateur introuvable.", 404);

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: user.email,
    // Le prix est généré à la volée à partir de la config admin, plutôt
    // que de dépendre d'un Price ID Stripe fixe qui se désynchroniserait
    // à chaque changement de tarif dans /admin/parametres.
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: Math.round(pricing.amountUSD * 100),
          recurring: { interval: plan === "premium_annual" ? "year" : "month" },
          product_data: { name: `${config.siteName} — ${plan === "premium_annual" ? "Premium annuel" : "Premium"}` },
        },
        quantity: 1,
      },
    ],
    metadata: { userId: user._id.toString(), plan },
    success_url: `${process.env.NEXTAUTH_URL}/abonnement/succes?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXTAUTH_URL}/abonnement`,
  });

  return NextResponse.json({ url: checkoutSession.url });
});
