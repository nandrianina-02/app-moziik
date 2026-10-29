"use client";

import { useEffect, useState } from "react";
import {
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
  UserPlus,
} from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import { TagInput } from "@/components/ui/TagInput";
import { EnteteMedia, Point, BoutonLectureMedia, BoutonActionMedia } from "@/components/music/EnteteMedia";
import { formatCompactNumber } from "@/lib/formatNumber";
import type { PlaylistDetail } from "@/components/playlist/types";

/**
 * En-tête de la page playlist : le même que celui d'un album (EnteteMedia),
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
  peutEditerTitres,
  onCollaboration,
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
  /** Propriétaire, admin ou collaborateur : ouvre le mode édition des titres. */
  peutEditerTitres: boolean;
  /** Présent pour le propriétaire et les collaborateurs. */
  onCollaboration?: () => void;
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

  const visibilite = (
    <span className="inline-flex items-center gap-1.5">
      {playlist.isPublic ? <Globe size={12} /> : <Lock size={12} />}
      Playlist {playlist.isPublic ? "publique" : "privée"}
    </span>
  );

  return (
    <EnteteMedia
      fond={{ couleurDe: playlist.coverUrl }}
      coinHaut={
        peutEditerTitres && (
          <button
            onClick={onToggleEditMode}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium backdrop-blur transition-colors ${
              editMode ? "bg-accent text-base hover:bg-accent-hover" : "bg-black/60 text-white hover:bg-black/70"
            }`}
          >
            {editMode ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
            Mode édition
          </button>
        )
      }
      pochette={
        <div className="relative">
          {playlist.coverUrl ? (
            <SafeImage src={playlist.coverUrl} alt={playlist.title} width={320} height={320} priority className="aspect-square w-full rounded-md object-cover" />
          ) : (
            <div className="grid aspect-square w-full place-items-center rounded-md bg-surface shadow-[0_16px_48px_rgba(0,0,0,0.5)]">
              <ListMusic size={44} className="text-ink-muted" />
            </div>
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
        </div>
      }
      etiquette={
        // Cliquable seulement en mode édition, simple information sinon.
        canManage && editMode ? (
          <button
            onClick={onToggleVisibility}
            className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-2.5 py-1 text-[11px] font-medium text-accent transition-colors hover:bg-accent/25"
          >
            {playlist.isPublic ? <Globe size={11} /> : <Lock size={11} />}
            {playlist.isPublic ? "Publique" : "Privée"}
            <span className="text-ink-muted">— cliquer pour changer</span>
          </button>
        ) : (
          visibilite
        )
      }
      titre={playlist.title}
      description={playlist.description}
      edition={
        canManage && editMode ? (
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
              <label className="mb-1.5 block text-xs text-ink-muted">Mots-clés d&apos;ambiance (Chill, Lo-fi, Relax...)</label>
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
        ) : undefined
      }
      infos={
        <>
          <span className="font-semibold text-ink">{playlist.owner?.name ?? "Utilisateur supprimé"}</span>
          {!!playlist.collaborateurs?.length && (
            <span className="flex items-center gap-1.5">
              <span className="flex -space-x-1.5">
                {playlist.collaborateurs.slice(0, 3).map((c) => (
                  <SafeImage key={c._id} src={c.avatarUrl} alt={c.name} width={20} height={20} className="h-5 w-5 rounded-full object-cover ring-2 ring-base" />
                ))}
              </span>
              et {playlist.collaborateurs.length} collaborateur{playlist.collaborateurs.length > 1 ? "s" : ""}
            </span>
          )}
          <Point />
          <span>
            {playlist.songs.length} titre{playlist.songs.length > 1 ? "s" : ""}
          </span>
          {totalDuration > 0 && (
            <>
              <Point />
              <span>{dureeLisible}</span>
            </>
          )}
          <Point />
          <span>{formatCompactNumber(totalPlays)} écoutes</span>
        </>
      }
    >
      {playlist.songs.length > 0 && (
        <>
          <BoutonLectureMedia enCours={isCurrentPlaylistPlaying} onClick={onTogglePlayAll} libelle={playlist.title} />
          <BoutonActionMedia libelle="Télécharger pour l'écoute hors connexion" onClick={onDownloadAll} disabled={downloading}>
            {downloading ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                {downloadProgress.total > 0 && `${downloadProgress.done}/${downloadProgress.total}`}
              </>
            ) : (
              <DownloadCloud size={22} />
            )}
          </BoutonActionMedia>
        </>
      )}
      {/* Une playlist privée ne se partage pas : le lien serait mort pour le
          destinataire. Le propriétaire garde l'accès pour pouvoir la rendre
          publique depuis la modale. */}
      {(playlist.isPublic || canManage) && (
        <BoutonActionMedia libelle="Partager" onClick={onShare}>
          <Share2 size={20} />
        </BoutonActionMedia>
      )}
      {onCollaboration && (
        <BoutonActionMedia libelle="Playlist collaborative" onClick={onCollaboration}>
          <UserPlus size={20} />
        </BoutonActionMedia>
      )}
      <BoutonActionMedia libelle="Plus d'options" onClick={(e) => onOpenMore(e.clientX, e.clientY)}>
        <MoreHorizontal size={22} />
      </BoutonActionMedia>
    </EnteteMedia>
  );
}
