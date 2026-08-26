"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Camera, ImageOff, Info } from "lucide-react";

const MAX_SIZE_MB = 10;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

/**
 * Zone de dépôt pour la pochette : affiche l'image actuelle (existante ou
 * nouvellement choisie), accepte le glisser-déposer ou le clic, et valide
 * le type/poids du fichier avant de le remonter au formulaire parent.
 */
export function CoverDropzone({
  previewUrl,
  onFile,
  error,
}: {
  previewUrl: string | null;
  onFile: (file: File) => void;
  error?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  function validateAndEmit(file: File | undefined) {
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      setLocalError("Format non supporté. Utilise JPG, PNG ou WEBP.");
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setLocalError(`Le fichier dépasse ${MAX_SIZE_MB} Mo.`);
      return;
    }
    setLocalError(null);
    onFile(file);
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-1.5">
        <h2 className="text-sm font-semibold">Pochette du titre</h2>
        <Info size={13} className="text-ink-muted" />
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          validateAndEmit(e.dataTransfer.files?.[0]);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        className={`group relative aspect-square w-full cursor-pointer overflow-hidden rounded-xl2 border-2 border-dashed transition-colors ${
          dragOver ? "border-accent bg-accent/5" : "border-border bg-base hover:border-accent/50"
        }`}
      >
        {previewUrl ? (
          <Image src={previewUrl} alt="Pochette du titre" fill sizes="320px" className="object-cover" />
        ) : (
          <div className="grid h-full place-items-center gap-2 text-ink-muted">
            <ImageOff size={28} />
          </div>
        )}

        <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-200 group-hover:bg-black/45 group-hover:opacity-100">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-white text-black shadow-lg">
            <Camera size={18} />
          </span>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(",")}
          className="hidden"
          onChange={(e) => validateAndEmit(e.target.files?.[0])}
        />
      </div>

      <p className="mt-2.5 text-center text-xs text-ink-muted">
        Glissez-déposez ou cliquez pour ajouter une image
      </p>
      <p className="text-center text-[11px] text-ink-muted">
        JPG, PNG ou WEBP. Max {MAX_SIZE_MB} Mo.
        <br />
        Recommandé : 3000x3000px (1:1)
      </p>

      {(localError || error) && (
        <p className="mt-2 text-center text-xs text-accent">{localError ?? error}</p>
      )}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex-1 rounded-xl border border-border py-2 text-xs font-medium text-ink transition-colors hover:border-accent hover:text-accent"
        >
          Remplacer
        </button>
      </div>
    </div>
  );
}
