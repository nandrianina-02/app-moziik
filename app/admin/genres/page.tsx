"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader2, Pause, Play, Sparkles, Tags, X } from "lucide-react";
import { AdminCardsSkeleton } from "@/components/admin/AdminSkeleton";
import { SafeImage } from "@/components/ui/SafeImage";
import { useToast } from "@/context/ToastProvider";

type Vue = "propositions" | "a-classer" | "genre";
type Titre = {
  _id: string;
  title: string;
  coverUrl?: string;
  genre?: string;
  genrePropose?: string;
  genreConfiance?: number;
  genreSource?: "artiste" | "balise" | "audio";
  artist?: { stageName?: string };
};

const SOURCES: Record<NonNullable<Titre["genreSource"]>, string> = {
  artiste: "genre de l'artiste",
  balise: "balise du fichier",
  audio: "empreinte sonore",
};

/** Au-dessus, une proposition se valide en lot sans réécoute. */
const SEUIL_SUR = 0.8;

/**
 * Les genres à valider : ce que l'analyse propose, ce qui reste sans genre,
 * et la revue d'un genre entier. Chaque ligne se réécoute sur place ; une
 * proposition s'accepte d'un clic, ou se corrige dans la liste des genres
 * du site. Rien n'est appliqué sans passer par ici.
 */
export default function AdminGenresPage() {
  const pushToast = useToast();
  const [vue, setVue] = useState<Vue>("propositions");
  const [genreRevu, setGenreRevu] = useState("");
  const [page, setPage] = useState(1);
  const [titres, setTitres] = useState<Titre[] | null>(null);
  const [genres, setGenres] = useState<string[]>([]);
  const [compteurs, setCompteurs] = useState({ propositions: 0, aClasser: 0 });
  const [suite, setSuite] = useState(false);
  const [choisis, setChoisis] = useState<Set<string>>(new Set());
  const [enCours, setEnCours] = useState(false);
  const [ecoute, setEcoute] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  const charger = useCallback(async () => {
    try {
      const params = new URLSearchParams({ vue, page: String(page) });
      if (vue === "genre") params.set("g", genreRevu);
      const res = await fetch(`/api/admin/genres?${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTitres(data.titres);
      setGenres(data.genres);
      setCompteurs(data.compteurs);
      setSuite(data.suite);
      setChoisis(new Set());
    } catch {
      pushToast("error", "Impossible de charger les genres.");
      setTitres([]);
    }
  }, [vue, page, genreRevu, pushToast]);

  useEffect(() => {
    charger();
  }, [charger]);

  // Un seul extrait à la fois, arrêté en quittant la page.
  useEffect(() => () => audio.current?.pause(), []);

  function ecouter(id: string) {
    if (ecoute === id) {
      audio.current?.pause();
      setEcoute(null);
      return;
    }
    audio.current?.pause();
    const a = new Audio(`/api/stream/${id}?q=low`);
    // Le cœur du morceau plutôt que l'introduction : c'est là que le genre s'entend.
    a.addEventListener("loadedmetadata", () => {
      if (Number.isFinite(a.duration)) a.currentTime = a.duration * 0.35;
    });
    a.addEventListener("ended", () => setEcoute(null));
    a.play().catch(() => pushToast("error", "Lecture impossible."));
    audio.current = a;
    setEcoute(id);
  }

  async function envoyer(corps: Record<string, unknown>, message: string) {
    setEnCours(true);
    try {
      const res = await fetch("/api/admin/genres", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corps),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Échec.");
      const { modifies } = await res.json();
      pushToast("success", `${modifies} ${message}`);
      await charger();
    } catch (e) {
      pushToast("error", e instanceof Error ? e.message : "Échec.");
    } finally {
      setEnCours(false);
    }
  }

  const surs = (titres ?? []).filter((t) => (t.genreConfiance ?? 0) >= SEUIL_SUR).map((t) => t._id);
  const basculer = (id: string) =>
    setChoisis((avant) => {
      const apres = new Set(avant);
      if (apres.has(id)) apres.delete(id);
      else apres.add(id);
      return apres;
    });

  const onglets: { valeur: Vue; libelle: string; n?: number }[] = [
    { valeur: "propositions", libelle: "Propositions", n: compteurs.propositions },
    { valeur: "a-classer", libelle: "Sans genre", n: compteurs.aClasser },
    { valeur: "genre", libelle: "Revoir un genre" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Vue">
        {onglets.map(({ valeur, libelle, n }) => (
          <button
            key={valeur}
            type="button"
            role="tab"
            aria-selected={vue === valeur}
            onClick={() => {
              setVue(valeur);
              setPage(1);
            }}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              vue === valeur ? "border-accent bg-accent/[0.08] text-accent" : "border-border text-ink-muted hover:border-accent hover:text-ink"
            }`}
          >
            {libelle}
            {n !== undefined && <span className="ml-1.5 tabular-nums opacity-70">{n}</span>}
          </button>
        ))}
        {vue === "genre" && (
          <select
            value={genreRevu}
            onChange={(e) => {
              setGenreRevu(e.target.value);
              setPage(1);
            }}
            className="ml-2 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-ink"
          >
            <option value="">Choisir un genre…</option>
            {genres.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Les actions en lot : sur les propositions sûres, ou sur la sélection. */}
      <div className="flex flex-wrap items-center gap-2 animate-fade-in-up">
        {vue === "propositions" && surs.length > 0 && (
          <button
            type="button"
            disabled={enCours}
            onClick={() => envoyer({ ids: surs, accepter: true }, "genres appliqués.")}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-base disabled:opacity-60"
          >
            <Sparkles size={13} />
            Accepter les {surs.length} propositions sûres (80 % et plus)
          </button>
        )}
        {choisis.size > 0 && (
          <>
            <span className="text-xs text-ink-muted">{choisis.size} sélectionné{choisis.size > 1 ? "s" : ""} :</span>
            <select
              defaultValue=""
              disabled={enCours}
              onChange={(e) => {
                if (e.target.value) envoyer({ ids: [...choisis], genre: e.target.value }, "titres classés.");
                e.target.value = "";
              }}
              className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-ink"
            >
              <option value="">Classer en…</option>
              {genres.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </>
        )}
        {enCours && <Loader2 size={15} className="animate-spin text-ink-muted" />}
      </div>

      {titres === null ? (
        <AdminCardsSkeleton count={6} cols={1} />
      ) : titres.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-muted">
          {vue === "genre" && !genreRevu ? "Choisissez un genre à revoir." : "Rien à traiter ici."}
        </p>
      ) : (
        <ul className="divide-y divide-border border-y border-border stagger">
          {titres.map((t) => {
            const confiance = Math.round((t.genreConfiance ?? 0) * 100);
            return (
              <li key={t._id} className="flex items-center gap-3 py-2.5 animate-fade-in-up">
                <input
                  type="checkbox"
                  checked={choisis.has(t._id)}
                  onChange={() => basculer(t._id)}
                  aria-label={`Sélectionner ${t.title}`}
                  className="h-4 w-4 accent-[rgb(var(--color-accent))]"
                />
                <button
                  type="button"
                  onClick={() => ecouter(t._id)}
                  aria-label={ecoute === t._id ? "Arrêter l'extrait" : "Écouter un extrait"}
                  className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg"
                >
                  <SafeImage src={t.coverUrl} alt="" width={44} height={44} className="h-11 w-11 object-cover" />
                  <span className="absolute inset-0 grid place-items-center bg-black/40 text-white">
                    {ecoute === t._id ? <Pause size={15} /> : <Play size={15} />}
                  </span>
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{t.title}</p>
                  <p className="truncate text-xs text-ink-muted">
                    {t.artist?.stageName ?? "Artiste supprimé"} · actuel : {t.genre || "aucun"}
                  </p>
                </div>
                {t.genrePropose && (
                  <span
                    className="hidden items-center gap-1 rounded-md border border-border px-2 py-0.5 text-[11px] text-ink sm:flex"
                    title={t.genreSource ? `Proposé d'après le ${SOURCES[t.genreSource]}` : undefined}
                  >
                    <Tags size={12} className="text-accent" />
                    {t.genrePropose}
                    <span className="tabular-nums text-ink-muted">{confiance} %</span>
                  </span>
                )}
                {t.genrePropose && (
                  <>
                    <button
                      type="button"
                      disabled={enCours}
                      onClick={() => envoyer({ ids: [t._id], accepter: true }, "genre appliqué.")}
                      title={`Accepter « ${t.genrePropose} »`}
                      aria-label={`Accepter « ${t.genrePropose} »`}
                      className="grid h-8 w-8 place-items-center rounded-lg border border-border text-accent transition-colors hover:border-accent"
                    >
                      <Check size={15} />
                    </button>
                    <button
                      type="button"
                      disabled={enCours}
                      onClick={() => envoyer({ ids: [t._id], rejeter: true }, "proposition écartée.")}
                      title="Écarter la proposition"
                      aria-label="Écarter la proposition"
                      className="grid h-8 w-8 place-items-center rounded-lg border border-border text-ink-muted transition-colors hover:border-accent hover:text-ink"
                    >
                      <X size={15} />
                    </button>
                  </>
                )}
                <select
                  value=""
                  disabled={enCours}
                  onChange={(e) => e.target.value && envoyer({ ids: [t._id], genre: e.target.value }, "titre classé.")}
                  aria-label={`Classer ${t.title}`}
                  className="w-28 rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-ink"
                >
                  <option value="">Classer…</option>
                  {genres.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </li>
            );
          })}
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
