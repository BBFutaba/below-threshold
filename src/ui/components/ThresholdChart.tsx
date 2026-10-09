// Logical error rate (log scale) against physical error rate, one line per distance,
// with 95% Wilson confidence bands and a draggable noise marker.

import { useRef, type PointerEvent as RPointerEvent } from 'react';
import { scaleLinear, scaleLog } from 'd3-scale';
import css from './ThresholdChart.module.css';

export interface ChartPoint {
  p: number;
  pL: number;
  lo: number;
  hi: number;
}

export interface ChartSeries {
  key: string;
  d: number;
  points: ChartPoint[];
  dashed?: boolean;
  label: string;
}

export const DIST_COLORS: Record<number, string> = {
  3: 'var(--blue)',
  5: 'var(--teal)',
  7: 'var(--violet)',
  9: 'var(--amber)',
  11: 'var(--coral)',
};

export function ThresholdChart({
  series,
  xDomain,
  marker,
  onMarker,
  yLabel = 'logical error rate',
  xLabel = 'physical error rate p',
  crossing,
}: {
  series: ChartSeries[];
  xDomain: [number, number];
  marker?: number;
  onMarker?: (p: number) => void;
  yLabel?: string;
  xLabel?: string;
  crossing?: number | null;
}) {
  const W = 640,
    H = 380,
    m = { l: 58, r: 18, t: 16, b: 46 };
  const all = series.flatMap((s) => s.points).filter((p) => p.pL > 0);
  const yMin = Math.max(1e-5, Math.min(1e-2, ...all.map((p) => Math.max(p.lo, p.pL / 4)).filter((v) => v > 0)) * 0.7);
  const yMax = Math.min(1, Math.max(0.02, ...all.map((p) => p.hi)) * 1.4);
  const x = scaleLinear().domain(xDomain).range([m.l, W - m.r]);
  const y = scaleLog().domain([yMin, yMax]).range([H - m.b, m.t]).clamp(true);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);

  const toP = (clientX: number) => {
    const r = svgRef.current!.getBoundingClientRect();
    const vx = ((clientX - r.left) / r.width) * W;
    return Math.max(xDomain[0], Math.min(xDomain[1], x.invert(vx)));
  };
  const down = (e: RPointerEvent<SVGSVGElement>) => {
    if (!onMarker) return;
    dragging.current = true;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    onMarker(toP(e.clientX));
  };
  const move = (e: RPointerEvent<SVGSVGElement>) => {
    if (dragging.current && onMarker) onMarker(toP(e.clientX));
  };
  const up = () => (dragging.current = false);

  const yTicks = (() => {
    const out: number[] = [];
    for (let e = Math.floor(Math.log10(yMin)); e <= 0; e++) {
      const v = 10 ** e;
      if (v >= yMin && v <= yMax) out.push(v);
    }
    return out;
  })();
  const xTicks = x.ticks(6);
  const fmtP = (v: number) => `${+(v * 100).toFixed(1)}%`;

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      className={css.chart}
      role="img"
      aria-label={`Threshold chart: ${series.map((s) => `${s.label} with ${s.points.length} points`).join('; ')}`}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      {yTicks.map((v) => (
        <g key={v}>
          <line x1={m.l} x2={W - m.r} y1={y(v)} y2={y(v)} className={css.grid} />
          <text x={m.l - 8} y={y(v)} className={css.yTick}>
            {v >= 0.01 ? `${+(v * 100).toFixed(0)}%` : v.toExponential(0)}
          </text>
        </g>
      ))}
      {xTicks.map((v) => (
        <g key={v}>
          <line x1={x(v)} x2={x(v)} y1={m.t} y2={H - m.b} className={css.grid} />
          <text x={x(v)} y={H - m.b + 18} className={css.xTick}>
            {fmtP(v)}
          </text>
        </g>
      ))}
      <text x={(m.l + W - m.r) / 2} y={H - 6} className={css.axisLabel}>
        {xLabel}
      </text>
      <text x={14} y={(m.t + H - m.b) / 2} className={css.axisLabel} transform={`rotate(-90 14 ${(m.t + H - m.b) / 2})`}>
        {yLabel}
      </text>

      {series.map((s) => {
        const pts = [...s.points].filter((p) => p.pL > 0).sort((a, b) => a.p - b.p);
        if (!pts.length) return null;
        const color = DIST_COLORS[s.d] ?? 'var(--text)';
        const band =
          pts.length > 1
            ? `M ${pts.map((p) => `${x(p.p)},${y(Math.max(p.hi, yMin))}`).join(' L ')} L ${[...pts]
                .reverse()
                .map((p) => `${x(p.p)},${y(Math.max(p.lo, yMin))}`)
                .join(' L ')} Z`
            : '';
        return (
          <g key={s.key}>
            {!s.dashed && band && <path d={band} fill={color} opacity={0.14} />}
            <polyline
              points={pts.map((p) => `${x(p.p)},${y(p.pL)}`).join(' ')}
              fill="none"
              stroke={color}
              strokeWidth={s.dashed ? 1.5 : 2.4}
              strokeDasharray={s.dashed ? '5 4' : undefined}
              opacity={s.dashed ? 0.8 : 1}
            />
            {!s.dashed &&
              pts.map((p) => (
                <g key={p.p}>
                  <line x1={x(p.p)} x2={x(p.p)} y1={y(Math.max(p.lo, yMin))} y2={y(p.hi)} stroke={color} strokeWidth={1} opacity={0.6} />
                  <circle cx={x(p.p)} cy={y(p.pL)} r={3.6} fill={color}>
                    <title>{`d=${s.d}, p=${fmtP(p.p)}: ${(100 * p.pL).toFixed(2)}% [${(100 * p.lo).toFixed(2)}, ${(100 * p.hi).toFixed(2)}]`}</title>
                  </circle>
                </g>
              ))}
          </g>
        );
      })}

      {crossing && crossing > xDomain[0] && crossing < xDomain[1] && (
        <g>
          <line x1={x(crossing)} x2={x(crossing)} y1={m.t} y2={H - m.b} className={css.crossing} />
          <text x={x(crossing) + 5} y={m.t + 12} className={css.crossLabel}>
            threshold ≈ {fmtP(crossing)}
          </text>
        </g>
      )}
      {marker !== undefined && (
        <g className={css.markerG}>
          <line x1={x(marker)} x2={x(marker)} y1={m.t} y2={H - m.b} className={css.marker} />
          <rect x={x(marker) - 30} y={H - m.b - 22} width={60} height={20} rx={6} className={css.markerTag} />
          <text x={x(marker)} y={H - m.b - 12} className={css.markerText}>
            {fmtP(marker)}
          </text>
        </g>
      )}
    </svg>
  );
}

export function ChartLegend({ ds, extra }: { ds: number[]; extra?: React.ReactNode }) {
  return (
    <div className={css.legend}>
      {ds.map((d) => (
        <span key={d}>
          <span className={css.legendLine} style={{ background: DIST_COLORS[d] }} /> d = {d}
        </span>
      ))}
      {extra}
    </div>
  );
}
