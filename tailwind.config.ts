import type { Config } from "tailwindcss";

// Système de tokens Moziik
// Palette pensée comme un coucher de soleil sur l'océan Indien :
// fond indigo profond, accent corail (action / lecture), accent
// émeraude réservé aux statuts de vérification et de succès.
const config: Config = {
  darkMode: "class",
  // context/ doit etre scanne au meme titre que les deux autres :
  // ToastProvider y rend la pile de notifications. Absent de cette liste,
  // ses classes n'etaient jamais generees — la pile se retrouvait en
  // position: fixed SANS decalage "bottom", donc rejetee a sa position
  // statique en fin de document, hors de l'ecran. Aucune notification
  // n'etait visible nulle part dans l'application.
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./context/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      screens: {
        // Les plus petits téléphones encore courants font 320 px. Ce
        // palier laisse masquer les commandes secondaires là, sans
        // pénaliser un 375 px qui a la place de les afficher.
        xs: "360px",
      },
      colors: {
        // Chaque token pointe vers une variable CSS définie dans
        // globals.css (valeurs sombres par défaut, redéfinies sous
        // html.light). Ainsi bg-surface / text-ink / border-border
        // etc. réagissent au thème PARTOUT dans l'app automatiquement,
        // sans avoir à écrire de variante -light sur chaque composant.
        base: {
          DEFAULT: "rgb(var(--color-base) / <alpha-value>)",
        },
        surface: {
          DEFAULT: "rgb(var(--color-surface) / <alpha-value>)",
        },
        border: {
          DEFAULT: "rgb(var(--color-border) / <alpha-value>)",
        },
        ink: {
          DEFAULT: "rgb(var(--color-ink) / <alpha-value>)",
          muted: "rgb(var(--color-ink-muted) / <alpha-value>)",
        },
        // L'accent et l'émeraude étaient les deux seuls tokens figés :
        // même valeur dans les deux thèmes, donc illisibles en clair.
        // Ils suivent désormais le même mécanisme que le reste.
        accent: {
          DEFAULT: "rgb(var(--color-accent) / <alpha-value>)", // corail — actions primaires, lecture
          hover: "rgb(var(--color-accent-hover) / <alpha-value>)",
        },
        verified: {
          DEFAULT: "rgb(var(--color-verified) / <alpha-value>)", // émeraude — badges vérifiés, succès
        },
        // États sémantiques, à préférer aux nuances Tailwind brutes
        // (text-red-500 & co. ne conviennent qu'à un seul des deux fonds).
        danger: {
          DEFAULT: "rgb(var(--color-danger) / <alpha-value>)",
        },
        warning: {
          DEFAULT: "rgb(var(--color-warning) / <alpha-value>)",
        },
        info: {
          DEFAULT: "rgb(var(--color-info) / <alpha-value>)",
        },
        // Teintes catégorielles des pastilles d'icônes (tableaux de bord,
        // cartes de statistiques) — décoratives, mais qui doivent rester
        // visibles sur les deux fonds.
        tint: {
          violet: "rgb(var(--tint-violet) / <alpha-value>)",
          cyan: "rgb(var(--tint-cyan) / <alpha-value>)",
          lime: "rgb(var(--tint-lime) / <alpha-value>)",
          sky: "rgb(var(--tint-sky) / <alpha-value>)",
          teal: "rgb(var(--tint-teal) / <alpha-value>)",
          orange: "rgb(var(--tint-orange) / <alpha-value>)",
          pink: "rgb(var(--tint-pink) / <alpha-value>)",
          indigo: "rgb(var(--tint-indigo) / <alpha-value>)",
          emerald: "rgb(var(--tint-emerald) / <alpha-value>)",
          fuchsia: "rgb(var(--tint-fuchsia) / <alpha-value>)",
          amber: "rgb(var(--tint-amber) / <alpha-value>)",
          rose: "rgb(var(--tint-rose) / <alpha-value>)",
          blue: "rgb(var(--tint-blue) / <alpha-value>)",
          slate: "rgb(var(--tint-slate) / <alpha-value>)",
        },
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
        mono: ["var(--font-mono)"],
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      keyframes: {
        eq: {
          "0%, 100%": { transform: "scaleY(0.3)" },
          "50%": { transform: "scaleY(1)" },
        },
      },
      animation: {
        eq1: "eq 0.9s ease-in-out infinite",
        eq2: "eq 0.9s ease-in-out infinite 0.2s",
        eq3: "eq 0.9s ease-in-out infinite 0.4s",
      },
    },
  },
  plugins: [],
};

export default config;
