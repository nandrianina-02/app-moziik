"use client";

import { useEffect, useState } from "react";

type RGB = { r: number; g: number; b: number };

/**
 * Échantillonne l'image de pochette (canvas hors-écran, résolution
 * réduite pour rester léger) et renvoie sa couleur moyenne, utilisée
 * pour le dégradé dynamique derrière la pochette. Se dégrade en
 * silence (retourne `null`) si l'image est distante et bloque la
 * lecture du canvas (CORS) — le fond retombe alors sur un dégradé neutre.
 */
export function useDominantColor(src?: string | null): RGB | null {
  const [color, setColor] = useState<RGB | null>(null);

  useEffect(() => {
    if (!src) {
      setColor(null);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = src;

    img.onload = () => {
      if (cancelled) return;
      try {
        const size = 24;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);

        let r = 0;
        let g = 0;
        let b = 0;
        let count = 0;
        for (let i = 0; i < data.length; i += 4) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          count++;
        }
        if (!cancelled && count > 0) {
          setColor({
            r: Math.round(r / count),
            g: Math.round(g / count),
            b: Math.round(b / count),
          });
        }
      } catch {
        // Image cross-origin non lisible par le canvas : on garde le dégradé par défaut.
        if (!cancelled) setColor(null);
      }
    };
    img.onerror = () => {
      if (!cancelled) setColor(null);
    };

    return () => {
      cancelled = true;
    };
  }, [src]);

  return color;
}
