import {
  BLANC,
  NOIR,
  assurerContraste,
  estFondSombre,
  hexEnRgb,
  melange,
  triplet,
  type RGB,
} from "@/lib/color";

/**
 * Le thème, de bout en bout.
 *
 * Un thème tient en quatre choix : un mode (sombre ou clair), une couleur
 * d'accent et un fond par mode. Tout le reste de la palette — surface,
 * bordure, encre, encre atténuée, survol de l'accent — en est déduit ici,
 * et vérifié pour le contraste. C'est ce qui permet d'ouvrir la
 * personnalisation sans ouvrir la porte aux pages illisibles.
 *
 * Le résultat est un jeu de variables CSS posées sur <html>. Comme tous les
 * jetons Tailwind du projet s'écrivent `rgb(var(--color-x) / <alpha>)`, il
 * n'y a rien d'autre à faire : la page entière change de couleur sans
 * qu'une seule classe soit réécrite.
 */

export type ThemeMode = "dark" | "light";

export type ThemePreference = {
  /** Identifiant d'un préréglage, ou "custom" pour des couleurs libres. */
  preset: string;
  /** Mode appliqué à la première visite ; l'interrupteur du site peut en changer ensuite. */
  mode: ThemeMode;
  /** Couleurs libres — ignorées tant que `preset` n'est pas "custom". */
  accent: string;
  backgroundDark: string;
  backgroundLight: string;
};

export type ThemePreset = {
  id: string;
  label: string;
  accent: string;
  backgroundDark: string;
  backgroundLight: string;
};

export const PRESET_PERSONNALISE = "custom";

/**
 * Les préréglages. Le premier reprend exactement la palette d'origine du
 * site — corail sur indigo profond — pour que « thème par défaut » veuille
 * dire la même chose qu'avant l'arrivée de cet écran.
 */
export const THEME_PRESETS: ThemePreset[] = [
  { id: "moziik", label: "Moziik", accent: "#FF6B4A", backgroundDark: "#0D0F1A", backgroundLight: "#FBF9F4" },
  { id: "ocean", label: "Océan", accent: "#38BDF8", backgroundDark: "#0A1220", backgroundLight: "#F4F9FF" },
  { id: "emeraude", label: "Émeraude", accent: "#34D399", backgroundDark: "#08150F", backgroundLight: "#F3FBF6" },
  { id: "violet", label: "Violet", accent: "#A78BFA", backgroundDark: "#110E1E", backgroundLight: "#F8F6FF" },
  { id: "rubis", label: "Rubis", accent: "#FB7185", backgroundDark: "#170C11", backgroundLight: "#FFF5F7" },
  { id: "or", label: "Or", accent: "#FBBF24", backgroundDark: "#14110A", backgroundLight: "#FFFAF0" },
  { id: "ardoise", label: "Ardoise", accent: "#94A3B8", backgroundDark: "#0F1216", backgroundLight: "#F6F7F8" },
];

export const THEME_PAR_DEFAUT: ThemePreference = {
  preset: "moziik",
  mode: "dark",
  accent: "#FF6B4A",
  backgroundDark: "#0D0F1A",
  backgroundLight: "#FBF9F4",
};

/** Encres de référence, reprises de la palette d'origine. */
const ENCRE_CLAIRE: RGB = { r: 242, g: 240, b: 233 }; // #F2F0E9
const ENCRE_SOMBRE: RGB = { r: 23, g: 26, b: 36 }; // #171A24

/** Les couleurs réellement appliquées, préréglage ou choix libres. */
export function couleursDe(pref: ThemePreference, mode: ThemeMode): { accent: string; background: string } {
  const preset = THEME_PRESETS.find((p) => p.id === pref.preset);
  const source = preset ?? pref;
  return {
    accent: source.accent,
    background: mode === "light" ? source.backgroundLight : source.backgroundDark,
  };
}

/**
 * Le fond appliqué est-il sombre ?
 *
 * C'est la luminance qui tranche, pas le mode déclaré : quelqu'un peut très
 * bien choisir un fond clair pour son « mode sombre ». Ce qui compte, c'est
 * l'encre à poser dessus et le jeu de couleurs sémantiques (erreur,
 * succès, pastilles) à utiliser — d'où la classe `light` sur <html>.
 */
export function fondSombre(pref: ThemePreference, mode: ThemeMode): boolean {
  const { background } = couleursDe(pref, mode);
  const fond = hexEnRgb(background);
  return fond ? estFondSombre(fond) : mode === "dark";
}

/**
 * Les sept variables CSS qui portent le thème.
 *
 * Les autres (sémantiques, teintes catégorielles) restent dans globals.css :
 * elles ont deux jeux, sombre et clair, et la classe `light` choisit le bon.
 */
export function themeVariables(pref: ThemePreference, mode: ThemeMode): Record<string, string> {
  const { accent, background } = couleursDe(pref, mode);
  const base = hexEnRgb(background) ?? hexEnRgb(THEME_PAR_DEFAUT.backgroundDark)!;
  const sombre = estFondSombre(base);

  // Une surface se détache toujours du fond en s'en éclaircissant — c'est
  // ce que faisait la palette d'origine dans les deux thèmes (#0D0F1A vers
  // #161927, #FBF9F4 vers le blanc). La bordure, elle, s'éloigne dans le
  // sens où elle reste visible : plus claire sur du sombre, plus foncée sur
  // du clair.
  const surface = melange(base, BLANC, sombre ? 0.05 : 0.6);
  const border = sombre ? melange(base, BLANC, 0.12) : melange(base, NOIR, 0.09);

  const encre = sombre ? ENCRE_CLAIRE : ENCRE_SOMBRE;
  // L'encre atténuée est du texte courant : elle doit tenir 4,5:1 sur le
  // fond, sinon elle n'est « atténuée » que pour ceux qui voient bien.
  const encreMuted = assurerContraste(melange(encre, base, 0.45), base, 4.5);

  const accentRgb = hexEnRgb(accent) ?? hexEnRgb(THEME_PAR_DEFAUT.accent)!;
  const accentLisible = accentAjuste(accentRgb, base);
  const accentHover = sombre ? melange(accentLisible, BLANC, 0.15) : melange(accentLisible, NOIR, 0.2);

  return {
    "--color-base": triplet(base),
    "--color-surface": triplet(surface),
    "--color-border": triplet(border),
    "--color-ink": triplet(encre),
    "--color-ink-muted": triplet(encreMuted),
    "--color-accent": triplet(accentLisible),
    "--color-accent-hover": triplet(accentHover),
  };
}

/**
 * L'accent, rendu lisible.
 *
 * Deux fonds à satisfaire, pas un : la page elle-même, et sa propre teinte
 * à 15 % — le motif « text-accent sur bg-accent/15 » des pastilles et des
 * encarts, qui est le cas dimensionnant. Corriger le second déplace le
 * premier, d'où les deux passes.
 */
function accentAjuste(accent: RGB, base: RGB): RGB {
  let resultat = assurerContraste(accent, base, 4.5);
  for (let i = 0; i < 2; i++) {
    const teinte = melange(base, resultat, 0.15);
    resultat = assurerContraste(resultat, teinte, 4.5);
  }
  return resultat;
}

/**
 * Relit une préférence venue de la base, d'une API ou du stockage local.
 *
 * Rien de ce qui arrive ici n'est digne de confiance : un document écrit
 * par une version précédente, une clé de localStorage bricolée à la main,
 * une réponse tronquée. Tout champ douteux retombe sur le thème par défaut
 * plutôt que de peindre la page en couleurs impossibles.
 */
export function normaliserTheme(valeur: unknown, repli: ThemePreference = THEME_PAR_DEFAUT): ThemePreference {
  const brut = (valeur ?? {}) as Partial<ThemePreference>;
  const presetConnu =
    typeof brut.preset === "string" &&
    (brut.preset === PRESET_PERSONNALISE || THEME_PRESETS.some((p) => p.id === brut.preset));

  const couleur = (v: unknown, defaut: string) =>
    typeof v === "string" && hexEnRgb(v) ? rgbNormalise(v) : defaut;

  return {
    preset: presetConnu ? (brut.preset as string) : repli.preset,
    mode: brut.mode === "light" || brut.mode === "dark" ? brut.mode : repli.mode,
    accent: couleur(brut.accent, repli.accent),
    backgroundDark: couleur(brut.backgroundDark, repli.backgroundDark),
    backgroundLight: couleur(brut.backgroundLight, repli.backgroundLight),
  };
}

/** Ramène « fff » ou « #FfF0e9 » à la forme « #FFF0E9 ». */
function rgbNormalise(hex: string): string {
  const rgb = hexEnRgb(hex);
  if (!rgb) return hex;
  const part = (v: number) => Math.round(v).toString(16).padStart(2, "0");
  return `#${part(rgb.r)}${part(rgb.g)}${part(rgb.b)}`.toUpperCase();
}
