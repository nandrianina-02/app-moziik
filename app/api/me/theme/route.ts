import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import User from "@/models/User";
import Subscription from "@/models/Subscription";
import { hasPremiumAccess } from "@/lib/premium";
import { getSiteConfig } from "@/lib/siteConfig";
import { ApiError, withApiErrors } from "@/lib/apiError";
import { parseOrThrow, themePreferenceSchema } from "@/lib/validation";
import { requireAuthUser } from "@/lib/mobileAuth";
import { normaliserTheme } from "@/lib/theme";

/**
 * Le thème personnel d'un membre Premium.
 *
 * La règle tient en une phrase : l'administration décide de l'apparence du
 * site, un abonné peut la remplacer pour lui seul. Le contrôle est fait
 * ici, à l'écriture — l'interface se contente de refléter la même règle, et
 * une interface peut être contournée.
 */

async function premiumDe(userId: string, role?: string) {
  const subscription = await Subscription.findOne({ user: userId }).sort({ startedAt: -1 }).select("status");
  return hasPremiumAccess({ role, subscription });
}

export const GET = withApiErrors(async (req: Request) => {
  const authUser = await requireAuthUser(req);

  await connectDB();
  const [user, config] = await Promise.all([
    User.findById(authUser.id).select("theme"),
    getSiteConfig(),
  ]);
  const hasPremium = await premiumDe(authUser.id, authUser.role);

  return NextResponse.json({
    // Le thème personnel est renvoyé même sans abonnement actif : il n'est
    // simplement pas appliqué. Le perdre à la première fin de mois serait
    // une punition, pas une limite.
    theme: user?.theme ? normaliserTheme(user.theme) : null,
    siteTheme: normaliserTheme(config.theme),
    hasPremium,
  });
});

export const PUT = withApiErrors(async (req: Request) => {
  const authUser = await requireAuthUser(req);

  await connectDB();
  if (!(await premiumDe(authUser.id, authUser.role))) {
    throw new ApiError("La personnalisation du thème est réservée aux comptes Premium.", 403);
  }

  const theme = parseOrThrow(themePreferenceSchema, await req.json());
  const user = await User.findByIdAndUpdate(authUser.id, { theme }, { new: true }).select("theme");
  if (!user) throw new ApiError("Compte introuvable.", 404);

  return NextResponse.json({ theme: normaliserTheme(user.theme) });
});

/** Revenir au thème du site, sans rien devoir reconfigurer. */
export const DELETE = withApiErrors(async (req: Request) => {
  const authUser = await requireAuthUser(req);

  await connectDB();
  await User.findByIdAndUpdate(authUser.id, { $unset: { theme: 1 } });

  const config = await getSiteConfig();
  return NextResponse.json({ theme: null, siteTheme: normaliserTheme(config.theme) });
});
