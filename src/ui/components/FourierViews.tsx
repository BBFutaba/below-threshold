// Views for the Shor's algorithm chapters: amplitudes drawn as clocks (size = how much,
// hand = which direction, i.e. the phase), a probability chart for registers of up to 512
// values, and the step-through QFT circuit diagram. Everything is drawn from real state vectors.

import type { ReactNode } from 'react';
import type { QftGate } from '../../core/qft';
import { phaseColor } from './QuantumViews';
import css from './FourierViews.module.css';

const TAU = 2 * Math.PI;

/** A phase as a fraction of a full turn, e.g. "1/4 turn". */
export function turnsLabel(phi: number): string {
  let t = (((phi / TAU) % 1) + 1) % 1;
  if (t > 1 - 1e-9) t = 0;
  if (t < 1e-9) return 'no turn';
  for (const den of [2, 3, 4, 6, 8, 12, 16, 32, 64]) {
    const num = Math.round(t * den);
    if (Math.abs(num / den - t) < 1e-6) return `${num}/${den} turn`;
  }
  return `${t.toFixed(2)} turn`;
}

export function PhaseClocks({
  re,
  im,
  labels,
  size = 56,
  maxCols = 8,
  highlight,
  caption,
  ariaLabel = 'Amplitudes drawn as clocks',
}: {
  re: ArrayLike<number>;
  im: ArrayLike<number>;
  labels?: string[];
  size?: number;
  maxCols?: number;
  highlight?: number[];
  caption?: ReactNode;
  ariaLabel?: string;
}) {
  const N = re.length;
  const amps = Array.from({ length: N }, (_, i) => Math.hypot(re[i], im[i]));
  const maxAmp = Math.max(1e-12, ...amps);
  const cols = Math.min(N, maxCols);
  const rows = Math.ceil(N / cols);
  const cellH = size + 18;
  const R = size * 0.4;
  const W = cols * size,
    H = rows * cellH;
  const hl = new Set(highlight ?? []);
  const summary = amps
    .map((a, i) => (a > 1e-6 ? `${labels?.[i] ?? i}: ${(100 * a * a).toFixed(0)}%, ${turnsLabel(Math.atan2(im[i], re[i]))}` : null))
    .filter(Boolean)
    .join('; ');
  return (
    <figure className={css.clocks}>
      <svg viewBox={`0 0 ${W} ${H}`} className={css.clockSvg} style={{ maxWidth: W * 1.25 }} role="img" aria-label={`${ariaLabel}. ${summary}`}>
        {amps.map((a, i) => {
          const cx = (i % cols) * size + size / 2;
          const cy = Math.floor(i / cols) * cellH + size / 2;
          const ang = Math.atan2(im[i], re[i]);
          const rel = a / maxAmp;
          const on = a > 1e-6;
          const col = phaseColor(re[i], im[i]);
          const hx = cx + R * rel * Math.cos(ang),
            hy = cy - R * rel * Math.sin(ang);
          return (
            <g key={i}>
              <title>{`${labels?.[i] ?? `|${i}⟩`}: probability ${(100 * a * a).toFixed(1)}%${on ? `, phase ${turnsLabel(ang)}` : ''}`}</title>
              <circle className={css.clockRing} data-hl={hl.has(i) ? 1 : 0} cx={cx} cy={cy} r={R} />
              <line className={css.clockTick} x1={cx + R} y1={cy} x2={cx + R + 3.5} y2={cy} />
              {on && <circle cx={cx} cy={cy} r={R * rel} fill={col} opacity={0.22} />}
              {on && <line className={css.clockHand} x1={cx} y1={cy} x2={hx} y2={hy} stroke={col} />}
              {on && <circle cx={hx} cy={hy} r={2.2} fill={col} />}
              <circle cx={cx} cy={cy} r={1.4} className={css.clockHub} />
              <text className={css.clockLabel} x={cx} y={cy + R + 13}>
                {labels?.[i] ?? i}
              </text>
            </g>
          );
        })}
      </svg>
      {caption && <figcaption className={css.cap}>{caption}</figcaption>}
    </figure>
  );
}

export function ProbChart({
  values,
  colors,
  markers,
  highlight,
  height = 150,
  label,
  caption,
  tickEvery,
  yLabel = 'probability',
  asCounts,
}: {
  values: ArrayLike<number>;
  colors?: (string | undefined)[];
  /** Fractional x positions to mark with dashed lines (e.g. multiples of Q/r). */
  markers?: number[];
  highlight?: number | null;
  height?: number;
  label: string;
  caption?: ReactNode;
  tickEvery?: number;
  yLabel?: string;
  asCounts?: boolean;
}) {
  const Q = values.length;
  const W = 600,
    padL = 8,
    padR = 8,
    padT = 14,
    padB = 22;
  const H = height + padT + padB;
  const plotW = W - padL - padR;
  const bw = plotW / Q;
  const gap = Q <= 64 ? Math.min(2, bw * 0.18) : 0;
  let max = 0;
  let total = 0;
  for (let i = 0; i < Q; i++) {
    max = Math.max(max, values[i]);
    total += values[i];
  }
  max = Math.max(max, 1e-12);
  const every = tickEvery ?? (Q <= 16 ? 1 : Q / 8);
  const xOf = (k: number) => padL + (k + 0.5) * bw;
  const fmt = (v: number) => (asCounts ? `${v} of ${total}` : `${(100 * v).toFixed(1)}%`);
  return (
    <figure className={css.chart}>
      <svg viewBox={`0 0 ${W} ${H}`} className={css.chartSvg} role="img" aria-label={label}>
        <line className={css.axis} x1={padL} x2={W - padR} y1={padT + height} y2={padT + height} />
        {markers?.map((m, i) => (
          <line key={`m${i}`} className={css.marker} x1={xOf(m)} x2={xOf(m)} y1={padT - 6} y2={padT + height} />
        ))}
        {Array.from({ length: Q }, (_, k) => {
          const h = (values[k] / max) * height;
          if (h <= 0.01 && highlight !== k) return null;
          return (
            <rect
              key={k}
              className={css.bar}
              data-hl={highlight === k ? 1 : 0}
              x={padL + k * bw + gap / 2}
              y={padT + height - h}
              width={Math.max(0.6, bw - gap)}
              height={Math.max(h, 0.01)}
              style={colors?.[k] ? { fill: colors[k] } : undefined}
            >
              <title>{`x = ${k}: ${fmt(values[k])}`}</title>
            </rect>
          );
        })}
        {highlight != null && highlight >= 0 && (
          <g className={css.pick}>
            <line x1={xOf(highlight)} x2={xOf(highlight)} y1={padT - 10} y2={padT + height} />
            <text x={Math.min(W - 30, Math.max(30, xOf(highlight)))} y={padT - 2}>
              {highlight}
            </text>
          </g>
        )}
        {Array.from({ length: Math.floor((Q - 1) / every) + 1 }, (_, i) => i * every).map((k) => (
          <text key={`t${k}`} className={css.tick} x={xOf(k)} y={padT + height + 15}>
            {k}
          </text>
        ))}
      </svg>
      {caption && <figcaption className={css.cap}>{caption}</figcaption>}
      <span className="visually-hidden">{yLabel}</span>
    </figure>
  );
}

const frac = (k: number) => `1/${2 ** k}`;

/** The QFT circuit with a playhead: gates before `step` are done, gate `step` is next. */
export function QftCircuitDiagram({ n, gates, step, onJump }: { n: number; gates: QftGate[]; step: number; onJump?: (step: number) => void }) {
  const colW = 46,
    rowH = 40,
    left = 82,
    top = 12;
  const W = left + gates.length * colW + 30;
  const H = top * 2 + n * rowH;
  const y = (q: number) => top + (n - 1 - q) * rowH + rowH / 2; // most significant qubit on top
  const x = (i: number) => left + i * colW + colW / 2;
  const state = (i: number) => (i < step ? 'done' : i === step ? 'next' : 'todo');
  return (
    <div className={css.circWrap}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className={css.circ} role="img" aria-label={`QFT circuit on ${n} qubits, ${step} of ${gates.length} gates applied`}>
        {Array.from({ length: n }, (_, q) => (
          <g key={q}>
            <text className={css.qName} x={8} y={y(q) - 3}>
              q{q}
            </text>
            <text className={css.qPlace} x={8} y={y(q) + 11}>
              ×{2 ** q}
            </text>
            <line className={css.wire} x1={left - 14} x2={W - 8} y1={y(q)} y2={y(q)} />
          </g>
        ))}
        {step > 0 && step <= gates.length && <line className={css.playhead} x1={left + step * colW} x2={left + step * colW} y1={4} y2={H - 4} />}
        {gates.map((g, i) => {
          const st = state(i);
          const click = onJump ? () => onJump(i + 1) : undefined;
          const cls = [css.gateG, onJump && css.clickable].filter(Boolean).join(' ');
          const title = onJump ? <title>{`Jump to just after this gate (step ${i + 1})`}</title> : null;
          if (g.g === 'H') {
            return (
              <g key={i} className={cls} data-state={st} onClick={click}>
                {title}
                <rect className={css.box} x={x(i) - 15} y={y(g.q) - 14} width={30} height={28} rx={6} />
                <text className={css.boxText} x={x(i)} y={y(g.q) + 1}>
                  H
                </text>
              </g>
            );
          }
          if (g.g === 'CP') {
            return (
              <g key={i} className={cls} data-state={st} onClick={click}>
                {title}
                <line className={css.link} x1={x(i)} x2={x(i)} y1={y(g.c)} y2={y(g.t)} />
                <circle className={css.ctrl} cx={x(i)} cy={y(g.c)} r={5} />
                <rect className={css.box} x={x(i) - 18} y={y(g.t) - 14} width={36} height={28} rx={6} />
                <text className={css.boxText} data-small={1} x={x(i)} y={y(g.t) + 1}>
                  {frac(g.k)}
                </text>
              </g>
            );
          }
          return (
            <g key={i} className={cls} data-state={st} onClick={click}>
              {title}
              <line className={css.link} x1={x(i)} x2={x(i)} y1={y(g.a)} y2={y(g.b)} />
              {[g.a, g.b].map((q) => (
                <g key={q}>
                  <line className={css.link} x1={x(i) - 6} x2={x(i) + 6} y1={y(q) - 6} y2={y(q) + 6} />
                  <line className={css.link} x1={x(i) - 6} x2={x(i) + 6} y1={y(q) + 6} y2={y(q) - 6} />
                </g>
              ))}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
