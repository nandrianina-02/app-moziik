import Link from "next/link";
import { Crown } from "lucide-react";

type PlanPricing = { plan: "premium" | "premium_annual"; amountUSD: number; amountMGA: number };

export function PremiumBanner({ plans, isSubscriber }: { plans: PlanPricing[]; isSubscriber: boolean }) {
  if (isSubscriber) return null;
  const monthly = plans.find((p) => p.plan === "premium");

  return (
    <div className="flex flex-col items-start justify-between gap-4 rounded-xl2 border border-border bg-surface p-6 md:flex-row md:items-center">
      <div>
        <h3 className="font-display text-lg">Passe à Premium</h3>
        <p className="mt-1 text-sm text-ink-muted">
          Sans limites, télécharge tes titres favoris et soutiens encore plus tes artistes.
          {monthly && ` À partir de ${monthly.amountUSD.toFixed(2)} $ / mois.`}
        </p>
      </div>
      <Link
        href="/abonnement"
        className="flex shrink-0 items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-base hover:bg-accent-hover"
      >
        <Crown size={16} /> Découvrir Premium
      </Link>
    </div>
  );
}
