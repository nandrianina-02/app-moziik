"use client";

import { useRef } from "react";
import { ImagePlus, Pause, Play, RotateCcw } from "lucide-react";
import { formaterDuree } from "@/lib/audioMetadata";
import type { LigneImport } from "./types";

const ORIGINE: Record<LigneImport["sourcePochette"], string> = {
  integree: "Pochette du fichier",
  manuelle: "Pochette ajoutée",
  defaut: "Pochette Moziik",
};

/**
 * Vignette de la ligne : aperçu de la pochette, lecture du fichier et
 * remplacement manuel de l'image. L'origine de la pochette est écrite sous
 * la vignette — sans ça, rien ne distingue une image extraite du fichier
 * d'une image de repli.
 */
export function ImportCover({
  ligne,
  enLecture,
  onLecture,
  onPochette,
  onRetablirPochette,
}: {
  ligne: LigneImport;
  enLecture: boolean;
  onLecture: () => void;
  onPochette: (fichier: File) => void;
  onRetablirPochette: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const peutRetablir = ligne.sourcePochette !== "integree" && !!ligne.pochetteIntegree;
  const dimensions = ligne.sourcePochette === "integree" ? ligne.pochetteIntegree : null;

  return (
    <div className="w-[120px] shrink-0">
      <div className="group/pochette relative aspect-square w-full overflow-hidden rounded-xl2 border border-border bg-base">
        {ligne.apercuPochette ? (
          // Image locale (blob:) : next/image ne sait pas l'optimiser, et
          // SafeImage la refuserait. La balise native est ici le bon outil.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ligne.apercuPochette} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center text-ink-muted">
            <ImagePlus size={22} />
          </div>
        )}

        {ligne.statut !== "erreur" && (
          <button
            type="button"
            onClick={onLecture}
            aria-label={enLecture ? "Mettre en pause" : "Écouter le fichier"}
            className="absolute bottom-1.5 left-1.5 grid h-8 w-8 place-items-center rounded-full bg-ink text-base shadow-lg transition-transform hover:scale-105"
          >
            {enLecture ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
          </button>
        )}

        <span className="absolute bottom-1.5 right-1.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
          {formaterDuree(ligne.meta?.duree)}
        </span>

        <div className="absolute inset-0 grid place-items-center gap-1 bg-black/55 au-survol focus-within:opacity-100 group-hover/pochette:opacity-100">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm hover:bg-white/25"
          >
            <ImagePlus size={12} /> Remplacer
          </button>
          {peutRetablir && (
            <button
              type="button"
              onClick={onRetablirPochette}
              className="flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur-sm hover:bg-white/25"
            >
              <RotateCcw size={12} /> D&apos;origine
            </button>
          )}
        </div>
      </div>

      {/* Sans aperçu il n'y a pas de pochette à qualifier : annoncer
          « Pochette Moziik » devant un emplacement vide serait faux. */}
      <p className="mt-1.5 truncate text-[11px] text-ink-muted" title={ligne.apercuPochette ? ORIGINE[ligne.sourcePochette] : undefined}>
        {ligne.apercuPochette ? ORIGINE[ligne.sourcePochette] : "Aucune pochette"}
      </p>
      {dimensions?.largeur && (
        <p className="text-[11px] text-ink-muted">
          {dimensions.largeur}×{dimensions.hauteur}
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPochette(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
