"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Pause, Play, RotateCcw, Scissors } from "lucide-react";

/**
 * Découpe le début et la fin d'un morceau.
 *
 * RIEN N'EST RÉENCODÉ
 *
 * Les bornes sont enregistrées, puis traduites en transformation
 * Cloudinary au moment de servir le fichier (lib/cloudinaryAudio.ts). Le
 * fichier d'origine reste entier : une découpe se corrige, se déplace ou
 * s'annule à tout moment, même des mois après la publication.
 *
 * Découper dans le navigateur aurait supposé un réencodeur MP3 embarqué —
 * une dépendance de plus — et aurait détruit ce qui dépasse. Le seul
 * format que le navigateur sait écrire nativement est le WAV, qui pèse
 * six fois plus lourd que le fichier reçu.
 */

/** Résolution de la forme d'onde. Au-delà, on dessine plus fin que le pixel. */
const BARRES = 320;

function formaterTemps(secondes: number): string {
  const s = Math.max(0, Math.round(secondes));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function TrimEditor({
  source,
  dureeOriginale,
  debut,
  fin,
  onChange,
}: {
  /** Fichier local en cours d'envoi, ou adresse d'un morceau déjà en ligne. */
  source: File | string;
  /** Durée du fichier entier. La découpe ne peut pas en sortir. */
  dureeOriginale: number;
  debut: number | null;
  fin: number | null;
  onChange: (bornes: { debut: number | null; fin: number | null }) => void;
}) {
  const [pics, setPics] = useState<number[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enLecture, setEnLecture] = useState(false);
  const [position, setPosition] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const piste = useRef<HTMLDivElement>(null);
  /**
   * La poignée en cours de déplacement.
   *
   * Un état, pas une référence : poser une référence ne provoque aucun
   * rendu, donc l'effet qui installe les écouteurs de fenêtre ne serait
   * jamais rejoué — et le glissement ne fonctionnerait tout simplement
   * pas.
   */
  const [glisse, setGlisse] = useState<"debut" | "fin" | null>(null);

  const d = debut ?? 0;
  const f = fin ?? dureeOriginale;

  // ---------------------------------------------------------- forme d'onde
  useEffect(() => {
    let annule = false;

    (async () => {
      try {
        const donnees =
          typeof source === "string"
            ? await (await fetch(source)).arrayBuffer()
            : await source.arrayBuffer();

        const AudioCtx =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const contexte = new AudioCtx();
        try {
          const buffer = await contexte.decodeAudioData(donnees);
          const canal = buffer.getChannelData(0);
          const parBarre = Math.floor(canal.length / BARRES) || 1;

          const mesures: number[] = [];
          let maximum = 0;
          for (let i = 0; i < BARRES; i++) {
            let crete = 0;
            for (let j = 0; j < parBarre; j++) {
              const v = Math.abs(canal[i * parBarre + j] ?? 0);
              if (v > crete) crete = v;
            }
            mesures.push(crete);
            if (crete > maximum) maximum = crete;
          }
          // Normalisé sur le maximum : un morceau enregistré bas ne doit
          // pas s'afficher comme une ligne plate.
          if (!annule) setPics(mesures.map((v) => (maximum > 0 ? v / maximum : 0)));
        } finally {
          contexte.close().catch(() => undefined);
        }
      } catch {
        // Sans forme d'onde, la découpe reste possible : les poignées
        // travaillent sur le temps, pas sur le dessin.
        if (!annule) setErreur("Aperçu indisponible pour ce fichier.");
      }
    })();

    return () => {
      annule = true;
    };
  }, [source]);

  // -------------------------------------------------------------- lecture
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const suivre = () => {
      setPosition(audio.currentTime);
      // On s'arrête à la borne de fin : c'est le morceau tel qu'il sera
      // servi qu'on écoute, pas le fichier entier.
      if (audio.currentTime >= f) {
        audio.pause();
        audio.currentTime = d;
        setEnLecture(false);
      }
    };
    audio.addEventListener("timeupdate", suivre);
    return () => audio.removeEventListener("timeupdate", suivre);
  }, [d, f]);

  function basculerLecture() {
    const audio = audioRef.current;
    if (!audio) return;
    if (enLecture) {
      audio.pause();
      setEnLecture(false);
      return;
    }
    if (audio.currentTime < d || audio.currentTime >= f) audio.currentTime = d;
    audio.play().then(() => setEnLecture(true)).catch(() => undefined);
  }

  // ------------------------------------------------------------- poignées
  const deplacer = useCallback(
    (clientX: number) => {
      const rect = piste.current?.getBoundingClientRect();
      if (!rect || !glisse) return;

      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      const instant = Math.round(ratio * dureeOriginale * 10) / 10;

      // Une seconde d'écart minimum : deux poignées confondues donneraient
      // un morceau de durée nulle.
      if (glisse === "debut") {
        onChange({ debut: Math.min(instant, f - 1), fin });
      } else {
        onChange({ debut, fin: Math.max(instant, d + 1) });
      }
    },
    [glisse, d, f, debut, fin, dureeOriginale, onChange]
  );

  useEffect(() => {
    if (!glisse) return;

    // Écouteurs sur la fenêtre, pas sur la poignée : le doigt sort
    // largement du rectangle de 16 px pendant le geste, et le glissement
    // s'arrêterait net à la première sortie.
    const bouger = (e: PointerEvent) => deplacer(e.clientX);
    const lacher = () => setGlisse(null);

    window.addEventListener("pointermove", bouger);
    window.addEventListener("pointerup", lacher);
    window.addEventListener("pointercancel", lacher);
    return () => {
      window.removeEventListener("pointermove", bouger);
      window.removeEventListener("pointerup", lacher);
      window.removeEventListener("pointercancel", lacher);
    };
  }, [glisse, deplacer]);

  const pct = (t: number) => `${(t / dureeOriginale) * 100}%`;
  const dureeRetenue = f - d;
  const decoupe = d > 0 || f < dureeOriginale;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Scissors size={15} className="text-ink-muted" /> Découpe
        </p>
        <p className="text-xs text-ink-muted">
          {formaterTemps(dureeRetenue)} retenu
          {decoupe && ` sur ${formaterTemps(dureeOriginale)}`}
        </p>
      </div>

      <div
        ref={piste}
        className="relative h-24 w-full touch-none select-none overflow-hidden rounded-xl border border-border bg-base"
      >
        {pics === null && !erreur && (
          <span className="absolute inset-0 grid place-items-center text-xs text-ink-muted">
            <Loader2 size={16} className="animate-spin" />
          </span>
        )}
        {erreur && (
          <span className="absolute inset-0 grid place-items-center px-4 text-center text-xs text-ink-muted">
            {erreur}
          </span>
        )}

        {pics && (
          <div className="absolute inset-0 flex items-center gap-px px-px">
            {pics.map((v, i) => {
              const instant = (i / pics.length) * dureeOriginale;
              const retenu = instant >= d && instant <= f;
              return (
                <span
                  key={i}
                  style={{ height: `${Math.max(2, v * 100)}%` }}
                  className={`flex-1 rounded-full ${retenu ? "bg-accent/70" : "bg-ink-muted/25"}`}
                />
              );
            })}
          </div>
        )}

        {/* Zones écartées, assombries : ce qu'on enlève doit se voir. */}
        <span className="absolute inset-y-0 left-0 bg-base/70" style={{ width: pct(d) }} />
        <span className="absolute inset-y-0 right-0 bg-base/70" style={{ width: pct(dureeOriginale - f) }} />

        {enLecture && (
          <span className="absolute inset-y-0 w-px bg-ink" style={{ left: pct(position) }} />
        )}

        {(["debut", "fin"] as const).map((borne) => (
          <button
            key={borne}
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              setGlisse(borne);
            }}
            aria-label={borne === "debut" ? "Début de la découpe" : "Fin de la découpe"}
            className="absolute inset-y-0 -ml-2 w-4 cursor-ew-resize"
            style={{ left: pct(borne === "debut" ? d : f) }}
          >
            <span className="absolute inset-y-1 left-1.5 w-1 rounded-full bg-accent shadow" />
          </button>
        ))}
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={basculerLecture}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:border-accent hover:text-accent"
        >
          {enLecture ? <Pause size={13} /> : <Play size={13} />}
          {enLecture ? "Pause" : "Écouter la découpe"}
        </button>

        <span className="text-xs tabular-nums text-ink-muted">
          {formaterTemps(d)} → {formaterTemps(f)}
        </span>

        {decoupe && (
          <button
            type="button"
            onClick={() => onChange({ debut: null, fin: null })}
            className="ml-auto flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-ink-muted transition-colors hover:border-accent hover:text-accent"
          >
            <RotateCcw size={13} /> Reprendre le morceau entier
          </button>
        )}
      </div>

      <p className="mt-2 text-xs text-ink-muted">
        Le fichier d&apos;origine n&apos;est pas modifié : la découpe s&apos;applique à la lecture,
        et s&apos;annule à tout moment.
      </p>

      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} src={typeof source === "string" ? source : undefined} preload="metadata" />
    </div>
  );
}
