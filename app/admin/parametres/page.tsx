"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { UploadCloud, Link2, Check } from "lucide-react";
import { EqualizerLoader } from "@/components/ui/EqualizerLoader";
import { FormField } from "@/components/ui/FormField";
import { TagInput } from "@/components/ui/TagInput";
import { useToast } from "@/context/ToastProvider";
import { uploadToCloudinaryClient } from "@/lib/cloudinaryClient";

type PlanPricing = { plan: "premium" | "premium_annual"; amountUSD: number; amountMGA: number };

type SiteConfigForm = {
  siteName: string;
  tagline: string;
  logoUrl: string;
  supportEmail: string;
  copyrightText: string;
  plans: PlanPricing[];
  genres: string[];
  payPerListenRateUSD: number;
  legalEntityName: string;
  legalCapital: string;
  legalRcsCity: string;
  legalRcsNumber: string;
  legalAddress: string;
  legalWebsite: string;
  legalUpdatedAt: string;
};

export default function AdminSettingsPage() {
  const pushToast = useToast();
  const [config, setConfig] = useState<SiteConfigForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoUrlInput, setLogoUrlInput] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/site-config");
        if (!res.ok) throw new Error();
        const data = await res.json();
        setConfig(data.config);
        setLogoUrlInput(data.config.logoUrl ?? "");
      } catch {
        pushToast("error", "Impossible de charger les paramètres.");
      }
    }
    load();
  }, [pushToast]);

  /**
   * Le logo est enregistré immédiatement côté serveur (au lieu
   * d'attendre le clic sur "Enregistrer les paramètres" avec le reste
   * du formulaire) — évite qu'un upload réussi n'apparaisse jamais
   * parce qu'on a oublié de sauvegarder ensuite.
   */
  async function saveLogoUrl(url: string) {
    if (!config) return;
    try {
      const res = await fetch("/api/admin/site-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logoUrl: url }),
      });
      if (!res.ok) throw new Error();
      setConfig({ ...config, logoUrl: url });
      setLogoUrlInput(url);
      window.dispatchEvent(new Event("moziik-site-config-change"));
      pushToast("success", "Logo mis à jour.");
    } catch {
      pushToast("error", "Échec de l'enregistrement du logo.");
    }
  }

  async function handleLogoUpload(file: File) {
    setUploadingLogo(true);
    try {
      const { url } = await uploadToCloudinaryClient(file, "site-assets");
      await saveLogoUrl(url);
    } catch {
      pushToast("error", "Échec de l'envoi du logo.");
    } finally {
      setUploadingLogo(false);
    }
  }

  function handleLogoUrlSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!logoUrlInput.trim()) return;
    saveLogoUrl(logoUrlInput.trim());
  }

  function updatePlan(index: number, field: keyof PlanPricing, value: number) {
    if (!config) return;
    const plans = [...config.plans];
    plans[index] = { ...plans[index], [field]: value };
    setConfig({ ...config, plans });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!config) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/site-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error();
      pushToast("success", "Paramètres enregistrés.");
      window.dispatchEvent(new Event("moziik-site-config-change"));
    } catch {
      pushToast("error", "L'enregistrement a échoué.");
    } finally {
      setSaving(false);
    }
  }

  if (!config) {
    return (
      <div className="py-10 grid place-items-center">
        <EqualizerLoader />
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-8 max-w-3xl">
      <section className="space-y-4">
        <h2 className="text-sm uppercase tracking-wide text-ink-muted">Identité du site</h2>

        <div className="space-y-3">
          <span className="text-sm text-ink-muted block">Logo</span>
          <div className="flex flex-wrap items-center gap-4">
            {config.logoUrl ? (
              <Image src={config.logoUrl} alt="Logo" width={56} height={56} className="rounded-lg object-contain bg-surface border border-border p-1.5" />
            ) : (
              <div className="h-14 w-14 rounded-lg bg-surface border border-border grid place-items-center text-ink-muted text-xs">
                Aucun
              </div>
            )}
            <label className="flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 cursor-pointer text-sm text-ink-muted hover:border-accent">
              <UploadCloud size={16} />
              {uploadingLogo ? "Envoi..." : "Envoyer un fichier"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploadingLogo}
                onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])}
              />
            </label>
          </div>

          <div className="flex items-center gap-2">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-ink-muted">ou</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleLogoUrlSubmit} className="flex items-center gap-2">
            <label className="flex-1 flex items-center gap-2 rounded-xl border border-border bg-base px-3.5 py-2.5">
              <Link2 size={14} className="text-ink-muted shrink-0" />
              <input
                value={logoUrlInput}
                onChange={(e) => setLogoUrlInput(e.target.value)}
                placeholder="https://... lien direct vers une image"
                className="flex-1 bg-transparent text-sm outline-none"
              />
            </label>
            <button
              type="submit"
              aria-label="Utiliser ce lien comme logo"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-base hover:bg-accent-hover"
            >
              <Check size={16} />
            </button>
          </form>
          <p className="text-xs text-ink-muted">
            Recommandé : image carrée, au moins 512×512, fond transparent (PNG/SVG).
          </p>
        </div>

        <FormField
          label="Nom du site"
          value={config.siteName}
          onChange={(e) => setConfig({ ...config, siteName: e.target.value })}
        />
        <FormField
          label="Slogan"
          value={config.tagline}
          onChange={(e) => setConfig({ ...config, tagline: e.target.value })}
        />
        <FormField
          label="Email de support"
          type="email"
          value={config.supportEmail}
          onChange={(e) => setConfig({ ...config, supportEmail: e.target.value })}
        />
        <FormField
          label="Mention de copyright"
          value={config.copyrightText}
          onChange={(e) => setConfig({ ...config, copyrightText: e.target.value })}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm uppercase tracking-wide text-ink-muted">Genres musicaux</h2>
        <p className="text-xs text-ink-muted -mt-1">
          Proposés aux artistes lors de la publication et la modification d&apos;un titre.
        </p>
        <TagInput
          value={config.genres}
          onChange={(genres) => setConfig({ ...config, genres })}
          placeholder="Ajouter un genre (ex: Afrobeat)..."
          preserveCase
          maxTags={40}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-sm uppercase tracking-wide text-ink-muted">Coûts d&apos;abonnement</h2>
        {config.plans.map((plan, i) => (
          <div key={plan.plan} className="rounded-xl2 border border-border bg-surface p-4">
            <p className="text-sm font-medium mb-3">
              {plan.plan === "premium" ? "Premium mensuel" : "Premium annuel"}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField
                label="Prix (USD / Stripe)"
                type="number"
                step="0.01"
                value={plan.amountUSD}
                onChange={(e) => updatePlan(i, "amountUSD", Number(e.target.value))}
              />
              <FormField
                label="Prix (MGA / Mobile Money)"
                type="number"
                value={plan.amountMGA}
                onChange={(e) => updatePlan(i, "amountMGA", Number(e.target.value))}
              />
            </div>
          </div>
        ))}

        <FormField
          label="Rémunération artiste par écoute complète (USD)"
          type="number"
          step="0.0001"
          value={config.payPerListenRateUSD}
          onChange={(e) => setConfig({ ...config, payPerListenRateUSD: Number(e.target.value) })}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-sm uppercase tracking-wide text-ink-muted">Mentions légales</h2>
        <p className="text-xs text-ink-muted -mt-2">
          Ces champs alimentent directement la page publique{" "}
          <span className="text-ink">/mentions-legales</span>.
        </p>

        <FormField
          label="Raison sociale"
          value={config.legalEntityName}
          onChange={(e) => setConfig({ ...config, legalEntityName: e.target.value })}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField
            label="Capital social"
            value={config.legalCapital}
            onChange={(e) => setConfig({ ...config, legalCapital: e.target.value })}
          />
          <FormField
            label="Site web affiché"
            value={config.legalWebsite}
            onChange={(e) => setConfig({ ...config, legalWebsite: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField
            label="Ville d'immatriculation RCS"
            value={config.legalRcsCity}
            onChange={(e) => setConfig({ ...config, legalRcsCity: e.target.value })}
          />
          <FormField
            label="Numéro RCS"
            value={config.legalRcsNumber}
            onChange={(e) => setConfig({ ...config, legalRcsNumber: e.target.value })}
          />
        </div>
        <FormField
          label="Adresse du siège"
          value={config.legalAddress}
          onChange={(e) => setConfig({ ...config, legalAddress: e.target.value })}
        />
        <FormField
          label="Date de dernière mise à jour des mentions légales"
          type="date"
          value={config.legalUpdatedAt ? config.legalUpdatedAt.slice(0, 10) : ""}
          onChange={(e) => setConfig({ ...config, legalUpdatedAt: e.target.value })}
        />
      </section>

      <button
        type="submit"
        disabled={saving}
        className="rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-base hover:bg-accent-hover disabled:opacity-60"
      >
        {saving ? "Enregistrement..." : "Enregistrer les paramètres"}
      </button>
    </form>
  );
}
