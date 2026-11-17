import { useEffect, useId, useRef, useState, type MouseEvent } from "react";
import { formatNombre } from "./composants";

/*
 * Les graphiques du tableau de bord, en SVG sans bibliothèque : trois
 * formes suffisent (mini-courbe, courbe d'évolution, anneau), et chacune
 * lit ses couleurs dans les variables du thème, si bien qu'elles suivent
 * le passage du sombre au clair sans être recalculées.
 */

/** Une mini-courbe sans axe : la tendance, pas la valeur. */
export function MiniCourbe({ valeurs, couleur, hauteur = 40 }: { valeurs: number[]; couleur: string; hauteur?: number }) {
  const id = useId();
  if (valeurs.length < 2) return <div style={{ height: hauteur }} />;
  const l = 120;
  const max = Math.max(...valeurs, 1);
  const pts = valeurs.map((v, i) => [(i / (valeurs.length - 1)) * l, hauteur - 3 - (v / max) * (hauteur - 8)] as const);
  const ligne = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${l} ${hauteur}`} preserveAspectRatio="none" className="w-full" style={{ height: hauteur }} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={couleur} stopOpacity="0.28" />
          <stop offset="1" stopColor={couleur} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${ligne} L${l},${hauteur} L0,${hauteur} Z`} fill={`url(#${id})`} />
      <path d={ligne} fill="none" stroke={couleur} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** Un plafond d'axe lisible : 1, 2, 2,5 ou 5 fois une puissance de dix. */
function plafond(max: number) {
  if (max <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= max) return m * p;
  return 10 * p;
}

function useLargeur<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [largeur, setLargeur] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const o = new ResizeObserver(([e]) => setLargeur(e.contentRect.width));
    o.observe(ref.current);
    return () => o.disconnect();
  }, []);
  return [ref, largeur] as const;
}

const jourCourt = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
const jourLong = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

/** La courbe d'évolution, avec réticule et infobulle au survol. */
export function CourbeAire({ serie, hauteur = 260, unite = "écoutes" }: { serie: { date: string; plays: number }[]; hauteur?: number; unite?: string }) {
  const [ref, largeur] = useLargeur<HTMLDivElement>();
  const [survol, setSurvol] = useState<number | null>(null);
  const id = useId();
  const g = 44;
  const b = 28;
  const h = 8;
  const zoneL = Math.max(0, largeur - g - 8);
  const zoneH = hauteur - b - h;
  const max = plafond(Math.max(0, ...serie.map((p) => p.plays)));
  const x = (i: number) => g + (serie.length > 1 ? (i / (serie.length - 1)) * zoneL : zoneL / 2);
  const y = (v: number) => h + zoneH - (v / max) * zoneH;
  const ligne = serie.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.plays).toFixed(1)}`).join(" ");
  const graduations = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const pasEtiquette = Math.max(1, Math.ceil(serie.length / 7));
  const point = survol !== null ? serie[survol] : null;

  function deplacer(e: MouseEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left - g;
    if (serie.length === 0 || px < -10) return setSurvol(null);
    setSurvol(Math.min(serie.length - 1, Math.max(0, Math.round((px / zoneL) * (serie.length - 1)))));
  }

  return (
    <div ref={ref} className="relative" style={{ height: hauteur }}>
      {largeur > 0 && (
        <svg width={largeur} height={hauteur} onMouseMove={deplacer} onMouseLeave={() => setSurvol(null)} role="img" aria-label={`Évolution des ${unite}`}>
          <defs>
            <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="var(--accent)" stopOpacity="0.32" />
              <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {graduations.map((v) => (
            <g key={v}>
              <line x1={g} x2={largeur - 8} y1={y(v)} y2={y(v)} stroke="var(--filet)" strokeDasharray={v === 0 ? undefined : "3 4"} />
              <text x={g - 10} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--texte-3)">
                {v >= 1000 ? `${Math.round(v / 100) / 10} k` : Math.round(v)}
              </text>
            </g>
          ))}
          {serie.map((p, i) =>
            i % pasEtiquette === 0 || i === serie.length - 1 ? (
              <text key={p.date} x={x(i)} y={hauteur - 8} textAnchor={i === 0 ? "start" : i === serie.length - 1 ? "end" : "middle"} fontSize="11" fill="var(--texte-3)">
                {jourCourt(p.date)}
              </text>
            ) : null,
          )}
          {serie.length > 1 && (
            <>
              <path d={`${ligne} L${x(serie.length - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill={`url(#${id})`} />
              <path d={ligne} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            </>
          )}
          {point && survol !== null && (
            <>
              <line x1={x(survol)} x2={x(survol)} y1={h} y2={y(0)} stroke="var(--texte-3)" strokeDasharray="3 3" />
              <circle cx={x(survol)} cy={y(point.plays)} r="5" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2" />
            </>
          )}
        </svg>
      )}
      {point && survol !== null && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg border border-filet bg-surface-2 px-3 py-2 text-[12px] shadow-lg shadow-black/20"
          style={{ left: Math.min(x(survol) + 12, largeur - 170), top: Math.max(0, y(point.plays) - 58) }}
        >
          <div className="text-texte-3 first-letter:uppercase">{jourLong(point.date)}</div>
          <div className="mt-0.5 font-semibold tabular-nums">
            {formatNombre(point.plays)} {unite}
          </div>
        </div>
      )}
    </div>
  );
}

/** L'anneau de répartition : un segment par part, séparés d'un filet de la couleur du fond. */
export function Anneau({ parts, taille = 172, epaisseur = 24, legendeCentre }: { parts: { libelle: string; valeur: number; couleur: string }[]; taille?: number; epaisseur?: number; legendeCentre: string }) {
  const [survol, setSurvol] = useState<number | null>(null);
  const total = parts.reduce((s, p) => s + p.valeur, 0);
  const r = (taille - epaisseur) / 2;
  const c = 2 * Math.PI * r;
  let cumul = 0;
  const actif = survol !== null ? parts[survol] : null;
  return (
    <div className="relative shrink-0" style={{ width: taille, height: taille }}>
      <svg width={taille} height={taille} className="-rotate-90" role="img" aria-label="Répartition">
        <circle cx={taille / 2} cy={taille / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={epaisseur} />
        {total > 0 &&
          parts.map((p, i) => {
            const longueur = (p.valeur / total) * c;
            const debut = cumul;
            cumul += longueur;
            const visible = Math.max(0, longueur - (parts.length > 1 ? 2 : 0));
            return (
              <circle
                key={p.libelle}
                cx={taille / 2}
                cy={taille / 2}
                r={r}
                fill="none"
                stroke={p.couleur}
                strokeWidth={survol === i ? epaisseur + 4 : epaisseur}
                strokeDasharray={`${visible} ${c - visible}`}
                strokeDashoffset={-debut}
                onMouseEnter={() => setSurvol(i)}
                onMouseLeave={() => setSurvol(null)}
                className="cursor-default transition-[stroke-width] duration-150"
              />
            );
          })}
      </svg>
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="font-titre text-[22px] font-semibold tabular-nums">{actif ? `${Math.round((actif.valeur / total) * 100)} %` : formatNombre(total)}</div>
          <div className="max-w-[100px] truncate text-[11px] text-texte-3">{actif ? actif.libelle : legendeCentre}</div>
        </div>
      </div>
    </div>
  );
}
