"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Play,
  Pause,
  Share2,
  DownloadCloud,
  MoreHorizontal,
  Loader2,
  Pencil,
  ToggleLeft,
  ToggleRight,
  Globe,
  Lock,
  ListMusic,
  Check,
  X,
} from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import { TagInput } from "@/components/ui/TagInput";
import { useDominantColor } from "@/components/song/useDominantColor";
import { formatCompactNumber } from "@/lib/formatNumber";
import type { PlaylistDetail } from "@/components/playlist/types";

/**
 * En-tête de la page playlist, calqué sur AlbumHero (même bandeau
 * dégradé tiré de la pochette, même pochette débordante, mêmes boutons)
 * pour que les deux pages se ressemblent réellement.
 *
 * Différence assumée : le titre et la description s'éditent sur place en
 * mode édition, là où un album passe par son onglet « À propos ». Une
 * playlist n'a que ces deux champs, ouvrir un formulaire séparé serait
 * disproportionné.
 */
export function PlaylistHero({
  playlist,
  totalPlays,
  totalDuration,
  isCurrentPlaylistPlaying,
  downloading,
  downloadProgress,
  canManage,
  editMode,
  savingMeta,
  onTogglePlayAll,
  onDownloadAll,
  onShare,
  onOpenMore,
  onToggleEditMode,
  onEditCover,
  onSaveMeta,
  onToggleVisibility,
}: {
  playlist: PlaylistDetail;
  totalPlays: number;
  totalDuration: number;
  isCurrentPlaylistPlaying: boolean;
  downloading: boolean;
  downloadProgress: { done: number; total: number };
  canManage: boolean;
  editMode: boolean;
  savingMeta: boolean;
  onTogglePlayAll: () => void;
  onDownloadAll: () => void;
  onShare: () => void;
  onOpenMore: (x: number, y: number) => void;
  onToggleEditMode: () => void;
  onEditCover: () => void;
  onSaveMeta: (updates: { title: string; description: string; tags: string[] }) => Promise<void>;
  onToggleVisibility: () => void;
}) {
  const color = useDominantColor(playlist.coverUrl);
  const gradient = color
    ? `linear-gradient(180deg, rgba(${color.r}, ${color.g}, ${color.b}, 0.55) 0%, rgba(${color.r}, ${color.g}, ${color.b}, 0.15) 55%, transparent 100%)`
    : "linear-gradient(180deg, rgba(255, 107, 74, 0.35) 0%, rgba(255, 107, 74, 0.08) 55%, transparent 100%)";

  const [title, setTitle] = useState(playlist.title);
  const [description, setDescription] = useState(playlist.description ?? "");
  const [tags, setTags] = useState<string[]>(playlist.tags ?? []);

  // Resynchronise les champs quand la playlist change sous nos pieds
  // (rechargement, modification depuis le menu contextuel) — sinon le
  // formulaire garderait les valeurs de l'ancien rendu.
  useEffect(() => {
    setTitle(playlist.title);
    setDescription(playlist.description ?? "");
    setTags(playlist.tags ?? []);
  }, [playlist.title, playlist.description, playlist.tags]);

  const modifie =
    title.trim() !== playlist.title ||
    description !== (playlist.description ?? "") ||
    tags.join("|") !== (playlist.tags ?? []).join("|");

  const heures = Math.floor(totalDuration / 3600);
  const minutes = Math.round((totalDuration % 3600) / 60);
  const dureeLisible = heures > 0 ? `${heures} h ${minutes} min` : `${minutes} min`;

  return (
    <div className="relative overflow-hidden rounded-xl2 border border-border">
      <div className="relative h-32 w-full sm:h-44 md:h-56">
        {playlist.coverUrl ? (
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${playlist.coverUrl})` }} />
        ) : (
          <div className="absolute inset-0 bg-surface" />
        )}
        <div className="absolute inset-0 backdrop-blur-2xl" />
        <div className="absolute inset-0" style={{ backgroundImage: gradient }} />
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/10 to-transparent" />

        {canManage && (
          <div className="absolute right-3 top-3">
            <button
              onClick={onToggleEditMode}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium backdrop-blur transition-colors ${
                editMode ? "bg-accent text-base hover:bg-accent-hover" : "bg-black/60 text-white hover:bg-black/70"
              }`}
            >
              {editMode ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
              Mode édition
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-6 px-5 pb-6 sm:px-8 md:flex-row md:items-end md:pb-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="group relative -mt-16 mx-auto w-36 shrink-0 sm:-mt-20 sm:w-44 md:mx-0 md:-mt-24 md:w-52"
        >
          {playlist.coverUrl ? (
            <SafeImage
              src={playlist.coverUrl}
              alt={playlist.title}
              width={320}
              height={320}
              priority
              className="aspect-square w-full rounded-xl2 object-cover shadow-2xl shadow-black/30 ring-4 ring-surface"
            />
          ) : (
            <div className="grid aspect-square w-full place-items-center rounded-xl2 bg-base shadow-2xl shadow-black/30 ring-4 ring-surface">
              <ListMusic size={40} className="text-ink-muted" />
            </div>
          )}

          {playlist.songs.length > 0 && (
            <button
              onClick={onTogglePlayAll}
              aria-label={isCurrentPlaylistPlaying ? "Mettre en pause" : "Tout écouter"}
              className="absolute inset-0 grid place-items-center rounded-xl2 bg-black/0 transition-all group-hover:bg-black/30 au-survol"
            >
              <span className="grid h-14 w-14 place-items-center rounded-full bg-accent text-base shadow-lg transition-transform hover:scale-105">
                {isCurrentPlaylistPlaying ? (
                  <Pause size={22} fill="currentColor" />
                ) : (
                  <Play size={22} fill="currentColor" className="ml-0.5" />
                )}
              </span>
            </button>
          )}

          {canManage && editMode && (
            <button
              onClick={onEditCover}
              aria-label="Modifier la pochette"
              title="Modifier la pochette"
              className="absolute -bottom-2 -right-2 grid h-9 w-9 place-items-center rounded-full bg-surface text-ink shadow-lg ring-1 ring-border transition-colors hover:text-accent"
            >
              <Pencil size={15} />
            </button>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.05, ease: "easeOut" }}
          className="min-w-0 flex-1 text-center md:text-left"
        >
          {/* Badge de visibilité : cliquable seulement en mode édition,
              simple information sinon. */}
          {canManage && editMode ? (
            <button
              onClick={onToggleVisibility}
              className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-2.5 py-1 text-[11px] font-medium text-accent transition-colors hover:bg-accent/25"
            >
              {playlist.isPublic ? <Globe size={11} /> : <Lock size={11} />}
              {playlist.isPublic ? "Publique" : "Privée"}
              <span className="text-ink-muted">— cliquer pour changer</span>
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-2.5 py-1 text-[11px] font-medium text-accent">
              {playlist.isPublic ? <Globe size={11} /> : <Lock size={11} />}
              Playlist {playlist.isPublic ? "publique" : "privée"}
            </span>
          )}

          {canManage && editMode ? (
            <div className="mt-3 space-y-2.5 text-left">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={150}
                aria-label="Titre de la playlist"
                placeholder="Titre de la playlist"
                className="w-full rounded-xl border border-border bg-base px-3.5 py-2 text-lg font-display outline-none transition-colors focus:border-accent"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={1000}
                rows={3}
                aria-label="Description de la playlist"
                placeholder="Décris l'ambiance de cette playlist..."
                className="w-full resize-y rounded-xl border border-border bg-base px-3.5 py-2 text-sm outline-none transition-colors focus:border-accent"
              />
              <div>
                <label className="mb-1.5 block text-xs text-ink-muted">
                  Mots-clés d&apos;ambiance (Chill, Lo-fi, Relax...)
                </label>
                <TagInput value={tags} onChange={setTags} preserveCase maxTags={10} placeholder="Ajouter un mot-clé..." />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => onSaveMeta({ title: title.trim(), description, tags })}
                  disabled={!modifie || !title.trim() || savingMeta}
                  className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-base transition-colors hover:bg-accent-hover disabled:opacity-50"
                >
                  {savingMeta ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Enregistrer
                </button>
                <button
                  onClick={() => {
                    setTitle(playlist.title);
                    setDescription(playlist.description ?? "");
                    setTags(playlist.tags ?? []);
                  }}
                  disabled={!modifie || savingMeta}
                  className="flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-2 text-sm font-medium text-ink-muted transition-colors hover:text-ink disabled:opacity-50"
                >
                  <X size={14} /> Annuler
                </button>
                <span className="text-xs text-ink-muted">{title.length}/150</span>
              </div>
            </div>
          ) : (
            <>
              <h1 className="mt-2 text-2xl font-display leading-tight sm:text-3xl">{playlist.title}</h1>
              {playlist.description && (
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">{playlist.description}</p>
              )}
            </>
          )}

          <p className="mt-3 text-sm text-ink-muted">
            Par {playlist.owner?.name ?? "Utilisateur supprimé"}
          </p>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 md:justify-start">
            <span className="rounded-full border border-border px-2.5 py-1 text-xs text-ink-muted">
              {playlist.songs.length} titre{playlist.songs.length > 1 ? "s" : ""}
            </span>
            {totalDuration > 0 && (
              <span className="rounded-full border border-border px-2.5 py-1 text-xs text-ink-muted">{dureeLisible}</span>
            )}
            <span className="rounded-full border border-border px-2.5 py-1 text-xs text-ink-muted">
              {formatCompactNumber(totalPlays)} écoutes
            </span>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5 md:justify-start">
            {playlist.songs.length > 0 && (
              <>
                <button
                  onClick={onTogglePlayAll}
                  className="flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-base transition-colors hover:bg-accent-hover"
                >
                  {isCurrentPlaylistPlaying ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
                  {isCurrentPlaylistPlaying ? "Pause" : "Tout écouter"}
                </button>
                <button
                  onClick={onDownloadAll}
                  disabled={downloading}
                  className="flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:border-accent hover:text-ink disabled:opacity-60"
                >
                  {downloading ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      {downloadProgress.total > 0 && `${downloadProgress.done}/${downloadProgress.total}`}
                    </>
                  ) : (
                    <>
                      <DownloadCloud size={15} />
                      <span className="hidden sm:inline">Télécharger</span>
                    </>
                  )}
                </button>
              </>
            )}
            {/* Une playlist privée ne se partage pas : le lien serait mort
                pour le destinataire. Le propriétaire garde l'accès pour
                pouvoir la rendre publique depuis la modale. */}
            {(playlist.isPublic || canManage) && (
              <button
                onClick={onShare}
                className="flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:border-accent hover:text-ink"
              >
                <Share2 size={15} />
                <span className="hidden sm:inline">Partager</span>
              </button>
            )}
            <button
              onClick={(e) => onOpenMore(e.clientX, e.clientY)}
              aria-label="Plus d'options"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border text-ink-muted transition-colors hover:border-accent hover:text-ink"
            >
              <MoreHorizontal size={16} />
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
