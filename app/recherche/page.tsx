"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BadgeCheck,
  ChevronRight,
  Compass,
  Loader2,
  Play,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  WifiOff,
  X,
} from "lucide-react";
import { SongRow } from "@/components/music/SongRow";
import { SafeImage } from "@/components/ui/SafeImage";
import { EqualizerLoader } from "@/components/ui/EqualizerLoader";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { PageSections } from "@/components/home/PageSections";
import { SearchBar } from "@/components/search/SearchBar";
import { SectionResultats, type SectionRecherche } from "@/components/search/SearchSection";
import { AiSearchFallback } from "@/components/search/AiSearchFallback";
import { TopResult } from "@/components/search/TopResult";
import { useOnlineStatus } from "@/context/OnlineStatusProvider";
import { useIADisponible } from "@/context/SiteConfigProvider";
import { usePlayer, type PlayableSong } from "@/context/PlayerProvider";
import { listOfflineSongs } from "@/lib/offlineCache";
import {
  addRecentSearch,
  clearRecentSearches,
  getRecentSearches,
  removeRecentSearch,
  type RecentSearchItem,
} from "@/lib/recentSearches";

/* ----------------------------------------------------------------- types - */

type Resultat = {
  q: string;
  type: string;
  page: number;
  limit: number;
  focus: { kind: string; id: string; title: string } | null;
  top: (Record<string, unknown> & { kind: string }) | null;
  sections: SectionRecherche[];
  counts: Record<string, number>;
  genresDisponibles: string[];
  approximatif: boolean;
};

type PopularItem =
  | { kind: "artist"; _id: string; title: string; coverUrl?: string; verified?: boolean }
  | { kind: "song"; _id: string; title: string; coverUrl?: string; verified?: boolean; artistName: string };

const FILTRES: { id: string; label: string }[] = [
  { id: "all", label: "Tout" },
  { id: "songs", label: "Titres" },
  { id: "artists", label: "Artistes" },
  { id: "albums", label: "Albums" },
  { id: "playlists", label: "Playlists" },
  { id: "events", label: "Évènements" },
  { id: "genres", label: "Genres" },
];

const TRIS: { id: string; label: string }[] = [
  { id: "relevance", label: "Pertinence" },
  { id: "popularity", label: "Popularité" },
  { id: "date", label: "Nouveautés" },
];

/** Délai après la dernière frappe avant de lancer la recherche complète. */
const DEBOUNCE_MS = 420;
const PAR_PAGE = 24;

/* ------------------------------------------------------------------ page - */

function SearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isOnline } = useOnlineStatus();
  const iaRecherche = useIADisponible("recherche");
  const { playQueue } = usePlayer();

  const [saisie, setSaisie] = useState(() => searchParams.get("q") ?? "");
  const [type, setType] = useState(() => searchParams.get("type") ?? "all");
  const [tri, setTri] = useState(() => searchParams.get("sort") ?? "relevance");
  const [genre, setGenre] = useState(() => searchParams.get("genre") ?? "");
  const [filtresOuverts, setFiltresOuverts] = useState(false);

  const [resultat, setResultat] = useState<Resultat | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Pagination cumulative de la vue « une seule catégorie ».
  const [pageSuivante, setPageSuivante] = useState(2);
  const [chargementSuite, setChargementSuite] = useState(false);
  const [supplement, setSupplement] = useState<Record<string, unknown>[]>([]);

  // Résultats hors-ligne (titres téléchargés uniquement).
  const [horsLigne, setHorsLigne] = useState<PlayableSong[]>([]);

  const [recentes, setRecentes] = useState<RecentSearchItem[]>([]);
  const [populaires, setPopulaires] = useState<PopularItem[]>([]);
  const [chargementPopulaires, setChargementPopulaires] = useState(true);

  // Numérote les requêtes : une réponse lente ne doit jamais écraser celle
  // d'une frappe plus récente.
  const numero = useRef(0);
  const terme = saisie.trim();
  /**
   * Une vraie phrase, a laquelle le site n'a presque rien repondu.
   *
   * Quatre mots significatifs : un nom d'artiste ou un titre en compte un
   * a trois, une demande formulee en compte davantage. Trois resultats ou
   * moins : au-dela, la recherche du site a manifestement compris, et une
   * seconde lecture n'apporterait que du bruit.
   */
  const motsSignificatifs = terme.split(/\s+/).filter((m) => m.length > 2).length;
  const enRecherche = terme.length >= 2;

  /* --- historique et suggestions de l'état par défaut ------------------- */

  useEffect(() => {
    function relire() {
      setRecentes(getRecentSearches());
    }
    relire();
    window.addEventListener("moziik-recent-searches-change", relire);
    return () => window.removeEventListener("moziik-recent-searches-change", relire);
  }, []);

  useEffect(() => {
    async function charger() {
      try {
        const [artistesRes, titresRes] = await Promise.all([
          fetch("/api/charts?period=month&type=artists"),
          fetch("/api/charts?period=month&type=songs"),
        ]);
        const artistes = artistesRes.ok ? (await artistesRes.json()).ranking : [];
        const titres = titresRes.ok ? (await titresRes.json()).ranking : [];

        let items: PopularItem[] = [
          ...artistes.slice(0, 3).map((a: { _id: string; stageName: string; coverUrl?: string; verified?: boolean }) => ({
            kind: "artist" as const,
            _id: a._id,
            title: a.stageName,
            coverUrl: a.coverUrl,
            verified: a.verified,
          })),
          ...titres
            .slice(0, 3)
            .map((s: { _id: string; title: string; coverUrl?: string; verified?: boolean; artistName: string }) => ({
              kind: "song" as const,
              _id: s._id,
              title: s.title,
              coverUrl: s.coverUrl,
              verified: s.verified,
              artistName: s.artistName,
            })),
        ];

        // Repli sur du contenu réel récent si pas encore assez d'écoutes
        // enregistrées pour établir un vrai classement.
        if (items.length < 4) {
          const [titresRepli, artistesRepli] = await Promise.all([
            fetch("/api/songs?limit=3").then((r) => (r.ok ? r.json() : { songs: [] })),
            fetch("/api/artists").then((r) => (r.ok ? r.json() : { artists: [] })),
          ]);
          items = [
            ...artistesRepli.artists
              .slice(0, 3)
              .map((a: { _id: string; stageName: string; coverUrl?: string; verified?: boolean }) => ({
                kind: "artist" as const,
                _id: a._id,
                title: a.stageName,
                coverUrl: a.coverUrl,
                verified: a.verified,
              })),
            ...titresRepli.songs.slice(0, 3).map((s: PlayableSong) => ({
              kind: "song" as const,
              _id: s._id,
              title: s.title,
              coverUrl: s.coverUrl,
              verified: s.artist?.verified,
              artistName: s.artist?.stageName ?? "Artiste supprimé",
            })),
          ];
        }

        setPopulaires(items);
      } catch {
        setPopulaires([]);
      } finally {
        setChargementPopulaires(false);
      }
    }
    charger();
  }, []);

  /* --- l'URL suit toujours l'état : une recherche se partage ----------- */

  useEffect(() => {
    const params = new URLSearchParams();
    if (terme) params.set("q", terme);
    if (type !== "all") params.set("type", type);
    if (tri !== "relevance") params.set("sort", tri);
    if (genre) params.set("genre", genre);
    const suffixe = params.toString();
    router.replace(suffixe ? `/recherche?${suffixe}` : "/recherche", { scroll: false });
  }, [terme, type, tri, genre, router]);

  /* --- la recherche elle-même ------------------------------------------ */

  useEffect(() => {
    if (!enRecherche) {
      setResultat(null);
      setHorsLigne([]);
      setErreur(null);
      return;
    }

    const id = ++numero.current;
    setChargement(true);
    setErreur(null);

    const minuteur = setTimeout(async () => {
      // Hors-ligne, seuls les titres téléchargés sont interrogeables : la
      // base est à l'autre bout du réseau. On le dit plutôt que d'afficher
      // « aucun résultat ».
      if (!isOnline) {
        try {
          const tout = await listOfflineSongs();
          const q = terme.toLowerCase();
          if (id !== numero.current) return;
          setHorsLigne(
            tout.filter(
              (s) => s.title.toLowerCase().includes(q) || s.artist.stageName.toLowerCase().includes(q)
            ) as unknown as PlayableSong[]
          );
          setResultat(null);
        } finally {
          if (id === numero.current) setChargement(false);
        }
        return;
      }

      try {
        const params = new URLSearchParams({ q: terme, type, sort: tri, limit: String(PAR_PAGE) });
        if (genre) params.set("genre", genre);
        const res = await fetch(`/api/search?${params.toString()}`);
        if (!res.ok) throw new Error("Recherche indisponible.");
        const data = (await res.json()) as Resultat;
        if (id !== numero.current) return;
        setResultat(data);
        setSupplement([]);
        setPageSuivante(2);
      } catch {
        if (id === numero.current) {
          setResultat(null);
          setErreur("La recherche n'a pas abouti. Réessaie dans un instant.");
        }
      } finally {
        if (id === numero.current) setChargement(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(minuteur);
  }, [terme, type, tri, genre, isOnline, enRecherche]);

  const chargerSuite = useCallback(async () => {
    if (!resultat || type === "all") return;
    setChargementSuite(true);
    try {
      const params = new URLSearchParams({
        q: terme,
        type,
        sort: tri,
        limit: String(PAR_PAGE),
        page: String(pageSuivante),
      });
      if (genre) params.set("genre", genre);
      const res = await fetch(`/api/search?${params.toString()}`);
      if (!res.ok) throw new Error();
      const data = (await res.json()) as Resultat;
      setSupplement((prev) => [...prev, ...(data.sections[0]?.items ?? [])]);
      setPageSuivante((p) => p + 1);
    } catch {
      /* silencieux : le bouton reste disponible pour réessayer */
    } finally {
      setChargementSuite(false);
    }
  }, [resultat, type, terme, tri, genre, pageSuivante]);

  /* --- lecture depuis le résultat principal ---------------------------- */

  const sectionTitres = resultat?.sections.find((s) => s.kind === "song");
  const peutEcouter = !!sectionTitres && sectionTitres.items.length > 0;

  function ecouterTop() {
    if (!sectionTitres) return;
    playQueue(sectionTitres.items as unknown as PlayableSong[], 0, {
      type: "search",
      label: `« ${terme} »`,
      // Les termes saisis : la file se prolongera sur la page suivante
      // des resultats plutot que de s'arreter au premier lot.
      query: terme,
    });
  }

  /* --- affichage -------------------------------------------------------- */

  const sectionUnique = type !== "all" ? resultat?.sections[0] : null;
  const listeComplete = sectionUnique
    ? { ...sectionUnique, items: [...sectionUnique.items, ...supplement] }
    : null;
  const resteAcharger = listeComplete ? listeComplete.total - listeComplete.items.length : 0;

  // Une vraie phrase a laquelle le site n'a presque rien repondu : les
  // deux ou trois titres remontes viennent souvent d'un mot isole et ne
  // repondent pas a la demande. Voir le calcul de `motsSignificatifs`.
  const totalTrouve = Object.values(resultat?.counts ?? {}).reduce((s, n) => s + (n as number), 0);
  const phraseMaigre = motsSignificatifs >= 4 && totalTrouve > 0 && totalTrouve <= 3;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 md:px-10 md:py-10">
      <h1 className="mb-5 font-display text-2xl text-ink">Recherche</h1>

      {!isOnline && (
        <p className="mb-4 flex items-center gap-1.5 text-xs text-accent">
          <WifiOff size={12} /> Hors-ligne — la recherche se limite à tes titres téléchargés
        </p>
      )}

      <div className="sticky top-0 z-30 -mx-4 mb-5 bg-base/95 px-4 pb-3 pt-1 backdrop-blur-sm sm:-mx-6 sm:px-6 md:static md:mx-0 md:bg-transparent md:px-0 md:backdrop-blur-none">
        <SearchBar
          valeur={saisie}
          onChange={setSaisie}
          onValider={(v) => setSaisie(v)}
          autoFocus={!searchParams.get("q")}
        />

        {enRecherche && isOnline && (
          <>
            <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
              {FILTRES.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setType(f.id)}
                  aria-pressed={type === f.id}
                  className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                    type === f.id
                      ? "border-accent bg-accent text-base"
                      : "border-border text-ink-muted hover:border-accent hover:text-accent"
                  }`}
                >
                  {f.label}
                </button>
              ))}
              <button
                onClick={() => setFiltresOuverts((v) => !v)}
                aria-pressed={filtresOuverts}
                aria-label="Filtres avancés"
                className={`ml-auto flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  filtresOuverts || genre || tri !== "relevance"
                    ? "border-accent text-accent"
                    : "border-border text-ink-muted hover:border-accent hover:text-accent"
                }`}
              >
                <SlidersHorizontal size={12} /> Filtres
              </button>
            </div>

            {filtresOuverts && (
              <div className="mt-2 flex flex-wrap items-center gap-4 rounded-xl2 border border-border bg-surface px-4 py-3">
                <label className="flex items-center gap-2 text-xs text-ink-muted">
                  Trier par
                  <select
                    value={tri}
                    onChange={(e) => setTri(e.target.value)}
                    className="rounded-lg border border-border bg-base px-2.5 py-1.5 text-xs text-ink outline-none focus:border-accent"
                  >
                    {TRIS.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex items-center gap-2 text-xs text-ink-muted">
                  Genre
                  <select
                    value={genre}
                    onChange={(e) => setGenre(e.target.value)}
                    className="rounded-lg border border-border bg-base px-2.5 py-1.5 text-xs text-ink outline-none focus:border-accent"
                  >
                    <option value="">Tous</option>
                    {(resultat?.genresDisponibles ?? []).map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </label>

                {(genre || tri !== "relevance") && (
                  <button
                    onClick={() => {
                      setGenre("");
                      setTri("relevance");
                    }}
                    className="flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                  >
                    <X size={11} /> Réinitialiser
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ------------------------------------------------------ résultats -- */}

      {enRecherche && chargement && <SkeletonRows count={6} />}

      {enRecherche && !chargement && erreur && (
        <p className="rounded-xl2 border border-border bg-surface px-4 py-6 text-center text-sm text-ink-muted">
          {erreur}
        </p>
      )}

      {/* Hors-ligne : uniquement les titres téléchargés. */}
      {enRecherche && !chargement && !isOnline && (
        <section>
          {horsLigne.length === 0 ? (
            <p className="rounded-xl2 border border-dashed border-border px-4 py-10 text-center text-sm text-ink-muted">
              Aucun titre téléchargé ne correspond à «&nbsp;{terme}&nbsp;».
            </p>
          ) : (
            <div className="space-y-1">
              {horsLigne.map((song, index) => (
                <SongRow
                  key={song._id}
                  song={song}
                  queue={horsLigne}
                  index={index}
                  source={{ type: "search", label: `« ${terme} » — hors-ligne` }}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {enRecherche && !chargement && isOnline && resultat && (
        <>
          {resultat.approximatif && (
            <p className="mb-5 flex items-start gap-2 rounded-xl2 border border-border bg-surface px-4 py-3 text-sm text-ink-muted">
              <Sparkles size={15} className="mt-0.5 shrink-0 text-accent" />
              <span>
                Aucune correspondance exacte pour «&nbsp;{terme}&nbsp;». Voici ce qui s&apos;en rapproche le plus.
              </span>
            </p>
          )}

          {resultat.sections.length === 0 ? (
            <>
              <div className="rounded-xl2 border border-dashed border-border px-4 py-12 text-center">
                <p className="mb-1 font-display text-base text-ink">Aucun résultat pour «&nbsp;{terme}&nbsp;»</p>
                <p className="text-sm text-ink-muted">
                  Vérifie l&apos;orthographe, ou essaie avec moins de mots — la recherche accepte les noms incomplets.
                </p>
              </div>
              {/* Seconde lecture de la demande, en genres et en mots-clés. */}
              {iaRecherche && <AiSearchFallback demande={terme} />}
            </>
          ) : type === "all" ? (
            <>
              {resultat.top && <TopResult top={resultat.top} onPlay={peutEcouter ? ecouterTop : undefined} />}
              {resultat.sections.map((section) => (
                <SectionResultats
                  key={section.key}
                  section={section}
                  requete={terme}
                  onVoirTout={(t) => {
                    setType(t);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                />
              ))}
              {/* Sous une réponse maigre à une vraie phrase : les deux ou
                  trois titres trouvés viennent souvent d'un mot isolé, et
                  ne répondent pas à la demande. La seconde lecture se
                  place dessous, elle ne remplace rien. */}
              {iaRecherche && phraseMaigre && <AiSearchFallback demande={terme} avecResultats />}
            </>
          ) : (
            listeComplete && (
              <>
                <SectionResultats section={listeComplete} requete={terme} />
                {resteAcharger > 0 && (
                  <div className="flex justify-center">
                    <button
                      onClick={chargerSuite}
                      disabled={chargementSuite}
                      className="flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-60"
                    >
                      {chargementSuite && <Loader2 size={14} className="animate-spin" />}
                      Charger plus ({resteAcharger} restant{resteAcharger > 1 ? "s" : ""})
                    </button>
                  </div>
                )}
              </>
            )
          )}
        </>
      )}

      {/* ------------------------------------------------ état par défaut -- */}

      {!enRecherche && (
        <>
          <section className="mb-10">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg text-ink">Dernières recherches</h2>
              {recentes.length > 0 && (
                <button
                  onClick={clearRecentSearches}
                  className="flex items-center gap-1 text-xs text-accent hover:underline"
                >
                  <Trash2 size={12} /> Effacer l&apos;historique
                </button>
              )}
            </div>

            {recentes.length === 0 ? (
              <p className="text-sm text-ink-muted">Tes recherches récentes apparaîtront ici.</p>
            ) : (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                {recentes.map((item) => (
                  <div key={item._id} className="relative rounded-xl2 border border-border bg-surface p-3">
                    <button
                      onClick={() => removeRecentSearch(item._id)}
                      aria-label="Retirer de l'historique"
                      className="absolute right-2.5 top-2.5 z-10 grid h-6 w-6 place-items-center rounded-full bg-base/80 text-ink-muted hover:text-accent"
                    >
                      <X size={12} />
                    </button>
                    {item.type === "term" ? (
                      <button
                        onClick={() => setSaisie(item.title)}
                        className="w-full text-left"
                      >
                        <span className="mb-3 grid aspect-square w-full place-items-center rounded-lg bg-accent/10 text-accent">
                          <Compass size={26} />
                        </span>
                        <span className="block truncate text-sm font-medium text-ink">{item.title}</span>
                        <span className="block truncate text-xs text-ink-muted">Recherche</span>
                      </button>
                    ) : (
                      <Link href={item.href}>
                        <SafeImage
                          src={item.coverUrl}
                          alt={item.title}
                          width={100}
                          height={100}
                          className="mb-3 aspect-square w-full rounded-lg object-cover"
                        />
                        <p className="flex items-center gap-1 truncate text-sm font-medium text-ink">
                          {item.title}
                          {item.verified && <BadgeCheck size={12} className="shrink-0 text-verified" />}
                        </p>
                        <p className="mb-1.5 truncate text-xs text-ink-muted">{item.subtitle}</p>
                        {item.type === "song" && typeof item.playsCount === "number" && (
                          <p className="flex items-center gap-1 text-[11px] text-ink-muted">
                            <Play size={10} /> {item.playsCount} écoute{item.playsCount > 1 ? "s" : ""}
                          </p>
                        )}
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="mb-10">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg text-ink">Suggestions populaires</h2>
              <Link href="/classements" className="text-xs text-accent hover:underline">
                Tout voir
              </Link>
            </div>

            {chargementPopulaires && (
              <div className="grid place-items-center py-6">
                <EqualizerLoader size="sm" />
              </div>
            )}

            {!chargementPopulaires && populaires.length === 0 && (
              <p className="text-sm text-ink-muted">Pas encore assez de contenu à suggérer.</p>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {populaires.map((item) => (
                <Link
                  key={`${item.kind}-${item._id}`}
                  href={item.kind === "artist" ? `/artiste/${item._id}` : `/son/${item._id}`}
                  onClick={() =>
                    addRecentSearch({
                      _id: item._id,
                      type: item.kind,
                      title: item.title,
                      coverUrl: item.coverUrl,
                      subtitle: item.kind === "artist" ? "Artiste" : item.artistName,
                      verified: item.verified,
                      href: item.kind === "artist" ? `/artiste/${item._id}` : `/son/${item._id}`,
                    })
                  }
                  className="flex items-center gap-3 rounded-xl2 border border-border bg-surface px-4 py-3 transition-colors hover:border-accent"
                >
                  <SafeImage
                    src={item.coverUrl}
                    alt={item.title}
                    width={44}
                    height={44}
                    className={`h-11 w-11 shrink-0 object-cover ${item.kind === "artist" ? "rounded-full" : "rounded-lg"}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1 truncate text-sm font-medium text-ink">
                      {item.title}
                      {item.verified && <BadgeCheck size={12} className="shrink-0 text-verified" />}
                    </p>
                    <p className="truncate text-xs text-ink-muted">
                      {item.kind === "artist" ? "Artiste" : `Son · ${item.artistName}`}
                    </p>
                  </div>
                  <ChevronRight size={16} className="shrink-0 text-ink-muted" />
                </Link>
              ))}
            </div>
          </section>

          {/* Sections éditoriales de l'admin. Uniquement dans l'état par
              défaut : pendant une recherche, l'écran appartient aux
              résultats. */}
          <PageSections page="discover" className="mb-10" />

          <section className="flex flex-col items-start gap-4 rounded-xl2 border border-accent/20 bg-accent/10 p-5 sm:flex-row sm:items-center sm:p-6">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
              <Compass size={22} />
            </span>
            <div className="flex-1">
              <p className="mb-1 font-display text-base text-ink">Découvrez de nouveaux sons</p>
              <p className="text-sm text-ink-muted">
                Un artiste, un titre, un album, une playlist ou même un genre — la recherche remonte aussi ce qui y est
                lié.
              </p>
            </div>
            <button
              onClick={() => router.push("/radio")}
              className="shrink-0 rounded-full bg-accent px-6 py-2.5 text-sm font-medium text-base transition-colors hover:bg-accent-hover"
            >
              Explorer
            </button>
          </section>
        </>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchPageContent />
    </Suspense>
  );
}
