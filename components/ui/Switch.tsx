"use client";

/**
 * Interrupteur on/off réutilisable (contenu explicite, options binaires...).
 * Purement contrôlé — aucun état interne — pour s'intégrer proprement à
 * react-hook-form via <Controller>.
 */
export function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${
        checked ? "bg-accent" : "bg-border"
      }`}
    >
      {/* Pastille en bg-ink, pas en blanc : blanche, elle se confondait
          avec le rail bg-border du thème clair (#FFF sur #E7E3D8, soit
          1,1:1). En bg-ink elle reste blanc cassé sur fond sombre — aspect
          inchangé — et devient encre sur fond clair. */}
      <span
        className={`inline-block h-4.5 w-4.5 transform rounded-full bg-ink shadow-sm transition-transform duration-200 ${
          checked ? "translate-x-[22px]" : "translate-x-1"
        }`}
      />
    </button>
  );
}
