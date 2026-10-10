// Chapter 6: Noise ruins the answer. The full gate-level circuit for N = 15, a = 7 on
// 10 qubits (6 input, 4 output; 36 steps) runs with a random X, Y or Z error hitting each
// qubit after each step with probability p. The peaks blur into noise. Then the scale
// argument: (1 - p)^G for computations with billions of steps leads into error correction.

import { useMemo, useState } from 'react';
import { expectedPeaks } from '../../../core/qft';
import { noisyShor, peakFraction, randomGuessSuccess, shorGates } from '../../../core/shor';
import { chapterBySlug } from '../../content';
import { ProbChart } from '../../components/FourierViews';
import { Button, ButtonLink, Card, Row, Segmented, Slider, WhatHappened, pct } from '../../components/ui';
import { ChapterFrame } from './ChapterFrame';
import s from '../screen.module.css';
import css from './Shor.module.css';

const meta = chapterBySlug('noise')!;
const N = 15,
  A = 7,
  T = 6,
  R_TRUE = 4,
  QUBITS = 10,
  SHOTS = 200;
const Q = 2 ** T;
const LEVELS = [0, 0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1];
const STEPS = shorGates(N, A, T).length;
const SCALES = [
  { value: 'demo', label: 'This demo', ops: STEPS * QUBITS },
  { value: 'mid', label: 'A million', ops: 1e6 },
  { value: 'rsa', label: 'Factoring-scale (10¹²)', ops: 1e12 },
] as const;

interface RunResult {
  p: number;
  counts: Uint32Array;
  peak: number;
  success: number;
}

/** (1 - p)^ops as readable text: a percentage, or "1 in 10^X". */
function survival(p: number, ops: number): string {
  if (p === 0) return '100%';
  const log10 = ops * Math.log10(1 - p);
  if (log10 > -3) return pct(10 ** log10, 1);
  return `1 in 10^${Math.round(-log10).toLocaleString()}`;
}

export function ChapterNoise() {
  const [li, setLi] = useState(0);
  const [runs, setRuns] = useState<RunResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [scale, setScale] = useState<(typeof SCALES)[number]['value']>('demo');
  const [done, setDone] = useState([false, false, false, false]);
  const mark = (i: number) => setDone((d) => d.map((v, j) => (j === i ? true : v)));
  const p = LEVELS[li];
  const last = runs.at(-1);
  const guess = useMemo(() => randomGuessSuccess(N, A, Q), []);
  const peaks = expectedPeaks(T, R_TRUE);

  const runShots = () => {
    setBusy(true);
    // Let the button repaint before the simulation (~10^7 amplitude updates) runs.
    window.setTimeout(() => {
      const res = noisyShor(N, A, T, p, SHOTS, 3100 + runs.length);
      const r: RunResult = { p, counts: res.counts, peak: peakFraction(res.counts, Q, R_TRUE), success: res.successes / res.shots };
      setRuns((rs) => [...rs, r]);
      if (p === 0) mark(0);
      if (Math.abs(p - 0.01) < 1e-9) mark(1);
      if (p >= 0.05 && r.peak < 0.35) mark(2);
      setBusy(false);
    }, 20);
  };

  const ops = SCALES.find((x) => x.value === scale)!.ops;

  let msg: { text: string; tone: 'good' | 'warn' | 'bad' | 'info'; deeper?: string } | null = null;
  if (last) {
    if (last.p === 0)
      msg = {
        tone: 'good',
        text: `With perfect qubits every run lands on one of the four peaks (0, 16, 32, 48). ${pct(last.success, 0)} of runs found 15 = 3 × 5; the rest measured k = 0, which says nothing about the period.`,
      };
    else if (last.peak > 0.7)
      msg = { tone: 'info', text: `At ${pct(last.p, 1)} per qubit per step, ${pct(last.peak, 0)} of runs still land on a peak. The signal is fading but readable.` };
    else if (last.peak > 0.3)
      msg = { tone: 'warn', text: `At ${pct(last.p, 1)}, only ${pct(last.peak, 0)} of runs land on a peak. Errors have pushed the rest to random values.` };
    else
      msg = {
        tone: 'bad',
        text: `At ${pct(last.p, 1)} the peaks are gone: ${pct(last.peak, 0)} on a peak, close to the ${pct(4 / Q, 0)} that pure chance would give. The quantum computer has become a random number generator.`,
        deeper: `For a number as small as 15, even a random k often leads to 3 × 5 (${pct(guess, 0)} of all k do), which is why tiny demonstrations prove little. The peaks are the real quantum signal, and they are what noise destroys.`,
      };
  }

  const tasks = [
    { label: <>Run 200 shots with <b>no noise</b>.</>, done: done[0] },
    { label: <>Turn the noise up to <b>1%</b> and run again.</>, done: done[1] },
    { label: <>At <b>5%</b> or more, watch the peaks disappear.</>, done: done[2] },
    { label: <>Scale up: could a <b>factoring-scale</b> computation run with no errors at all?</>, done: done[3] },
  ];

  return (
    <ChapterFrame
      meta={meta}
      clip={{ id: 'noise', caption: 'From the film: the same circuit with noise, and why scale makes it hopeless without error correction.' }}
      goal="See what errors do to Shor's algorithm, and why that leads to error correction."
      tasks={tasks}
      complete={done.every(Boolean)}
      canvas={
        <div className={s.stateGrid}>
          <Card title={`Factoring 15 on ${QUBITS} noisy qubits (${STEPS} steps)`}>
            {last ? (
              <ProbChart
                values={last.counts}
                asCounts
                markers={peaks}
                height={150}
                label={`Histogram of ${SHOTS} measured values at error rate ${pct(last.p, 1)}; ${pct(last.peak, 0)} on a peak`}
                caption={`${SHOTS} runs at p = ${pct(last.p, 1)}. Dashed lines: the four peaks a perfect machine always hits.`}
              />
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                Each run is the full circuit: six Hadamards, six controlled multiplications (by 7, 4, 1, 1, 1, 1 mod 15) and the 6-qubit QFT, on the state-vector simulator.
                Press Run to see where 200 runs land.
              </p>
            )}
            {last && (
              <div className={css.statRow} style={{ marginTop: 12 }}>
                <div className={css.stat}>
                  <span className={css.big}>{pct(last.peak, 0)}</span>
                  <span>runs on a peak (pure chance: {pct(4 / Q, 0)})</span>
                </div>
                <div className={css.stat}>
                  <span className={css.big}>{pct(last.success, 0)}</span>
                  <span>found 3 × 5 (a random k: {pct(guess, 0)})</span>
                </div>
              </div>
            )}
          </Card>
          {runs.length > 1 && (
            <Card title="Signal vs noise, from your runs">
              <SignalPlot runs={runs} />
            </Card>
          )}
          <Card title="Now scale it up">
            <p style={{ marginTop: 0, fontSize: '0.92rem' }}>
              The chance that a computation with G qubit-operations has <b>no error at all</b> is (1 − p)<sup>G</sup>. Breaking real encryption is estimated to need
              around a million qubits running for days: well over 10<sup>12</sup> qubit-operations.
            </p>
            <Segmented
              label="Size of the computation"
              value={scale}
              onChange={(v) => {
                setScale(v);
                if (v === 'rsa') mark(3);
              }}
              options={SCALES.map((x) => ({ value: x.value, label: x.label }))}
            />
            <div className={css.scale} style={{ marginTop: 12 }}>
              {[0.01, 0.001, 0.0001].map((pp) => (
                <div key={pp}>
                  <span>p = {pct(pp, pp < 0.001 ? 2 : 1)} per operation</span>
                  <b>{survival(pp, ops)}</b>
                </div>
              ))}
            </div>
            <p className="faint" style={{ fontSize: '0.82rem', margin: '10px 0 0' }}>
              Today&apos;s best physical qubits make roughly one error per thousand operations. To finish a factoring-scale computation, each operation must fail less than
              about once in a trillion. No physical qubit is that good; error correction builds such qubits out of many noisy ones.
            </p>
          </Card>
        </div>
      }
      panel={
        <>
          <Card title="Noise">
            <Slider
              label="Error rate per qubit per step"
              value={li}
              min={0}
              max={LEVELS.length - 1}
              step={1}
              onChange={setLi}
              format={(i) => (LEVELS[i] === 0 ? 'none (perfect qubits)' : pct(LEVELS[i], LEVELS[i] < 0.01 ? 1 : 0))}
              hint="After every step, each qubit is hit by a random X, Y or Z error with this probability."
            />
            <Row style={{ marginTop: 10 }}>
              <Button variant="primary" onClick={runShots} disabled={busy}>
                {busy ? 'Running…' : `Run ${SHOTS} shots`}
              </Button>
              {runs.length > 0 && (
                <Button variant="ghost" onClick={() => setRuns([])}>
                  Clear
                </Button>
              )}
            </Row>
          </Card>
          {msg && (
            <WhatHappened tone={msg.tone} deeper={msg.deeper}>
              {msg.text}
            </WhatHappened>
          )}
          {done.every(Boolean) && (
            <Card title="Where this leads">
              <p style={{ marginTop: 0 }}>
                Part III shows how: no-cloning rules out backups, entanglement spreads one qubit over many, parity checks find errors without looking, and the surface code
                puts it all on a chip.
              </p>
              <ButtonLink to="/learn/no-cloning" variant="primary">
                Part III: keep it alive →
              </ButtonLink>
            </Card>
          )}
        </>
      }
    />
  );
}

function SignalPlot({ runs }: { runs: RunResult[] }) {
  const W = 600,
    H = 170,
    padL = 40,
    padB = 26,
    padT = 10;
  const xOf = (p: number) => padL + (LEVELS.indexOf(p) / (LEVELS.length - 1)) * (W - padL - 14);
  const yOf = (v: number) => padT + (1 - v) * (H - padT - padB);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={css.plot} role="img" aria-label={`Fraction of runs on a peak for each error rate you tried: ${runs.map((r) => `${pct(r.p, 1)}: ${pct(r.peak, 0)}`).join(', ')}`}>
      <line className={css.axis} x1={padL} x2={W - 8} y1={H - padB} y2={H - padB} />
      <line className={css.axis} x1={padL} x2={padL} y1={padT} y2={H - padB} />
      <line className={css.oneLine} x1={padL} x2={W - 8} y1={yOf(4 / Q)} y2={yOf(4 / Q)} style={{ stroke: 'var(--coral)' }} />
      <text className={css.axisText} x={W - 10} y={yOf(4 / Q) - 4} textAnchor="end">
        pure chance
      </text>
      {[0, 0.5, 1].map((v) => (
        <text key={v} className={css.axisText} x={padL - 6} y={yOf(v) + 4} textAnchor="end">
          {pct(v, 0)}
        </text>
      ))}
      {LEVELS.map((p) => (
        <text key={p} className={css.axisText} x={xOf(p)} y={H - 8} textAnchor="middle">
          {p === 0 ? '0' : pct(p, p < 0.01 ? 1 : 0)}
        </text>
      ))}
      {runs.map((r, i) => (
        <circle key={i} cx={xOf(r.p)} cy={yOf(r.peak)} r={5} fill="var(--blue)" stroke="var(--bg)" />
      ))}
      <text className={css.axisText} x={padL + 4} y={padT + 8}>
        runs on a peak
      </text>
    </svg>
  );
}
