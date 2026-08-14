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

  function end(e: React.TouchEvent) {
    clear();
    // Après un `touchend`, le navigateur émet des évènements souris de
    // compatibilité (mousedown, mouseup, click). Sans ce garde-fou, un
    // appui long ouvrait bien le menu... que le `mousedown` suivant
    // refermait aussitôt en le prenant pour un clic extérieur — et le
    // `click` lançait en prime la lecture du titre. Résultat visible :
    // l'appui long ne « marchait pas » sur mobile.
    if (triggeredRef.current) e.preventDefault();
  }

  return {
    onTouchStart: start,
    onTouchEnd: end,
    onTouchMove: clear,
    wasLongPress: () => triggeredRef.current,
  };
}
