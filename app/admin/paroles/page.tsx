"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AudioLines, ChevronDown, ChevronUp, Loader2, Music, Search, Type, X } from "lucide-react";
import { AdminCardsSkeleton } from "@/components/admin/AdminSkeleton";
import { LyricsStudio } from "@/components/song/LyricsStudio";
import { useToast } from "@/context/ToastProvider";
import { SafeImage } from "@/components/ui/SafeImage";

type Etat = "aucune" | "texte" | "synchro";
type Titre = {
  _id: string;
  title: string;
  coverUrl?: string;
  status: string;
  playsCount?: number;
  etat: Etat;
  artist?: { stageName?: string };
};

const ETATS: { valeur: Etat | null; libelle: string; icone: typeof Music }[] = [
  { valeur: null, libelle: "Tous", icone: Music },
  { valeur: "aucune", libelle: "Sans paroles", icone: X },
  { valeur: "texte", libelle: "Texte seul", icone: Type },
  { valeur: "synchro", libelle: "Synchronisées", icone: AudioLines },
];

const BADGE: Record<Etat, { libelle: string; classe: string; icone: typeof Music }> = {
  aucune: { libelle: "Sans paroles", classe: "border-border text-ink-muted", icone: X },
  texte: { libelle: "Texte seul", classe: "border-border text-ink", icone: Type },
  synchro: { libelle: "Synchronisées", classe: "border-accent text-accent", icone: AudioLines },
};

/**
 * Les paroles du catalogue : ce qui manque, ce qui reste à caler, et
 * l'atelier de synchronisation ouvert sur place, sans passer par la fiche
 * de modification de chaque titre. Les paroles synchronisées sont celles
 * qui défilent en rythme dans le lecteur du site et de l'application.
 */
export default function AdminParolesPage() {
  const pushToast = useToast();
  const [etat, setEtat] = useState<Etat | null>("texte");
  const [recherche, setRecherche] = useState("");
  const [page, setPage] = useState(1);
  const [titres, setTitres] = useState<Titre[] | null>(null);
  const [compteurs, setCompteurs] = useState<Record<Etat, number> | null>(null);
  const [suite, setSuite] = useState(false);
  const [ouvert, setOuvert] = useState<string | null>(null);

  const charger = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (etat) params.set("etat", etat);
      if (recherche.trim()) params.set("q", recherche.trim());
      const res = await fetch(`/api/admin/paroles?${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTitres(data.titres);
      setCompteurs(data.compteurs);
      setSuite(data.suite);
    } catch {
      pushToast("error", "Impossible de charger les paroles du catalogue.");
      setTitres([]);
    }
  }, [etat, recherche, page, pushToast]);

  useEffect(() => {
    // Une frappe sur deux ne mérite pas sa requête.
    const minuterie = setTimeout(charger, recherche ? 300 : 0);
    return () => clearTimeout(minuterie);
  }, [charger, recherche]);

  const total = compteurs ? compteurs.aucune + compteurs.texte + compteurs.synchro : null;
  const couverture = compteurs && total ? Math.round((compteurs.synchro / total) * 100) : null;

  return (
    <div className="space-y-6">
      {compteurs && total !== null && (
        <div className="animate-fade-in-up">
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-sm text-ink-muted">
              <span className="text-2xl font-semibold text-ink">{couverture ?? 0} %</span> du catalogue défile en rythme
            </p>
            <p className="text-xs text-ink-muted">{total} titres</p>
          </div>
          {/* Une seule barre segmentée : la part de chaque état, sans légende de couleur à décoder. */}
          <div className="mt-2 flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-border">
            {total > 0 && (
              <>
                <span className="bg-accent" style={{ width: `${(compteurs.synchro / total) * 100}%` }} />
                <span className="bg-ink-muted/60" style={{ width: `${(compteurs.texte / total) * 100}%` }} />
              </>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="État des paroles">
          {ETATS.map(({ valeur, libelle, icone: Icone }) => {
            const actif = etat === valeur;
            const n = valeur ? compteurs?.[valeur] : total;
            return (
              <button
                key={libelle}
                type="button"
                role="tab"
                aria-selected={actif}
                onClick={() => {
                  setEtat(valeur);
                  setPage(1);
                  setOuvert(null);
                }}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  actif ? "border-accent bg-accent/[0.08] text-accent" : "border-border text-ink-muted hover:border-accent hover:text-ink"
                }`}
              >
                <Icone size={13} />
                {libelle}
                {n !== undefined && n !== null && <span className="tabular-nums opacity-70">{n}</span>}
              </button>
            );
          })}
        </div>
        <label className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-surface px-3.5 py-2 lg:max-w-sm lg:ml-auto">
          <Search size={16} className="text-ink-muted" />
          <input
            value={recherche}
            onChange={(e) => {
              setRecherche(e.target.value);
              setPage(1);
            }}
            placeholder="Rechercher un titre…"
            className="flex-1 bg-transparent text-sm outline-none"
          />
        </label>
      </div>

      {titres === null ? (
        <AdminCardsSkeleton count={6} cols={1} />
      ) : titres.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-muted">Aucun titre dans cette catégorie.</p>
      ) : (
        <ul className="divide-y divide-border border-y border-border stagger">
          {titres.map((t) => (
            <LigneTitre
              key={t._id}
              titre={t}
              ouvert={ouvert === t._id}
              onBasculer={() => setOuvert(ouvert === t._id ? null : t._id)}
              onFerme={() => {
                setOuvert(null);
                charger();
              }}
            />
          ))}
        </ul>
      )}

      {titres && (page > 1 || suite) && (
        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-lg border border-border px-3 py-1.5 text-ink-muted transition-colors hover:border-accent hover:text-ink disabled:opacity-40"
          >
            Précédents
          </button>
          <span className="text-xs text-ink-muted">Page {page}</span>
          <button
            type="button"
            disabled={!suite}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-border px-3 py-1.5 text-ink-muted transition-colors hover:border-accent hover:text-ink disabled:opacity-40"
          >
            Suivants
          </button>
        </div>
      )}
    </div>
  );
}

function LigneTitre({
  titre,
  ouvert,
  onBasculer,
  onFerme,
}: {
  titre: Titre;
  ouvert: boolean;
  onBasculer: () => void;
  onFerme: () => void;
}) {
  const badge = BADGE[titre.etat];
  const IconeBadge = badge.icone;
  return (
    <li className="animate-fade-in-up">
      <div className="flex items-center gap-3 py-3">
        <SafeImage src={titre.coverUrl} alt="" width={44} height={44} className="h-11 w-11 shrink-0 rounded-lg object-cover" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{titre.title}</p>
          <p className="truncate text-xs text-ink-muted">
            {titre.artist?.stageName ?? "Artiste supprimé"}
            {titre.status !== "published" && " · brouillon"}
          </p>
        </div>
        <span className={`hidden items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium sm:flex ${badge.classe}`}>
          <IconeBadge size={12} />
          {badge.libelle}
        </span>
        <button
          type="button"
          onClick={onBasculer}
          aria-expanded={ouvert}
          className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:border-accent hover:text-ink"
        >
          {ouvert ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {titre.etat === "synchro" ? "Modifier" : titre.etat === "texte" ? "Caler" : "Ajouter"}
        </button>
      </div>
      {ouvert && <Atelier songId={titre._id} onFerme={onFerme} />}
    </li>
  );
}

/** L'atelier du titre ouvert : les paroles actuelles sont relues avant d'y toucher. */
function Atelier({ songId, onFerme }: { songId: string; onFerme: () => void }) {
  const pushToast = useToast();
  const [lrc, setLrc] = useState<string | null>(null);
  // La fermeture change à chaque rendu de la liste : relire les paroles à
  // chaque fois écraserait le travail en cours dans l'atelier.
  const fermer = useRef(onFerme);
  fermer.current = onFerme;

  useEffect(() => {
    let actif = true;
    fetch(`/api/songs/${songId}/lyrics`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data) => actif && setLrc(data.raw ?? ""))
      .catch(() => {
        pushToast("error", "Impossible de lire les paroles de ce titre.");
        fermer.current();
      });
    return () => {
      actif = false;
    };
  }, [songId, pushToast]);

  return (
    <div className="mb-4 rounded-xl2 border border-border bg-surface p-4 animate-fade-in-up">
      {lrc === null ? (
        <div className="flex items-center gap-2 py-6 text-sm text-ink-muted">
          <Loader2 size={16} className="animate-spin" />
          Lecture des paroles…
        </div>
      ) : (
        <>
          <LyricsStudio songId={songId} valeur={lrc} onChange={setLrc} />
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={onFerme}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:border-accent hover:text-ink"
            >
              Fermer et actualiser
            </button>
          </div>
        </>
      )}
    </div>
  );
}
