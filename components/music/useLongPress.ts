"use client";

import { useRef } from "react";

/**
 * Déclenche `onLongPress` après ~500ms d'appui tactile, avec les
 * coordonnées du point de contact (pour positionner le menu). N'entre
 * pas en conflit avec le clic normal (tap court = pas de déclenchement).
 */
export function useLongPress(onLongPress: (x: number, y: number) => void, delay = 500) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggeredRef = useRef(false);

  function start(e: React.TouchEvent) {
    const touch = e.touches[0];
    triggeredRef.current = false;
    timerRef.current = setTimeout(() => {
      triggeredRef.current = true;
      onLongPress(touch.clientX, touch.clientY);
    }, delay);
  }

  function clear() {
    if (timerRef.current) clearTimeout(timerRef.current);
  }

  return {
    onTouchStart: start,
    onTouchEnd: clear,
    onTouchMove: clear,
    wasLongPress: () => triggeredRef.current,
  };
}
