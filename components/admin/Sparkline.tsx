/** Mini courbe SVG sans axes, utilisée dans les cartes de stats du dashboard admin. */
export function Sparkline({ values, color = "rgb(var(--color-accent))" }: { values: number[]; color?: string }) {
  if (values.length < 2) return null;

  const width = 100;
  const height = 32;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-8 w-24 overflow-visible">
      <polyline points={points.join(" ")} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
