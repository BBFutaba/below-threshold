// Bridge: the 3-qubit repetition code morphs into the distance-3 rotated surface code.

import { useEffect, useMemo, useState } from 'react';
import { makeRotatedSurfaceCode } from '../../../core/surfaceCode';
import { checkShape, halfDiscPath, qubitPos, viewSize } from '../../components/latticeGeometry';
import { MediaClip } from '../../components/MediaClip';
import { Button, ButtonLink, Card, GoalLine } from '../../components/ui';
import s from '../screen.module.css';

const STEPS = [
  'You just protected one qubit with 3. Real machines use hundreds.',
  'The repetition code catches one kind of error: bit flips, with teal checks.',
  'The surface code catches both, on a 2D grid that real chips can build.',
];

export function Bridge() {
  const code = useMemo(() => makeRotatedSurfaceCode(3), []);
  const [step, setStep] = useState(0);
  const size = viewSize(3);

  useEffect(() => {
    if (step >= 2) return;
    const id = window.setTimeout(() => setStep((x) => x + 1), 2600);
    return () => window.clearTimeout(id);
  }, [step]);

  // Stage 0/1: three qubits of the middle row, with two repetition checks between them.
  const mid = [3, 4, 5];
  const row = (q: number) => qubitPos(code, q);

  return (
    <div className={`${s.page} ${s.narrow}`}>
      <header className={s.header}>
        <p className={s.eyebrow}>Bridge</p>
        <h1>From 3 qubits to the surface code</h1>
      </header>
      <GoalLine>See how the repetition code grows into the code real chips use.</GoalLine>
      <div className={s.canvas} style={{ display: 'grid', gap: 18 }}>
        <svg viewBox={`0 0 ${size} ${size}`} style={{ width: '100%', maxWidth: 420, margin: '0 auto', display: 'block' }} role="img" aria-label={STEPS[step]}>
          {/* Surface-code plaquettes fade in at stage 2 */}
          {code.stabilizers.map((st, i) => {
            const sh = checkShape(code, i);
            const style = { opacity: step >= 2 ? 1 : 0, transition: `opacity 600ms ease ${i * 40}ms` };
            const cls = st.type === 'Z' ? 'var(--teal-tint)' : 'var(--violet-tint)';
            const stroke = st.type === 'Z' ? 'var(--teal)' : 'var(--violet)';
            return sh.kind === 'square' ? (
              <rect key={i} x={sh.x + 1} y={sh.y + 1} width={sh.size - 2} height={sh.size - 2} rx={5} fill={cls} stroke={stroke} strokeOpacity={0.4} style={style} />
            ) : (
              <path key={i} d={halfDiscPath(sh)} fill={cls} stroke={stroke} strokeOpacity={0.4} style={style} />
            );
          })}
          {/* Repetition-code checks between neighbours (stages 0-1) */}
          {[0, 1].map((k) => {
            const a = row(mid[k]),
              b = row(mid[k + 1]);
            return (
              <rect
                key={k}
                x={(a.x + b.x) / 2 - 11}
                y={a.y - 11}
                width={22}
                height={22}
                rx={5}
                fill="var(--teal-fire)"
                style={{ opacity: step >= 2 ? 0 : step >= 1 ? 1 : 0.35, transition: 'opacity 500ms ease' }}
              />
            );
          })}
          {/* Data qubits: the middle row is always visible, the rest grow in */}
          {code.dataQubits.map((_, q) => {
            const p = qubitPos(code, q);
            const visible = mid.includes(q) || step >= 2;
            return (
              <circle
                key={q}
                cx={p.x}
                cy={p.y}
                r={11}
                fill="var(--qubit-fill)"
                stroke="var(--qubit-stroke)"
                strokeWidth={2.2}
                style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'scale(0.4)', transformOrigin: `${p.x}px ${p.y}px`, transition: `all 500ms ease ${q * 50}ms` }}
              />
            );
          })}
        </svg>
        <p style={{ textAlign: 'center', fontSize: '1.1rem', minHeight: '3em', margin: 0 }} aria-live="polite">
          {STEPS[step]}
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', fontSize: '0.85rem' }} className="muted">
          <span>
            <span className={s.swatch} style={{ background: 'var(--teal-fire)', verticalAlign: 'middle' }} /> Z-check: detects bit flips
          </span>
          <span>
            <span className={s.swatch} style={{ background: 'var(--violet-fire)', verticalAlign: 'middle' }} /> X-check: detects phase flips
          </span>
          <span>○ data qubit</span>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Button variant="ghost" onClick={() => setStep(0)}>
            Replay
          </Button>
          <ButtonLink to="/play" variant="primary">
            Play the game →
          </ButtonLink>
        </div>
      </div>
      <div style={{ marginTop: 20 }}>
        <Card title="Watch it in motion">
          <MediaClip id="bridge" caption="Manim animation of the same transition." />
        </Card>
      </div>
    </div>
  );
}
