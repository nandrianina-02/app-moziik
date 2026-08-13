// Signature visuelle de Moziik : trois barres animées façon égaliseur.
// Utilisé comme loader, indicateur "en cours de lecture" sur SongRow,
// et accent décoratif discret dans les en-têtes de section.

export function EqualizerLoader({ size = "md" }: { size?: "sm" | "md" }) {
  const height = size === "sm" ? "h-3" : "h-5";
  return (
    <span
      className={`inline-flex items-end gap-[3px] ${height}`}
      role="status"
      aria-label="Lecture en cours"
    >
      <span className="w-[3px] h-full origin-bottom rounded-sm bg-accent animate-eq1" />
      <span className="w-[3px] h-full origin-bottom rounded-sm bg-accent animate-eq2" />
      <span className="w-[3px] h-full origin-bottom rounded-sm bg-accent animate-eq3" />
    </span>
  );
}
