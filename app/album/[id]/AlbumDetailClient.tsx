"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { usePlayer } from "@/context/PlayerProvider";
import { useToast } from "@/context/ToastProvider";
import { downloadAlbumForOffline } from "@/lib/offlineCache";
import { AlbumContextMenu } from "@/components/album/AlbumContextMenu";
import { ShareModal } from "@/components/share/ShareModal";
import { buildAlbumSubject } from "@/components/share/shareSubject";
import { AlbumHero } from "@/components/album/AlbumHero";
import { AlbumTabs } from "@/components/album/AlbumTabs";
import { AlbumSidebar } from "@/components/album/AlbumSidebar";
import { AlbumDetailSkeleton } from "@/components/album/AlbumDetailSkeleton";
import { PageSections } from "@/components/home/PageSections";
import { AlbumImageEditModal } from "@/components/album/AlbumImageEditModal";
import type { AlbumDetail, AlbumSummaryLite } from "@/components/album/types";

export function AlbumDetailClient() {
  const { id } = useParams<{ id: string }>();
  const { data: session, status } = useSession();
  const pushToast = useToast();
  const { currentSong, isPlaying, playQueue } = usePlayer();

  const [album, setAlbum] = useState<AlbumDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({ done: 0, total: 0 });
  const [saved, setSaved] = useState(false);
  const [savingToggle, setSavingToggle] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingImage, setEditingImage] = useState<"banner" | "cover" | null>(null);

  const [commentsCount, setCommentsCount] = useState(0);
  const [moreFromArtist, setMoreFromArtist] = useState<AlbumSummaryLite[]>([]);

  const [showShareModal, setShowShareModal] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);

  async function load() {
    try {
      const res = await fetch(`/api/albums/${id}`);
      if (!res.ok) {
        setNotFound(true);
        return;
      }
      const data = await res.json();
      setAlbum(data.album);
    } catch {
      pushToast("error", "Impossible de charger cet album.");
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (session?.user?.role === "admin") {
      setCanManage(true);
      return;
    }
    if (session?.user?.role === "artist" && album?.artist) {
      fetch("/api/artist/me")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => setCanManage(!!data?.artist && data.artist._id === album.artist!._id))
        .catch(() => {});
    }
  }, [session, album?.artist]);

  useEffect(() => {
    if (status !== "authenticated" || !id) return;
    fetch("/api/me/saved-albums")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setSaved(data.albums.some((a: { _id: string }) => a._id === id));
      });
  }, [status, id]);

  useEffect(() => {
    if (!album) return;

    fetch(`/api/albums/${album._id}/comments`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setCommentsCount(data.total))
      .catch(() => {});

    if (album.artist) {
      fetch(`/api/albums?artist=${album.artist._id}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!data) return;
          setMoreFromArtist(
            data.albums.filter((a: AlbumSummaryLite & { _id: string }) => a._id !== album._id)
          );
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [album?._id, album?.artist?._id]);

  async function toggleSaved() {
    if (status !== "authenticated") {
      pushToast("error", "Connecte-toi pour enregistrer cet album.");
      return;
    }
    setSavingToggle(true);
    try {
      const res = await fetch("/api/me/saved-albums", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ albumId: id }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSaved(data.saved);
      pushToast("success", data.saved ? "Album enregistré dans ta bibliothèque." : "Album retiré de ta bibliothèque.");
    } catch {
      pushToast("error", "Échec de l'enregistrement.");
    } finally {
      setSavingToggle(false);
    }
  }

  async function handleDownloadAlbum() {
    if (!album) return;
    setDownloading(true);
    try {
      await downloadAlbumForOffline(album._id, (done, total) => setDownloadProgress({ done, total }));
      pushToast("success", "Album disponible hors-ligne.");
      fetch(`/api/albums/${album._id}/download`, { method: "POST" })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => data && setAlbum((prev) => (prev ? { ...prev, downloadsCount: data.downloadsCount } : prev)))
        .catch(() => {});
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "Échec du téléchargement.");
    } finally {
      setDownloading(false);
    }
  }

  async function patchAlbum(updates: Partial<AlbumDetail>) {
    if (!album) return;
    const res = await fetch(`/api/albums/${album._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error();
    // La réponse renvoie l'album avec artist/songs non repeuplés (juste
    // leurs ObjectId) — on ne fusionne donc que les champs qu'on vient
    // d'envoyer, jamais data.album en entier, pour ne pas écraser les
    // objets artist/songs déjà peuplés dans l'état local.
    setAlbum((prev) => (prev ? { ...prev, ...updates } : prev));
  }

  async function handleSaveDescription(description: string) {
    try {
      await patchAlbum({ description });
      pushToast("success", "Description mise à jour.");
    } catch {
      pushToast("error", "Échec de l'enregistrement de la description.");
    }
  }

  async function handleImageSaved(kind: "banner" | "cover", url: string | null) {
    try {
      if (kind === "banner") {
        await patchAlbum({ bannerUrl: url });
      } else if (url) {
        await patchAlbum({ coverUrl: url });
      }
      pushToast("success", kind === "banner" ? "Bannière mise à jour." : "Photo de l'album mise à jour.");
    } catch {
      pushToast("error", "Échec de l'enregistrement de l'image.");
    } finally {
      setEditingImage(null);
    }
  }

  function openMenuAt(x: number, y: number) {
    setMenuPosition({ x, y });
  }

  if (loading) return <AlbumDetailSkeleton />;
  if (notFound || !album) {
    return <p className="px-6 py-16 text-center text-sm text-ink-muted">Cet album est introuvable.</p>;
  }

  const isCurrentAlbumPlaying = isPlaying && album.songs.some((s) => s._id === currentSong?._id);
  const totalPlays = album.songs.reduce((sum, s) => sum + (s.playsCount ?? 0), 0);
  const totalLikes = album.songs.reduce((sum, s) => sum + (s.likesCount ?? 0), 0);
  const totalShares = album.songs.reduce(
    (sum, s) => sum + ((s as unknown as { sharesCount?: number }).sharesCount ?? 0),
    0
  );

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 md:px-10 md:py-10">
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <AlbumHero
            album={album}
            totalPlays={totalPlays}
            totalLikes={totalLikes}
            isCurrentAlbumPlaying={isCurrentAlbumPlaying}
            saved={saved}
            savingToggle={savingToggle}
            downloading={downloading}
            downloadProgress={downloadProgress}
            canManage={canManage}
            editMode={editMode}
            onTogglePlayAll={() => playQueue(album.songs, 0, { type: "album" })}
            onToggleSaved={toggleSaved}
            onDownloadAll={handleDownloadAlbum}
            onShare={() => setShowShareModal(true)}
            onOpenMore={openMenuAt}
            onToggleEditMode={() => setEditMode((v) => !v)}
            onEditBanner={() => setEditingImage("banner")}
            onEditCover={() => setEditingImage("cover")}
          />

          <div className="mt-6">
            <AlbumTabs
              album={album}
              commentsCount={commentsCount}
              moreFromArtist={moreFromArtist}
              canManage={canManage}
              editMode={editMode}
              onReload={load}
              onSaveDescription={handleSaveDescription}
            />
          </div>
        </div>

        <AlbumSidebar
          album={album}
          totalPlays={totalPlays}
          totalLikes={totalLikes}
          totalShares={totalShares}
          moreFromArtist={moreFromArtist}
        />
      </div>

      {showShareModal && <ShareModal subject={buildAlbumSubject(album)} onClose={() => setShowShareModal(false)} />}

      {menuPosition && (
        <AlbumContextMenu
          album={album}
          position={menuPosition}
          canManage={canManage}
          onClose={() => setMenuPosition(null)}
          onDeleted={() => setNotFound(true)}
        />
      )}

      {/* Sections éditoriales pilotées depuis l'administration. */}
      <PageSections page="detail" className="mt-12" />

      {editingImage && (
        <AlbumImageEditModal
          kind={editingImage}
          currentUrl={editingImage === "banner" ? album.bannerUrl : album.coverUrl}
          onClose={() => setEditingImage(null)}
          onSaved={(url) => handleImageSaved(editingImage, url)}
        />
      )}
    </div>
  );
}
