"use client";

import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, ChevronDown, ChevronRight, Loader2, Search, Sparkles, Wand2 } from "lucide-react";
import { AdminCard, AdminHeaderActions, AdminTabs } from "@/components/admin/AdminChrome";
import { AdminCardsSkeleton, AdminStatsSkeleton } from "@/components/admin/AdminSkeleton";
import { SafeImage } from "@/components/ui/SafeImage";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/context/ToastProvider";
import { formatCompactNumber } from "@/lib/formatNumber";
import { UNIVERS_INFO, type Univers } from "@/lib/univers";

/**
 * Le classement général / évangélique du catalogue.
 *
 * L'écran est bâti autour d'une idée : **un artiste emmène ses titres**.
 * Le déplacer n'est donc pas une modification de ligne, c'est une cascade,
 * et elle est annoncée avant d'être appliquée. À l'inverse, déplacer un
 * titre seul le détache définitivement de son artiste — également dit,
 * parce que rien dans le tableau ne le laisserait deviner ensuite.
 *
 * La colonne « Titres évangéliques » sert à repérer les artistes à
 * cheval : un artiste général dont six titres sur huit sont rangés côté
 * gospel est presque toujours une erreur de classement, et c'est la seule
 * information qui la rend visible sans ouvrir chaque fiche.
 */

type Artiste = {
  _id: string;
  stageName: string;
  coverUrl: string;
  verified: boolean;
  genres: string[];
  univers: Univers;
  source: "auto" | "admin";
  motif: string;
  titres: number;
  titresChretiens: number;
};

type Titre = {
  _id: string;
  title: string;
  coverUrl: string;
  genre: string;
  status: string;
  univers: Univers;
  source: "artiste" | "auto" | "admin";
  detecte: Univers;
};

type Donnees = {
  page: number;
  total: number;
  hasMore: boolean;
  stats: { artistes: Record<Univers, number>; titres: Record<Univers, number> };
  iaDisponible: boolean;
  artistes: Artiste[];
};

type Filtre = "tous" | Univers | "admin";

const FILTRES: { value: Filtre; label: string }[] = [
  { value: "tous", label: "Tous les artistes" },
  { value: "general", label: UNIVERS_INFO.general.label },
  { value: "christian", label: UNIVERS_INFO.christian.label },
  { value: "admin", label: "Classés à la main" },
];

function parametresDe(filtre: Filtre, q: string, page: number) {
  const p = new URLSearchParams({ page: String(page) });
  if (q) p.set("q", q);
  if (filtre === "general" || filtre === "christian") p.set("univers", filtre);
  if (filtre === "admin") p.set("source", "admin");
  return p.toString();
}

function PastilleUnivers({ univers }: { univers: Univers }) {
  const chretien = univers === "christian";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${
        chretien ? "border-verified/40 text-verified" : "border-border text-ink-muted"
      }`}
    >
      {UNIVERS_INFO[univers].label}
    </span>
  );
}

export default function AdminUniversPage() {
  const pushToast = useToast();
  const [filtre, setFiltre] = useState<Filtre>("tous");
  const [recherche, setRecherche] = useState("");
  const [saisie, setSaisie] = useState("");
  const [page, setPage] = useState(1);
  const [donnees, setDonnees] = useState<Donnees | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [detection, setDetection] = useState(false);
  const [confirmation, setConfirmation] = useState<{ artiste: Artiste; vers: Univers } | null>(null);

  // Titres dépliés, par artiste. `null` = chargement en cours.
  const [titres, setTitres] = useState<Record<string, Titre[] | null>>({});
  const [deplies, setDeplies] = useState<Set<string>>(new Set());

  const charger = useCallback(() => {
    setEnCours(true);
    fetch(`/api/admin/univers?${parametresDe(filtre, recherche, page)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Chargement impossible."))))
      .then((data: Donnees) => setDonnees(data))
      .catch(() => pushToast("error", "Impossible de charger le classement."))
      .finally(() => setEnCours(false));
  }, [filtre, recherche, page, pushToast]);

  useEffect(charger, [charger]);

  // La saisie ne relance pas une requête à chaque frappe : 350 ms de
  // pause suffisent à distinguer « je tape » de « j'attends ».
  useEffect(() => {
    const minuteur = setTimeout(() => {
      setRecherche(saisie.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(minuteur);
  }, [saisie]);

  function basculer(artiste: Artiste) {
    const id = artiste._id;
    setDeplies((prev) => {
      const suivant = new Set(prev);
      if (suivant.has(id)) suivant.delete(id);
      else suivant.add(id);
      return suivant;
    });
    if (titres[id] !== undefined) return;

    setTitres((prev) => ({ ...prev, [id]: null }));
    fetch(`/api/admin/univers?artist=${id}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((data: { titres: Titre[] }) => setTitres((prev) => ({ ...prev, [id]: data.titres })))
      .catch(() => {
        setTitres((prev) => ({ ...prev, [id]: [] }));
        pushToast("error", "Impossible de lire les titres de cet artiste.");
      });
  }

  async function deplacer(type: "artist" | "song", id: string, univers: Univers) {
    const res = await fetch("/api/admin/univers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, id, univers }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      pushToast("error", data?.error ?? "Déplacement impossible.");
      return;
    }
    pushToast("success", data.message);
    // Les titres dépliés viennent peut-être de changer d'univers en
    // cascade : on les oublie plutôt que d'afficher un état périmé.
    setTitres({});
    setDeplies(new Set());
    charger();
  }

  async function lancerDetection(avecIA: boolean) {
    setDetection(true);
    try {
      const res = await fetch("/api/admin/univers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avecIA }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Détection impossible.");
      pushToast("success", data.message);
      setTitres({});
      setDeplies(new Set());
      charger();
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "Détection impossible.");
    } finally {
      setDetection(false);
    }
  }

  const stats = donnees?.stats;

  return (
    <div className="space-y-6">
      <AdminHeaderActions>
        <button
          type="button"
          onClick={() => lancerDetection(false)}
          disabled={detection}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface-2 disabled:opacity-60"
        >
          {detection ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
          Détecter
        </button>
        {donnees?.iaDisponible && (
          <button
            type="button"
            onClick={() => lancerDetection(true)}
            disabled={detection}
            className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-2 text-sm font-medium text-base transition-colors hover:bg-accent-hover disabled:opacity-60"
          >
            <Sparkles size={14} />
            Détecter avec l&apos;IA
          </button>
        )}
      </AdminHeaderActions>

      {!stats ? (
        <AdminStatsSkeleton count={4} />
      ) : (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {(["general", "christian"] as Univers[]).map((u) => (
            <div key={`a-${u}`} className="rounded-xl2 border border-border bg-surface p-4">
              <p className="text-xs text-ink-muted">Artistes · {UNIVERS_INFO[u].label}</p>
              <p className="mt-1 text-2xl font-display text-ink">{formatCompactNumber(stats.artistes[u])}</p>
            </div>
          ))}
          {(["general", "christian"] as Univers[]).map((u) => (
            <div key={`t-${u}`} className="rounded-xl2 border border-border bg-surface p-4">
              <p className="text-xs text-ink-muted">Titres publiés · {UNIVERS_INFO[u].label}</p>
              <p className="mt-1 text-2xl font-display text-ink">{formatCompactNumber(stats.titres[u])}</p>
            </div>
          ))}
        </div>
      )}

      <AdminCard
        title="Comment le classement se décide"
        description={
          <>
            Un artiste emmène tous ses titres et tous ses albums dans son univers. Un titre déplacé seul, en
            revanche, se détache définitivement de son artiste : plus aucune détection ni cascade ne le reprend.
            La détection s&apos;appuie d&apos;abord sur un lexique — genre déclaré, titre, paroles, biographie —
            et ne dérange le modèle que pour les cas qu&apos;elle ne tranche pas seule.
          </>
        }
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              value={saisie}
              onChange={(e) => setSaisie(e.target.value)}
              placeholder="Chercher un artiste…"
              className="w-full rounded-full border border-border bg-base py-2 pl-9 pr-3 text-sm text-ink outline-none focus:border-accent"
            />
          </div>
        </div>
        <div className="mt-4">
          <AdminTabs
            tabs={FILTRES}
            value={filtre}
            onChange={(v) => {
              setFiltre(v);
              setPage(1);
            }}
          />
        </div>
      </AdminCard>

      {!donnees ? (
        <AdminCardsSkeleton count={6} cols={1} />
      ) : donnees.artistes.length === 0 ? (
        <AdminCard>
          <p className="py-8 text-center text-sm text-ink-muted">Aucun artiste ne correspond à ce filtre.</p>
        </AdminCard>
      ) : (
        <div className="space-y-2">
          {donnees.artistes.map((artiste) => {
            const ouvert = deplies.has(artiste._id);
            const liste = titres[artiste._id];
            const aCheval =
              artiste.titres > 0 &&
              artiste.titresChretiens > 0 &&
              artiste.titresChretiens < artiste.titres;

            return (
              <div key={artiste._id} className="rounded-xl2 border border-border bg-surface">
                <div className="flex flex-wrap items-center gap-3 p-3">
                  <button
                    type="button"
                    onClick={() => basculer(artiste)}
                    aria-expanded={ouvert}
                    className="shrink-0 rounded-full p-1 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
                  >
                    {ouvert ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>

                  <SafeImage
                    src={artiste.coverUrl}
                    alt={artiste.stageName}
                    width={40}
                    height={40}
                    className="h-10 w-10 shrink-0 rounded-full object-cover"
                  />

                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-sm font-medium text-ink">
                      {artiste.stageName}
                      {artiste.verified && <BadgeCheck size={13} className="shrink-0 text-verified" />}
                    </p>
                    <p className="truncate text-xs text-ink-muted">
                      {artiste.titres} titre{artiste.titres > 1 ? "s" : ""}
                      {aCheval && ` · ${artiste.titresChretiens} rangé(s) côté ${UNIVERS_INFO.christian.label.toLowerCase()}`}
                      {artiste.source === "admin" ? " · classé à la main" : artiste.motif ? ` · ${artiste.motif}` : ""}
                    </p>
                  </div>

                  <PastilleUnivers univers={artiste.univers} />

                  <button
                    type="button"
                    onClick={() =>
                      setConfirmation({
                        artiste,
                        vers: artiste.univers === "christian" ? "general" : "christian",
                      })
                    }
                    className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-surface-2"
                  >
                    Déplacer vers{" "}
                    {UNIVERS_INFO[artiste.univers === "christian" ? "general" : "christian"].label}
                  </button>
                </div>

                {ouvert && (
                  <div className="border-t border-border px-3 py-2">
                    {liste === null ? (
                      <p className="py-3 text-center text-xs text-ink-muted">Lecture des titres…</p>
                    ) : liste.length === 0 ? (
                      <p className="py-3 text-center text-xs text-ink-muted">Cet artiste n&apos;a aucun titre.</p>
                    ) : (
                      <ul className="divide-y divide-border">
                        {liste.map((titre) => (
                          <li key={titre._id} className="flex flex-wrap items-center gap-3 py-2">
                            <SafeImage
                              src={titre.coverUrl}
                              alt={titre.title}
                              width={32}
                              height={32}
                              className="h-8 w-8 shrink-0 rounded object-cover"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm text-ink">{titre.title}</p>
                              <p className="truncate text-xs text-ink-muted">
                                {titre.genre || "Genre non précisé"}
                                {titre.source === "admin"
                                  ? " · déplacé à la main"
                                  : titre.source === "auto"
                                    ? " · reconnu seul"
                                    : " · suit son artiste"}
                                {titre.detecte !== titre.univers &&
                                  ` · le lexique dirait « ${UNIVERS_INFO[titre.detecte].label} »`}
                              </p>
                            </div>
                            <PastilleUnivers univers={titre.univers} />
                            <button
                              type="button"
                              onClick={() =>
                                deplacer("song", titre._id, titre.univers === "christian" ? "general" : "christian")
                              }
                              className="shrink-0 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-ink transition-colors hover:bg-surface-2"
                            >
                              Déplacer
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {donnees && (donnees.page > 1 || donnees.hasMore) && (
        <div className="flex items-center justify-between">
          <button
            type="button"
            disabled={donnees.page <= 1 || enCours}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-full border border-border px-4 py-2 text-sm text-ink transition-colors hover:bg-surface-2 disabled:opacity-40"
          >
            Précédent
          </button>
          <span className="text-xs text-ink-muted">
            {donnees.total} artiste{donnees.total > 1 ? "s" : ""}
          </span>
          <button
            type="button"
            disabled={!donnees.hasMore || enCours}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-full border border-border px-4 py-2 text-sm text-ink transition-colors hover:bg-surface-2 disabled:opacity-40"
          >
            Suivant
          </button>
        </div>
      )}

      {confirmation && (
        <ConfirmDialog
          title={`Déplacer ${confirmation.artiste.stageName} ?`}
          description={`${confirmation.artiste.titres} titre(s) et tous les albums de cet artiste passeront dans l'univers ${UNIVERS_INFO[
            confirmation.vers
          ].label.toLowerCase()}. Les titres déjà déplacés à la main resteront où ils sont.`}
          confirmLabel="Déplacer"
          danger={false}
          onCancel={() => setConfirmation(null)}
          onConfirm={() => {
            void deplacer("artist", confirmation.artiste._id, confirmation.vers);
            setConfirmation(null);
          }}
        />
      )}
    </div>
  );
}
