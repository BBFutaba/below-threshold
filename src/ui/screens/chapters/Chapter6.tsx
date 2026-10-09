// Chapter 6: Error discretization. A small rotation Rx(theta) on one data qubit; running
// the checks 200 times gives only two outcomes, "no error" (cos^2(theta/2)) and "full flip
// on that qubit" (sin^2(theta/2)), and after correction the fidelity is 100% every time.

import { useState } from 'react';
import { QState } from '../../../core/quantum';
import { makeRng } from '../../../core/rng';
import { chapterBySlug } from '../../content';
import { BlochSphere, Histogram } from '../../components/QuantumViews';
import { Button, Card, Row, Slider, WhatHappened } from '../../components/ui';
import { MediaClip } from '../../components/MediaClip';
import { ChapterFrame } from './ChapterFrame';
import { encodedData } from './repetition';
import s from '../screen.module.css';

const meta = chapterBySlug('discretization')!;
const THETA_STATE = 1.1;
const RUNS = 200;
const LABELS = ['no error', 'flip q0', 'flip q1', 'flip q2'];
const KEY: Record<string, number> = { '0,0': 0, '1,0': 1, '1,1': 2, '0,1': 3 };

interface RunResult {
  theta: number;
  counts: number[];
  perfect: number;
}

function runChecks(theta: number, seed: number): RunResult {
  const rng = makeRng(seed);
  const target = encodedData(THETA_STATE);
  const counts = [0, 0, 0, 0];
  let perfect = 0;
  for (let t = 0; t < RUNS; t++) {
    const s = new QState(5).ry(0, THETA_STATE).cnot(0, 1).cnot(0, 2);
    s.rx(1, theta); // small continuous error on qubit 1
    s.cnot(0, 3).cnot(1, 3).cnot(1, 4).cnot(2, 4);
    const a = s.measure(3, rng.next),
      b = s.measure(4, rng.next);
    const k = KEY[`${a},${b}`];
    counts[k]++;
    if (k > 0) s.x(k - 1);
    if (a) s.x(3);
    if (b) s.x(4);
    // Compare the data block (ancillas reset to |00>) with the stored state.
    let re = 0,
      im = 0;
    for (let j = 0; j < 8; j++) {
      re += target.re[j] * s.re[j] + target.im[j] * s.im[j];
      im += target.re[j] * s.im[j] - target.im[j] * s.re[j];
    }
    if (re * re + im * im > 1 - 1e-9) perfect++;
  }
  return { theta, counts, perfect };
}

export function Chapter6() {
  const [theta, setTheta] = useState(0);
  const [res, setRes] = useState<RunResult | null>(null);
  const [runs, setRuns] = useState<number[]>([]);
  const [seed, setSeed] = useState(606);

  const run = () => {
    const r = runChecks(theta, seed);
    setRes(r);
    setSeed((x) => x + 1);
    setRuns((prev) => (prev.some((t) => Math.abs(t - theta) < 1e-9) ? prev : [...prev, theta]));
  };

  const pFlip = Math.sin(theta / 2) ** 2;
  // Bloch vector of the erred qubit alone, before measuring the checks (for intuition).
  const single = new QState(1).rx(0, theta).bloch(0);
  const nonzeroRuns = runs.filter((t) => t > 0.01);
  const tasks = [
    { label: <>Drag the <b>error strength</b> to a small, nonzero value.</>, done: theta > 0.01 || nonzeroRuns.length > 0 },
    { label: <>Run the checks {RUNS} times and look at the histogram.</>, done: nonzeroRuns.length > 0 },
    { label: <>Try a second strength: still only two bars, still 100% after correction?</>, done: nonzeroRuns.length > 1 },
  ];

  const measuredFlip = res ? res.counts[2] / RUNS : 0;
  return (
    <ChapterFrame
      meta={meta}
      goal="Understand why error correction works at all when real errors are small, continuous drifts."
      tasks={tasks}
      complete={tasks.every((t) => t.done)}
      canvas={
        <div className={s.stateGrid}>
          <div className={s.blochRow}>
            <BlochSphere bloch={single} label={`a lone qubit after Rx(${theta.toFixed(2)})`} size={160} />
          </div>
          <Histogram
            counts={res ? res.counts : [0, 0, 0, 0]}
            labels={LABELS}
            expected={[1 - pFlip, 0, pFlip, 0]}
            height={150}
            caption={res ? `${RUNS} runs of the checks at strength ${res.theta.toFixed(2)} rad (dashed: formula)` : 'Run the checks to fill the histogram'}
          />
          {res && (
            <Card title="Live readout">
              <Row gap={18}>
                <span>
                  Measured flip rate <b className="mono">{(100 * measuredFlip).toFixed(1)}%</b>
                </span>
                <span>
                  Formula sin²(θ/2) <b className="mono">{(100 * Math.sin(res.theta / 2) ** 2).toFixed(1)}%</b>
                </span>
                <span>
                  Fidelity 100% after correction <b className="mono" style={{ color: res.perfect === RUNS ? 'var(--green)' : 'var(--coral)' }}>{res.perfect}/{RUNS}</b>
                </span>
              </Row>
            </Card>
          )}
        </div>
      }
      panel={
        <>
          <Card title="Error on qubit 1">
            <Slider
              label="Error strength Rx(θ)"
              value={theta}
              min={0}
              max={1.6}
              step={0.01}
              onChange={(v) => setTheta(v)}
              format={(v) => `${v.toFixed(2)} rad · a ${(100 * Math.sin(v / 2) ** 2).toFixed(1)}% partial flip`}
              hint="A partial rotation, not a full flip: the qubit drifts a little toward |1⟩."
            />
            <Row style={{ marginTop: 12 }}>
              <Button variant="primary" onClick={run}>
                Run the checks {RUNS} times
              </Button>
            </Row>
          </Card>
          {res && (
            <WhatHappened
              tone="good"
              deeper={
                <>
                  Rx(θ) = cos(θ/2)·I − i·sin(θ/2)·X. Measuring the checks projects onto one of the two terms: with probability cos²(θ/2) the error vanishes, and
                  with probability sin²(θ/2) it becomes a full X on qubit 1, which the syndrome (1,1) identifies. No in-between outcome exists, so a discrete
                  correction always fixes it. This exact behavior is checked by an automated test.
                </>
              }
            >
              Only two bars appeared: “no error” and “full flip on q1”. Nothing in between. After correction the fidelity was exactly 100% in {res.perfect} of {RUNS} runs.
            </WhatHappened>
          )}
          {res && (
            <Card title="Watch it in motion">
              <MediaClip id="discretization" caption="Manim animation of 200 real simulator runs (qubits numbered 1 to 3 in the clip)." />
            </Card>
          )}
        </>
      }
    />
  );
}
