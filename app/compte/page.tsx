"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { oublierCompte } from "@/lib/offlineApi";
import { LogOut, Wallet, Shield, Mic2, Crown, ChevronRight, Pencil, Share2 } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { SafeImage } from "@/components/ui/SafeImage";
import { ShareModal } from "@/components/share/ShareModal";
import { buildArtistSubject } from "@/components/share/shareSubject";
import { useToast } from "@/context/ToastProvider";
import { EditProfileModal, type EditableProfile } from "@/components/account/EditProfileModal";

type MyArtistProfile = {
  _id: string;
  stageName: string;
  verified?: boolean;
  coverUrl?: string;
  followersCount?: number;
};

type Subscription = { plan: string; status: string; currentPeriodEnd: string } | null;

const roleLabels: Record<string, string> = { member: "Membre", artist: "Artiste", admin: "Admin" };

export default function AccountPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pushToast = useToast();
  const [subscription, setSubscription] = useState<Subscription>(null);
  const [hasPremium, setHasPremium] = useState(false);
  const [loading, setLoading] = useState(true);
  const [myArtist, setMyArtist] = useState<MyArtistProfile | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [profile, setProfile] = useState<EditableProfile | null>(null);
  const [showEditProfile, setShowEditProfile] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/me/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (data) =>
          data?.user &&
          setProfile({
            name: data.user.name,
            email: data.user.email,
            avatarUrl: data.user.avatarUrl,
            hasGoogleAccount: data.user.hasGoogleAccount,
          }),
      )
      .catch(() => {});
  }, [status]);

  useEffect(() => {
    if (status !== "authenticated" || session?.user?.role !== "artist") return;
    fetch("/api/artist/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data?.artist && setMyArtist(data.artist))
      .catch(() => {});
  }, [status, session]);

  useEffect(() => {
    if (status !== "authenticated") {
      setLoading(false);
      return;
    }
    fetch("/api/me/subscription")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setSubscription(data.subscription);
          setHasPremium(data.hasPremium);
        }
      })
      .finally(() => setLoading(false));
  }, [status]);

  if (status === "loading" || loading) {
    return (
      <div aria-busy="true" className="mx-auto w-full max-w-3xl space-y-4 px-6 py-8 md:px-10 md:py-10">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-32 w-full rounded-xl2" />
        <Skeleton className="h-64 w-full rounded-xl2" />
        <Skeleton className="h-48 w-full rounded-xl2" />
      </div>
    );
  }

  if (status === "unauthenticated" || !session?.user) {
    return (
      <div className="mx-auto w-full max-w-[1600px] px-6 py-8 md:px-10 md:py-10">
        <p className="text-sm text-ink-muted">
          <Link href="/connexion" className="text-accent hover:underline">Connecte-toi</Link> pour accéder à ton compte.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8 md:px-10 md:py-10">
      {/* Fil d'Ariane */}
      <nav className="mb-6 flex items-center gap-1.5 text-sm text-ink-muted">
        <Link href="/" className="hover:text-ink">Accueil</Link>
        <ChevronRight size={14} />
        <span className="text-ink">Compte</span>
      </nav>

      <h1 className="mb-8 text-2xl font-display font-bold md:text-3xl">Mon compte</h1>

      {/* Profil */}
      <div className="mb-6 rounded-xl2 border border-border bg-surface p-6">
        <p className="mb-4 text-base font-semibold text-ink">Profil</p>
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* `min-w-0` sur le conteneur ET sur le bloc texte : sans lui, un
              enfant flex garde la largeur de son contenu comme minimum, et
              une adresse e-mail longue (aucune césure possible) poussait la
              page à 365 px de large sur un écran de 320. */}
          <div className="flex min-w-0 items-center gap-4">
            <SafeImage
              src={profile?.avatarUrl ?? session.user.image}
              alt={profile?.name ?? session.user.name ?? "Profil"}
              width={64}
              height={64}
              className="h-16 w-16 shrink-0 rounded-full object-cover"
            />
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-ink">{profile?.name ?? session.user.name}</p>
              <p className="truncate text-sm text-ink-muted" title={profile?.email ?? session.user.email ?? undefined}>
                {profile?.email ?? session.user.email}
              </p>
              <span className="mt-2 inline-block rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                {roleLabels[session.user.role ?? "member"]}
              </span>
            </div>
          </div>
          <button
            onClick={() => setShowEditProfile(true)}
            disabled={!profile}
            className="flex shrink-0 items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-ink-muted disabled:opacity-60"
          >
            <Pencil size={14} /> Modifier le profil
          </button>
        </div>
      </div>

      {/* Abonnement */}
      <div className="mb-6 rounded-xl2 border border-border bg-surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="mb-2 flex items-center gap-2 text-base font-semibold text-ink">
              <Wallet size={18} className="text-accent" /> Abonnement
            </p>
            {session.user.role === "admin" ? (
              <p className="flex items-center gap-1.5 text-sm text-verified">
                <Crown size={14} /> Accès Premium illimité (compte admin)
              </p>
            ) : subscription ? (
              <p className="text-sm text-ink-muted">
                Plan {subscription.plan === "premium_annual" ? "Premium annuel" : "Premium"} — statut : {subscription.status}
                <br />
                Renouvellement : {new Date(subscription.currentPeriodEnd).toLocaleDateString("fr-FR")}
              </p>
            ) : (
              <p className="text-sm text-ink-muted">Tu n&apos;as pas encore d&apos;abonnement actif.</p>
            )}
          </div>
          {session.user.role !== "admin" && (
            <Link
              href="/abonnement"
              className="shrink-0 rounded-xl border border-accent px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/10"
            >
              {hasPremium ? "Gérer l'abonnement" : "Passer en Premium"}
            </Link>
          )}
        </div>
      </div>

      {/* Espace artiste / revenus / administration */}
      {session.user.role === "artist" && (
        <div className="mb-6 rounded-xl2 border border-border bg-surface p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="flex items-center gap-2 text-base font-semibold text-ink">
              <Mic2 size={18} className="text-ink-muted" /> Mon espace artiste
            </p>
            <div className="flex shrink-0 items-center gap-2">
              {myArtist && (
                <button
                  onClick={() => setShowShareModal(true)}
                  className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-medium text-ink-muted transition-colors hover:border-accent hover:text-accent"
                >
                  <Share2 size={14} /> Partager mon profil
                </button>
              )}
              <Link
                href="/artiste/gestion"
                className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-ink-muted"
              >
                Ouvrir
              </Link>
            </div>
          </div>
        </div>
      )}

      {session.user.role === "artist" && (
        <div className="mb-6 rounded-xl2 border border-border bg-surface p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="flex items-center gap-2 text-base font-semibold text-ink">
              <Wallet size={18} className="text-ink-muted" /> Mes revenus d&apos;artiste
            </p>
            <Link
              href="/artiste/revenus"
              className="shrink-0 rounded-xl border border-border px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-ink-muted"
            >
              Ouvrir
            </Link>
          </div>
        </div>
      )}

      {session.user.role === "admin" && (
        <div className="mb-6 rounded-xl2 border border-border bg-surface p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="mb-1 flex items-center gap-2 text-base font-semibold text-ink">
                <Shield size={18} /> Administration
              </p>
              <p className="text-sm text-ink-muted">
                Accès à l&apos;espace d&apos;administration pour gérer les utilisateurs, contenus et paramètres.
              </p>
            </div>
            <Link
              href="/admin"
              className="shrink-0 rounded-xl border border-ink px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-base"
            >
              Ouvrir l&apos;administration
            </Link>
          </div>
        </div>
      )}

      {/* Déconnexion */}
      <button
        onClick={async () => {
          // redirect:false + navigation manuelle (au lieu du comportement
          // par défaut de signOut, qui recharge la page en dur) : sinon le
          // toast de confirmation n'a jamais le temps de s'afficher, la
          // page étant déchargée avant son rendu.
          await oublierCompte();
          await signOut({ redirect: false });
          pushToast("success", "Déconnecté avec succès.");
          router.push("/");
          router.refresh();
        }}
        className="mb-8 flex w-full items-center justify-center gap-2 rounded-xl2 border border-accent/30 bg-accent/5 px-4 py-4 text-sm font-medium text-accent transition-colors hover:bg-accent/10"
      >
        <LogOut size={16} /> Se déconnecter
      </button>

      <div className="flex gap-4 text-xs text-ink-muted">
        <Link href="/contact" className="hover:text-ink">Contact</Link>
        <Link href="/mentions-legales" className="hover:text-ink">Mentions légales</Link>
      </div>

      {showShareModal && myArtist && (
        <ShareModal subject={buildArtistSubject(myArtist, true)} onClose={() => setShowShareModal(false)} />
      )}

      {showEditProfile && profile && (
        <EditProfileModal
          profile={profile}
          isArtist={session.user.role === "artist"}
          artistId={myArtist?._id}
          onClose={() => setShowEditProfile(false)}
          onUpdated={setProfile}
        />
      )}
    </div>
  );
}