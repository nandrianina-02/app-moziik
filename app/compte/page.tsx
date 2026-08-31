"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  BadgeCheck,
  Calendar,
  Check,
  Clock,
  Crown,
  Download,
  KeyRound,
  Loader2,
  LogOut,
  Mic2,
  Monitor,
  Palette,
  Shield,
  Smartphone,
  Trash2,
  User as UserIcon,
  Wallet,
} from "lucide-react";
import { oublierCompte } from "@/lib/offlineApi";
import { Skeleton } from "@/components/ui/Skeleton";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { FormField } from "@/components/ui/FormField";
import { AdminCard, AdminTabs } from "@/components/admin/AdminChrome";
import { ChangePasswordModal } from "@/components/account/ChangePasswordModal";
import { AvatarPicker } from "@/components/account/AvatarPicker";
import { useToast } from "@/context/ToastProvider";
import { useFormatDate, useSiteConfig } from "@/context/SiteConfigProvider";
import { DEVISES, FORMATS_DATE, FUSEAUX, LANGUES, deviseDe } from "@/lib/locales";
import { UniversToggle } from "@/components/ui/UniversToggle";
import { ModeSelector } from "@/components/ui/ModeSelector";

type Profil = {
  id: string;
  name: string;
  username?: string;
  email: string;
  avatarUrl?: string;
  phone: string;
  role: "member" | "artist" | "admin";
  verifiedArtist: boolean;
  emailVerified: boolean;
  suspended: boolean;
  hasPassword: boolean;
  hasGoogleAccount: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  preferences: { language?: string; timezone?: string; dateFormat?: string };
};

type Abonnement = { plan: string; status: string; currentPeriodEnd: string; amount?: number; currency?: string; paymentMethod?: string } | null;
type Appareil = { id: string; device: string; createdAt: string; expiresAt: string };

const roleLabels: Record<string, string> = { member: "Membre", artist: "Artiste", admin: "Administrateur" };

type Onglet = "profil" | "abonnement" | "securite" | "preferences";

const onglets = [
  { value: "profil" as const, label: "Profil", icon: UserIcon },
  { value: "abonnement" as const, label: "Abonnement", icon: Wallet },
  { value: "securite" as const, label: "Sécurité", icon: Shield },
  { value: "preferences" as const, label: "Préférences", icon: Palette },
];

export default function AccountPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const pushToast = useToast();
  const formatDate = useFormatDate();
  const siteConfig = useSiteConfig();

  const [onglet, setOnglet] = useState<Onglet>("profil");
  const [profil, setProfil] = useState<Profil | null>(null);
  const [subscription, setSubscription] = useState<Abonnement>(null);
  const [hasPremium, setHasPremium] = useState(false);
  const [appareils, setAppareils] = useState<Appareil[]>([]);
  const [loading, setLoading] = useState(true);

  // Brouillon du formulaire d'identité : séparé du profil enregistré, pour
  // que « Annuler » ait un sens et que rien ne parte sans clic.
  const [form, setForm] = useState({ name: "", username: "", email: "", phone: "" });
  const [prefs, setPrefs] = useState({ language: "", timezone: "", dateFormat: "" });
  const [enregistrement, setEnregistrement] = useState(false);

  const [motDePasse, setMotDePasse] = useState(false);
  const [confirmDeconnexionTout, setConfirmDeconnexionTout] = useState(false);
  const [confirmSuppression, setConfirmSuppression] = useState(false);
  const [action, setAction] = useState(false);

  const chargerProfil = useCallback(async () => {
    try {
      const res = await fetch("/api/me/profile");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setProfil(data.user);
      setForm({
        name: data.user.name,
        username: data.user.username ?? "",
        email: data.user.email,
        phone: data.user.phone ?? "",
      });
      setPrefs({
        language: data.user.preferences?.language ?? "",
        timezone: data.user.preferences?.timezone ?? "",
        dateFormat: data.user.preferences?.dateFormat ?? "",
      });
    } catch {
      pushToast("error", "Impossible de charger le profil.");
    }
  }, [pushToast]);

  useEffect(() => {
    if (status !== "authenticated") {
      setLoading(false);
      return;
    }
    Promise.all([
      chargerProfil(),
      fetch("/api/me/subscription")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!data) return;
          setSubscription(data.subscription);
          setHasPremium(data.hasPremium);
        })
        .catch(() => {}),
      fetch("/api/me/sessions")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => data && setAppareils(data.devices))
        .catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [status, chargerProfil]);

  async function enregistrerIdentite(e: React.FormEvent) {
    e.preventDefault();
    if (!profil) return;
    setEnregistrement(true);
    try {
      const res = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          ...(form.username && form.username !== profil.username ? { username: form.username } : {}),
          // L'email d'un compte Google est sa clé de rattachement : le
          // formulaire l'affiche, mais ne l'envoie pas.
          ...(profil.hasGoogleAccount || form.email === profil.email ? {} : { email: form.email }),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error);
      setProfil((p) => (p ? { ...p, ...data.user } : p));
      // La session porte le nom et la photo affichés dans l'en-tête : sans
      // cette mise à jour, ils resteraient périmés jusqu'au rechargement.
      await update({ name: data.user.name, email: data.user.email });
      pushToast("success", "Profil mis à jour.");
    } catch (err) {
      pushToast("error", err instanceof Error && err.message ? err.message : "L'enregistrement a échoué.");
    } finally {
      setEnregistrement(false);
    }
  }

  async function enregistrerPreferences() {
    setEnregistrement(true);
    try {
      const res = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: prefs }),
      });
      if (!res.ok) throw new Error();
      // Les dates affichées partout dans l'app suivent ces réglages : on
      // prévient le fournisseur plutôt que d'attendre un rechargement.
      window.dispatchEvent(new Event("moziik-preferences-change"));
      pushToast("success", "Préférences enregistrées.");
    } catch {
      pushToast("error", "L'enregistrement a échoué.");
    } finally {
      setEnregistrement(false);
    }
  }

  async function deconnecterAppareil(id: string) {
    const res = await fetch(`/api/me/sessions?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      pushToast("error", "La déconnexion a échoué.");
      return;
    }
    setAppareils((prev) => prev.filter((a) => a.id !== id));
    pushToast("success", "Appareil déconnecté.");
  }

  async function deconnecterTout() {
    setAction(true);
    const res = await fetch("/api/me/sessions", { method: "DELETE" });
    setAction(false);
    setConfirmDeconnexionTout(false);
    if (!res.ok) {
      pushToast("error", "La déconnexion a échoué.");
      return;
    }
    // La session courante fait partie du lot : on la ferme proprement plutôt
    // que de laisser la page se vider à la prochaine revalidation.
    await oublierCompte();
    await signOut({ redirect: false });
    pushToast("success", "Toutes les sessions ont été fermées.");
    router.push("/connexion");
  }

  async function supprimerCompte() {
    setAction(true);
    try {
      const res = await fetch("/api/me", { method: "DELETE" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error);
      await oublierCompte();
      await signOut({ redirect: false });
      pushToast("success", "Compte supprimé.");
      router.push("/");
    } catch (err) {
      pushToast("error", err instanceof Error && err.message ? err.message : "La suppression a échoué.");
    } finally {
      setAction(false);
      setConfirmSuppression(false);
    }
  }

  if (status === "loading" || (status === "authenticated" && loading)) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 md:px-10 md:py-10">
        <Skeleton className="h-9 w-52 rounded-xl" />
        <Skeleton className="mt-6 h-36 w-full rounded-xl2" />
        <Skeleton className="mt-4 h-64 w-full rounded-xl2" />
      </div>
    );
  }

  if (status !== "authenticated" || !session?.user || !profil) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 md:px-10 md:py-10">
        <h1 className="text-2xl font-display">Mon compte</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Connecte-toi pour accéder à ton compte.{" "}
          <Link href="/connexion" className="text-accent hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    );
  }

  const devise = deviseDe(siteConfig.currency ?? "EUR");

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 md:px-10 md:py-10">
      <h1 className="text-2xl font-display sm:text-3xl">Mon compte</h1>
      <p className="mt-1 text-sm text-ink-muted">Gérez vos informations personnelles et vos préférences.</p>

      <div className="mt-5">
        <AdminTabs tabs={onglets} value={onglet} onChange={setOnglet} />
      </div>

      {/* Carte d'identité — visible quel que soit l'onglet, c'est le repère. */}
      <div className="mt-6 flex flex-col gap-6 rounded-xl2 border border-border bg-surface p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <AvatarPicker
            url={profil.avatarUrl}
            nom={profil.name}
            onChange={async (avatarUrl) => {
              await fetch("/api/me/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ avatarUrl }),
              });
              setProfil((p) => (p ? { ...p, avatarUrl } : p));
              await update({ picture: avatarUrl });
              pushToast("success", "Photo mise à jour.");
            }}
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-lg font-semibold text-ink">{profil.name}</p>
              <span className="rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
                {roleLabels[profil.role]}
              </span>
              {profil.verifiedArtist && <BadgeCheck size={16} className="text-verified" aria-label="Artiste vérifié" />}
            </div>
            <p className="mt-0.5 truncate text-sm text-ink-muted">{profil.email}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs text-ink-muted">
                <Calendar size={13} /> Membre depuis le {formatDate(profil.createdAt)}
              </span>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                  profil.suspended
                    ? "bg-danger/10 text-danger"
                    : profil.emailVerified
                      ? "bg-verified/10 text-verified"
                      : "bg-warning/10 text-warning"
                }`}
              >
                {profil.suspended ? "Compte suspendu" : profil.emailVerified ? "Compte actif" : "Email non confirmé"}
              </span>
            </div>
          </div>
        </div>

        <dl className="shrink-0 space-y-2.5 text-sm lg:w-56">
          <Info icon={Clock} label="Dernière connexion" valeur={profil.lastLoginAt ? formatDate(profil.lastLoginAt) : "—"} />
          <Info
            icon={Smartphone}
            label="Appareils connectés"
            valeur={`${appareils.length} application${appareils.length > 1 ? "s" : ""} mobile${appareils.length > 1 ? "s" : ""}`}
          />
          <Info
            icon={KeyRound}
            label="Connexion"
            valeur={profil.hasGoogleAccount ? "Google" : "Email et mot de passe"}
          />
        </dl>
      </div>

      {/* ------------------------------------------------------- Profil */}
      {onglet === "profil" && (
        <form onSubmit={enregistrerIdentite} className="mt-4 space-y-4">
          <AdminCard title="Informations personnelles">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                label="Nom complet"
                value={form.name}
                required
                maxLength={80}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <div>
                <FormField
                  label="Nom d'utilisateur"
                  value={form.username}
                  minLength={3}
                  maxLength={20}
                  spellCheck={false}
                  onChange={(e) =>
                    setForm({ ...form, username: e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, "") })
                  }
                />
                <p className="mt-1 text-xs text-ink-muted">
                  Votre adresse publique : on vous mentionne par{" "}
                  <span className="font-mono text-ink">@{form.username || "…"}</span>, et votre profil est
                  visible sur{" "}
                  {profil.username ? (
                    <Link href={`/membre/${profil.username}`} className="text-accent hover:underline">
                      /membre/{profil.username}
                    </Link>
                  ) : (
                    "/membre/…"
                  )}
                  .
                </p>
              </div>
              <div>
                <FormField
                  label="Email"
                  type="email"
                  value={form.email}
                  disabled={profil.hasGoogleAccount}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
                {profil.hasGoogleAccount && (
                  <p className="mt-1 text-xs text-ink-muted">
                    Ce compte se connecte avec Google : son adresse ne peut pas être changée ici.
                  </p>
                )}
              </div>
              <div>
                <FormField
                  label="Téléphone"
                  type="tel"
                  value={form.phone}
                  placeholder="+261 34 12 345 67"
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
                <p className="mt-1 text-xs text-ink-muted">
                  Pré-rempli lors d&apos;un paiement Mobile Money. Laissez vide pour le retirer.
                </p>
              </div>
              <FormField label="Rôle" value={roleLabels[profil.role]} disabled readOnly />
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="submit"
                disabled={enregistrement}
                className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-base transition-colors hover:bg-accent-hover disabled:opacity-60"
              >
                {enregistrement ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                Enregistrer les modifications
              </button>
            </div>
          </AdminCard>

          {profil.role === "artist" && (
            <AdminCard title="Espace artiste">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-ink-muted">
                  Vos morceaux, vos albums et vos revenus. La bio, la bannière et les liens de votre profil
                  public se modifient depuis votre page artiste.
                </p>
                <div className="flex gap-2">
                  <Link
                    href="/artiste/gestion"
                    className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-accent hover:text-accent"
                  >
                    <Mic2 size={14} /> Gérer ma musique
                  </Link>
                  <Link
                    href="/artiste/revenus"
                    className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-accent hover:text-accent"
                  >
                    <Wallet size={14} /> Mes revenus
                  </Link>
                </div>
              </div>
            </AdminCard>
          )}

          {profil.role === "admin" && (
            <AdminCard title="Administration">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-ink-muted">Membres, contenus, paramètres de la plateforme.</p>
                <Link
                  href="/admin"
                  className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-accent hover:text-accent"
                >
                  <Shield size={14} /> Ouvrir l&apos;administration
                </Link>
              </div>
            </AdminCard>
          )}
        </form>
      )}

      {/* --------------------------------------------------- Abonnement */}
      {onglet === "abonnement" && (
        <div className="mt-4 space-y-4">
          <AdminCard title="Mon abonnement" description="Votre formule actuelle et son échéance.">
            {profil.role === "admin" ? (
              <p className="flex items-center gap-2 text-sm text-verified">
                <Crown size={16} /> Accès Premium illimité, inclus avec le compte administrateur.
              </p>
            ) : subscription ? (
              <div className="grid gap-4 sm:grid-cols-3">
                <Bloc label="Formule">
                  {subscription.plan === "premium_annual" ? "Premium annuel" : "Premium"}
                </Bloc>
                <Bloc label="Statut">
                  <span className={subscription.status === "active" ? "text-verified" : "text-warning"}>
                    {subscription.status === "active" ? "Actif" : subscription.status}
                  </span>
                </Bloc>
                <Bloc label="Prochaine échéance">{formatDate(subscription.currentPeriodEnd)}</Bloc>
                {typeof subscription.amount === "number" && (
                  <Bloc label="Montant">
                    {subscription.amount.toFixed(2)} {subscription.currency ?? devise.symbole}
                  </Bloc>
                )}
                {subscription.paymentMethod && (
                  <Bloc label="Moyen de paiement">
                    {subscription.paymentMethod === "stripe" ? "Carte bancaire" : "Mobile Money"}
                  </Bloc>
                )}
              </div>
            ) : (
              <p className="text-sm text-ink-muted">Aucun abonnement actif pour l&apos;instant.</p>
            )}

            {profil.role !== "admin" && (
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href="/abonnement"
                  className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-base transition-colors hover:bg-accent-hover"
                >
                  {hasPremium ? "Gérer l'abonnement" : "Passer en Premium"}
                </Link>
              </div>
            )}
          </AdminCard>

          <AdminCard
            title="Ce que Premium débloque"
            description="Les avantages liés à l'abonnement, quel que soit le mode de paiement."
          >
            <ul className="grid gap-2 text-sm text-ink-muted sm:grid-cols-2">
              {[
                "Écoute hors-ligne des morceaux téléchargés",
                "Qualité audio supérieure",
                "Personnalisation du thème et des couleurs",
                "Soutien direct aux artistes que vous écoutez",
              ].map((ligne) => (
                <li key={ligne} className="flex items-start gap-2">
                  <Check size={15} className="mt-0.5 shrink-0 text-verified" />
                  {ligne}
                </li>
              ))}
            </ul>
          </AdminCard>
        </div>
      )}

      {/* ----------------------------------------------------- Sécurité */}
      {onglet === "securite" && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <AdminCard title="Sécurité du compte">
            <div className="flex flex-col">
              <Ligne
                icon={KeyRound}
                titre="Mot de passe"
                aide={
                  profil.hasPassword
                    ? "Modifiable à tout moment depuis cet écran."
                    : "Aucun mot de passe : ce compte se connecte avec Google."
                }
                bouton={profil.hasPassword ? "Modifier" : "Définir"}
                onClick={() => setMotDePasse(true)}
              />
              <Ligne
                icon={Monitor}
                titre="Sessions ouvertes"
                aide={
                  appareils.length === 0
                    ? "Aucune application mobile connectée."
                    : `${appareils.length} application${appareils.length > 1 ? "s" : ""} mobile${appareils.length > 1 ? "s" : ""} connectée${appareils.length > 1 ? "s" : ""}.`
                }
                bouton="Tout fermer"
                onClick={() => setConfirmDeconnexionTout(true)}
              />
            </div>

            {appareils.length > 0 && (
              <ul className="mt-3 divide-y divide-border border-t border-border">
                {appareils.map((appareil) => (
                  <li key={appareil.id} className="flex items-center gap-3 py-3">
                    <Smartphone size={15} className="shrink-0 text-ink-muted" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-ink">{appareil.device}</p>
                      <p className="text-xs text-ink-muted">Connecté le {formatDate(appareil.createdAt)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => deconnecterAppareil(appareil.id)}
                      className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:border-danger hover:text-danger"
                    >
                      Déconnecter
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <p className="mt-3 text-xs text-ink-muted">
              Les sessions du site sont des jetons signés, sans état côté serveur : « Tout fermer » les refuse
              toutes, y compris celle-ci, dans les cinq minutes qui suivent.
            </p>
          </AdminCard>

          <AdminCard title="Actions du compte">
            <div className="flex flex-col">
              <Ligne
                icon={Download}
                titre="Exporter mes données"
                aide="Profil, playlists, commentaires, abonnement — en JSON."
                bouton="Exporter"
                onClick={() => {
                  window.location.href = "/api/me/export";
                }}
              />
              <Ligne
                icon={LogOut}
                titre="Se déconnecter"
                aide="Ferme la session de cet appareil uniquement."
                bouton="Déconnexion"
                onClick={async () => {
                  await oublierCompte();
                  await signOut({ redirect: false });
                  pushToast("success", "Déconnecté avec succès.");
                  router.push("/");
                  router.refresh();
                }}
              />
            </div>

            <div className="mt-4 rounded-xl border border-danger/30 bg-danger/[0.06] p-4">
              <p className="flex items-center gap-2 text-sm font-medium text-danger">
                <Trash2 size={15} /> Supprimer mon compte
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                Cette action est irréversible. {profil.role === "artist" && "Vos morceaux, albums et évènements seront supprimés avec le compte. "}
                Un abonnement par carte doit être résilié au préalable.
              </p>
              <button
                type="button"
                onClick={() => setConfirmSuppression(true)}
                className="mt-3 rounded-xl border border-danger px-4 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger/10"
              >
                Supprimer définitivement
              </button>
            </div>
          </AdminCard>
        </div>
      )}

      {/* -------------------------------------------------- Préférences */}
      {onglet === "preferences" && (
        <div className="mt-4 space-y-4">
          <AdminCard
            title="Univers musical"
            description="Général ou évangélique : ce choix décide de tout ce que vous entendez — recommandations, lecture automatique, playlists, accueil. Il s'applique immédiatement, sans passer par le bouton d'enregistrement, et suit votre compte d'un appareil à l'autre."
          >
            <UniversToggle />
          </AdminCard>

          <AdminCard
            title="Mode d'écoute"
            description="Ce que vous êtes en train de faire pendant que vous écoutez. Il oriente les recommandations, la lecture automatique et les sections de l'accueil, sans jamais franchir la frontière entre les deux univers. Laissé sur « Automatique », il suit l'heure qu'il est chez vous."
          >
            <ModeSelector />
          </AdminCard>

          <AdminCard
            title="Affichage"
            description="Ces réglages ne valent que pour votre compte. Laissés sur « Réglage du site », ils suivent ce que l'équipe a choisi."
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <Choix
                label="Langue régionale"
                value={prefs.language}
                onChange={(language) => setPrefs({ ...prefs, language })}
                options={LANGUES}
                defautLabel={LANGUES.find((l) => l.value === siteConfig.defaultLanguage)?.label}
              />
              <Choix
                label="Fuseau horaire"
                value={prefs.timezone}
                onChange={(timezone) => setPrefs({ ...prefs, timezone })}
                options={FUSEAUX}
                defautLabel={FUSEAUX.find((f) => f.value === siteConfig.timezone)?.label}
              />
              <Choix
                label="Format de date"
                value={prefs.dateFormat}
                onChange={(dateFormat) => setPrefs({ ...prefs, dateFormat })}
                options={FORMATS_DATE}
                defautLabel={FORMATS_DATE.find((f) => f.value === siteConfig.dateFormat)?.label}
              />
            </div>

            <p className="mt-3 text-xs text-ink-muted">
              La langue régionale sert à la mise en forme des dates et des nombres. L&apos;interface, elle,
              reste en français.
            </p>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={enregistrerPreferences}
                disabled={enregistrement}
                className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-base transition-colors hover:bg-accent-hover disabled:opacity-60"
              >
                {enregistrement ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                Enregistrer
              </button>
            </div>
          </AdminCard>

          <AdminCard title="Apparence">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-ink-muted">
                Thème, couleurs et mode sombre — {hasPremium || profil.role === "admin" ? "personnalisables avec Premium." : "réservés aux comptes Premium."}
              </p>
              <Link
                href="/compte/apparence"
                className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-accent hover:text-accent"
              >
                <Palette size={14} /> Personnaliser
              </Link>
            </div>
          </AdminCard>

          <AdminCard title="Devise">
            <p className="text-sm text-ink-muted">
              Les prix sont affichés en {DEVISES.find((d) => d.value === (siteConfig.currency ?? "EUR"))?.label ?? "EUR (€)"},
              tels que définis par la plateforme. Le paiement Mobile Money reste facturé en ariary.
            </p>
          </AdminCard>
        </div>
      )}

      <div className="mt-8 flex gap-4 text-xs text-ink-muted">
        <Link href="/contact" className="hover:text-ink">
          Contact
        </Link>
        <Link href="/mentions-legales" className="hover:text-ink">
          Mentions légales
        </Link>
      </div>

      {motDePasse && (
        <ChangePasswordModal
          aDejaUnMotDePasse={profil.hasPassword}
          onClose={() => setMotDePasse(false)}
          onDone={() => {
            setMotDePasse(false);
            chargerProfil();
          }}
        />
      )}

      {confirmDeconnexionTout && (
        <ConfirmDialog
          title="Fermer toutes les sessions ?"
          description="Tous les appareils connectés, y compris celui-ci, devront se reconnecter."
          confirmLabel="Tout fermer"
          busy={action}
          onConfirm={deconnecterTout}
          onCancel={() => setConfirmDeconnexionTout(false)}
        />
      )}

      {confirmSuppression && (
        <ConfirmDialog
          title="Supprimer définitivement votre compte ?"
          description={
            profil.role === "artist"
              ? "Vos morceaux, albums et évènements seront supprimés avec le compte. Cette action est irréversible."
              : "Vos playlists, commentaires et données seront supprimés. Cette action est irréversible."
          }
          confirmLabel="Supprimer mon compte"
          busy={action}
          onConfirm={supprimerCompte}
          onCancel={() => setConfirmSuppression(false)}
        />
      )}
    </div>
  );
}

function Info({ icon: Icon, label, valeur }: { icon: typeof Clock; label: string; valeur: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon size={15} className="mt-0.5 shrink-0 text-ink-muted" />
      <div className="min-w-0">
        <dt className="text-xs text-ink-muted">{label}</dt>
        <dd className="truncate text-sm text-ink">{valeur}</dd>
      </div>
    </div>
  );
}

function Bloc({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-ink">{children}</p>
    </div>
  );
}

function Ligne({
  icon: Icon,
  titre,
  aide,
  bouton,
  onClick,
}: {
  icon: typeof KeyRound;
  titre: string;
  aide: string;
  bouton: string;
  onClick: () => void;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-border py-3 last:border-0">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
        <Icon size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{titre}</p>
        <p className="truncate text-xs text-ink-muted">{aide}</p>
      </div>
      <button
        type="button"
        onClick={onClick}
        className="shrink-0 rounded-lg border border-border px-3.5 py-1.5 text-xs font-medium text-ink transition-colors hover:border-accent hover:text-accent"
      >
        {bouton}
      </button>
    </div>
  );
}

/** Un réglage à trois états : hérité du site, ou l'une des valeurs proposées. */
function Choix({
  label,
  value,
  onChange,
  options,
  defautLabel,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  defautLabel?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-ink-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-border bg-base px-4 py-2.5 text-sm text-ink outline-none focus:border-accent"
      >
        <option value="">Réglage du site{defautLabel ? ` — ${defautLabel}` : ""}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
