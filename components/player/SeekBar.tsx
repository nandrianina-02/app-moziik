"use client";

import { useRef, useState } from "react";

type SeekBarProps = {
  progress: number; // secondes
  duration: number; // secondes
  onSeek: (seconds: number) => void;
  /** "edge" = ligne fine collée aux bords (mini-player mobile, comme Spotify) ; "pill" = barre arrondie compacte (contrôles desktop + lecteur plein écran). */
  variant?: "edge" | "pill";
  className?: string;
};

export function SeekBar({ progress, duration, onSeek, variant = "pill", className = "" }: SeekBarProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragRatio, setDragRatio] = useState<number | null>(null); // null = pas de glissement en cours
  const [hovering, setHovering] = useState(false);

  const safeDuration = duration > 0 ? duration : 0;
  const liveRatio = dragRatio ?? (safeDuration > 0 ? progress / safeDuration : 0);
  const pct = Math.min(100, Math.max(0, liveRatio * 100));
  const active = hovering || dragRatio !== null;

  function ratioFromEvent(e: { clientX: number }) {
    const el = trackRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
  }

  function handlePointerDown(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDragRatio(ratioFromEvent(e));
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (dragRatio === null) return;
    setDragRatio(ratioFromEvent(e));
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (dragRatio === null) return;
    const ratio = ratioFromEvent(e);
    onSeek(ratio * safeDuration);
    setDragRatio(null);
  }

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    // Un simple clic (sans glissement) doit aussi déplacer la lecture.
    if (dragRatio !== null) return;
    onSeek(ratioFromEvent(e) * safeDuration);
  }

  const trackHeight = active ? "h-1.5" : "h-1";
  const thumbSize = variant === "pill" ? "h-3 w-3" : "h-2.5 w-2.5";
  const rounded = variant === "pill" ? "rounded-full" : "rounded-none";

  return (
    <div
      ref={trackRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onClick={handleClick}
      role="slider"
      aria-label="Progression de la lecture"
      aria-valuemin={0}
      aria-valuemax={safeDuration}
      aria-valuenow={liveRatio * safeDuration}
      className={`group relative w-full cursor-pointer select-none touch-none ${
        variant === "pill" ? "py-1.5" : ""
      } ${className}`}
    >
      <div className={`relative w-full ${rounded} bg-border transition-[height] duration-150 ${trackHeight}`}>
        <div
          className={`absolute inset-y-0 left-0 ${rounded} transition-colors duration-150 ${
            active ? "bg-accent" : "bg-ink"
          }`}
          style={{ width: `${pct}%`, transition: dragRatio !== null ? "none" : "width 0.15s linear, background-color 0.15s" }}
        />
        <div
          className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full bg-white shadow transition-opacity duration-150 ${thumbSize} ${
            active ? "opacity-100" : "opacity-0"
          }`}
          style={{ left: `${pct}%` }}
        />
      </div>
    </div>
  );
}
