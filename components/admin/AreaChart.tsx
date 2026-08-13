"use client";

import { useId, useState } from "react";

/** Graphique en aire responsive (SVG fait main, pas de dépendance externe) avec info-bulle au survol. */
export function AreaChart({
  values,
  labels,
  color = "#ff6b4a",
}: {
  /** Valeurs du plus ancien au plus récent. */
  values: number[];
  /** Étiquettes de même longueur que values (dates courtes). */
  labels: string[];
  color?: string;
}) {
  const gradientId = useId();
  const [hover, setHover] = useState<number | null>(null);

  if (values.length < 2) return <p className="text-sm text-ink-muted">Pas encore assez de données.</p>;

  const width = 600;
  const height = 220;
  const padding = 28;
  const max = Math.max(...values, 1);
  const min = 0;
  const range = max - min || 1;

  const stepX = (width - padding * 2) / (values.length - 1);
  const points = values.map((v, i) => {
    const x = padding + i * stepX;
    const y = height - padding - ((v - min) / range) * (height - padding * 2);
    return { x, y, v };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

  const yTicks = 4;
  const rawStep = max / yTicks;
  const step = Math.max(1, Math.round(rawStep));
  const tickValues: number[] = [];
  for (let v = 0; v <= max; v += step) tickValues.push(v);
  if (tickValues[tickValues.length - 1] !== max) tickValues.push(max);

  // N'affiche qu'une poignée d'étiquettes sur l'axe X pour éviter le chevauchement.
  const labelEvery = Math.max(1, Math.ceil(values.length / 6));

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>

      {tickValues.map((tick, i) => {
        const y = height - padding - (tick / max) * (height - padding * 2);
        return (
          <g key={i}>
            <line x1={padding} x2={width - padding} y1={y} y2={y} stroke="currentColor" className="text-border" strokeWidth={1} />
            <text x={padding - 8} y={y + 3} textAnchor="end" fontSize={11} className="fill-ink-muted">
              {tick}
            </text>
          </g>
        );
      })}

      <path d={areaPath} fill={`url(#${gradientId})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

      {points.map((p, i) => (
        <g key={i}>
          <rect
            x={p.x - stepX / 2}
            y={0}
            width={stepX}
            height={height}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover((h) => (h === i ? null : h))}
          />
          {hover === i && (
            <>
              <line x1={p.x} x2={p.x} y1={padding} y2={height - padding} stroke="currentColor" className="text-border" strokeDasharray="3 3" />
              <circle cx={p.x} cy={p.y} r={4} fill={color} stroke="white" strokeWidth={1.5} />
              <g transform={`translate(${Math.min(Math.max(p.x, padding + 20), width - padding - 20)}, ${Math.max(p.y - 14, 12)})`}>
                <rect x={-16} y={-12} width={32} height={18} rx={5} className="fill-ink" />
                <text x={0} y={1} textAnchor="middle" fontSize={11} className="fill-base font-medium">
                  {p.v}
                </text>
              </g>
            </>
          )}
        </g>
      ))}

      {labels.map((label, i) =>
        i % labelEvery === 0 ? (
          <text key={i} x={points[i].x} y={height - 6} textAnchor="middle" fontSize={11} className="fill-ink-muted">
            {label}
          </text>
        ) : null
      )}
    </svg>
  );
}
