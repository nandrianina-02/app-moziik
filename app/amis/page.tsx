"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Blend, Eye, EyeOff, Headphones, Loader2, Play, RefreshCw, Search, Users } from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import { usePlayer, type PlayableSong } from "@/context/PlayerProvider";
import { useToast } from "@/context/ToastProvider";

type Ami = { _id: string; name: string; username?: string; avatarUrl?: string };
type Activite = { ami: Ami; titre: PlayableSong & { album?: { _id: string; title: string } }; ecouteLe: string };
type Social = { partageEcoute: boolean; abonnements: (Ami & { mutuel: boolean })[] };

/** Une écoute de moins de huit minutes est sans doute encore en cours. */
const EN_COURS_MS = 8 * 60 * 1000;

function ilYa(date: string): string {
  const ecart = Date.now() - new Date(date).getTime();
  if (ecart < EN_COURS_MS) return "En ce moment";
  const minutes = Math.round(ecart / 60000);
  if (minutes < 60) return `il y a ${minutes} min`;
  const heures = Math.round(minutes / 60);
  if (heures < 24) return `il y a ${heures} h`;
  const jours = Math.round(heures / 24);
  return jours === 1 ? "hier" : `il y a ${jours} j`;
}

/**
 * Ce que les membres suivis écoutent, et les membres suivis eux-mêmes.
 * L'activité se relit toutes les minutes tant que la page est ouverte :
 * c'est l'ordre de grandeur d'un titre, inutile d'interroger plus souvent.
 */
export default function PageAmis() {
  const { status } = useSession();
  const { playQueue } = usePlayer();
  const pushToast = useToast();
  const [activite, setActivite] = useState<Activite[] | null>(null);
  const [social, setSocial] = useState<Social | null>(null);
  const [erreur, setErreur] = useState(false);
  const [bascule, setBascule] = useState(false);

  const charger = useCallback(async () => {
    try {
      const [a, s] = await Promise.all([fetch("/api/me/activite-amis"), fetch("/api/me/social")]);
      if (!a.ok || !s.ok) throw new Error();
      setActivite(((await a.json()) as { activite: Activite[] }).activite);
      setSocial(await s.json());
      setErreur(false);
    } catch {
      setErreur(true);
    }
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    charger();
    const tic = window.setInterval(charger, 60_000);
    return () => window.clearInterval(tic);
  }, [status, charger]);

  async function basculerPartage() {
    if (!social) return;
    const partageEcoute = !social.partageEcoute;
    setBascule(true);
    try {
      const r = await fetch("/api/me/social", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partageEcoute }),
      });
      if (!r.ok) throw new Error();
      setSocial({ ...social, partageEcoute });
    } catch {
      pushToast("error", "Le réglage n'a pas été enregistré.");
    } finally {
      setBascule(false);
    }
  }

  if (status === "unauthenticated") {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 md:px-10">
        <Users size={26} className="mb-3 text-ink-muted" />
        <h1 className="font-display text-2xl font-bold">Activité des amis</h1>
        <p className="mt-1 text-sm text-ink-muted">
          <Link href="/connexion" className="font-medium text-accent hover:underline">
            Connectez-vous
          </Link>{" "}
          pour voir ce qu&apos;écoutent les membres que vous suivez.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full px-4 py-6 sm:px-6 md:px-8 md:py-8">
      <header className="animate-fade-in-up flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="font-display text-3xl font-bold md:text-4xl">Activité des amis</h1>
          <p className="mt-1 text-sm text-ink-muted">Ce que les membres que vous suivez écoutent en ce moment, ou ont écouté en dernier.</p>
        </div>
        {social && (
          <button
            onClick={basculerPartage}
            disabled={bascule}
            role="switch"
            aria-checked={social.partageEcoute}
            className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-medium text-ink-muted transition-colors hover:border-ink hover:text-ink disabled:opacity-60"
          >
            {social.partageEcoute ? <Eye size={14} /> : <EyeOff size={14} />}
            {social.partageEcoute ? "Votre activité est visible par vos abonnés" : "Votre activité est masquée"}
          </button>
        )}
      </header>

      <div className="mt-6 grid gap-10 cq-xl:grid-cols-[1fr_320px] [container-type:inline-size]">
        <section>
          {erreur && !activite ? (
            <div className="flex items-center gap-3 text-sm text-ink-muted">
              L&apos;activité n&apos;a pas pu être chargée.
              <button onClick={charger} className="flex items-center gap-1.5 font-medium text-accent hover:underline">
                <RefreshCw size={14} /> Réessayer
              </button>
            </div>
          ) : !activite ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-md bg-ink/[0.06]" />
              ))}
            </div>
          ) : activite.length === 0 ? (
            <div className="max-w-md py-6">
              <Headphones size={24} className="mb-3 text-ink-muted" />
              <p className="font-semibold">Rien à afficher pour l&apos;instant</p>
              <p className="mt-1 text-sm text-ink-muted">
                Suivez des membres depuis leur profil : leurs écoutes des deux dernières semaines apparaîtront ici, s&apos;ils les partagent.
              </p>
              <Link href="/recherche" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
                <Search size={14} /> Chercher des membres
              </Link>
            </div>
          ) : (
            <ul className="stagger divide-y divide-border">
              {activite.map(({ ami, titre, ecouteLe }) => {
                const enCours = Date.now() - new Date(ecouteLe).getTime() < EN_COURS_MS;
                return (
                  <li key={ami._id} className="group flex items-center gap-4 py-3">
                    <Link href={ami.username ? `/membre/${ami.username}` : "#"} className="relative shrink-0">
                      <SafeImage src={ami.avatarUrl} alt={ami.name} width={48} height={48} className="h-12 w-12 rounded-full object-cover" />
                      {enCours && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-base bg-accent" aria-hidden />}
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <Link href={ami.username ? `/membre/${ami.username}` : "#"} className="truncate text-sm font-semibold hover:underline">
                          {ami.name}
                        </Link>
                        <span className={`shrink-0 text-xs ${enCours ? "font-medium text-accent" : "text-ink-muted"}`}>{ilYa(ecouteLe)}</span>
                      </div>
                      <p className="truncate text-sm">
                        <Link href={`/son/${titre._id}`} className="hover:underline">
                          {titre.title}
                        </Link>
                        {titre.artist && (
                          <>
                            <span className="text-ink-muted"> · </span>
                            <Link href={`/artiste/${titre.artist._id}`} className="text-ink-muted hover:text-ink hover:underline">
                              {titre.artist.stageName}
                            </Link>
                          </>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={() => playQueue([titre], 0, { type: "song", label: `Écouté par ${ami.name}`, id: titre._id })}
                      aria-label={`Écouter ${titre.title}`}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-base opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100"
                    >
                      <Play size={15} className="ml-0.5" fill="currentColor" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside className="animate-fade-in-up">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-ink-muted">
            <Users size={14} /> Vous suivez
          </h2>
          {!social ? (
            <Loader2 size={18} className="animate-spin text-ink-muted" />
          ) : social.abonnements.length === 0 ? (
            <p className="text-sm text-ink-muted">Personne pour l&apos;instant.</p>
          ) : (
            <ul className="space-y-1">
              {social.abonnements.map((m) => (
                <li key={m._id} className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-ink/[0.06]">
                  <Link href={m.username ? `/membre/${m.username}` : "#"} className="flex min-w-0 flex-1 items-center gap-3">
                    <SafeImage src={m.avatarUrl} alt={m.name} width={36} height={36} className="h-9 w-9 shrink-0 rounded-full object-cover" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{m.name}</span>
                      <span className="block truncate text-xs text-ink-muted">{m.mutuel ? "Vous vous suivez" : `@${m.username ?? ""}`}</span>
                    </span>
                  </Link>
                  {m.mutuel && m.username && (
                    <Link
                      href={`/blend/${m.username}`}
                      title={`Blend avec ${m.name}`}
                      aria-label={`Blend avec ${m.name}`}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-ink/[0.08] hover:text-accent"
                    >
                      <Blend size={15} />
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
