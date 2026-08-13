"use client";

import Image from "next/image";
import { useState } from "react";
import { ImageOff } from "lucide-react";

/**
 * next/image lève une erreur FATALE (pas juste un avertissement)
 * quand `src` est vide ou manquant, ce qui casse toute la page. Ce
 * composant protège systématiquement contre ce cas — utile partout où
 * une pochette/couverture/photo peut légitimement être absente
 * (playlist sans cover personnalisée, artiste sans photo, etc.).
 *
 * Affiche aussi un effet shimmer tant que l'image n'est pas chargée,
 * pour éviter tout flash de contenu vide (et donc tout saut de mise en
 * page) — appliqué en classes conditionnelles sur le même <img>, sans
 * wrapper supplémentaire, pour ne rien changer au DOM que les centaines
 * d'appels existants dans le projet peuvent supposer.
 */
export function SafeImage({
  src,
  alt,
  width,
  height,
  className,
  priority,
}: {
  src?: string | null;
  alt: string;
  width: number;
  height: number;
  className?: string;
  priority?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);

  if (!src) {
    return (
      <div
        style={{ width, height }}
        className={`grid shrink-0 place-items-center bg-surface text-ink-muted ${className ?? ""}`}
      >
        <ImageOff size={Math.max(14, width * 0.3)} />
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={`${className ?? ""} ${loaded ? "" : "animate-shimmer bg-surface"}`}
      priority={priority}
      onLoad={() => setLoaded(true)}
    />
  );
}
