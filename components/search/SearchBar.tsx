"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { BadgeCheck, Clock, Disc3, ListMusic, Loader2, Music2, Search as SearchIcon, User, X } from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import { addRecentSearch, addRecentTerm, getRecentSearches, type RecentSearchItem } from "@/lib/recentSearches";

export type Suggestion = {
  kind: "song" | "artist" | "album" | "playlist" | "genre" | "event" | "user";
  _id: string;
  title: string;
  subtitle: string;
  coverUrl?: string;
  verified?: boolean;
  href: string;
};

const ICONE = { song: Music2, artist: User, album: Disc3, playlist: ListMusic, genre: Music2, event: Music2, user: User };

/** Délai après la dernière frappe avant d'interroger le serveur. */
const DEBOUNCE_MS = 260;

/**
 * Barre de recherche avec suggestions instantanées.
 *
 * Deux chemins distincts, volontairement :
 *
 * - pendant la frappe, /api/search/suggest — quatre collections, aucune
 *   relation, quelques dizaines de millisecondes ;
 * - à la validation, /api/search — la recherche complète avec ses sections
 *   et ses relations.
 *
 * Confondre les deux rendrait chaque frappe aussi coûteuse qu'une recherche
 * validée, pour un résultat que l'utilisateur ne regarde même pas.
 */
export function SearchBar({
  valeur,
  onChange,
  onValider,
  autoFocus,
  variante = "page",
  placeholder = "Rechercher un titre, un artiste, un album, une playlist…",
}: {
  valeur: string;
  onChange: (v: string) => void;
  onValider: (v: string) => void;
  autoFocus?: boolean;
  /** « barre » = pastille arrondie de l'en-tête ; « page » = champ de la page de recherche. */
  variante?: "page" | "barre";
  placeholder?: string;
}) {
  const router = useRouter();
  const [ouvert, setOuvert] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [chargement, setChargement] = useState(false);
  const [recentes, setRecentes] = useState<RecentSearchItem[]>([]);
  const [surligne, setSurligne] = useState(-1);
  const enveloppe = useRef<HTMLDivElement>(null);
  // Numérote les requêtes : une réponse lente ne doit jamais écraser le
  // résultat d'une frappe plus récente.
  const requete = useRef(0);
  // L'en-tête et la page de recherche peuvent être montées en même temps :
  // un identifiant fixe créerait deux éléments de même id, et `aria-controls`
  // ne désignerait plus rien de fiable.
  const idListe = useId();

  useEffect(() => {
    function relire() {
      setRecentes(getRecentSearches());
    }
    relire();
    window.addEventListener("moziik-recent-searches-change", relire);
    return () => window.removeEventListener("moziik-recent-searches-change", relire);
  }, []);

  useEffect(() => {
    const terme = valeur.trim();
    if (terme.length < 2) {
      setSuggestions([]);
      setChargement(false);
      return;
    }
    const id = ++requete.current;
    setChargement(true);
    const minuteur = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(terme)}`);
        const data = res.ok ? await res.json() : { suggestions: [] };
        if (id !== requete.current) return;
        setSuggestions(data.suggestions ?? []);
      } catch {
        if (id === requete.current) setSuggestions([]);
      } finally {
        if (id === requete.current) setChargement(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(minuteur);
  }, [valeur]);

  useEffect(() => {
    function dehors(e: MouseEvent) {
      if (enveloppe.current && !enveloppe.current.contains(e.target as Node)) setOuvert(false);
    }
    document.addEventListener("mousedown", dehors);
    return () => document.removeEventListener("mousedown", dehors);
  }, []);

  const lignes = useMemo<{ cle: string; suggestion?: Suggestion; recente?: RecentSearchItem }[]>(() => {
    if (valeur.trim().length >= 2) return suggestions.map((s) => ({ cle: `${s.kind}-${s._id}`, suggestion: s }));
    return recentes.slice(0, 6).map((r) => ({ cle: r._id, recente: r }));
  }, [valeur, suggestions, recentes]);

  function valider(terme: string) {
    const propre = terme.trim();
    if (propre.length < 2) return;
    addRecentTerm(propre);
    setOuvert(false);
    onValider(propre);
  }

  function ouvrirSuggestion(s: Suggestion) {
    addRecentSearch({
      _id: s._id,
      type: (s.kind === "song" || s.kind === "artist" || s.kind === "album" || s.kind === "playlist"
        ? s.kind
        : "term") as RecentSearchItem["type"],
      title: s.title,
      coverUrl: s.coverUrl,
      subtitle: s.subtitle,
      verified: s.verified,
      href: s.href,
    });
    setOuvert(false);
    router.push(s.href);
  }

  function auClavier(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOuvert(true);
      setSurligne((i) => Math.min(lignes.length - 1, i + 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSurligne((i) => Math.max(-1, i - 1));
      return;
    }
    if (e.key === "Escape") {
      setOuvert(false);
      setSurligne(-1);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const ligne = lignes[surligne];
      if (ligne?.suggestion) ouvrirSuggestion(ligne.suggestion);
      else if (ligne?.recente) router.push(ligne.recente.href);
      else valider(valeur);
      setSurligne(-1);
    }
  }

  return (
    <div ref={enveloppe} className="relative">
      <label
        className={`flex items-center gap-2 border border-border bg-surface transition-colors focus-within:border-accent ${
          variante === "barre" ? "rounded-full px-4 py-2.5" : "rounded-xl px-4 py-3"
        }`}
      >
        <SearchIcon size={variante === "barre" ? 16 : 18} className="shrink-0 text-ink-muted" />
        <input
          value={valeur}
          onChange={(e) => {
            onChange(e.target.value);
            setOuvert(true);
            setSurligne(-1);
          }}
          onFocus={() => setOuvert(true)}
          onKeyDown={auClavier}
          placeholder={placeholder}
          aria-label="Rechercher sur Moziik"
          aria-expanded={ouvert && lignes.length > 0}
          aria-controls={idListe}
          aria-autocomplete="list"
          role="combobox"
          className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
          autoFocus={autoFocus}
        />
        {chargement && <Loader2 size={15} className="shrink-0 animate-spin text-ink-muted" />}
        {valeur && !chargement && (
          <button
            onClick={() => {
              onChange("");
              onValider("");
            }}
            aria-label="Effacer la recherche"
            className="shrink-0 text-ink-muted transition-colors hover:text-accent"
          >
            <X size={16} />
          </button>
        )}
      </label>

      <AnimatePresence>
        {ouvert && lignes.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.14 }}
            role="listbox"
            id={idListe}
            className="absolute inset-x-0 top-full z-40 mt-2 max-h-[60vh] overflow-y-auto rounded-xl2 border border-border bg-surface py-1.5 shadow-2xl"
          >
            {valeur.trim().length < 2 && (
              <p className="px-4 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                Recherches récentes
              </p>
            )}

            {lignes.map((ligne, i) => {
              const actif = i === surligne;
              if (ligne.recente) {
                const r = ligne.recente;
                return (
                  <button
                    key={ligne.cle}
                    role="option"
                    aria-selected={actif}
                    onClick={() => router.push(r.href)}
                    className={`flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-base ${
                      actif ? "bg-base" : ""
                    }`}
                  >
                    {r.type === "term" ? (
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-base text-ink-muted">
                        <Clock size={14} />
                      </span>
                    ) : (
                      <SafeImage
                        src={r.coverUrl}
                        alt=""
                        width={32}
                        height={32}
                        className={`h-8 w-8 shrink-0 object-cover ${r.type === "artist" ? "rounded-full" : "rounded-lg"}`}
                      />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink">{r.title}</span>
                      <span className="block truncate text-xs text-ink-muted">{r.subtitle}</span>
                    </span>
                  </button>
                );
              }

              const s = ligne.suggestion as Suggestion;
              const Icone = ICONE[s.kind] ?? Music2;
              return (
                <button
                  key={ligne.cle}
                  role="option"
                  aria-selected={actif}
                  onClick={() => ouvrirSuggestion(s)}
                  className={`flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-base ${
                    actif ? "bg-base" : ""
                  }`}
                >
                  <SafeImage
                    src={s.coverUrl}
                    alt=""
                    width={32}
                    height={32}
                    className={`h-8 w-8 shrink-0 object-cover ${s.kind === "artist" ? "rounded-full" : "rounded-lg"}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1 truncate text-sm text-ink">
                      <span className="truncate">{s.title}</span>
                      {s.verified && <BadgeCheck size={12} className="shrink-0 text-verified" />}
                    </span>
                    <span className="block truncate text-xs text-ink-muted">{s.subtitle}</span>
                  </span>
                  <Icone size={14} className="shrink-0 text-ink-muted" />
                </button>
              );
            })}

            {valeur.trim().length >= 2 && (
              <button
                onClick={() => valider(valeur)}
                className="mt-1 flex w-full items-center gap-3 border-t border-border px-4 py-2.5 text-left text-sm text-accent transition-colors hover:bg-base"
              >
                <SearchIcon size={14} className="shrink-0" />
                Voir tous les résultats pour «&nbsp;{valeur.trim()}&nbsp;»
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
