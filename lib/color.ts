/**
 * Petite boîte à outils couleur, sans dépendance.
 *
 * Elle sert au thème personnalisable : quand quelqu'un choisit un fond et
 * une couleur d'accent, tout le reste de la palette (surface, bordure,
 * encre, encre atténuée, survol) en est déduit — et surtout vérifié. Un
 * accent corail sur un fond crème ne fait que 2,7:1 : joli dans le
 * sélecteur, illisible sur la page. Les fonctions de contraste d'ici sont
 * ce qui empêche de publier ce genre de thème.
 */

export type RGB = { r: number; g: number; b: number };

export const NOIR: RGB = { r: 0, g: 0, b: 0 };
export const BLANC: RGB = { r: 255, g: 255, b: 255 };

/** Accepte « #RGB », « #RRGGBB » et la même chose sans dièse. */
export function hexEnRgb(hex: string): RGB | null {
  // Cette fonction est le point d entrée de toute couleur venue d ailleurs —
  // base, formulaire, stockage local. Une valeur manquante y arrive donc
  // pour de vrai, et doit repartir en « null », pas en exception.
  if (typeof hex !== "string") return null;
  const brut = hex.trim().replace(/^#/, "");
  const complet = brut.length === 3 ? brut.replace(/./g, (c) => c + c) : brut;
  if (!/^[0-9a-fA-F]{6}$/.test(complet)) return null;
  return {
    r: parseInt(complet.slice(0, 2), 16),
    g: parseInt(complet.slice(2, 4), 16),
    b: parseInt(complet.slice(4, 6), 16),
  };
}

export function rgbEnHex({ r, g, b }: RGB): string {
  const part = (v: number) => Math.round(borner(v, 0, 255)).toString(16).padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`.toUpperCase();
}

/** Format attendu par Tailwind : « 255 107 74 », sans « rgb() ». */
export function triplet({ r, g, b }: RGB): string {
  return `${Math.round(borner(r, 0, 255))} ${Math.round(borner(g, 0, 255))} ${Math.round(borner(b, 0, 255))}`;
}

function borner(valeur: number, min: number, max: number) {
  return Math.min(max, Math.max(min, valeur));
}

/** Mélange linéaire : `poids` = part de `b` dans le résultat. */
export function melange(a: RGB, b: RGB, poids: number): RGB {
  const p = borner(poids, 0, 1);
  return {
    r: a.r + (b.r - a.r) * p,
    g: a.g + (b.g - a.g) * p,
    b: a.b + (b.b - a.b) * p,
  };
}

/** Luminance relative WCAG — 0 pour le noir, 1 pour le blanc. */
export function luminance({ r, g, b }: RGB): number {
  const canal = (v: number) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

/** Rapport de contraste WCAG entre deux couleurs opaques (1 à 21). */
export function contraste(a: RGB, b: RGB): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Un fond sur lequel il faut écrire en clair plutôt qu'en foncé. */
export function estFondSombre(fond: RGB): boolean {
  return luminance(fond) < 0.35;
}

/**
 * Éloigne `couleur` de `fond` jusqu'à atteindre le rapport demandé.
 *
 * On l'éclaircit sur un fond sombre, on l'assombrit sur un fond clair, par
 * pas de 4 % vers le blanc ou le noir. Quarante pas suffisent toujours à
 * atteindre 4,5:1 : au pire on finit sur du blanc pur ou du noir pur, qui
 * l'atteignent par construction.
 */
export function assurerContraste(couleur: RGB, fond: RGB, cible = 4.5): RGB {
  if (contraste(couleur, fond) >= cible) return couleur;
  const direction = estFondSombre(fond) ? BLANC : NOIR;
  let resultat = couleur;
  for (let i = 0; i < 40 && contraste(resultat, fond) < cible; i++) {
    resultat = melange(resultat, direction, 0.04);
  }
  return resultat;
}
