// Chapter 5: Shor's algorithm, end to end. Seven steps on real register-level state vectors:
// choose N and a, superpose every x, compute a^x mod N into a second register, measure it
// (the input collapses to a comb), apply the QFT (peaks), measure, then continued fractions
// and gcd. Runs are seeded; "Run 50 times" shows how often one run succeeds.

import { useMemo, useRef, useState } from 'react';
import { expectedPeaks } from '../../../core/qft';
import { makeRng } from '../../../core/rng';
import {
  bitsFor,
  comb,
  coprimeBases,
  modPow,
  outputValues,
  postprocess,
  qftOfComb,
  recommendedT,
  registers,
  sampleIndex,
  successProbability,
  type PostResult,
  type PostStatus,
} from '../../../core/shor';
import { chapterBySlug } from '../../content';
import { ProbChart } from '../../components/FourierViews';
import { Button, Card, Row, Segmented, Slider, WhatHappened, pct } from '../../components/ui';
import { ChapterFrame } from './ChapterFrame';
import s from '../screen.module.css';
import css from './Shor.module.css';

const meta = chapterBySlug('shor')!;
const NS = [15, 21, 33, 35] as const;
const DEFAULT_A: Record<number, number> = { 15: 7, 21: 2, 33: 5, 35: 2 };
const defaultT = (N: number) => (N === 15 ? 4 : recommendedT(N));

const STAGES = ['Choose N', 'Superpose', 'Compute aˣ mod N', 'Measure output', 'QFT', 'Measure input', 'Classical math'];

const STATUS_TEXT: Record<PostStatus, string> = {
  ok: 'found the factors',
  zero: 'measured k = 0',
  'no-period': 'k between peaks',
  odd: 'odd period',
  trivial: 'unlucky a',
};

function valueColor(i: number, total: number) {
  return `hsl(${Math.round((i * 360) / Math.max(1, total) + 200) % 360} 70% 62%)`;
}

export function ChapterShor() {
  const [N, setN] = useState<number>(15);
  const [a, setA] = useState(7);
  const [t, setT] = useState(4);
  const [stage, setStage] = useState(0);
  const [run, setRun] = useState(0);
  const [v, setV] = useState<number | null>(null);
  const [k, setK] = useState<number | null>(null);
  const [batch, setBatch] = useState<{ runs: number; by: Record<PostStatus, number>; exact: number } | null>(null);
  const [done, setDone] = useState([false, false, false, false]);
  const rngRef = useRef(makeRng(7000));
  const mark = (i: number) => setDone((d) => d.map((x, j) => (j === i ? true : x)));

  const R = useMemo(() => registers(N, a, t), [N, a, t]);
  const outs = useMemo(() => outputValues(R), [R]);
  const colorOf = useMemo(() => {
    const m = new Map<number, string>();
    outs.forEach((o, i) => m.set(o.v, valueColor(i, outs.length)));
    return m;
  }, [outs]);
  const after = useMemo(() => (v === null ? null : qftOfComb(R, v)), [R, v]);
  const post: PostResult | null = useMemo(() => (k === null ? null : postprocess(k, R.Q, N, a)), [k, R.Q, N, a]);

  const choose = (n: number, base: number, tt: number) => {
    setN(n);
    setA(base);
    setT(tt);
    setStage(0);
    setV(null);
    setK(null);
    setBatch(null);
  };

  const advance = () => {
    const next = Math.min(6, stage + 1);
    if (next === 3) {
      const rng = rngRef.current;
      const i = sampleIndex(
        outs.map((o) => o.count / R.Q),
        rng,
      );
      setV(outs[i].v);
    }
    if (next === 5 && v !== null) {
      setK(sampleIndex(qftOfComb(R, v).p, rngRef.current));
    }
    if (next === 6 && k !== null) {
      const res = postprocess(k, R.Q, N, a);
      if (res.status === 'ok' && N === 15) mark(0);
      if (res.status === 'ok' && N === 21) mark(1);
      if (res.status !== 'ok') mark(2);
    }
    setStage(next);
  };
  const runToEnd = () => {
    // Same draws as stepping, so a run is reproducible from its seed.
    let vv = v,
      kk = k;
    const rng = rngRef.current;
    if (stage < 3) vv = outs[sampleIndex(outs.map((o) => o.count / R.Q), rng)].v;
    if (stage < 5) kk = sampleIndex(qftOfComb(R, vv!).p, rng);
    setV(vv);
    setK(kk);
    const res = postprocess(kk!, R.Q, N, a);
    if (res.status === 'ok' && N === 15) mark(0);
    if (res.status === 'ok' && N === 21) mark(1);
    if (res.status !== 'ok') mark(2);
    setStage(6);
  };
  const goBack = (i: number) => {
    if (i >= stage) return;
    if (i < 3) setV(null);
    if (i < 5) setK(null);
    setStage(i);
  };
  const newRun = () => {
    setRun((x) => x + 1);
    rngRef.current = makeRng(7000 + run + 1);
    setV(null);
    setK(null);
    setStage(1);
  };
  const runBatch = () => {
    const rng = makeRng(9100 + run);
    const by: Record<PostStatus, number> = { ok: 0, zero: 0, 'no-period': 0, odd: 0, trivial: 0 };
    const pv = outs.map((o) => o.count / R.Q);
    for (let i = 0; i < 50; i++) {
      const vv = outs[sampleIndex(pv, rng)].v;
      const kk = sampleIndex(qftOfComb(R, vv).p, rng);
      by[postprocess(kk, R.Q, N, a).status]++;
    }
    setBatch({ runs: 50, by, exact: successProbability(R) });
    mark(3);
  };

  // What the chart shows at each stage.
  const Q = R.Q;
  let values: Float64Array = new Float64Array(Q);
  let colors: (string | undefined)[] | undefined;
  let chartCaption = '';
  if (stage === 0) {
    values[0] = 1;
    chartCaption = 'The input register starts at x = 0.';
  } else if (stage <= 2) {
    values.fill(1 / Q);
    if (stage === 2) colors = Array.from(R.f, (fx) => colorOf.get(fx));
    chartCaption = stage === 1 ? `Every x from 0 to ${Q - 1} at once, each with chance 1/${Q}.` : 'Same chances, but each x is now tied to its value aˣ mod N (color = value).';
  } else if (stage === 3 && v !== null) {
    const xs = comb(R, v);
    for (const x of xs) values[x] = 1 / xs.length;
    colors = Array.from({ length: Q }, () => colorOf.get(v));
    chartCaption = `Only the x with aˣ mod N = ${v} survive: ${xs.slice(0, 4).join(', ')}, … spaced r apart.`;
  } else if (after) {
    values = after.p;
    chartCaption = stage === 4 ? 'After the QFT: sharp peaks. Their spacing hides r.' : `Measured k = ${k}.`;
  }
  const markers = stage === 6 ? expectedPeaks(t, R.r) : undefined;

  const explain = [
    `We will factor N = ${N} using base a = ${a}. The input register has t = ${t} qubits (Q = ${Q} values of x); the output register has ${R.m} qubits to hold aˣ mod ${N}.`,
    `Hadamards on all ${t} input qubits put every x from 0 to ${Q - 1} into superposition at once. The output register still holds 1.`,
    `One big circuit computes aˣ mod ${N} into the output register, for every x at the same time. The two registers are now entangled: each x is paired with its value.`,
    v === null ? '' : `We measure the output register and see ${v}. The input register collapses to only the x values that give ${v}. They are evenly spaced, exactly r apart, but start at a random place.`,
    `The QFT turns that evenly spaced comb into peaks near multiples of ${Q}/r, and the random starting place no longer matters.`,
    k === null ? '' : `Measuring the input register gives k = ${k}. One number, but it is (close to) a multiple of ${Q}/r.`,
    'Now ordinary arithmetic: find the simple fraction closest to k/Q, read r from its denominator, then two gcds.',
  ][stage];

  const tasks = [
    { label: <>Factor <b>15</b> with Shor&apos;s algorithm, step by step.</>, done: done[0] },
    { label: <>Factor <b>21</b>.</>, done: done[1] },
    { label: <>Watch a run fail, and read why.</>, done: done[2] },
    { label: <>Run it <b>50 times</b>: how often does one run succeed?</>, done: done[3] },
  ];

  return (
    <ChapterFrame
      meta={meta}
      clip={{ id: 'shor', caption: "From the film: Shor's algorithm on real simulated registers, end to end." }}
      goal="Factor a number with a (simulated) quantum computer, one step at a time."
      tasks={tasks}
      complete={done.every(Boolean)}
      canvas={
        <div className={s.stateGrid}>
          <Card>
            <ol className={css.stages} aria-label="Steps of Shor's algorithm">
              {STAGES.map((name, i) => (
                <li key={name}>
                  <button data-state={i < stage ? 'done' : i === stage ? 'current' : 'todo'} disabled={i > stage} onClick={() => goBack(i)} aria-label={`Step ${i}: ${name}${i < stage ? ' (go back to it)' : ''}`}>
                    <span className={css.stageNum}>{i}</span> {name}
                  </button>
                </li>
              ))}
            </ol>
            <div className={css.registers}>
              <div className={css.register}>
                <b>Input register · {t} qubits</b>
                <span className="mono">
                  {stage === 0 ? '|0⟩' : stage <= 2 ? `all x = 0…${Q - 1}` : stage === 3 ? `comb: x with aˣ mod N = ${v}` : stage === 4 ? 'QFT of the comb' : `measured k = ${k}`}
                </span>
              </div>
              <div className={css.register}>
                <b>Output register · {bitsFor(N)} qubits</b>
                <span className="mono">{stage <= 1 ? '|1⟩' : stage === 2 ? `${a}ˣ mod ${N} (entangled)` : `measured ${v}`}</span>
              </div>
            </div>
            <ProbChart values={values} colors={colors} markers={markers} highlight={stage >= 5 ? k : null} height={140} label={`Input register probabilities at step ${stage}: ${chartCaption}`} caption={chartCaption} />
            <p className={css.explain} aria-live="polite">
              {explain}
            </p>
          </Card>

          {(stage === 2 || stage === 3) && (
            <Card title={`The two registers, first ${Math.min(Q, 24)} values of x`}>
              <div className={css.table}>
                {Array.from({ length: Math.min(Q, 24) }, (_, x) => (
                  <div key={x} className={css.cell} data-dim={stage === 3 && R.f[x] !== v ? 1 : 0} style={{ borderColor: colorOf.get(R.f[x]) }}>
                    <span>x={x}</span>
                    <span style={{ color: colorOf.get(R.f[x]) }}>{R.f[x]}</span>
                  </div>
                ))}
              </div>
              <p className="faint" style={{ fontSize: '0.82rem', margin: '8px 0 0' }}>
                Top: x in the input register. Bottom: {a}ˣ mod {N} in the output register. The colors repeat with the period, but the algorithm never gets to read this table.
              </p>
            </Card>
          )}

          {stage === 6 && post && (
            <Card title="Classical math: from k to the factors">
              <div className={css.cf}>
                <div>
                  k / Q = {post.k} / {Q} = <b>{(post.k / Q).toFixed(5)}</b>
                </div>
                {post.status !== 'zero' && (
                  <div>
                    Closest simple fractions (continued fraction), denominators below {N}:{' '}
                    <b>{post.convergents.map((c) => `${c.p}/${c.q}`).join(', ') || 'none'}</b>
                  </div>
                )}
                {post.r !== null && post.guess !== null && post.guess !== post.r && (
                  <div>
                    Denominator {post.guess} fails the check ({a}
                    <sup>{post.guess}</sup> mod {N} = {modPow(a, post.guess, N)}, not 1). The fraction may have reduced, so we also try small multiples of the denominators.
                  </div>
                )}
                {post.r !== null && (
                  <div>
                    Period r = <b>{post.r}</b>: check {a}
                    <sup>{post.r}</sup> mod {N} = {modPow(a, post.r, N)} ✓
                  </div>
                )}
                {post.half !== undefined && (
                  <div>
                    {a}
                    <sup>{post.r! / 2}</sup> mod {N} = <b>{post.half}</b>
                  </div>
                )}
                <div style={{ color: post.status === 'ok' ? 'var(--green)' : 'var(--amber)' }}>{post.note}</div>
              </div>
              {markers && (
                <p className="faint" style={{ fontSize: '0.82rem', margin: '8px 0 0' }}>
                  The dashed lines on the chart are where theory puts the peaks, multiples of {Q}/{R.r} = {(Q / R.r).toFixed(2)}, now that we know r.
                </p>
              )}
            </Card>
          )}
        </div>
      }
      panel={
        <>
          <Card title="Controls">
            <Row>
              {stage < 6 ? (
                <Button variant="primary" onClick={advance}>
                  {stage === 0 ? 'Start ▶' : `Next: ${STAGES[stage + 1]} ▶`}
                </Button>
              ) : (
                <Button variant="primary" onClick={newRun}>
                  New run ↻
                </Button>
              )}
              {stage < 6 && <Button onClick={runToEnd}>Run to the end</Button>}
              <Button variant="ghost" onClick={runBatch}>
                Run 50 times
              </Button>
            </Row>
          </Card>
          {stage === 6 && post && (
            <WhatHappened tone={post.status === 'ok' ? 'good' : 'warn'} title={post.status === 'ok' ? 'Factored!' : 'This run failed'}>
              {post.status === 'ok' ? `${N} = ${post.factors![0]} × ${post.factors![1]}. ` : ''}
              {post.status === 'ok'
                ? 'The quantum computer only found the period; the rest was school arithmetic.'
                : `${post.note} Failures are normal: Shor's algorithm is repeated until it works, which takes only a few runs on average.`}
            </WhatHappened>
          )}
          {batch && (
            <Card title={`50 runs of N = ${N}, a = ${a}`}>
              <div className={css.statRow}>
                <div className={css.stat}>
                  <span className={css.big}>{batch.by.ok}/50</span>
                  <span>found the factors</span>
                </div>
                <div className={css.stat}>
                  <span className={css.big}>{pct(batch.exact, 0)}</span>
                  <span>exact chance per run</span>
                </div>
              </div>
              <p className="faint" style={{ fontSize: '0.82rem', margin: '8px 0 0' }}>
                Failures:{' '}
                {(Object.keys(batch.by) as PostStatus[])
                  .filter((st) => st !== 'ok' && batch.by[st])
                  .map((st) => `${batch.by[st]} ${STATUS_TEXT[st]}`)
                  .join(', ') || 'none'}
                .
              </p>
            </Card>
          )}
          <Card title="Set up">
            <Segmented label="Number to factor" value={N} onChange={(n) => choose(n, DEFAULT_A[n], defaultT(n))} options={NS.map((n) => ({ value: n, label: String(n) }))} />
            <div className={css.bases} role="group" aria-label="Base a">
              {coprimeBases(N).map((b) => (
                <button key={b} aria-pressed={b === a} onClick={() => choose(N, b, t)}>
                  {b}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 12 }}>
              <Slider
                label="Input register size"
                value={t}
                min={3}
                max={9}
                step={1}
                onChange={(tt) => choose(N, a, tt)}
                format={(tt) => `${tt} qubits · Q = ${2 ** tt}`}
                hint={`Textbook choice: Q ≥ N² (${recommendedT(N)} qubits${Math.ceil(Math.log2(N * N)) > 9 ? ', capped at 9 here' : ''}). Smaller registers blur the peaks unless r divides Q.`}
              />
            </div>
          </Card>
        </>
      }
    />
  );
}
