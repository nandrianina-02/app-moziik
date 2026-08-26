"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Music2, Play, Pause, UploadCloud, CheckCircle2 } from "lucide-react";

const ACCEPTED_EXT = /\.(mp3|wav|flac)$/i;
const MAX_SIZE_MB = 100;

export function formatBytes(bytes: number) {
  if (!bytes) return "0 Mo";
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} Mo`;
}

export function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// Barres décoratives pseudo-aléatoires mais stables (dérivées du nom de
// fichier) simulant une forme d'onde — purement visuel, pas d'analyse du
// signal audio réel.
function useWaveformBars(seed: string, count = 56) {
  return useMemo(() => {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    const bars: number[] = [];
    for (let i = 0; i < count; i++) {
      h = (h * 1103515245 + 12345) >>> 0;
      bars.push(0.22 + ((h >>> 8) % 1000) / 1000 * 0.78);
    }
    return bars;
  }, [seed, count]);
}

export function AudioDropzone({
  fileName,
  fileSizeLabel,
  audioSrc,
  isNewFile,
  uploading,
  uploadProgress,
  onFileSelected,
  onDurationDetected,
  error,
}: {
  fileName: string;
  fileSizeLabel: string;
  audioSrc: string | null;
  isNewFile: boolean;
  uploading: boolean;
  uploadProgress: number;
  onFileSelected: (file: File) => void;
  onDurationDetected: (seconds: number) => void;
  error?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  const bars = useWaveformBars(fileName || "moziik-track");

  useEffect(() => {
    setPlaying(false);
    setCurrent(0);
  }, [audioSrc]);

  function validateAndEmit(file: File | undefined) {
    if (!file) return;
    const isAccepted = file.type.startsWith("audio/") || ACCEPTED_EXT.test(file.name);
    if (!isAccepted) {
      setLocalError("Format non supporté. Utilise MP3, WAV ou FLAC.");
      return;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setLocalError(`Le fichier dépasse ${MAX_SIZE_MB} Mo.`);
      return;
    }
    setLocalError(null);
    onFileSelected(file);
  }

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) audio.pause();
    else audio.play().catch(() => {});
  }

  function handleSeek(clientX: number, target: HTMLDivElement) {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = target.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    audio.currentTime = ratio * duration;
    setCurrent(audio.currentTime);
  }

  const progressRatio = duration ? current / duration : 0;

  return (
    <div>
      <div className="mb-3 flex items-center gap-1.5">
        <Music2 size={15} className="text-ink-muted" />
        <h2 className="text-sm font-semibold">Fichier audio</h2>
      </div>

      {!audioSrc ? (
        <DropSurface
          dragOver={dragOver}
          onDragOver={setDragOver}
          onDrop={validateAndEmit}
          inputRef={inputRef}
        />
      ) : (
        <div className="rounded-xl2 border border-border bg-base p-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/10 text-accent">
              <Music2 size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{fileName}</p>
              <p className="text-xs text-ink-muted">{fileSizeLabel}</p>
            </div>
            {!uploading && !localError && !error && <CheckCircle2 size={18} className="shrink-0 text-verified" />}
          </div>

          {uploading && (
            <div className="mt-3.5">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-150"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-ink-muted">Téléchargement en cours... {uploadProgress}%</p>
            </div>
          )}

          {!uploading && (
            <>
              <audio
                ref={audioRef}
                src={audioSrc}
                preload="metadata"
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onEnded={() => setPlaying(false)}
                onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
                onLoadedMetadata={(e) => {
                  const d = e.currentTarget.duration;
                  if (Number.isFinite(d)) {
                    setDuration(d);
                    if (isNewFile) onDurationDetected(Math.round(d));
                  }
                }}
                className="hidden"
              />
              <div className="mt-3.5 flex items-center gap-3">
                <button
                  type="button"
                  onClick={togglePlay}
                  aria-label={playing ? "Mettre en pause" : "Écouter l'aperçu"}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent text-base transition-colors hover:bg-accent-hover"
                >
                  {playing ? (
                    <Pause size={16} fill="currentColor" />
                  ) : (
                    <Play size={16} fill="currentColor" className="ml-0.5" />
                  )}
                </button>
                <span className="w-9 shrink-0 text-xs tabular-nums text-ink-muted">{formatTime(current)}</span>
                <div
                  className="relative h-8 flex-1 cursor-pointer"
                  onClick={(e) => handleSeek(e.clientX, e.currentTarget)}
                >
                  <div className="absolute inset-0 flex items-center gap-[2px]">
                    {bars.map((h, i) => (
                      <span
                        key={i}
                        style={{ height: `${h * 100}%` }}
                        className={`w-full flex-1 rounded-full transition-colors ${
                          i / bars.length <= progressRatio ? "bg-accent" : "bg-border"
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <span className="w-9 shrink-0 text-right text-xs tabular-nums text-ink-muted">
                  {formatTime(duration)}
                </span>
              </div>
            </>
          )}

          {!uploading && (
            <div className="mt-3.5 flex items-center justify-between border-t border-border pt-3">
              <p className="flex items-center gap-1.5 text-xs text-verified">
                <CheckCircle2 size={13} /> Analyse terminée : votre fichier audio est valide.
              </p>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="shrink-0 text-xs font-medium text-accent hover:underline"
              >
                Remplacer
              </button>
            </div>
          )}

          <input
            ref={inputRef}
            type="file"
            accept="audio/*,.mp3,.wav,.flac"
            className="hidden"
            onChange={(e) => validateAndEmit(e.target.files?.[0])}
          />
        </div>
      )}

      {(localError || error) && <p className="mt-2 text-xs text-accent">{localError ?? error}</p>}
    </div>
  );
}

function DropSurface({
  dragOver,
  onDragOver,
  onDrop,
  inputRef,
}: {
  dragOver: boolean;
  onDragOver: (v: boolean) => void;
  onDrop: (file: File | undefined) => void;
  inputRef: RefObject<HTMLInputElement>;
}) {
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver(true);
      }}
      onDragLeave={() => onDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        onDragOver(false);
        onDrop(e.dataTransfer.files?.[0]);
      }}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
      }}
      className={`grid cursor-pointer place-items-center gap-3 rounded-xl2 border-2 border-dashed px-6 py-10 text-center transition-colors ${
        dragOver ? "border-accent bg-accent/5" : "border-border bg-base hover:border-accent/50"
      }`}
    >
      <span className="grid h-12 w-12 place-items-center rounded-full bg-surface text-ink-muted">
        <UploadCloud size={22} />
      </span>
      <div>
        <p className="text-sm font-medium">
          Déposez votre fichier audio ici
          <br />
          <span className="font-normal text-ink-muted">ou</span>
        </p>
      </div>
      <span className="rounded-full bg-accent px-4 py-2 text-xs font-medium text-base transition-colors hover:bg-accent-hover">
        Choisir un fichier
      </span>
      <p className="text-[11px] text-ink-muted">MP3, WAV, FLAC · Max {MAX_SIZE_MB} Mo</p>
      <input
        ref={inputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.flac"
        className="hidden"
        onChange={(e) => onDrop(e.target.files?.[0])}
      />
    </div>
  );
}
