"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { CheckCircle2, Circle, Headphones, ImageOff, Pause, Play } from "lucide-react";
import { formatTime } from "@/components/song/AudioDropzone";

export type ChecklistItem = {
  key: string;
  label: string;
  detail: string;
  done: boolean;
};

export function SongPreviewSidebar({
  coverPreview,
  title,
  artistName,
  genre,
  language,
  duration,
  audioSrc,
  checklist,
}: {
  coverPreview: string | null;
  title: string;
  artistName: string;
  genre: string;
  language: string;
  duration: number;
  audioSrc: string | null;
  checklist: ChecklistItem[];
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);

  const allDone = checklist.every((c) => c.done);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) audio.pause();
    else audio.play().catch(() => {});
  }

  return (
    <div className="space-y-4 xl:sticky xl:top-6">
      <div className="rounded-xl2 border border-border bg-surface p-5">
        <h2 className="mb-4 text-sm font-semibold">Aperçu du titre</h2>

        <div className="relative aspect-square w-full overflow-hidden rounded-xl bg-base">
          {coverPreview ? (
            <Image src={coverPreview} alt={title || "Pochette"} fill sizes="360px" className="object-cover" />
          ) : (
            <div className="grid h-full place-items-center text-ink-muted">
              <ImageOff size={26} />
            </div>
          )}
        </div>

        <div className="mt-3.5">
          <p className="truncate text-base text-ink font-display leading-tight">{title || "Titre du morceau"}</p>
          <p className="truncate text-sm text-ink-muted">{artistName || "Artiste"}</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-muted">
            {genre && <span>{genre}</span>}
            {genre && language && <span aria-hidden>·</span>}
            {language && <span>{language}</span>}
            {(genre || language) && duration > 0 && <span aria-hidden>·</span>}
            {duration > 0 && <span>{formatTime(duration)}</span>}
          </p>
        </div>

        {audioSrc && (
          <div className="mt-4 flex items-center gap-3 border-t border-border pt-4">
            <audio
              ref={audioRef}
              src={audioSrc}
              preload="none"
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
              onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
              className="hidden"
            />
            <button
              type="button"
              onClick={togglePlay}
              aria-label={playing ? "Mettre en pause l'aperçu" : "Écouter l'aperçu"}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-base transition-colors hover:bg-accent-hover"
            >
              {playing ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
            </button>
            <span className="text-xs tabular-nums text-ink-muted">{formatTime(current)}</span>
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${duration ? Math.min(100, (current / duration) * 100) : 0}%` }}
              />
            </div>
            <span className="text-xs tabular-nums text-ink-muted">{formatTime(duration)}</span>
          </div>
        )}

        <div
          className={`mt-4 flex items-center justify-center gap-1.5 rounded-full py-2 text-xs font-medium ${
            allDone ? "bg-verified/10 text-verified" : "bg-ink-muted/10 text-ink-muted"
          }`}
        >
          {allDone ? <CheckCircle2 size={13} /> : <Circle size={13} />}
          {allDone ? "Prêt à publier" : "Encore quelques détails à compléter"}
        </div>
      </div>

      <div className="rounded-xl2 border border-border bg-surface p-5">
        <ul className="space-y-3.5">
          {checklist.map((item) => (
            <li key={item.key} className="flex items-start gap-2.5">
              {item.done ? (
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-verified" />
              ) : (
                <Circle size={16} className="mt-0.5 shrink-0 text-ink-muted" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-ink-muted">{item.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl2 border border-border bg-surface p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
            <Headphones size={16} />
          </span>
          <div>
            <p className="text-sm font-semibold">Besoin d&apos;aide ?</p>
            <p className="mt-0.5 text-xs text-ink-muted">
              Consultez notre guide de publication ou contactez notre support.
            </p>
            <a href="/contact" className="mt-1.5 inline-block text-xs font-medium text-accent hover:underline">
              Voir le guide →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
