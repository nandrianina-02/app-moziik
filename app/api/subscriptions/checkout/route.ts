import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { getSiteConfig } from "@/lib/siteConfig";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { parseOrThrow, checkoutSchema } from "@/lib/validation";
import { requireAuthUser } from "@/lib/mobileAuth";

export const POST = withApiErrors(async (req: Request) => {
  const authUser = await requireAuthUser(req);

  const { plan } = parseOrThrow(checkoutSchema, await req.json());

  const config = await getSiteConfig();
  const pricing = config.plans.find((p) => p.plan === plan);
  if (!pricing) throw new ApiError("Ce plan n'est pas configuré.", 404);

  await connectDB();
  const user = await User.findById(authUser.id);
  if (!user) throw new ApiError("Utilisateur introuvable.", 404);

  // La devise choisie en administration pilote le débit, pas seulement
  // l'affichage : annoncer « 4,99 € » et prélever des dollars serait faux.
  // L'ariary n'est pas débitable par carte — c'est le mobile money qui s'en
  // charge — donc Stripe repart sur le dollar dans ce cas.
  const devise = ["usd", "eur"].includes((config.currency ?? "").toLowerCase())
    ? (config.currency as string).toLowerCase()
    : "usd";
  const essai = Math.max(0, Math.round(config.trialDays ?? 0));

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: user.email,
    // Une période d'essai à zéro jour est refusée par Stripe : on n'envoie
    // le bloc que lorsqu'il y a réellement un essai à offrir.
    ...(essai > 0 ? { subscription_data: { trial_period_days: essai } } : {}),
    // Le prix est généré à la volée à partir de la config admin, plutôt
    // que de dépendre d'un Price ID Stripe fixe qui se désynchroniserait
    // à chaque changement de tarif dans /admin/parametres.
    line_items: [
      {
        price_data: {
          currency: devise,
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
