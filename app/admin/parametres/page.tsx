"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  BarChart3,
  Check,
  CreditCard,
  Image as ImageIcon,
  Link2,
  Palette,
  Save,
  Settings2,
  Share2,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { AdminPanelSkeleton } from "@/components/admin/AdminSkeleton";
import { AdminCard, AdminHeaderActions, AdminTabs } from "@/components/admin/AdminChrome";
import { FormField } from "@/components/ui/FormField";
import { TagInput } from "@/components/ui/TagInput";
import { ThemeEditor } from "@/components/theme/ThemeEditor";
import { useToast } from "@/context/ToastProvider";
import { uploadToCloudinaryClient } from "@/lib/cloudinaryClient";
import { RESEAUX, urlSocialeValide, type IdentifiantReseau } from "@/lib/socialPlatforms";
import { UNIVERS, UNIVERS_INFO, normaliserUnivers, type Univers } from "@/lib/univers";
import { normaliserTheme, type ThemePreference } from "@/lib/theme";
import { DEVISES, FORMATS_DATE, FUSEAUX, LANGUES } from "@/lib/locales";

type PlanPricing = { plan: "premium" | "premium_annual"; amountUSD: number; amountMGA: number };

type SiteConfigForm = {
  siteName: string;
  tagline: string;
  description: string;
  siteUrl: string;
  defaultLanguage: string;
  defaultUnivers: Univers;
  currency: string;
  timezone: string;
  dateFormat: string;
  logoUrl: string;
  logoDarkUrl: string;
  faviconUrl: string;
  supportEmail: string;
  copyrightText: string;
  seoTitle: string;
  seoDescription: string;
  googleAnalyticsId: string;
  googleSearchConsoleId: string;
  trialDays: number;
  anonymousDailyPlays: number;
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
  socialLinks: { platform: IdentifiantReseau; url: string }[];
  theme: ThemePreference;
};

type Onglet = "general" | "logos" | "theme" | "premium" | "reseaux" | "seo";

const onglets: { value: Onglet; label: string; icon: typeof Settings2 }[] = [
  { value: "general", label: "Général", icon: Settings2 },
  { value: "logos", label: "Logos & Favicon", icon: ImageIcon },
  { value: "theme", label: "Thème", icon: Palette },
  { value: "premium", label: "Prix Premium", icon: CreditCard },
  { value: "reseaux", label: "Réseaux sociaux", icon: Share2 },
  { value: "seo", label: "SEO & Analytics", icon: BarChart3 },
];

/** Les trois images du site, décrites une fois pour les trois emplacements. */
const IMAGES = [
  {
    cle: "logoUrl",
    label: "Logo principal",
    aide: "Barre latérale, en-tête mobile, icône de l'application.",
    fondSombre: false,
  },
  {
    cle: "logoDarkUrl",
    label: "Logo sombre",
    aide: "Utilisé sur fond sombre. À défaut, le logo principal sert partout.",
    fondSombre: true,
  },
  {
    cle: "faviconUrl",
    label: "Favicon",
    aide: "Icône d'onglet. À défaut, elle est dérivée du logo principal.",
    fondSombre: false,
  },
] as const;

export default function AdminSettingsPage() {
  const pushToast = useToast();
  const [config, setConfig] = useState<SiteConfigForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [onglet, setOnglet] = useState<Onglet>("general");
  const [envoiEnCours, setEnvoiEnCours] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/site-config");
        if (!res.ok) throw new Error();
        const data = await res.json();
        setConfig({
          ...data.config,
          socialLinks: data.config.socialLinks ?? [],
          // Un document enregistré avant l'arrivée du thème n'en a pas :
          // la normalisation retombe alors sur la palette d'origine.
          theme: normaliserTheme(data.config.theme),
        });
      } catch {
        pushToast("error", "Impossible de charger les paramètres.");
      }
    }
    load();
  }, [pushToast]);

  function modifier(patch: Partial<SiteConfigForm>) {
    setConfig((actuel) => (actuel ? { ...actuel, ...patch } : actuel));
  }

  /**
   * Les images sont enregistrées immédiatement, sans attendre le bouton
   * principal : un envoi réussi qu'on oublie de valider ensuite donne
   * l'impression que rien ne s'est passé.
   */
  async function enregistrerImage(cle: "logoUrl" | "logoDarkUrl" | "faviconUrl", url: string) {
    try {
      const res = await fetch("/api/admin/site-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [cle]: url }),
      });
      if (!res.ok) throw new Error();
      modifier({ [cle]: url } as Partial<SiteConfigForm>);
      window.dispatchEvent(new Event("moziik-site-config-change"));
      pushToast("success", url ? "Image mise à jour." : "Image retirée.");
    } catch {
      pushToast("error", "Échec de l'enregistrement de l'image.");
    }
  }

  async function envoyerImage(cle: "logoUrl" | "logoDarkUrl" | "faviconUrl", file: File) {
    setEnvoiEnCours(cle);
    try {
      const { url } = await uploadToCloudinaryClient(file, "site-assets");
      await enregistrerImage(cle, url);
    } catch {
      pushToast("error", "Échec de l'envoi du fichier.");
    } finally {
      setEnvoiEnCours(null);
    }
  }

  function updatePlan(index: number, field: keyof PlanPricing, value: number) {
    if (!config) return;
    const plans = [...config.plans];
    plans[index] = { ...plans[index], [field]: value };
    modifier({ plans });
  }

  async function handleSave(e?: React.FormEvent) {
    e?.preventDefault();
    if (!config) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/site-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...config,
          // Une ligne laissée en blanc ferait échouer tout l'enregistrement :
          // le schéma exige une URL http(s) valide sur chaque entrée.
          socialLinks: config.socialLinks.filter((l) => urlSocialeValide(l.url)),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error);
      }
      pushToast("success", "Paramètres enregistrés.");
      window.dispatchEvent(new Event("moziik-site-config-change"));
    } catch (err) {
      pushToast("error", err instanceof Error && err.message ? err.message : "L'enregistrement a échoué.");
    } finally {
      setSaving(false);
    }
  }

  if (!config) {
    return (
      <div className="space-y-4">
        <AdminPanelSkeleton height="h-12" />
        <AdminPanelSkeleton height="h-64" />
        <AdminPanelSkeleton height="h-48" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <AdminHeaderActions>
        <button
          type="button"
          onClick={() => handleSave()}
          disabled={saving}
          className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-base transition-colors hover:bg-accent-hover disabled:opacity-60"
        >
          <Save size={16} />
          {saving ? "Enregistrement..." : "Enregistrer les modifications"}
        </button>
      </AdminHeaderActions>

      <AdminTabs tabs={onglets} value={onglet} onChange={setOnglet} />

      {onglet === "general" && (
        <>
          <AdminCard title="Informations générales">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-4">
                <FormField
                  label="Nom du site"
                  value={config.siteName}
                  onChange={(e) => modifier({ siteName: e.target.value })}
                />
                <FormField
                  label="Slogan"
                  value={config.tagline}
                  onChange={(e) => modifier({ tagline: e.target.value })}
                />
                <FormField
                  label="Email de contact"
                  type="email"
                  value={config.supportEmail}
                  onChange={(e) => modifier({ supportEmail: e.target.value })}
                />
              </div>
              <label className="block">
                <span className="mb-1.5 block text-sm text-ink-muted">Description du site</span>
                <textarea
                  value={config.description}
                  onChange={(e) => modifier({ description: e.target.value })}
                  rows={6}
                  maxLength={1000}
                  placeholder="En quelques phrases, ce qu'on trouve sur la plateforme."
                  className="w-full resize-y rounded-xl border border-border bg-base px-4 py-2.5 text-sm outline-none focus:border-accent"
                />
                <span className="mt-1 block text-xs text-ink-muted">
                  Reprise comme description de référencement si le champ SEO est laissé vide.
                </span>
              </label>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <FormField
                label="Adresse du site"
                type="url"
                placeholder="https://moziik.app"
                value={config.siteUrl}
                onChange={(e) => modifier({ siteUrl: e.target.value })}
              />
              <FormField
                label="Mention de copyright"
                value={config.copyrightText}
                onChange={(e) => modifier({ copyrightText: e.target.value })}
              />
              <Selecteur
                label="Langue par défaut"
                value={config.defaultLanguage}
                onChange={(defaultLanguage) => modifier({ defaultLanguage })}
                options={LANGUES}
              />
              <div>
                <Selecteur
                  label="Univers musical par défaut"
                  value={config.defaultUnivers}
                  onChange={(v) => modifier({ defaultUnivers: normaliserUnivers(v) })}
                  options={UNIVERS.map((u) => ({ value: u, label: UNIVERS_INFO[u].label }))}
                />
                <p className="mt-1 text-xs text-ink-muted">
                  Ce que voit un visiteur qui n&apos;a rien choisi. Chacun peut ensuite basculer depuis
                  l&apos;en-tête, et son choix le suit d&apos;un appareil à l&apos;autre s&apos;il a un compte.
                </p>
              </div>
              <Selecteur
                label="Devise"
                value={config.currency}
                onChange={(currency) => modifier({ currency })}
                options={DEVISES}
              />
              <Selecteur
                label="Fuseau horaire"
                value={config.timezone}
                onChange={(timezone) => modifier({ timezone })}
                options={FUSEAUX}
              />
              <Selecteur
                label="Format de date"
                value={config.dateFormat}
                onChange={(dateFormat) => modifier({ dateFormat })}
                options={FORMATS_DATE}
              />
            </div>
          </AdminCard>

          <AdminCard
            title="Genres musicaux"
            description="Proposés aux artistes lors de la publication et la modification d'un titre."
          >
            <TagInput
              value={config.genres}
              onChange={(genres) => modifier({ genres })}
              placeholder="Ajouter un genre (ex: Afrobeat)..."
              preserveCase
              maxTags={40}
            />
          </AdminCard>

          <AdminCard
            title="Mentions légales"
            description="Ces champs alimentent directement la page publique /mentions-legales."
          >
            <div className="space-y-4">
              <FormField
                label="Raison sociale"
                value={config.legalEntityName}
                onChange={(e) => modifier({ legalEntityName: e.target.value })}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  label="Capital social"
                  value={config.legalCapital}
                  onChange={(e) => modifier({ legalCapital: e.target.value })}
                />
                <FormField
                  label="Site web affiché"
                  value={config.legalWebsite}
                  onChange={(e) => modifier({ legalWebsite: e.target.value })}
                />
                <FormField
                  label="Ville d'immatriculation RCS"
                  value={config.legalRcsCity}
                  onChange={(e) => modifier({ legalRcsCity: e.target.value })}
                />
                <FormField
                  label="Numéro RCS"
                  value={config.legalRcsNumber}
                  onChange={(e) => modifier({ legalRcsNumber: e.target.value })}
                />
              </div>
              <FormField
                label="Adresse du siège"
                value={config.legalAddress}
                onChange={(e) => modifier({ legalAddress: e.target.value })}
              />
              <FormField
                label="Date de dernière mise à jour"
                type="date"
                value={config.legalUpdatedAt ? config.legalUpdatedAt.slice(0, 10) : ""}
                onChange={(e) => modifier({ legalUpdatedAt: e.target.value })}
              />
            </div>
          </AdminCard>
        </>
      )}

      {onglet === "logos" && (
        <AdminCard
          title="Logos & Favicon"
          description="Envoyez un fichier ou collez un lien direct. Chaque image est enregistrée aussitôt."
        >
          <div className="grid gap-6 md:grid-cols-3">
            {IMAGES.map((image) => (
              <ChampImage
                key={image.cle}
                label={image.label}
                aide={image.aide}
                fondSombre={image.fondSombre}
                url={config[image.cle]}
                envoiEnCours={envoiEnCours === image.cle}
                onFichier={(file) => envoyerImage(image.cle, file)}
                onLien={(url) => enregistrerImage(image.cle, url)}
                onRetirer={() => enregistrerImage(image.cle, "")}
              />
            ))}
          </div>
        </AdminCard>
      )}

      {onglet === "theme" && (
        <AdminCard
          title="Thème du site"
          description="Ce que voient les visiteurs et les comptes gratuits. Les membres Premium peuvent lui préférer leurs propres couleurs, depuis leur compte. L'aperçu ci-dessous ne change pas votre affichage : le thème s'applique après enregistrement."
        >
          <ThemeEditor value={config.theme} onChange={(theme) => modifier({ theme })} />
        </AdminCard>
      )}

      {onglet === "premium" && (
        <>
          <AdminCard title="Prix Premium" description="Les montants proposés à l'abonnement.">
            <div className="space-y-4">
              {config.plans.map((plan, i) => (
                <div key={plan.plan} className="rounded-xl border border-border p-4">
                  <p className="mb-3 text-sm font-medium">
                    {plan.plan === "premium" ? "Premium mensuel" : "Premium annuel"}
                    {plan.plan === "premium_annual" && economieAnnuelle(config.plans) && (
                      <span className="ml-2 rounded-full bg-verified/10 px-2 py-0.5 text-[11px] font-semibold text-verified">
                        Économisez {economieAnnuelle(config.plans)} %
                      </span>
                    )}
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      label="Prix (USD / Stripe)"
                      type="number"
                      step="0.01"
                      min="0"
                      value={plan.amountUSD}
                      onChange={(e) => updatePlan(i, "amountUSD", Number(e.target.value))}
                    />
                    <FormField
                      label="Prix (MGA / Mobile Money)"
                      type="number"
                      min="0"
                      value={plan.amountMGA}
                      onChange={(e) => updatePlan(i, "amountMGA", Number(e.target.value))}
                    />
                  </div>
                </div>
              ))}

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  label="Période d'essai (jours, 0 pour aucune)"
                  type="number"
                  min="0"
                  max="365"
                  value={config.trialDays}
                  onChange={(e) => modifier({ trialDays: Math.max(0, Number(e.target.value)) })}
                />
                <FormField
                  label="Rémunération artiste par écoute complète (USD)"
                  type="number"
                  step="0.0001"
                  min="0"
                  value={config.payPerListenRateUSD}
                  onChange={(e) => modifier({ payPerListenRateUSD: Number(e.target.value) })}
                />
                <FormField
                  label="Écoutes par jour sans compte (0 pour aucune limite)"
                  type="number"
                  min="0"
                  max="1000"
                  value={config.anonymousDailyPlays}
                  onChange={(e) => modifier({ anonymousDailyPlays: Math.max(0, Number(e.target.value)) })}
                />
              </div>

              <p className="text-xs text-ink-muted">
                Le décompte porte sur les titres distincts, par adresse IP, et se remet à zéro
                chaque jour. Réécouter un titre déjà compté ne consomme rien de plus.
              </p>
            </div>
          </AdminCard>

          <AdminCard
            title="Ce que Premium débloque"
            description="Rappel de ce dont bénéficient les abonnés — géré par le code, listé ici pour mémoire."
          >
            <ul className="grid gap-2 text-sm text-ink-muted sm:grid-cols-2">
              {[
                "Écoute hors-ligne des morceaux téléchargés",
                "Qualité audio 320 kb/s (128 sans abonnement)",
                "Personnalisation du thème et des couleurs",
                "Aucune interruption dans la lecture",
              ].map((ligne) => (
                <li key={ligne} className="flex items-start gap-2">
                  <Check size={15} className="mt-0.5 shrink-0 text-verified" />
                  {ligne}
                </li>
              ))}
            </ul>
          </AdminCard>
        </>
      )}

      {onglet === "reseaux" && (
        <AdminCard
          title="Réseaux sociaux"
          description="Affichés sur la page de contact et dans le pied de page. Un réseau laissé vide n'apparaît pas."
        >
          <div className="grid gap-4 lg:grid-cols-2">
            {RESEAUX.map((reseau) => {
              const courant = config.socialLinks.find((l) => l.platform === reseau.id);
              const valeur = courant?.url ?? "";
              const invalide = valeur.trim().length > 0 && !urlSocialeValide(valeur);
              return (
                <div key={reseau.id}>
                  <div className="flex items-center gap-3">
                    <span className="flex w-28 shrink-0 items-center gap-2 text-sm text-ink">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: reseau.couleur }}
                        aria-hidden
                      />
                      {reseau.label}
                    </span>
                    <input
                      type="url"
                      inputMode="url"
                      value={valeur}
                      aria-label={`Lien ${reseau.label}`}
                      placeholder={reseau.exemple}
                      onChange={(e) => {
                        const url = e.target.value;
                        const autres = config.socialLinks.filter((l) => l.platform !== reseau.id);
                        modifier({
                          socialLinks: url.trim() ? [...autres, { platform: reseau.id, url }] : autres,
                        });
                      }}
                      className={`min-w-0 flex-1 rounded-xl border bg-base px-4 py-2.5 text-sm outline-none focus:border-accent ${
                        invalide ? "border-accent" : "border-border"
                      }`}
                    />
                  </div>
                  {invalide && (
                    <p className="mt-1 pl-[7.75rem] text-xs text-accent">
                      Le lien doit commencer par http:// ou https:// — sinon il ne sera pas enregistré.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </AdminCard>
      )}

      {onglet === "seo" && (
        <AdminCard
          title="SEO & Analytics"
          description="Ce que voient les moteurs de recherche, et la mesure d'audience."
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <FormField
                label="Titre du site (SEO)"
                value={config.seoTitle}
                placeholder={config.siteName}
                onChange={(e) => modifier({ seoTitle: e.target.value })}
              />
              <FormField
                label="Google Analytics ID"
                value={config.googleAnalyticsId}
                placeholder="G-XXXXXXXXXX"
                onChange={(e) => modifier({ googleAnalyticsId: e.target.value.trim() })}
              />
              <FormField
                label="Vérification Google Search Console"
                value={config.googleSearchConsoleId}
                placeholder="Jeton de la balise de vérification"
                onChange={(e) => modifier({ googleSearchConsoleId: e.target.value.trim() })}
              />
            </div>
            <label className="block">
              <span className="mb-1.5 block text-sm text-ink-muted">Description (SEO)</span>
              <textarea
                value={config.seoDescription}
                onChange={(e) => modifier({ seoDescription: e.target.value })}
                rows={5}
                maxLength={400}
                placeholder={config.description || config.tagline}
                className="w-full resize-y rounded-xl border border-border bg-base px-4 py-2.5 text-sm outline-none focus:border-accent"
              />
              <span className="mt-1 block text-xs text-ink-muted">
                {config.seoDescription.length}/400 — au-delà de 160 caractères, Google tronque.
              </span>
            </label>
          </div>

          <p className="mt-4 rounded-xl border border-border bg-base/60 p-3 text-xs text-ink-muted">
            Laissé vide, l&apos;identifiant Analytics n&apos;installe aucun script : aucune requête de mesure
            n&apos;est envoyée, et rien n&apos;est déposé sur l&apos;appareil des visiteurs.
          </p>
        </AdminCard>
      )}
    </form>
  );
}

/** Économie annoncée sur l'abonnement annuel, arrondie à l'entier. */
function economieAnnuelle(plans: PlanPricing[]): number | null {
  const mensuel = plans.find((p) => p.plan === "premium")?.amountUSD ?? 0;
  const annuel = plans.find((p) => p.plan === "premium_annual")?.amountUSD ?? 0;
  if (mensuel <= 0 || annuel <= 0) return null;
  const economie = Math.round((1 - annuel / (mensuel * 12)) * 100);
  return economie > 0 ? economie : null;
}

function Selecteur({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-ink-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-border bg-base px-4 py-2.5 text-sm text-ink outline-none focus:border-accent"
      >
        {/* Une valeur enregistrée qui ne figure plus au catalogue reste
            proposée : la retirer de la liste la ferait disparaître au premier
            enregistrement, sans que personne ne l'ait demandé. */}
        {!options.some((o) => o.value === value) && value && <option value={value}>{value}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function ChampImage({
  label,
  aide,
  fondSombre,
  url,
  envoiEnCours,
  onFichier,
  onLien,
  onRetirer,
}: {
  label: string;
  aide: string;
  fondSombre: boolean;
  url: string;
  envoiEnCours: boolean;
  onFichier: (file: File) => void;
  onLien: (url: string) => void;
  onRetirer: () => void;
}) {
  const [lien, setLien] = useState("");

  return (
    <div>
      <p className="text-sm font-medium text-ink">{label}</p>
      <p className="mt-0.5 text-xs text-ink-muted">{aide}</p>

      <div
        className={`mt-3 grid h-24 place-items-center rounded-xl border border-border p-3 ${
          fondSombre ? "bg-[#0D0F1A]" : "bg-base"
        }`}
      >
        {url ? (
          <Image src={url} alt={label} width={120} height={72} className="max-h-16 w-auto object-contain" />
        ) : (
          <span className="text-xs text-ink-muted">Aucune image</span>
        )}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <label className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-medium text-ink-muted transition-colors hover:border-accent hover:text-accent">
          <UploadCloud size={14} />
          {envoiEnCours ? "Envoi..." : url ? "Remplacer" : "Envoyer"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={envoiEnCours}
            onChange={(e) => e.target.files?.[0] && onFichier(e.target.files[0])}
          />
        </label>
        {url && (
          <button
            type="button"
            onClick={onRetirer}
            aria-label={`Retirer ${label}`}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border text-ink-muted transition-colors hover:border-danger hover:text-danger"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <span className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border bg-base px-3 py-2">
          <Link2 size={13} className="shrink-0 text-ink-muted" />
          <input
            value={lien}
            onChange={(e) => setLien(e.target.value)}
            placeholder="ou coller un lien"
            aria-label={`Lien direct pour ${label}`}
            className="min-w-0 flex-1 bg-transparent text-xs outline-none"
          />
        </span>
        <button
          type="button"
          disabled={!lien.trim()}
          onClick={() => {
            onLien(lien.trim());
            setLien("");
          }}
          aria-label={`Utiliser ce lien pour ${label}`}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent text-base transition-colors hover:bg-accent-hover disabled:opacity-40"
        >
          <Check size={14} />
        </button>
      </div>
    </div>
  );
}
