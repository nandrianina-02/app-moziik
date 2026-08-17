"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Plus, ListMusic, Loader2, Check, X } from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import { Tooltip } from "@/components/layout/Tooltip";
import { useToast } from "@/context/ToastProvider";
import { readApiError } from "@/lib/readApiError";

type PlaylistLite = { _id: string; title: string; coverUrl?: string };

/**
 * Section « Mes playlists » du menu latéral, comme sur la maquette :
 * vignette, titre, et un bouton « + » pour en créer une sans quitter la
 * page courante.
 *
 * La création se fait par un champ qui s'ouvre sur place plutôt que par
 * une modale : c'est une seule saisie, une surcouche serait
 * disproportionnée et ferait perdre le contexte.
 *
 * Rien n'est affiché à un visiteur non connecté — il n'a pas de playlist.
 */
export function SidebarPlaylists({ collapsed }: { collapsed: boolean }) {
  const { status } = useSession();
  const pathname = usePathname();
  const pushToast = useToast();

  const [playlists, setPlaylists] = useState<PlaylistLite[]>([]);
  const [chargement, setChargement] = useState(true);
  const [creation, setCreation] = useState(false);
  const [titre, setTitre] = useState("");
  const [envoi, setEnvoi] = useState(false);

  const charger = useCallback(async () => {
    try {
      const res = await fetch("/api/playlists?owner=me");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPlaylists(data.playlists ?? []);
    } catch {
      setPlaylists([]);
    } finally {
      setChargement(false);
    }
  }, []);

  useEffect(() => {
    if (status !== "authenticated") {
      setPlaylists([]);
      setChargement(false);
      return;
    }
    charger();
  }, [status, charger]);

  // Une playlist créée ailleurs (page bibliothèque, modale « Ajouter à
  // une playlist ») doit apparaître ici sans rechargement.
  useEffect(() => {
    function onChange() {
      if (status === "authenticated") charger();
    }
    window.addEventListener("moziik-playlists-change", onChange);
    return () => window.removeEventListener("moziik-playlists-change", onChange);
  }, [status, charger]);

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
      const data = await res.json();
      setPlaylists((prev) => [{ _id: data.playlist._id, title: data.playlist.title }, ...prev]);
      setTitre("");
      setCreation(false);
      pushToast("success", "Playlist créée.");
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "Échec de la création.");
    } finally {
      setEnvoi(false);
    }
  }

  if (status !== "authenticated") return null;

  // Replié, la section se réduit à son icône : afficher des vignettes de
  // 20 px sans libellé n'aiderait personne à s'y retrouver.
  if (collapsed) {
    return (
      <div className="shrink-0">
        <div className="my-4 mx-1 h-px bg-border" />
        <Tooltip label="Ma bibliothèque" show>
          <Link
            href="/bibliotheque"
            className="flex w-full justify-center rounded-xl py-2.5 text-ink-muted transition-colors hover:bg-surface hover:text-ink"
          >
            <ListMusic size={18} />
          </Link>
        </Tooltip>
      </div>
    );
  }

  return (
    // `min-h-0` + absence de `flex-grow` : le bloc garde la hauteur de son
    // contenu tant qu'il y a la place, et se comprime en premier quand
    // l'écran raccourcit — c'est lui qui absorbe le manque de hauteur, à la
    // place du reste de la sidebar.
    <div className="flex min-h-0 shrink flex-col">
      <div className="my-4 h-px shrink-0 bg-border" />

      <div className="mb-1 flex shrink-0 items-center justify-between px-3">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Mes playlists</span>
        <button
          onClick={() => setCreation((v) => !v)}
          aria-label="Créer une playlist"
          title="Créer une playlist"
          className="grid h-6 w-6 place-items-center rounded-full text-ink-muted transition-colors hover:bg-surface hover:text-accent"
        >
          <Plus size={15} />
        </button>
      </div>

      {creation && (
        <div className="mb-1.5 flex shrink-0 items-center gap-1 px-2">
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
          <button
            onClick={creer}
            disabled={!titre.trim() || envoi}
            aria-label="Valider"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-accent transition-colors hover:bg-surface disabled:opacity-40"
          >
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

      {chargement && <p className="shrink-0 px-3 py-1.5 text-xs text-ink-muted">Chargement...</p>}

      {!chargement && playlists.length === 0 && !creation && (
        <p className="shrink-0 px-3 py-1.5 text-xs text-ink-muted">Aucune playlist pour l&apos;instant.</p>
      )}

      {/* La liste défile pour elle-même. `min-h-` (et non `max-h-`) est ce
          qui compte : il autorise la compression sous la taille du contenu
          — un enfant flex a sinon `min-height: auto`, refuse de rétrécir,
          et repousse tout le reste hors de l'écran. La borne haute vient
          maintenant de la place réellement disponible, pas d'un `max-h-64`
          arbitraire qui masquait les playlists au-delà de la quatrième. */}
      <nav className="min-h-[3.25rem] space-y-0.5 overflow-y-auto">
        {playlists.map((p) => {
          const actif = pathname === `/playlist/${p._id}`;
          return (
            <Link
              key={p._id}
              href={`/playlist/${p._id}`}
              className={`flex items-center gap-2.5 rounded-xl px-3 py-1.5 text-sm transition-colors ${
                actif ? "bg-accent/10 font-medium text-accent" : "text-ink-muted hover:bg-surface hover:text-ink"
              }`}
            >
              {p.coverUrl ? (
                <SafeImage
                  src={p.coverUrl}
                  alt=""
                  width={28}
                  height={28}
                  className="h-7 w-7 shrink-0 rounded-md object-cover"
                />
              ) : (
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-surface">
                  <ListMusic size={13} />
                </span>
              )}
              <span className="truncate">{p.title}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
