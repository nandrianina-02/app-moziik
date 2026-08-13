import { Switch } from "@/components/ui/Switch";

/**
 * Interrupteur on/off réutilisable (statut actif, filtres vérifiés, etc.).
 * Fine enveloppe autour de `Switch` (même composant visuel que le reste de
 * l'app) qui conserve l'API existante — `onChange` sans argument — pour ne
 * casser aucun appel existant côté admin.
 */
export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: () => void;
  label?: string;
  disabled?: boolean;
}) {
  return <Switch checked={checked} onChange={onChange} label={label} disabled={disabled} />;
}
