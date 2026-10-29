"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Award, BadgeCheck, CalendarDays, ListMusic, Loader2, Mic2, UserCheck, UserPlus, UserRound } from "lucide-react";
import { useSession } from "next-auth/react";
import { SafeImage } from "@/components/ui/SafeImage";
import { Skeleton } from "@/components/ui/Skeleton";
import { useFormatDate } from "@/context/SiteConfigProvider";
import { useToast } from "@/context/ToastProvider";

type ProfilPublic = {
  user: { name: string; username: string; avatarUrl?: string; role: string; createdAt: string };
  badges: { key: string; label: string; description?: string; category?: string }[];
  playlists: { _id: string; title: string; coverUrl?: string; songsCount: number }[];
  artist: {
    _id: string;
    stageName: string;
    verified: boolean;
    coverUrl?: string;
    followersCount: number;
    totalPlays: number;
  } | null;
  social: { abonnes: number; abonnements: number; estMoi: boolean; suivi: boolean; mutuel: boolean };
};

/**
 * La page qu'on atteint en cliquant sur une mention `@quelquun` ou sur un
 * résultat de recherche. Elle ne montre que ce que la personne a publié —
 * ses playlists publiques et ses badges — et renvoie vers la page artiste
 * quand il y en a une, plutôt que d'en recopier le contenu.
 */
export default function MemberProfilePage() {
  const params = useParams<{ username: string }>();
  const formatDate = useFormatDate();
  const [profil, setProfil] = useState<ProfilPublic | null>(null);
  const [introuvable, setIntrouvable] = useState(false);
  const { status } = useSession();
  const pushToast = useToast();
  const [bascule, setBascule] = useState(false);

  async function basculerSuivi() {
    if (!profil) return;
    if (status !== "authenticated") {
      pushToast("info", "Connectez-vous pour suivre ce membre.");
      return;
    }
    const suivre = !profil.social.suivi;
    setBascule(true);
    try {
      const res = await fetch(`/api/users/${params.username}/suivre`, { method: suivre ? "POST" : "DELETE" });
      if (!res.ok) throw new Error();
      const { abonnes } = (await res.json()) as { abonnes: number };
      // Ne plus suivre défait aussi le lien mutuel ; le suivre de nouveau
      // ne le rétablit qu'après relecture, d'où ce `false` prudent.
      setProfil((p) => (p ? { ...p, social: { ...p.social, suivi: suivre, abonnes, mutuel: suivre ? p.social.mutuel : false } } : p));
    } catch {
      pushToast("error", "L'action n'a pas abouti. Réessayez.");
    } finally {
      setBascule(false);
    }
  }

  useEffect(() => {
    fetch(`/api/users/${params.username}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(setProfil)
      .catch(() => setIntrouvable(true));
  }, [params.username]);

  if (introuvable) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10 text-center sm:px-6 md:px-10">
        <UserRound size={28} className="mx-auto mb-3 text-ink-muted" />
        <h1 className="text-xl font-display">Profil introuvable</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Ce nom d&apos;utilisateur n&apos;existe pas, ou le compte n&apos;est plus accessible.
        </p>
        <Link href="/recherche" className="mt-4 inline-block text-sm text-accent hover:underline">
          Retour à la recherche
        </Link>
      </div>
    );
  }

  if (!profil) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 md:px-10 md:py-10">
        <Skeleton className="h-28 w-full rounded-xl2" />
        <Skeleton className="mt-4 h-48 w-full rounded-xl2" />
      </div>
    );
  }

  const { user, badges, playlists, artist, social } = profil;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 md:px-10 md:py-10">
      <div className="flex flex-col gap-4 rounded-xl2 border border-border bg-surface p-5 sm:flex-row sm:items-center">
        <SafeImage
          src={user.avatarUrl}
          alt={user.name}
          width={88}
          height={88}
          className="h-[88px] w-[88px] shrink-0 rounded-full object-cover"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate font-display text-2xl font-bold md:text-3xl">{user.name}</h1>
            {artist?.verified && <BadgeCheck size={18} className="shrink-0 text-verified" />}
          </div>
          <p className="text-sm text-ink-muted">@{user.username}</p>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-muted">
            <CalendarDays size={13} /> Sur Moziik depuis le {formatDate(user.createdAt)}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            <span className="font-semibold text-ink">{social.abonnes}</span> abonné{social.abonnes > 1 ? "s" : ""}
            <span className="mx-1.5">·</span>
            <span className="font-semibold text-ink">{social.abonnements}</span> abonnement{social.abonnements > 1 ? "s" : ""}
          </p>
        </div>

        {!social.estMoi && (
          <button
            onClick={basculerSuivi}
            disabled={bascule}
            aria-pressed={social.suivi}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60 ${
              social.suivi ? "border border-border text-ink hover:border-ink" : "bg-ink text-base hover:bg-ink/90"
            }`}
          >
            {bascule ? <Loader2 size={15} className="animate-spin" /> : social.suivi ? <UserCheck size={15} /> : <UserPlus size={15} />}
            {social.suivi ? "Abonné" : "Suivre"}
          </button>
        )}

        {artist && (
          <Link
            href={`/artiste/${artist._id}`}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-base transition-colors hover:bg-accent-hover"
          >
            <Mic2 size={15} /> Voir la page artiste
          </Link>
        )}
      </div>

      {badges.length > 0 && (
        <section className="mt-4 rounded-xl2 border border-border bg-surface p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Award size={15} className="text-accent" /> Badges
          </h2>
          <ul className="flex flex-wrap gap-2">
            {badges.map((badge) => (
              <li
                key={badge.key}
                title={badge.description}
                className="rounded-full border border-border px-3 py-1.5 text-xs text-ink-muted"
              >
                {badge.label}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-4">
        <h2 className="mb-3 flex items-center gap-2 text-base font-display">
          <ListMusic size={16} className="text-accent" /> Playlists publiques
        </h2>
        {playlists.length === 0 ? (
          <p className="rounded-xl2 border border-dashed border-border p-8 text-center text-sm text-ink-muted">
            Cette personne n&apos;a publié aucune playlist pour l&apos;instant.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {playlists.map((playlist) => (
              <Link key={playlist._id} href={`/playlist/${playlist._id}`}>
                <SafeImage
                  src={playlist.coverUrl}
                  alt={playlist.title}
                  width={160}
                  height={160}
                  className="mb-2 aspect-square w-full rounded-xl2 object-cover"
                />
                <p className="truncate text-sm">{playlist.title}</p>
                <p className="text-xs text-ink-muted">{playlist.songsCount} titre(s)</p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
