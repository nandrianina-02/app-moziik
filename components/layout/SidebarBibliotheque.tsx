"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowDownAZ, Check, Clock3, ListMusic, Loader2, Pin, Plus, Search, X } from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import { Tooltip } from "@/components/layout/Tooltip";
import { useToast } from "@/context/ToastProvider";
import { readApiError } from "@/lib/readApiError";

/**
 * « Ma bibliothèque » dans la barre latérale, comme sur Spotify : les
 * playlists du compte, ses albums enregistrés et ses artistes suivis,
 * toujours à portée de main. Des puces filtrent par sorte, un champ
 * cherche dans la liste, un bouton trie (récents ou A à Z), et une
 * épingle garde ses favoris en tête (l'épinglage est propre à l'appareil).
 *
 * Repliée, la barre ne montre que les pochettes, avec leur nom au survol.
 * Rien n'est affiché à un visiteur : il n'a pas de bibliothèque.
 */

type Sorte = "playlist" | "album" | "artiste";
type Element = { id: string; sorte: Sorte; titre: string; sousTitre: string; image?: string; lien: string; rang: number };

const LIBELLES: Record<Sorte, string> = { playlist: "Playlists", album: "Albums", artiste: "Artistes" };
const EPINGLES_KEY = "moziik:bibliotheque-epingles";
const TRI_KEY = "moziik:bibliotheque-tri";

function lireEpingles(): string[] {
  try {
    return JSON.parse(localStorage.getItem(EPINGLES_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function SidebarBibliotheque({ collapsed }: { collapsed: boolean }) {
  const { status } = useSession();
  const pathname = usePathname();
  const pushToast = useToast();

  const [elements, setElements] = useState<Element[] | null>(null);
  const [sorte, setSorte] = useState<Sorte | null>(null);
  const [tri, setTri] = useState<"recents" | "az">("recents");
  const [recherche, setRecherche] = useState<string | null>(null);
  const [epingles, setEpingles] = useState<string[]>([]);
  const [creation, setCreation] = useState(false);
  const [titre, setTitre] = useState("");
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    setEpingles(lireEpingles());
    try {
      if (localStorage.getItem(TRI_KEY) === "az") setTri("az");
    } catch {
      // Stockage indisponible (navigation privée) : on garde le tri par défaut.
    }
  }, []);

  const charger = useCallback(async () => {
    const lire = (url: string) => fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    const [p, a, s] = await Promise.all([lire("/api/playlists?owner=me"), lire("/api/me/saved-albums"), lire("/api/me/followed-artists")]);
    const liste: Element[] = [];
    let rang = 0;
    for (const pl of (p?.playlists ?? []) as { _id: string; title: string; coverUrl?: string }[]) {
      liste.push({ id: pl._id, sorte: "playlist", titre: pl.title, sousTitre: "Playlist", image: pl.coverUrl, lien: `/playlist/${pl._id}`, rang: rang++ });
    }
    // Le dernier album enregistré en premier : la liste arrive dans l'ordre d'enregistrement.
    for (const al of [...((a?.albums ?? []) as { _id: string; title: string; coverUrl?: string; artist?: { stageName?: string } }[])].reverse()) {
      liste.push({ id: al._id, sorte: "album", titre: al.title, sousTitre: `Album · ${al.artist?.stageName ?? "Artiste"}`, image: al.coverUrl, lien: `/album/${al._id}`, rang: rang++ });
    }
    for (const ar of (s?.artists ?? []) as { _id: string; stageName: string; coverUrl?: string }[]) {
      liste.push({ id: ar._id, sorte: "artiste", titre: ar.stageName, sousTitre: "Artiste", image: ar.coverUrl, lien: `/artiste/${ar._id}`, rang: rang++ });
    }
    setElements(liste);
  }, []);

  useEffect(() => {
    if (status !== "authenticated") {
      setElements(null);
      return;
    }
    charger();
  }, [status, charger]);

  // Une playlist créée, un album enregistré ou un artiste suivi ailleurs
  // apparaît ici sans rechargement.
  useEffect(() => {
    const surChangement = () => status === "authenticated" && charger();
    window.addEventListener("moziik-playlists-change", surChangement);
    window.addEventListener("moziik-bibliotheque-change", surChangement);
    return () => {
      window.removeEventListener("moziik-playlists-change", surChangement);
      window.removeEventListener("moziik-bibliotheque-change", surChangement);
    };
  }, [status, charger]);

  const affiches = useMemo(() => {
    if (!elements) return [];
    const texte = recherche?.trim().toLowerCase() ?? "";
    return elements
      .filter((e) => (!sorte || e.sorte === sorte) && (!texte || e.titre.toLowerCase().includes(texte)))
      .sort((a, b) => {
        const pa = epingles.includes(a.id) ? 0 : 1;
        const pb = epingles.includes(b.id) ? 0 : 1;
        if (pa !== pb) return pa - pb;
        return tri === "az" ? a.titre.localeCompare(b.titre, "fr", { sensitivity: "base" }) : a.rang - b.rang;
      });
  }, [elements, sorte, recherche, tri, epingles]);

  function basculerEpingle(id: string) {
    setEpingles((avant) => {
      const apres = avant.includes(id) ? avant.filter((x) => x !== id) : [id, ...avant];
      try {
        localStorage.setItem(EPINGLES_KEY, JSON.stringify(apres));
      } catch {
        // Sans stockage, l'épingle vaut pour la visite en cours.
      }
      return apres;
    });
  }

  function basculerTri() {
    const suivant = tri === "recents" ? "az" : "recents";
    setTri(suivant);
    try {
      localStorage.setItem(TRI_KEY, suivant);
    } catch {
      // Idem : le tri vaut pour la visite.
    }
  }

  async function creer() {
    const nom = titre.trim();
    if (!nom) return;
    setEnvoi(true);
    try {
      const res = await fetch("/api/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: nom }),
      });
      if (!res.ok) throw new Error(await readApiError(res, "Échec de la création."));
      setTitre("");
      setCreation(false);
      pushToast("success", "Playlist créée.");
      charger();
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "Échec de la création.");
    } finally {
      setEnvoi(false);
    }
  }

  if (status !== "authenticated") return null;

  const vignette = (e: Element, taille: number) =>
    e.image ? (
      <SafeImage
        src={e.image}
        alt=""
        width={taille}
        height={taille}
        className={`h-10 w-10 shrink-0 object-cover ${e.sorte === "artiste" ? "rounded-full" : "rounded-md"}`}
      />
    ) : (
      <span className={`grid h-10 w-10 shrink-0 place-items-center bg-surface text-ink-muted ${e.sorte === "artiste" ? "rounded-full" : "rounded-md"}`}>
        <ListMusic size={taille / 2.6} />
      </span>
    );

  // Repliée : les pochettes seules, comme la barre repliée de Spotify.
  if (collapsed) {
    return (
      <div className="flex min-h-0 shrink flex-col">
        <div className="mx-1 my-4 h-px shrink-0 bg-border" />
        <Tooltip label="Ma bibliothèque" show>
          <Link href="/bibliotheque" className="mb-1 flex w-full shrink-0 justify-center rounded-xl py-2 text-ink-muted transition-colors hover:bg-surface hover:text-ink">
            <ListMusic size={18} />
          </Link>
        </Tooltip>
        <nav className="min-h-0 space-y-1 overflow-y-auto pb-1">
          {affiches.map((e) => (
            <Tooltip key={`${e.sorte}-${e.id}`} label={e.titre} show>
              <Link href={e.lien} className={`flex justify-center rounded-lg p-1 transition-colors hover:bg-surface ${pathname === e.lien ? "bg-accent/10" : ""}`}>
                {vignette(e, 40)}
              </Link>
            </Tooltip>
          ))}
        </nav>
      </div>
    );
  }

  return (
    // `min-h-0` sans `flex-grow` : le bloc garde sa hauteur tant qu'il y a la
    // place, et se comprime en premier quand l'écran raccourcit.
    <div className="flex min-h-0 shrink flex-col">
      <div className="my-4 h-px shrink-0 bg-border" />

      <div className="mb-2 flex shrink-0 items-center gap-1 px-2">
        <Link href="/bibliotheque" className="flex-1 truncate px-1 text-sm font-bold text-ink hover:underline">
          Ma bibliothèque
        </Link>
        <button
          onClick={() => setRecherche((r) => (r === null ? "" : null))}
          aria-label="Chercher dans la bibliothèque"
          title="Chercher"
          className={`grid h-7 w-7 place-items-center rounded-full transition-colors hover:bg-surface ${recherche !== null ? "text-accent" : "text-ink-muted hover:text-ink"}`}
        >
          <Search size={15} />
        </button>
        <button
          onClick={() => setCreation((v) => !v)}
          aria-label="Créer une playlist"
          title="Créer une playlist"
          className="grid h-7 w-7 place-items-center rounded-full text-ink-muted transition-colors hover:bg-surface hover:text-accent"
        >
          <Plus size={16} />
        </button>
      </div>

      {creation && (
        <div className="mb-2 flex shrink-0 items-center gap-1 px-2">
          <input
            autoFocus
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") creer();
              if (e.key === "Escape") {
                setCreation(false);
                setTitre("");
              }
            }}
            maxLength={150}
            placeholder="Nom de la playlist"
            aria-label="Nom de la nouvelle playlist"
            className="min-w-0 flex-1 rounded-lg border border-border bg-base px-2.5 py-1.5 text-xs outline-none focus:border-accent"
          />
          <button onClick={creer} disabled={!titre.trim() || envoi} aria-label="Valider" className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-accent transition-colors hover:bg-surface disabled:opacity-40">
            {envoi ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          </button>
          <button
            onClick={() => {
              setCreation(false);
              setTitre("");
            }}
            aria-label="Annuler"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-surface"
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div className="mb-2 flex shrink-0 flex-wrap gap-1.5 px-2">
        {(Object.keys(LIBELLES) as Sorte[]).map((s) => (
          <button
            key={s}
            onClick={() => setSorte((avant) => (avant === s ? null : s))}
            aria-pressed={sorte === s}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${sorte === s ? "bg-ink text-base" : "bg-ink/[0.08] text-ink hover:bg-ink/[0.14]"}`}
          >
            {LIBELLES[s]}
          </button>
        ))}
      </div>

      <div className="mb-1 flex shrink-0 items-center gap-1 px-2">
        {recherche !== null ? (
          <input
            autoFocus
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setRecherche(null)}
            placeholder="Chercher dans la bibliothèque"
            aria-label="Chercher dans la bibliothèque"
            className="min-w-0 flex-1 rounded-md bg-ink/[0.08] px-2.5 py-1.5 text-xs outline-none placeholder:text-ink-muted"
          />
        ) : (
          <span className="flex-1" />
        )}
        <button
          onClick={basculerTri}
          title={tri === "recents" ? "Trié par récents" : "Trié de A à Z"}
          className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-xs text-ink-muted transition-colors hover:text-ink"
        >
          {tri === "recents" ? <Clock3 size={13} /> : <ArrowDownAZ size={13} />}
          {tri === "recents" ? "Récents" : "A à Z"}
        </button>
      </div>

      {elements === null && <p className="shrink-0 px-3 py-1.5 text-xs text-ink-muted">Chargement...</p>}
      {elements !== null && affiches.length === 0 && !creation && (
        <p className="shrink-0 px-3 py-1.5 text-xs text-ink-muted">
          {elements.length === 0 ? "Votre bibliothèque est vide pour l'instant." : "Rien ne correspond."}
        </p>
      )}

      {/* La liste défile pour elle-même ; `min-h-` autorise sa compression
          quand l'écran est court, au lieu de repousser le reste. */}
      <nav className="min-h-[3.25rem] overflow-y-auto pb-1">
        {affiches.map((e) => {
          const actif = pathname === e.lien;
          const epingle = epingles.includes(e.id);
          return (
            <div key={`${e.sorte}-${e.id}`} className="group relative">
              <Link
                href={e.lien}
                className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors ${actif ? "bg-accent/10" : "hover:bg-surface"}`}
              >
                {vignette(e, 40)}
                <span className="min-w-0 flex-1 pr-6">
                  <span className={`block truncate text-sm ${actif ? "font-medium text-accent" : "text-ink"}`}>{e.titre}</span>
                  <span className="flex items-center gap-1 truncate text-xs text-ink-muted">
                    {epingle && <Pin size={11} className="shrink-0 text-accent" fill="currentColor" />}
                    {e.sousTitre}
                  </span>
                </span>
              </Link>
              <button
                onClick={() => basculerEpingle(e.id)}
                aria-label={epingle ? `Désépingler ${e.titre}` : `Épingler ${e.titre}`}
                title={epingle ? "Désépingler" : "Épingler en tête"}
                className={`absolute right-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full transition-opacity hover:bg-base ${
                  epingle ? "text-accent opacity-100" : "text-ink-muted opacity-0 group-hover:opacity-100 focus:opacity-100"
                }`}
              >
                <Pin size={14} fill={epingle ? "currentColor" : "none"} />
              </button>
            </div>
          );
        })}
      </nav>
    </div>
  );
}
