"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause, X, Download } from "lucide-react";
import { SafeImage } from "@/components/ui/SafeImage";
import { Portal } from "@/components/ui/Portal";
import { dureeCourte, libelleTaille, type PieceJointe } from "@/lib/messagerie";

/**
 * Les images et les sons attachés à une bulle.
 *
 * L'IMAGE S'AGRANDIT SUR PLACE
 *
 * Ouvrir la photo dans un onglet ferait quitter la conversation pour
 * regarder ce qu'on vient d'y recevoir, et perdre le fil de la
 * discussion. La visionneuse est donc une couche par-dessus, refermable
 * d'un geste ou d'Échap.
 *
 * LE SON A SON PROPRE LECTEUR, ET IL NE TOUCHE PAS AU LECTEUR DU SITE
 *
 * Un mémo vocal n'est pas un morceau : le passer par la file d'écoute
 * interromprait la musique en cours, écraserait la file, et laisserait le
 * mémo dans l'historique d'écoute comme s'il s'agissait d'un titre du
 * catalogue. Il joue donc dans son coin — mais la musique du site est
 * mise en pause au démarrage, parce que personne ne veut écouter les deux
 * en même temps.
 */
export function PiecesJointes({ pieces, aMoi }: { pieces: PieceJointe[]; aMoi: boolean }) {
  const [agrandie, setAgrandie] = useState<PieceJointe | null>(null);

  const images = pieces.filter((p) => p.type === "image");
  const sons = pieces.filter((p) => p.type === "audio");

  return (
    <div className="mt-1 space-y-1.5">
      {images.length > 0 && (
        <div className={`grid gap-1.5 ${images.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
          {images.map((p) => (
            <button
              key={p.url}
              type="button"
              onClick={() => setAgrandie(p)}
              className="overflow-hidden rounded-xl"
              aria-label={`Agrandir ${p.nom || "l'image"}`}
            >
              <SafeImage
                src={p.url}
                alt={p.nom}
                width={p.largeur ?? 420}
                height={p.hauteur ?? 320}
                className={`w-full object-cover ${
                  images.length > 1 ? "aspect-square" : "max-h-72"
                }`}
              />
            </button>
          ))}
        </div>
      )}

      {sons.map((p) => (
        <LecteurMemo key={p.url} piece={p} aMoi={aMoi} />
      ))}

      {agrandie && (
        <Portal>
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4"
            onClick={() => setAgrandie(null)}
            role="presentation"
          >
            <button
              type="button"
              onClick={() => setAgrandie(null)}
              className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
              aria-label="Fermer"
            >
              <X size={20} />
            </button>
            <a
              href={agrandie.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-sm text-white transition-colors hover:bg-white/20"
            >
              <Download size={16} /> Ouvrir
            </a>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={agrandie.url}
              alt={agrandie.nom}
              className="max-h-full max-w-full rounded-xl object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </Portal>
      )}
    </div>
  );
}

/** Un mémo vocal : une barre, un bouton, une durée. */
function LecteurMemo({ piece, aMoi }: { piece: PieceJointe; aMoi: boolean }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [joue, setJoue] = useState(false);
  const [position, setPosition] = useState(0);
  const [duree, setDuree] = useState(piece.duree ?? 0);

  useEffect(() => {
    const el = audio.current;
    if (!el) return;
    const surTemps = () => setPosition(el.currentTime);
    const surMeta = () => Number.isFinite(el.duration) && setDuree(el.duration);
    const surFin = () => {
      setJoue(false);
      setPosition(0);
    };
    el.addEventListener("timeupdate", surTemps);
    el.addEventListener("loadedmetadata", surMeta);
    el.addEventListener("ended", surFin);
    return () => {
      el.removeEventListener("timeupdate", surTemps);
      el.removeEventListener("loadedmetadata", surMeta);
      el.removeEventListener("ended", surFin);
    };
  }, []);

  function basculer() {
    const el = audio.current;
    if (!el) return;
    if (joue) {
      el.pause();
      setJoue(false);
      return;
    }
    // La musique du site s'arrête : deux sources à la fois ne s'écoutent
    // pas. On passe par l'élément du lecteur plutôt que par son contexte,
    // pour ne pas faire dépendre une pièce jointe de l'état de la file.
    document.querySelectorAll("audio").forEach((autre) => {
      if (autre !== el) autre.pause();
    });
    void el.play().then(() => setJoue(true)).catch(() => setJoue(false));
  }

  const avancement = duree > 0 ? Math.min(100, (position / duree) * 100) : 0;
  const teinte = aMoi ? "bg-white/25" : "bg-border";
  const remplissage = aMoi ? "bg-white" : "bg-accent";

  return (
    <div
      className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 ${
        aMoi ? "bg-white/10" : "bg-base"
      }`}
    >
      <audio ref={audio} src={piece.url} preload="metadata" />
      <button
        type="button"
        onClick={basculer}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
          aMoi ? "bg-white text-accent" : "bg-accent text-base"
        }`}
        aria-label={joue ? "Mettre en pause" : "Écouter le message vocal"}
      >
        {joue ? <Pause size={15} /> : <Play size={15} />}
      </button>

      <div className="min-w-0 flex-1">
        <div className={`h-1 w-full overflow-hidden rounded-full ${teinte}`}>
          <div className={`h-full rounded-full ${remplissage}`} style={{ width: `${avancement}%` }} />
        </div>
        <p className={`mt-1 text-[11px] ${aMoi ? "text-white/70" : "text-ink-muted"}`}>
          {dureeCourte(position || duree) || libelleTaille(piece.taille) || "Message vocal"}
        </p>
      </div>
    </div>
  );
}
