// Threshold lab: live Monte Carlo experiments in Web Workers. Below the threshold, bigger
// codes win.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { NoiseModel } from '../../core/noise';
import type { DecoderId } from '../../core/decoders/index';
import type { PointResult } from '../../core/simulate';
import { crossings, interpLogLog } from '../../core/stats';
import { simPool, resetPool } from '../../workers/client';
import validation from '../../data/validation.json';
import { ThresholdChart, ChartLegend, type ChartSeries } from '../components/ThresholdChart';
import { MediaClip } from '../components/MediaClip';
import { Button, ButtonLink, Card, GoalLine, Pill, Row, Segmented, Slider, WhatHappened, pct } from '../components/ui';
import s from './screen.module.css';
import css from './Lab.module.css';

type ModelKind = 'bitflip' | 'depolarizing' | 'phenomenological';

const MODELS: Record<ModelKind, { label: string; range: [number, number]; default: [number, number]; marker: number; blurb: string }> = {
  bitflip: { label: 'Bit-flip only', range: [0.02, 0.2], default: [0.04, 0.16], marker: 0.06, blurb: 'X errors with probability p, perfect checks' },
  depolarizing: { label: 'Depolarizing', range: [0.04, 0.3], default: [0.06, 0.24], marker: 0.09, blurb: 'X, Y or Z each with probability p/3, perfect checks' },
  phenomenological: { label: 'With measurement errors', range: [0.005, 0.06], default: [0.01, 0.05], marker: 0.015, blurb: 'bit flips plus misreported checks (q = p), d rounds' },
};

const N_POINTS = 7;

interface ValidationVerdict {
  model: string;
  decoder: string;
  estimate: number | null;
  published: number;
  band: [number, number];
  pass: boolean;
}

export function Lab() {
  const [model, setModel] = useState<ModelKind>('bitflip');
  const [decoder, setDecoder] = useState<DecoderId>('mwpm');
  const [ds, setDs] = useState<number[]>([3, 5, 7]);
  const [range, setRange] = useState<[number, number]>(MODELS.bitflip.default);
  const [marker, setMarker] = useState(MODELS.bitflip.marker);
  const [results, setResults] = useState<PointResult[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [showPre, setShowPre] = useState(false);
  const runId = useRef(0);

  useEffect(() => {
    setRange(MODELS[model].default);
    setMarker(MODELS[model].marker);
    setResults([]);
  }, [model]);
  useEffect(() => setResults([]), [decoder]);

  const ps = useMemo(() => {
    const [a, b] = range;
    return Array.from({ length: N_POINTS }, (_, i) => +(a + ((b - a) * i) / (N_POINTS - 1)).toFixed(4));
  }, [range]);

  const run = async () => {
    const id = ++runId.current;
    setRunning(true);
    setResults([]);
    const specs = ps.flatMap((p, i) =>
      ds.map((d) => {
        const m: NoiseModel = model === 'phenomenological' ? { kind: 'phenomenological', p, q: p, rounds: d } : { kind: model, p };
        return { d, model: m, decoder, seed: 1000 * d + i + 7, maxFailures: 100, maxTrials: 20_000, timeBudgetMs: 6000 };
      }),
    );
    // Interleave so every curve fills in together.
    specs.sort((a, b) => a.d - b.d);
    const order = ps.flatMap((_, i) => ds.map((_, j) => specs[j * ps.length + i]));
    setProgress({ done: 0, total: order.length });
    const pool = simPool();
    let next = 0;
    const worker = async (w: (typeof pool)[number]) => {
      while (next < order.length && runId.current === id) {
        const spec = order[next++];
        const r = await w.runPoint(spec);
        if (runId.current !== id) return;
        setResults((prev) => [...prev, r]);
        setProgress((pr) => ({ ...pr, done: pr.done + 1 }));
      }
    };
    await Promise.all(pool.map(worker));
    if (runId.current === id) setRunning(false);
  };

  const stop = () => {
    runId.current++;
    resetPool();
    setRunning(false);
  };

  const metric = (r: PointResult) => (model === 'phenomenological' ? { pL: r.pShot, lo: r.ciShot.lo, hi: r.ciShot.hi } : { pL: r.pL, lo: r.ci.lo, hi: r.ci.hi });

  const series: ChartSeries[] = useMemo(() => {
    const live = ds.map((d) => ({
      key: `live${d}`,
      d,
      label: `d=${d}`,
      points: results
        .filter((r) => r.d === d)
        .map((r) => ({ p: r.p, ...metric(r) }))
        .sort((a, b) => a.p - b.p), // workers finish out of order; crossings() needs a sorted grid
    }));
    if (!showPre) return live;
    const pre = (validation.curves as Record<string, Record<string, { d: number; p: number; pL: number; ci: { lo: number; hi: number }; pShot: number; ciShot: { lo: number; hi: number } }[]>>)[model]?.[decoder] ?? [];
    const preDs = [...new Set(pre.map((r) => r.d))].filter((d) => d <= 11);
    const preSeries = preDs.map((d) => ({
      key: `pre${d}`,
      d,
      dashed: true,
      label: `validation d=${d}`,
      points: pre
        .filter((r) => r.d === d)
        .map((r) => (model === 'phenomenological' ? { p: r.p, pL: r.pShot, lo: r.ciShot.lo, hi: r.ciShot.hi } : { p: r.p, pL: r.pL, lo: r.ci.lo, hi: r.ci.hi })),
    }));
    return [...live, ...preSeries];
  }, [results, ds, showPre, model, decoder]); // eslint-disable-line react-hooks/exhaustive-deps

  const live = series.filter((x) => !x.dashed && x.points.length > 0);
  const sortedDs = [...ds].sort((a, b) => a - b);
  const small = live.find((x) => x.d === sortedDs[0]);
  const big = live.find((x) => x.d === sortedDs[sortedDs.length - 1]);
  const complete = small && big && small.points.length === ps.length && big.points.length === ps.length && small !== big;
  const cross = complete ? crossings(small!.points, big!.points) : [];
  const crossing = cross.length ? cross[Math.floor(cross.length / 2)] : null;

  // Readout at the marker.
  const atMarker = live.map((x) => ({ d: x.d, v: interpLogLog(x.points, marker) })).filter((x) => x.v !== null) as { d: number; v: number }[];
  atMarker.sort((a, b) => a.d - b.d);
  let verdict: 'below' | 'above' | null = null;
  let lambda: number | null = null;
  if (atMarker.length >= 2) {
    verdict = atMarker[atMarker.length - 1].v < atMarker[0].v ? 'below' : 'above';
    const ratios: number[] = [];
    for (let i = 0; i + 1 < atMarker.length; i++) {
      const step = (atMarker[i + 1].d - atMarker[i].d) / 2;
      ratios.push(Math.pow(atMarker[i].v / atMarker[i + 1].v, 1 / step));
    }
    lambda = Math.exp(ratios.reduce((a, b) => a + Math.log(b), 0) / ratios.length);
  }

  const v = (validation.verdicts as unknown as ValidationVerdict[]).find((x) => x.model === model && x.decoder === decoder);
  const toggleD = (d: number) => setDs((cur) => (cur.includes(d) ? (cur.length > 1 ? cur.filter((x) => x !== d) : cur) : [...cur, d].sort((a, b) => a - b)));

  return (
    <div className={s.page}>
      <header className={s.header}>
        <p className={s.eyebrow}>Threshold lab</p>
        <h1>Watch the threshold appear</h1>
        <p className={s.lede}>Real Monte Carlo experiments run in your browser. Every point is thousands of simulated memories, decoded live.</p>
      </header>
      <div className={s.split}>
        <div className={s.canvas}>
          <ThresholdChart
            series={series}
            xDomain={range}
            marker={marker}
            onMarker={setMarker}
            crossing={crossing}
            yLabel={model === 'phenomenological' ? 'logical error rate (whole d-round memory)' : 'logical error rate'}
            xLabel={model === 'phenomenological' ? 'physical error rate p (= measurement error q)' : 'physical error rate p'}
          />
          <ChartLegend ds={ds} extra={showPre ? <span className="faint">dashed: precomputed validation run</span> : undefined} />
          <div style={{ marginTop: 14 }}>
            <Slider label="Noise level (drag here or on the chart)" value={marker} min={range[0]} max={range[1]} step={(range[1] - range[0]) / 200} onChange={setMarker} format={(x) => pct(x, 2)} />
          </div>
          <div className={css.readout} data-verdict={verdict ?? 'none'} aria-live="polite">
            {verdict === null ? (
              <span className="muted">{running ? 'Points are streaming in…' : 'Press Run to start the experiment.'}</span>
            ) : verdict === 'below' ? (
              <>
                <b>Below threshold:</b> bigger codes make things better.
                {lambda && <span className="mono"> Suppression Λ ≈ {lambda.toFixed(2)}× per +2 distance</span>}
              </>
            ) : (
              <>
                <b>Above threshold:</b> bigger codes make things worse.
                {lambda && <span className="mono"> Λ ≈ {lambda.toFixed(2)} (below 1)</span>}
              </>
            )}
          </div>
          <p className="faint" style={{ fontSize: '0.85rem', marginTop: 10 }}>
            In 2024, Google&apos;s Willow chip showed this on real hardware: each step from d = 3 to 5 to 7 cut the logical error per cycle by a factor of about 2.1 (Λ ≈
            2.14), the first clear below-threshold memory.
          </p>
        </div>
        <div className={s.panel}>
          <Card>
            <GoalLine>Find the noise level where bigger codes start to win.</GoalLine>
            <Row>
              {!running ? (
                <Button variant="primary" onClick={run}>
                  Run experiment
                </Button>
              ) : (
                <Button onClick={stop}>Stop</Button>
              )}
              {running && (
                <span className="faint" style={{ fontSize: '0.88rem' }}>
                  {progress.done}/{progress.total} points
                </span>
              )}
            </Row>
          </Card>
          <Card title="Experiment">
            <div className={s.stateGrid} style={{ gap: 14 }}>
              <div>
                <div className="muted" style={{ fontSize: '0.86rem', marginBottom: 6 }}>
                  Noise model
                </div>
                <Segmented label="Noise model" value={model} onChange={setModel} options={(Object.keys(MODELS) as ModelKind[]).map((k) => ({ value: k, label: MODELS[k].label }))} />
                <div className="faint" style={{ fontSize: '0.8rem', marginTop: 6 }}>
                  {MODELS[model].blurb}
                </div>
              </div>
              <div>
                <div className="muted" style={{ fontSize: '0.86rem', marginBottom: 6 }}>
                  Decoder
                </div>
                <Segmented
                  label="Decoder"
                  value={decoder}
                  onChange={setDecoder}
                  options={[
                    { value: 'mwpm', label: 'Exact matching' },
                    { value: 'unionFind', label: 'Union-find' },
                    { value: 'greedy', label: 'Greedy' },
                  ]}
                />
              </div>
              <div>
                <div className="muted" style={{ fontSize: '0.86rem', marginBottom: 6 }}>
                  Code distances
                </div>
                <div className={css.toggles} role="group" aria-label="Code distances">
                  {[3, 5, 7, 9].map((d) => (
                    <button key={d} aria-pressed={ds.includes(d)} onClick={() => toggleD(d)}>
                      d = {d}
                    </button>
                  ))}
                </div>
              </div>
              <Slider
                label="Error-rate range: from"
                value={range[0]}
                min={MODELS[model].range[0]}
                max={range[1] - 0.005}
                step={0.0025}
                onChange={(a) => setRange([a, range[1]])}
                format={(x) => pct(x, 1)}
              />
              <Slider
                label="to"
                value={range[1]}
                min={range[0] + 0.005}
                max={MODELS[model].range[1]}
                step={0.0025}
                onChange={(b) => setRange([range[0], b])}
                format={(x) => pct(x, 1)}
              />
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.9rem', minHeight: 32 }}>
                <input type="checkbox" checked={showPre} onChange={(e) => setShowPre(e.target.checked)} />
                Overlay our precomputed validation run (dashed, clearly labeled)
              </label>
            </div>
          </Card>
          {v && (
            <Card title="Validation badge">
              <div className={css.badge}>
                <Pill tone={v.pass ? 'green' : 'coral'}>{v.pass ? 'validated' : 'out of band'}</Pill>
                <div>
                  Our threshold <b className="mono">{v.estimate ? pct(v.estimate, 2) : 'n/a'}</b> vs published ≈ <b className="mono">{pct(v.published, 1)}</b>
                </div>
              </div>
              <p className="faint" style={{ fontSize: '0.82rem', margin: '8px 0 0' }}>
                From our validation suite: d up to 13, cross-checked against Stim and PyMatching. <ButtonLink to="/honesty" small variant="ghost">Validation report →</ButtonLink>
              </p>
            </Card>
          )}
          <WhatHappened deeper="Each point runs until 100 logical failures or 20,000 trials, whichever comes first, in a Web Worker so the page never freezes. Bands are 95% Wilson intervals. The suppression factor Λ is how much the logical error rate drops each time the distance grows by 2.">
            Below the threshold, adding qubits suppresses errors exponentially. Above it, bigger codes just add more ways to fail.
          </WhatHappened>
          <MediaClip id="threshold" caption="From the film: the threshold, drawn from our validation data." />
        </div>
      </div>
    </div>
  );
}
