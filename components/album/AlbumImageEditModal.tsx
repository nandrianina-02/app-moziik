"use client";

import { useRef, useState } from "react";
import { Upload, Trash2, Loader2, ImageIcon } from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import { useToast } from "@/context/ToastProvider";
import { uploadToCloudinaryClient } from "@/lib/cloudinaryClient";
import { ModalSheet } from "@/components/ui/ModalSheet";

/**
 * `title` permet de réutiliser cette modale hors des albums (pochette de
 * playlist...) sans dupliquer la logique d'envoi Cloudinary ni les
 * contrôles de format. Sans lui, le libellé reste celui des albums.
 */
export function AlbumImageEditModal({
  kind,
  currentUrl,
  title: titleProp,
  onClose,
  onSaved,
}: {
  kind: "banner" | "cover";
  currentUrl?: string | null;
  title?: string;
  onClose: () => void;
  onSaved: (url: string | null) => void;
}) {
  const pushToast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [removed, setRemoved] = useState(false);

  const title = titleProp ?? (kind === "banner" ? "Modifier la bannière" : "Modifier la photo de l'album");

  function handlePick(file: File | null) {
    if (!file) return;
    if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file.type)) {
      pushToast("error", "Formats acceptés : JPG, PNG, WEBP.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      pushToast("error", "L'image dépasse la taille maximale de 10 Mo.");
      return;
    }
    setPendingFile(file);
    setRemoved(false);
    setPreview(URL.createObjectURL(file));
  }

  async function handleSave() {
    if (removed) {
      onSaved(null);
      return;
    }
    if (!pendingFile) {
      onClose();
      return;
    }
    setUploading(true);
    try {
      const uploaded = await uploadToCloudinaryClient(
        pendingFile,
        kind === "banner" ? "banners" : "covers",
        setProgress
      );
      onSaved(uploaded.url);
    } catch (err) {
      pushToast("error", err instanceof Error ? err.message : "Échec de l'envoi de l'image.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <ModalSheet
      titre={title}
      largeur="sm:max-w-md"
      onClose={onClose}
      pied={
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-ink-muted hover:text-ink"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={uploading}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-base hover:bg-accent-hover disabled:opacity-60"
          >
            {uploading ? "Envoi..." : "Enregistrer les modifications"}
          </button>
        </div>
      }
    >
      <div
        className={`relative overflow-hidden rounded-xl2 border border-dashed border-border bg-base ${
          kind === "banner" ? "aspect-[21/9]" : "mx-auto aspect-square w-48"
        }`}
      >
        {preview && !removed ? (
          <SafeImage
            src={preview}
            alt="Aperçu"
            width={400}
            height={kind === "banner" ? 172 : 400}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="grid h-full place-items-center text-ink-muted">
            <ImageIcon size={28} />
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 grid place-items-center bg-black/40 text-white">
            <Loader2 size={22} className="animate-spin" />
            <span className="mt-1 text-xs">{progress}%</span>
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => handlePick(e.target.files?.[0] ?? null)}
      />

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:border-accent"
        >
          <Upload size={14} /> Changer
        </button>
        {kind === "banner" && preview && !removed && (
          <button
            type="button"
            onClick={() => {
              setRemoved(true);
              setPendingFile(null);
              setPreview(null);
            }}
            className="flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-2 text-sm font-medium text-accent transition-colors hover:border-accent"
          >
            <Trash2 size={14} /> Supprimer
          </button>
        )}
      </div>

      <p className="mt-3 text-xs text-ink-muted">
        JPG, PNG ou WEBP, 10 Mo maximum. Les modifications sont enregistrées après validation.
      </p>
    </ModalSheet>
  );
}
