"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Moon, Sun } from "lucide-react";
import {
  PRESET_PERSONNALISE,
  THEME_PRESETS,
  couleursDe,
  themeVariables,
  type ThemeMode,
  type ThemePreference,
} from "@/lib/theme";
import { contraste, hexEnRgb } from "@/lib/color";

/**
 * L'éditeur de thème, partagé par l'administration (thème du site) et les
 * membres Premium (thème personnel). Un seul écran, deux portées : ce que
 * l'un règle pour tout le monde, l'autre le règle pour lui.
 *
 * Le composant ne connaît ni l'API ni les droits — il reçoit une valeur,
 * en renvoie une autre. Qui a le droit d'enregistrer, et où, se décide
 * ailleurs.
 */
export function ThemeEditor({
  value,
  onChange,
  disabled = false,
}: {
  value: ThemePreference;
  onChange: (theme: ThemePreference) => void;
  disabled?: boolean;
}) {
  const modifier = (patch: Partial<ThemePreference>) => {
    if (disabled) return;
    onChange({ ...value, ...patch });
  };

  const { accent, background } = couleursDe(value, value.mode);
  const personnalise = value.preset === PRESET_PERSONNALISE;
  const cleFond = value.mode === "light" ? "backgroundLight" : "backgroundDark";

  // Ce que donnera réellement le thème, une fois le contraste garanti.
  const variables = useMemo(() => themeVariables(value, value.mode), [value]);
  const accentApplique = `rgb(${variables["--color-accent"].split(" ").join(",")})`;

  // L'accent choisi a-t-il dû être corrigé pour rester lisible ?
  const accentAjuste = useMemo(() => {
    const choisi = hexEnRgb(accent);
    const fond = hexEnRgb(background);
    if (!choisi || !fond) return false;
    return contraste(choisi, fond) < 4.5;
  }, [accent, background]);

  return (
    <div className="space-y-6">
      {/* Mode */}
      <div>
        <p className="mb-2 text-sm font-medium text-ink">Mode</p>
        <div className="flex gap-2">
          <BoutonMode
            actif={value.mode === "dark"}
            onClick={() => modifier({ mode: "dark" })}
            icon={Moon}
            label="Sombre"
            disabled={disabled}
          />
          <BoutonMode
            actif={value.mode === "light"}
            onClick={() => modifier({ mode: "light" })}
            icon={Sun}
            label="Clair"
            disabled={disabled}
          />
        </div>
      </div>

      {/* Préréglages */}
      <div>
        <p className="mb-2 text-sm font-medium text-ink">Thème</p>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {THEME_PRESETS.map((preset) => (
            <CartePreset
              key={preset.id}
              label={preset.label}
              accent={preset.accent}
              fond={value.mode === "light" ? preset.backgroundLight : preset.backgroundDark}
              actif={value.preset === preset.id}
              onClick={() => modifier({ preset: preset.id })}
              disabled={disabled}
            />
          ))}
          <CartePreset
            label="Personnalisé"
            accent={value.accent}
            fond={value[cleFond]}
            actif={personnalise}
            onClick={() => modifier({ preset: PRESET_PERSONNALISE })}
            disabled={disabled}
          />
        </div>
      </div>

      {/* Couleurs libres */}
      {personnalise && (
        <div className="grid gap-4 sm:grid-cols-2">
          <ChampCouleur
            label="Couleur d'accent"
            aide="Boutons, liens, lecture en cours."
            value={value.accent}
            onChange={(accent) => modifier({ accent })}
            disabled={disabled}
          />
          <ChampCouleur
            label={value.mode === "light" ? "Fond (mode clair)" : "Fond (mode sombre)"}
            aide="Surfaces, bordures et encre en sont déduites."
            value={value[cleFond]}
            onChange={(couleur) => modifier({ [cleFond]: couleur } as Partial<ThemePreference>)}
            disabled={disabled}
          />
        </div>
      )}

      {accentAjuste && (
        <p className="flex items-start gap-2 rounded-xl border border-border bg-base/60 p-3 text-xs text-ink-muted">
          <span className="mt-0.5 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: accentApplique }} />
          Cette couleur d&apos;accent manquait de contraste sur ce fond : elle est appliquée légèrement ajustée,
          pour que les boutons et les liens restent lisibles.
        </p>
      )}

      {/* Aperçu — les variables sont posées sur ce bloc seulement, il montre
          donc le thème visé même quand la page autour n'a pas changé. */}
      <div>
        <p className="mb-2 text-sm font-medium text-ink">Aperçu</p>
        <div
          style={variables as React.CSSProperties}
          className="rounded-xl2 border border-border bg-base p-4 text-ink"
        >
          <div className="rounded-xl border border-border bg-surface p-4">
            <p className="text-sm font-semibold text-ink">Titre du morceau</p>
            <p className="mt-0.5 text-xs text-ink-muted">Artiste · Afrobeat · 3:45</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-accent px-3.5 py-1.5 text-xs font-semibold text-base">Écouter</span>
              <span className="rounded-full border border-border px-3.5 py-1.5 text-xs font-medium text-ink">
                Ajouter
              </span>
              <span className="rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">Premium</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BoutonMode({
  actif,
  onClick,
  icon: Icon,
  label,
  disabled,
}: {
  actif: boolean;
  onClick: () => void;
  icon: typeof Moon;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={actif}
      className={`flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-60 ${
        actif ? "border-accent bg-accent/10 text-accent" : "border-border text-ink-muted hover:text-ink"
      }`}
    >
      <Icon size={15} /> {label}
    </button>
  );
}

function CartePreset({
  label,
  accent,
  fond,
  actif,
  onClick,
  disabled,
}: {
  label: string;
  accent: string;
  fond: string;
  actif: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={actif}
      className={`flex items-center gap-3 rounded-2xl border p-2.5 text-left transition-colors disabled:opacity-60 ${
        actif ? "border-accent" : "border-border hover:border-ink-muted"
      }`}
    >
      {/* La pastille montre le fond et l'accent ensemble : c'est ce couple
          qui fait l'identité d'un thème, pas la couleur d'accent seule. */}
      <span
        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-border"
        style={{ backgroundColor: fond }}
      >
        <span className="h-4 w-4 rounded-full" style={{ backgroundColor: accent }} />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{label}</span>
      {actif && <Check size={15} className="shrink-0 text-accent" />}
    </button>
  );
}

function ChampCouleur({
  label,
  aide,
  value,
  onChange,
  disabled,
}: {
  label: string;
  aide: string;
  value: string;
  onChange: (couleur: string) => void;
  disabled?: boolean;
}) {
  const [brouillon, setBrouillon] = useState(value);
  useEffect(() => {
    setBrouillon(value);
  }, [value]);

  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      <span className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          disabled={disabled}
          aria-label={label}
          className="h-10 w-12 shrink-0 cursor-pointer rounded-xl border border-border bg-surface disabled:opacity-60"
        />
        {/* La saisie texte double le sélecteur : elle seule permet de coller
            un code de charte graphique, et de le relire. Elle garde son
            propre brouillon — « #FF » est une étape normale de la frappe,
            mais ce n'est pas une couleur, et le thème ne doit jamais la
            recevoir. */}
        <input
          type="text"
          value={brouillon}
          onChange={(e) => {
            const saisi = e.target.value.trim().toUpperCase();
            if (!/^#?[0-9A-F]{0,6}$/.test(saisi)) return;
            const avecDiese = saisi.startsWith("#") ? saisi : `#${saisi}`;
            setBrouillon(avecDiese);
            if (/^#[0-9A-F]{6}$/.test(avecDiese)) onChange(avecDiese);
          }}
          onBlur={() => setBrouillon(value)}
          disabled={disabled}
          spellCheck={false}
          className="w-full rounded-xl border border-border bg-surface px-3 py-2 font-mono text-sm outline-none focus:border-accent disabled:opacity-60"
        />
      </span>
      <span className="mt-1 block text-xs text-ink-muted">{aide}</span>
    </label>
  );
}
