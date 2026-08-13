/**
 * Chrome (et les autres navigateurs) vérifient que les dimensions
 * RÉELLES d'une icône correspondent exactement à celles déclarées —
 * sinon la PWA n'est simplement pas installable, ou l'icône ne
 * s'affiche pas, sans message d'erreur explicite. Le logo uploadé par
 * l'admin ayant une taille arbitraire, on force le format carré exact
 * via une transformation Cloudinary à la volée (jamais de recadrage
 * destructeur, juste du padding transparent/blanc).
 */
export function sizedIcon(logoUrl: string, size: number): string | null {
  if (!logoUrl.includes("/upload/")) return null; // pas une URL Cloudinary : taille non garantissable
  return logoUrl.replace("/upload/", `/upload/w_${size},h_${size},c_pad,b_auto/`);
}

/**
 * Les icônes "maskable" (PWA Android) peuvent être recadrées en
 * cercle/arrondi par le système : marge de sécurité en réduisant le
 * logo à ~70% du canevas avant de le centrer sur la taille finale.
 */
export function sizedMaskableIcon(logoUrl: string, size: number): string | null {
  if (!logoUrl.includes("/upload/")) return null;
  const inner = Math.round(size * 0.7);
  return logoUrl.replace(
    "/upload/",
    `/upload/w_${inner},h_${inner},c_pad,b_auto/w_${size},h_${size},c_pad,b_auto/`
  );
}
