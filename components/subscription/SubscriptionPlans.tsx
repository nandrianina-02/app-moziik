"use client";

import { useEffect, useState } from "react";
import {
  Crown,
  Check,
  CreditCard,
  Smartphone,
  Info,
  Lock,
  ShieldCheck,
  Music2,
  DownloadCloud,
  Gem,
  Ban,
} from "lucide-react";
import { useToast } from "@/context/ToastProvider";

type Plan = { plan: "premium" | "premium_annual"; amountUSD: number; amountMGA: number };
type PaymentMethod = "stripe" | "mobile_money";

const planFeatures = ["Écoute sans limite", "Téléchargement hors-ligne", "Qualité audio supérieure", "Sans publicité"];

const perks = [
  { icon: Music2, color: "emerald", title: "Écoute sans limite", description: "Accède à des millions de titres sans restriction." },
  { icon: DownloadCloud, color: "sky", title: "Hors-ligne", description: "Télécharge tes musiques préférées et écoute-les partout." },
  { icon: Gem, color: "violet", title: "Qualité supérieure", description: "Profite d'un son haute qualité pour une meilleure expérience." },
  { icon: Ban, color: "rose", title: "Sans publicité", description: "Écoute ta musique sans aucune interruption." },
] as const;

const perkColors: Record<string, string> = {
  emerald: "bg-emerald-500/15 text-emerald-500",
  sky: "bg-sky-500/15 text-sky-500",
  violet: "bg-violet-500/15 text-violet-500",
  rose: "bg-rose-500/15 text-rose-500",
};

function formatPrice(plan: Plan, method: PaymentMethod) {
  return method === "mobile_money"
    ? `${plan.amountMGA.toLocaleString("fr-FR")} Ar`
    : `${plan.amountUSD.toFixed(2)} $`;
}

export function SubscriptionPlans() {
  const pushToast = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [preferredMethod, setPreferredMethod] = useState<PaymentMethod>("stripe");
  const [selectedPlan, setSelectedPlan] = useState<Plan["plan"]>("premium");
  const [method, setMethod] = useState<PaymentMethod>("stripe");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const [configRes, regionRes] = await Promise.all([fetch("/api/site-config"), fetch("/api/region")]);
      if (regionRes.ok) {
        const region = await regionRes.json();
        setPreferredMethod(region.preferredMethod);
        setMethod(region.preferredMethod);
      }
      if (configRes.ok) {
        const data = await configRes.json();
        setPlans(data.plans);
      }
    }
    load();
  }, []);

  async function handleSubscribe() {
    setLoading(true);
    try {
      if (method === "stripe") {
        const res = await fetch("/api/subscriptions/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan: selectedPlan }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        window.location.href = data.url;
      } else {
        if (!phoneNumber) {
          pushToast("error", "Renseigne ton numéro Mobile Money.");
          setLoading(false);
          return;
        }
        const res = await fetch("/api/subscriptions/mobile-money", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan: selectedPlan, phoneNumber }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        pushToast("success", data.message);
      }
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "Le paiement a échoué.");
    } finally {
      setLoading(false);
    }
  }

  const monthly = plans.find((p) => p.plan === "premium");
  const annual = plans.find((p) => p.plan === "premium_annual");
  const currentPlan = plans.find((p) => p.plan === selectedPlan);
  const savingsPercent =
    monthly && annual ? Math.round((1 - annual.amountUSD / (monthly.amountUSD * 12)) * 100) : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 lg:gap-8 items-start">
      {/* Colonne principale */}
      <div className="min-w-0">
        <h1 className="text-2xl md:text-3xl font-display mb-2">Passer en Premium</h1>
        <p className="text-sm text-ink-muted mb-6 md:mb-8">
          Écoute sans limite, soutiens tes artistes préférés, débloque le hors-ligne.
        </p>

        {/* Cartes de plan */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {plans.map((plan) => {
            const isAnnual = plan.plan === "premium_annual";
            const isSelected = selectedPlan === plan.plan;
            return (
              <button
                key={plan.plan}
                onClick={() => setSelectedPlan(plan.plan)}
                className={`relative text-left rounded-xl2 border-2 p-5 md:p-6 transition-colors ${
                  isSelected ? "border-accent bg-surface" : "border-border hover:border-accent/50"
                }`}
              >
                {/* Indicateur de sélection */}
                <span
                  className={`absolute top-4 left-4 grid h-5 w-5 place-items-center rounded-full border-2 ${
                    isSelected ? "border-accent bg-accent" : "border-border"
                  }`}
                >
                  {isSelected && <Check size={12} className="text-base" strokeWidth={3} />}
                </span>

                {!isAnnual && (
                  <span className="absolute top-4 right-4 rounded-full bg-accent/15 px-2.5 py-1 text-[10px] font-medium text-accent">
                    Recommandé
                  </span>
                )}
                {isAnnual && savingsPercent !== null && savingsPercent > 0 && (
                  <span className="absolute top-4 right-4 rounded-full bg-verified/15 px-2.5 py-1 text-[10px] font-medium text-verified">
                    Économisez {savingsPercent}%
                  </span>
                )}

                <div className="flex flex-col items-center text-center pt-6">
                  <span
                    className={`grid h-14 w-14 place-items-center rounded-full mb-3 ${
                      isSelected ? "bg-accent" : "bg-surface border border-border"
                    }`}
                  >
                    <Crown size={24} className={isSelected ? "text-base" : "text-ink-muted"} />
                  </span>
                  <h3 className="font-display text-lg mb-1">
                    {isAnnual ? "Premium annuel" : "Premium mensuel"}
                  </h3>
                  <p className="mb-4">
                    <span className="text-2xl font-display text-accent">{formatPrice(plan, method)}</span>
                    <span className="text-sm text-ink-muted"> / {isAnnual ? "an" : "mois"}</span>
                  </p>
                </div>

                <ul className="space-y-2">
                  {planFeatures.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm text-ink-muted">
                      <Check size={14} className="text-verified shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>

        {/* Mode de paiement */}
        <div className="rounded-xl2 border border-border bg-surface p-5 md:p-6">
          <h2 className="font-display text-lg mb-4">Mode de paiement</h2>

          <div className="grid grid-cols-2 gap-3 mb-5">
            <button
              onClick={() => setMethod("stripe")}
              className={`relative flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-3.5 text-sm font-medium transition-colors ${
                method === "stripe" ? "border-accent text-accent" : "border-border text-ink-muted hover:border-accent/50"
              }`}
            >
              <CreditCard size={18} /> Carte bancaire
              {method === "stripe" && (
                <span className="absolute top-2.5 right-2.5 grid h-4 w-4 place-items-center rounded-full bg-accent">
                  <Check size={10} className="text-base" strokeWidth={3} />
                </span>
              )}
            </button>
            <button
              onClick={() => setMethod("mobile_money")}
              className={`relative flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-3.5 text-sm font-medium transition-colors ${
                method === "mobile_money" ? "border-accent text-accent" : "border-border text-ink-muted hover:border-accent/50"
              }`}
            >
              <Smartphone size={18} /> Mobile Money
              {method === "mobile_money" && (
                <span className="absolute top-2.5 right-2.5 grid h-4 w-4 place-items-center rounded-full bg-accent">
                  <Check size={10} className="text-base" strokeWidth={3} />
                </span>
              )}
            </button>
          </div>

          {method === preferredMethod && (
            <p className="text-xs text-ink-muted -mt-3 mb-4">Mode recommandé pour ta région.</p>
          )}

          {method === "mobile_money" && (
            <div className="mb-5">
              <label className="text-sm text-ink-muted mb-1.5 block">Numéro Mobile Money</label>
              <label className="flex items-center gap-2.5 rounded-xl border border-border bg-base px-4 py-3">
                <Smartphone size={16} className="text-ink-muted shrink-0" />
                <input
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="034 XX XXX XX"
                  className="flex-1 bg-transparent text-sm outline-none"
                />
              </label>
              <p className="flex items-start gap-1.5 text-xs text-ink-muted mt-2">
                <Info size={13} className="shrink-0 mt-0.5" />
                Tu recevras une demande de paiement sur ce numéro.
              </p>
            </div>
          )}

          <button
            onClick={handleSubscribe}
            disabled={loading || !currentPlan}
            className="w-full rounded-xl bg-accent py-3.5 text-sm font-medium text-base hover:bg-accent-hover disabled:opacity-60"
          >
            {loading ? "Redirection..." : `S'abonner — ${currentPlan ? formatPrice(currentPlan, method) : ""}`}
          </button>
          <p className="flex items-center justify-center gap-1.5 text-xs text-ink-muted mt-3">
            <Lock size={12} /> Paiement sécurisé
          </p>
        </div>
      </div>

      {/* Colonne latérale : résumé */}
      <div className="lg:sticky lg:top-8 space-y-5">
        <div className="rounded-xl2 border border-border bg-surface p-5 md:p-6">
          <h2 className="font-display text-base mb-4">Résumé de la commande</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-ink-muted">Formule</dt>
              <dd>{selectedPlan === "premium_annual" ? "Premium annuel" : "Premium mensuel"}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-ink-muted">Prix</dt>
              <dd>{currentPlan ? formatPrice(currentPlan, method) : "—"}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="flex items-center gap-1 text-ink-muted">
                Frais de service <Info size={12} />
              </dt>
              <dd>{method === "mobile_money" ? "0 Ar" : "0 $"}</dd>
            </div>
          </dl>
          <div className="h-px bg-border my-4" />
          <div className="flex items-center justify-between">
            <span className="font-display">Total à payer</span>
            <span className="font-display text-lg text-accent">
              {currentPlan ? formatPrice(currentPlan, method) : "—"}
            </span>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-xl2 bg-accent/10 border border-accent/20 p-4">
          <ShieldCheck size={20} className="text-accent shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">Annulation à tout moment</p>
            <p className="text-xs text-ink-muted mt-0.5">Résilie ton abonnement quand tu veux, sans frais.</p>
          </div>
        </div>

        <div className="space-y-4">
          {perks.map((perk) => (
            <div key={perk.title} className="flex items-start gap-3">
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${perkColors[perk.color]}`}>
                <perk.icon size={16} />
              </span>
              <div>
                <p className="text-sm font-medium">{perk.title}</p>
                <p className="text-xs text-ink-muted mt-0.5">{perk.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
