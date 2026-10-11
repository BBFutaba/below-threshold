// State panel pieces for the chapters: Bloch sphere, amplitude bars, shots histogram,
// circuit strip and fidelity meter. Everything is drawn from the real state vector.

import { useRef, useState, type PointerEvent as RPointerEvent, type KeyboardEvent } from 'react';
import type { Bloch, QState } from '../../core/quantum';
import { basisLabel } from '../../core/quantum';
import css from './QuantumViews.module.css';

// ----------------------------------------------------------------------------- Bloch sphere

interface V3 {
  x: number;
  y: number;
  z: number;
}

function project(v: V3, yaw: number, pitch: number, R: number) {
  const x1 = v.x * Math.cos(yaw) - v.y * Math.sin(yaw);
  const y1 = v.x * Math.sin(yaw) + v.y * Math.cos(yaw);
  const depth = y1 * Math.cos(pitch) + v.z * Math.sin(pitch);
  const up = -y1 * Math.sin(pitch) + v.z * Math.cos(pitch);
  return { sx: x1 * R, sy: -up * R, depth };
}

export function BlochSphere({ bloch, label, size = 150 }: { bloch: Bloch; label: string; size?: number }) {
  const [yaw, setYaw] = useState(-0.6);
  const [pitch, setPitch] = useState(0.32);
  const drag = useRef<{ x: number; y: number; yaw: number; pitch: number } | null>(null);
  const R = size * 0.36;
  const c = size / 2;

  const onDown = (e: RPointerEvent<SVGSVGElement>) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, yaw, pitch };
  };
  const onMove = (e: RPointerEvent<SVGSVGElement>) => {
    if (!drag.current) return;
    setYaw(drag.current.yaw - (e.clientX - drag.current.x) * 0.012);
    setPitch(Math.max(-1.3, Math.min(1.3, drag.current.pitch + (e.clientY - drag.current.y) * 0.012)));
  };
  const onUp = () => (drag.current = null);
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key === 'ArrowLeft') setYaw((y) => y + 0.15);
    else if (e.key === 'ArrowRight') setYaw((y) => y - 0.15);
    else if (e.key === 'ArrowUp') setPitch((p) => Math.min(1.3, p + 0.1));
    else if (e.key === 'ArrowDown') setPitch((p) => Math.max(-1.3, p - 0.1));
    else return;
    e.preventDefault();
  };

  const ring = (axis: 'eq' | 'mer') => {
    const pts: string[] = [];
    for (let i = 0; i <= 64; i++) {
      const t = (i / 64) * 2 * Math.PI;
      const v = axis === 'eq' ? { x: Math.cos(t), y: Math.sin(t), z: 0 } : { x: Math.cos(t), y: 0, z: Math.sin(t) };
      const p = project(v, yaw, pitch, R);
      pts.push(`${(c + p.sx).toFixed(2)},${(c + p.sy).toFixed(2)}`);
    }
    return pts.join(' ');
  };
  const axes: { v: V3; text: string }[] = [
    { v: { x: 0, y: 0, z: 1 }, text: '|0⟩' },
    { v: { x: 0, y: 0, z: -1 }, text: '|1⟩' },
    { v: { x: 1, y: 0, z: 0 }, text: '+' },
    { v: { x: 0, y: 1, z: 0 }, text: '+i' },
  ];
  const tip = project(bloch, yaw, pitch, R);
  const len = bloch.length;
  const describe = `${label}: Bloch vector x ${bloch.x.toFixed(2)}, y ${bloch.y.toFixed(2)}, z ${bloch.z.toFixed(2)}, length ${len.toFixed(2)}${len < 0.98 ? ' (entangled: shorter than 1)' : ''}.`;

  return (
    <figure className={css.bloch}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onKeyDown={onKey}
        tabIndex={0}
        role="img"
        aria-label={describe + ' Drag or use arrow keys to rotate.'}
        className={css.blochSvg}
      >
        <circle cx={c} cy={c} r={R} className={css.sphere} />
        <polyline points={ring('eq')} className={css.ring} />
        <polyline points={ring('mer')} className={css.ring} />
        {axes.map((a) => {
          const p = project(a.v, yaw, pitch, R * 1.18);
          const q = project(a.v, yaw, pitch, R);
          return (
            <g key={a.text}>
              <line x1={c} y1={c} x2={c + q.sx} y2={c + q.sy} className={css.axis} />
              <text x={c + p.sx} y={c + p.sy} className={css.axisLabel}>
                {a.text}
              </text>
            </g>
          );
        })}
        <line x1={c} y1={c} x2={c + tip.sx} y2={c + tip.sy} className={css.vec} style={{ opacity: tip.depth > 0.2 ? 0.75 : 1 }} />
        <circle cx={c + tip.sx} cy={c + tip.sy} r={4.5} className={css.vecTip} />
        <circle cx={c} cy={c} r={2} className={css.center} />
      </svg>
      <figcaption className={css.blochCap}>
        <span>{label}</span>
        <span className="mono" title="Length of the Bloch vector. Below 1 means this qubit is entangled with others.">
          |r| = {len.toFixed(2)}
        </span>
      </figcaption>
    </figure>
  );
}

// ----------------------------------------------------------------------------- Amplitude bars

export function phaseColor(re: number, im: number): string {
  const ang = Math.atan2(im, re); // -pi..pi
  const hue = ((ang * 180) / Math.PI + 360 + 200) % 360; // phase 0 -> blue-ish
  return `hsl(${hue.toFixed(0)} 80% 62%)`;
}

export function AmplitudeBars({ state, height = 120, maxBars = 32 }: { state: QState; height?: number; maxBars?: number }) {
  const N = Math.min(state.N, maxBars);
  const items = Array.from({ length: N }, (_, i) => ({
    i,
    p: state.re[i] ** 2 + state.im[i] ** 2,
    re: state.re[i],
    im: state.im[i],
  }));
  const terms = items.filter((t) => t.p > 1e-9);
  const summary = terms.map((t) => `${basisLabel(t.i, state.n)} ${(100 * t.p).toFixed(0)}%`).join(', ');
  return (
    <figure className={css.amps} aria-label={`Amplitudes: ${summary}`} role="img">
      <div className={css.ampBars} style={{ height }}>
        {items.map((t) => (
          <div key={t.i} className={css.ampCol} title={`${basisLabel(t.i, state.n)}: probability ${(100 * t.p).toFixed(1)}%, amplitude ${t.re.toFixed(3)}${t.im >= 0 ? '+' : '−'}${Math.abs(t.im).toFixed(3)}i`}>
            <div className={css.ampBar} style={{ height: `${t.p * 100}%`, background: t.p > 1e-9 ? phaseColor(t.re, t.im) : 'transparent' }} />
          </div>
        ))}
      </div>
      <div className={css.ampLabels} style={{ gridTemplateColumns: `repeat(${N}, 1fr)` }}>
        {items.map((t) => (
          <span key={t.i} className={css.ampLabel} data-small={state.n > 3 ? 1 : 0}>
            {basisLabel(t.i, state.n)}
          </span>
        ))}
      </div>
      <figcaption className={css.ampCap}>
        Bar height = probability · color = phase
        <span className={css.phaseKey} aria-hidden>
          <span style={{ background: phaseColor(1, 0) }} /> + <span style={{ background: phaseColor(-1, 0) }} /> −
        </span>
      </figcaption>
    </figure>
  );
}

// ----------------------------------------------------------------------------- Histogram

export function Histogram({
  counts,
  labels,
  expected,
  height = 120,
  caption,
}: {
  counts: number[];
  labels: string[];
  expected?: number[];
  height?: number;
  caption?: string;
}) {
  const total = counts.reduce((a, b) => a + b, 0);
  const max = Math.max(1, ...counts, ...(expected ?? []).map((e) => e * total));
  return (
    <figure className={css.hist} role="img" aria-label={`Shots: ${labels.map((l, i) => `${l} ${counts[i]}`).join(', ')}`}>
      <div className={css.histBars} style={{ height }}>
        {counts.map((c, i) => (
          <div key={i} className={css.histCol}>
            <span className={css.histCount}>{c}</span>
            <div className={css.histBar} style={{ height: `${(c / max) * 100}%` }} />
            {expected && total > 0 && <div className={css.histExpected} style={{ bottom: `${((expected[i] * total) / max) * 100}%` }} title={`expected ${(expected[i] * total).toFixed(1)}`} />}
          </div>
        ))}
      </div>
      <div className={css.histLabels} style={{ gridTemplateColumns: `repeat(${counts.length}, 1fr)` }}>
        {labels.map((l) => (
          <span key={l} className="mono">
            {l}
          </span>
        ))}
      </div>
      <figcaption className={css.ampCap}>{caption ?? `${total} shots`}</figcaption>
    </figure>
  );
}

// ----------------------------------------------------------------------------- Circuit strip

export type Op =
  | { g: 'X' | 'Y' | 'Z' | 'H' | 'S'; q: number }
  | { g: 'Rx' | 'Ry' | 'P'; q: number; t: number }
  | { g: 'CNOT'; c: number; t: number }
  | { g: 'M'; q: number; out?: number }
  | { g: 'ERR'; q: number; p: string; hidden?: boolean };

export function applyOp(s: QState, op: Op, rand?: () => number): number | undefined {
  switch (op.g) {
    case 'X':
      s.x(op.q);
      break;
    case 'Y':
      s.y(op.q);
      break;
    case 'Z':
      s.z(op.q);
      break;
    case 'H':
      s.h(op.q);
      break;
    case 'S':
      s.s(op.q);
      break;
    case 'Rx':
      s.rx(op.q, op.t);
      break;
    case 'Ry':
      s.ry(op.q, op.t);
      break;
    case 'P':
      s.phase(op.q, op.t);
      break;
    case 'CNOT':
      s.cnot(op.c, op.t);
      break;
    case 'M':
      return s.measure(op.q, rand);
    case 'ERR':
      if (op.p === 'X') s.x(op.q);
      else if (op.p === 'Z') s.z(op.q);
      else if (op.p === 'Y') s.y(op.q);
      break;
  }
  return undefined;
}

export function CircuitStrip({
  n,
  ops,
  onUndoTo,
  qubitLabels,
}: {
  n: number;
  ops: Op[];
  onUndoTo?: (index: number) => void;
  qubitLabels?: string[];
}) {
  const colW = 44,
    rowH = 34,
    left = 54;
  const W = left + Math.max(4, ops.length + 1) * colW;
  const H = n * rowH + 8;
  return (
    <div className={css.circuitWrap}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Circuit with ${ops.length} steps`} className={css.circuit}>
        {Array.from({ length: n }, (_, q) => (
          <g key={q}>
            <text x={8} y={q * rowH + rowH / 2 + 4} className={css.qLabel}>
              {qubitLabels?.[q] ?? `q${q}`}
            </text>
            <line x1={left - 8} x2={W - 6} y1={q * rowH + rowH / 2 + 4} y2={q * rowH + rowH / 2 + 4} className={css.wire} />
          </g>
        ))}
        {ops.map((op, i) => {
          const x = left + i * colW + colW / 2;
          const y = (q: number) => q * rowH + rowH / 2 + 4;
          const click = onUndoTo ? () => onUndoTo(i) : undefined;
          const title = onUndoTo ? 'Undo back to before this step' : undefined;
          if (op.g === 'CNOT') {
            return (
              <g key={i} className={onUndoTo ? css.opClickable : undefined} onClick={click}>
                {title && <title>{title}</title>}
                <line x1={x} x2={x} y1={y(op.c)} y2={y(op.t)} className={css.cnotLine} />
                <circle cx={x} cy={y(op.c)} r={4.5} className={css.cnotDot} />
                <circle cx={x} cy={y(op.t)} r={10} className={css.cnotTarget} />
                <line x1={x - 10} x2={x + 10} y1={y(op.t)} y2={y(op.t)} className={css.cnotLine} />
                <line x1={x} x2={x} y1={y(op.t) - 10} y2={y(op.t) + 10} className={css.cnotLine} />
              </g>
            );
          }
          const label = op.g === 'ERR' ? (op.hidden ? '?' : op.p) : op.g === 'M' ? (op.out === undefined ? 'M' : `M${op.out}`) : op.g;
          return (
            <g key={i} className={onUndoTo ? css.opClickable : undefined} onClick={click}>
              {title && <title>{title}</title>}
              <rect
                x={x - 15}
                y={y(op.q) - 13}
                width={30}
                height={26}
                rx={6}
                className={op.g === 'ERR' ? css.gateErr : op.g === 'M' ? css.gateMeas : css.gate}
              />
              <text x={x} y={y(op.q) + 1} className={css.gateText} data-small={label.length > 2 ? 1 : 0}>
                {label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function FidelityMeter({ value, label = 'Fidelity with the stored state' }: { value: number; label?: string }) {
  const pctv = Math.max(0, Math.min(1, value));
  const color = pctv > 0.999 ? 'var(--green)' : pctv > 0.6 ? 'var(--amber)' : 'var(--coral)';
  return (
    <div className={css.fid} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pctv * 100)}>
      <div className={css.fidHead}>
        <span>{label}</span>
        <span className="mono" style={{ color }}>
          {(pctv * 100).toFixed(pctv > 0.999 || pctv < 0.001 ? 0 : 1)}%
        </span>
      </div>
      <div className={css.fidTrack}>
        <div className={css.fidFill} style={{ width: `${pctv * 100}%`, background: color }} />
      </div>
    </div>
  );
}
