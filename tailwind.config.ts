import type { Config } from "tailwindcss";

// Système de tokens Moziik
// Palette pensée comme un coucher de soleil sur l'océan Indien :
// fond indigo profond, accent corail (action / lecture), accent
// émeraude réservé aux statuts de vérification et de succès.
const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
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
        accent: {
          DEFAULT: "#FF6B4A", // corail — actions primaires, lecture
          hover: "#FF8267",
        },
        verified: {
          DEFAULT: "#3DDC97", // émeraude — badges vérifiés, succès
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
        "toast-in": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        eq1: "eq 0.9s ease-in-out infinite",
        eq2: "eq 0.9s ease-in-out infinite 0.2s",
        eq3: "eq 0.9s ease-in-out infinite 0.4s",
        "toast-in": "toast-in 0.2s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
