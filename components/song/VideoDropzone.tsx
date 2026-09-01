"use client";

import { useEffect, useState } from "react";
import { Clapperboard, Loader2, Trash2, Upload } from "lucide-react";

/**
 * Le clip vidéo d'un titre.
 *
 * Un seul champ, facultatif, partagé par la publication et la
 * modification : un clip n'est pas un contenu séparé, c'est une seconde
 * façon de présenter un morceau déjà publié. Il apparaît ensuite dans
 * l'onglet « Vidéos » de l'artiste.
 *
 * L'envoi passe par le même chemin que l'audio — direct navigateur vers
 * Cloudinary — parce qu'un fichier vidéo dépasse de loin la charge utile
 * qu'une route Next.js accepte.
 */

/** Au-delà, l'envoi depuis un téléphone échoue plus souvent qu'il n'aboutit. */
const TAILLE_MAX_MO = 200;

export function VideoDropzone({
  videoUrl,
  fichier,
  televersement,
  progression,
  onFichier,
  onRetirer,
}: {
  /** Le clip déjà enregistré, s'il y en a un. */
  videoUrl?: string;
  /** Le fichier choisi mais pas encore envoyé. */
  fichier: File | null;
  televersement: boolean;
  progression: number;
  onFichier: (fichier: File | null) => void;
  onRetirer: () => void;
}) {
  const [apercu, setApercu] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!fichier) {
      setApercu(null);
      return;
    }
    // L'URL d'objet est révoquée au changement de fichier : sans cela,
    // chaque essai laisse un blob en mémoire jusqu'au rechargement.
    const url = URL.createObjectURL(fichier);
    setApercu(url);
    return () => URL.revokeObjectURL(url);
  }, [fichier]);

  function choisir(f: File | null) {
    setErreur(null);
    if (!f) return;
    if (!f.type.startsWith("video/")) {
      setErreur("Choisis un fichier vidéo.");
      return;
    }
    if (f.size > TAILLE_MAX_MO * 1024 * 1024) {
      setErreur(`Fichier trop lourd (${TAILLE_MAX_MO} Mo maximum).`);
      return;
    }
    onFichier(f);
  }

  const source = apercu ?? videoUrl;

  return (
    <div>
      <p className="mb-1.5 flex items-center gap-2 text-sm font-medium">
        <Clapperboard size={15} className="text-ink-muted" /> Clip vidéo
        <span className="text-xs font-normal text-ink-muted">(optionnel)</span>
      </p>
      <p className="mb-3 text-xs text-ink-muted">
        Il apparaîtra dans l&apos;onglet « Vidéos » de ta page d&apos;artiste, et sur la fiche du
        titre. {TAILLE_MAX_MO} Mo maximum.
      </p>

      {source ? (
        <div className="overflow-hidden rounded-xl border border-border bg-base">
          {/* `preload="metadata"` : la première image suffit à montrer que
              le clip est bien là, sans télécharger la vidéo entière. */}
          <video src={source} controls preload="metadata" className="aspect-video w-full bg-black" />

          <div className="flex flex-wrap items-center justify-between gap-2 p-3">
            <span className="truncate text-xs text-ink-muted">
              {fichier ? fichier.name : "Clip enregistré"}
            </span>

            <div className="flex shrink-0 items-center gap-2">
              <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-ink-muted transition-colors hover:border-accent hover:text-accent">
                <Upload size={13} /> Remplacer
                <input
                  type="file"
                  accept="video/*"
                  className="hidden"
                  disabled={televersement}
                  onChange={(e) => {
                    choisir(e.target.files?.[0] ?? null);
                    e.target.value = "";
                  }}
                />
              </label>

              <button
                type="button"
                onClick={onRetirer}
                disabled={televersement}
                className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-ink-muted transition-colors hover:border-danger hover:text-danger disabled:opacity-60"
              >
                <Trash2 size={13} /> Retirer
              </button>
            </div>
          </div>
        </div>
      ) : (
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-8 text-center transition-colors hover:border-accent">
          <Clapperboard size={20} className="text-ink-muted" />
          <span className="text-sm font-medium">Ajouter un clip</span>
          <span className="text-xs text-ink-muted">MP4, WebM ou MOV</span>
          <input
            type="file"
            accept="video/*"
            className="hidden"
            disabled={televersement}
            onChange={(e) => {
              choisir(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
        </label>
      )}

      {televersement && (
        <p className="mt-2 flex items-center gap-2 text-xs text-ink-muted">
          <Loader2 size={13} className="animate-spin" />
          Envoi du clip... {progression}%
        </p>
      )}

      {erreur && <p className="mt-2 text-xs text-danger">{erreur}</p>}
    </div>
  );
}
