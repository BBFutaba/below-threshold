// The surface-code lattice: data qubits (white circles), Z-checks (teal) and X-checks
// (violet), fired checks (bright fill plus a dot), revealed errors (coral ring with a
// letter), player corrections (blue fill with a letter) and decoder paths (dashed blue).

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import type { SurfaceCode } from '../../core/surfaceCode';
import { pauliAt, type Pauli, type PauliFrame } from '../../core/pauliFrame';
import {
  checkCenter,
  checkShape,
  halfDiscPath,
  qubitPos,
  viewSize,
  type Segment,
  S,
} from './latticeGeometry';
import css from './Lattice.module.css';

export type CorrectionMode = 'x' | 'xyz' | 'none';

export interface LatticeProps {
  code: SurfaceCode;
  /** One bit per stabilizer: lit checks. */
  syndrome?: Uint8Array;
  /** Which check types to draw. */
  show?: 'both' | 'Z' | 'X';
  /** Revealed hidden errors. */
  errors?: PauliFrame | null;
  /** Player corrections. */
  corrections?: PauliFrame | null;
  /** Decoder correction paths. */
  paths?: Segment[];
  /** Qubits to outline in coral (e.g. a logical error chain). */
  chain?: number[];
  /** Checks to highlight (hint). */
  hinted?: number[];
  flash?: 'bad' | 'good' | null;
  mode?: CorrectionMode;
  onCorrect?: (q: number, p: Pauli) => void;
  onSubmit?: () => void;
  label?: string;
  maxWidth?: number;
  /** Dim everything except the given check types (used in teaching moments). */
  dimChecks?: boolean;
  className?: string;
  /** Extra SVG drawn on top (badges, markers), in lattice coordinates. */
  overlay?: ReactNode;
  /** Fade one check type (e.g. X-checks in bit-flip-only levels). */
  muteType?: 'X' | 'Z';
}

export function Lattice({
  code,
  syndrome,
  show = 'both',
  errors,
  corrections,
  paths,
  chain,
  hinted,
  flash,
  mode = 'none',
  onCorrect,
  onSubmit,
  label = 'Surface code lattice',
  maxWidth,
  dimChecks,
  className,
  overlay,
  muteType,
}: LatticeProps) {
  const size = viewSize(code.d);
  const [focus, setFocus] = useState<number>(Math.floor(code.n / 2));
  const [menu, setMenu] = useState<number | null>(null);
  const [focused, setFocused] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = svgRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setScale(el.getBoundingClientRect().width / size));
    ro.observe(el);
    return () => ro.disconnect();
  }, [size]);
  const interactive = mode !== 'none' && !!onCorrect;
  const hintSet = useMemo(() => new Set(hinted ?? []), [hinted]);
  const chainSet = useMemo(() => new Set(chain ?? []), [chain]);

  useEffect(() => {
    if (focus >= code.n) setFocus(Math.floor(code.n / 2));
  }, [code.n, focus]);

  // Close the radial menu on outside clicks.
  useEffect(() => {
    if (menu === null) return;
    const onDown = (e: PointerEvent) => {
      if (!svgRef.current?.contains(e.target as Node)) setMenu(null);
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [menu]);

  const apply = (q: number, p: Pauli) => {
    onCorrect?.(q, p);
    setMenu(null);
  };

  const onQubit = (q: number) => {
    if (!interactive) return;
    setFocus(q);
    if (mode === 'x') apply(q, 'X');
    else setMenu(menu === q ? null : q);
  };

  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (!interactive) return;
    const d = code.d;
    const r = Math.floor(focus / d),
      c = focus % d;
    const k = e.key.toLowerCase();
    let next = focus;
    if (k === 'arrowup') next = Math.max(0, r - 1) * d + c;
    else if (k === 'arrowdown') next = Math.min(d - 1, r + 1) * d + c;
    else if (k === 'arrowleft') next = r * d + Math.max(0, c - 1);
    else if (k === 'arrowright') next = r * d + Math.min(d - 1, c + 1);
    else if (k === 'x') return void (e.preventDefault(), apply(focus, 'X'));
    else if ((k === 'z' || k === 'y') && mode === 'xyz') return void (e.preventDefault(), apply(focus, k === 'z' ? 'Z' : 'Y'));
    else if (k === ' ') {
      e.preventDefault();
      return mode === 'x' ? apply(focus, 'X') : setMenu(menu === focus ? null : focus);
    } else if (k === 'enter') return void (e.preventDefault(), onSubmit?.());
    else if (k === 'escape') return setMenu(null);
    else return;
    e.preventDefault();
    setFocus(next);
    setMenu(null);
  };

  const showType = (t: 'X' | 'Z') => show === 'both' || show === t;
  const fp = qubitPos(code, focus);
  const focusInfo = (() => {
    const lit = code.qubitStabilizers[focus].filter((s) => syndrome?.[s]).length;
    const { r, c } = code.dataQubits[focus];
    const corr = corrections ? pauliAt(corrections, focus) : 'I';
    return `Qubit row ${r + 1}, column ${c + 1}. Touches ${lit} lit check${lit === 1 ? '' : 's'}.${corr !== 'I' ? ` Corrected with ${corr}.` : ''}`;
  })();
  const litCount = syndrome ? syndrome.reduce((a, b) => a + b, 0) : 0;

  return (
    <div
      className={[css.wrap, interactive && css.interactive, className].filter(Boolean).join(' ')}
      style={{ maxWidth: `min(${maxWidth ?? 640}px, calc(100vh - 210px))` }}
    >
      <svg
        ref={svgRef}
        className={css.svg}
        viewBox={`0 0 ${size} ${size}`}
        role={interactive ? 'application' : 'img'}
        aria-label={`${label}, distance ${code.d}. ${litCount} lit check${litCount === 1 ? '' : 's'}.${interactive ? ' Arrow keys move between qubits; X' + (mode === 'xyz' ? ', Z or Y' : '') + ' applies a correction; Enter submits.' : ''}`}
        tabIndex={interactive ? 0 : -1}
        onKeyDown={onKey}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      >
        {/* Checks */}
        {code.stabilizers.map((st, i) => {
          if (!showType(st.type)) return null;
          const fired = !!syndrome?.[i];
          const sh = checkShape(code, i);
          const cls = [
            css.check,
            st.type === 'Z' ? (fired ? css.firedZ : css.checkZ) : fired ? css.firedX : css.checkX,
            fired && css.fired,
            hintSet.has(i) && css.hinted,
            ((dimChecks && !fired) || (muteType === st.type && !fired)) && css.dimmed,
          ]
            .filter(Boolean)
            .join(' ');
          const c = checkCenter(code, i);
          return (
            <g key={`s${i}-${fired ? 1 : 0}`}>
              {sh.kind === 'square' ? (
                <rect className={cls} x={sh.x + 1} y={sh.y + 1} width={sh.size - 2} height={sh.size - 2} rx={5}>
                  <title>{`${st.type}-check${fired ? ' (lit)' : ''}: detects ${st.type === 'Z' ? 'bit flips' : 'phase flips'}`}</title>
                </rect>
              ) : (
                <path className={cls} d={halfDiscPath(sh)}>
                  <title>{`${st.type}-check${fired ? ' (lit)' : ''}: detects ${st.type === 'Z' ? 'bit flips' : 'phase flips'}`}</title>
                </path>
              )}
              {fired && <circle className={css.dot} cx={c.x} cy={c.y} r={5.5} />}
            </g>
          );
        })}

        {/* Decoder paths */}
        {paths?.map((sg, i) => (
          <line key={`p${i}`} className={css.path} x1={sg.a.x} y1={sg.a.y} x2={sg.b.x} y2={sg.b.y} />
        ))}

        {/* Data qubits */}
        {code.dataQubits.map((_, q) => {
          const p = qubitPos(code, q);
          const corr = corrections ? pauliAt(corrections, q) : 'I';
          const err = errors ? pauliAt(errors, q) : 'I';
          return (
            <g key={`q${q}`} className={css.qubitG} onClick={() => onQubit(q)}>
              <circle
                className={[css.qubit, corr !== 'I' && css.corrected, chainSet.has(q) && css.chain].filter(Boolean).join(' ')}
                cx={p.x}
                cy={p.y}
                r={11}
              />
              {corr !== 'I' && (
                <text className={css.corrLetter} x={p.x} y={p.y + 0.5}>
                  {corr}
                </text>
              )}
              {err !== 'I' && (
                <>
                  <circle className={css.errRing} cx={p.x} cy={p.y} r={17} />
                  <text className={css.errLetter} x={p.x + 15} y={p.y - 15}>
                    {err}
                  </text>
                </>
              )}
              {interactive && <circle className={css.qubitHit} cx={p.x} cy={p.y} r={S * 0.48} />}
            </g>
          );
        })}

        {overlay}

        {interactive && focused && <circle className={css.focusRing} cx={fp.x} cy={fp.y} r={21} />}

        {flash === 'bad' && <rect className={css.flash} x={0} y={0} width={size} height={size} rx={16} />}
        {flash === 'good' && <rect className={css.flashGood} x={0} y={0} width={size} height={size} rx={16} />}

        {/* Radial correction menu */}
        {menu !== null && mode === 'xyz' && (
          <RadialMenu
            x={qubitPos(code, menu).x}
            y={qubitPos(code, menu).y}
            size={size}
            k={Math.max(1, 44 / (34 * scale))}
            onPick={(p) => apply(menu, p)}
          />
        )}
      </svg>
      {interactive && (
        <div className="visually-hidden" aria-live="polite">
          {focused ? focusInfo : ''}
        </div>
      )}
    </div>
  );
}

function RadialMenu({ x, y, size, k, onPick }: { x: number; y: number; size: number; k: number; onPick: (p: Pauli) => void }) {
  const opts: { p: Pauli; sub: string }[] = [
    { p: 'X', sub: 'bit' },
    { p: 'Z', sub: 'phase' },
    { p: 'Y', sub: 'both' },
  ];
  // k scales the menu so each button stays at least 44 CSS pixels wide.
  const R = 34 * k;
  // Fan the menu upward unless the qubit is near the top edge.
  const up = y > 80;
  const base = up ? -Math.PI / 2 : Math.PI / 2;
  const angles = [base - 0.95, base, base + 0.95];
  return (
    <g>
      <circle className={css.menuBack} cx={x} cy={y} r={R + 22 * k} />
      {opts.map((o, i) => {
        let bx = x + R * Math.cos(angles[i]);
        const by = y + R * Math.sin(angles[i]);
        bx = Math.min(size - 18 * k, Math.max(18 * k, bx));
        return (
          <g
            key={o.p}
            className={css.menuBtn}
            role="button"
            tabIndex={0}
            aria-label={`Apply ${o.p} (${o.sub} flip)`}
            onClick={(e) => {
              e.stopPropagation();
              onPick(o.p);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onPick(o.p);
              }
            }}
          >
            <circle cx={bx} cy={by} r={17 * k} />
            <text x={bx} y={by - 3 * k} style={{ fontSize: 14 * k }}>
              {o.p}
            </text>
            <text className={css.menuSub} x={bx} y={by + 9 * k} style={{ fontSize: 7.5 * k }}>
              {o.sub}
            </text>
          </g>
        );
      })}
    </g>
  );
}
