// Chapter 5: Phase, a qubit's hidden clock. H, a phase dial, H again: measurement cannot see
// the phase, interference can. Then three qubits: eight clocks winding at frequency f, where
// each qubit only needs its own phase turn (the structure the QFT builds on).

import { useMemo, useState } from 'react';
import { QState } from '../../../core/quantum';
import { makeRng } from '../../../core/rng';
import { chapterBySlug } from '../../content';
import { BlochSphere, CircuitStrip, Histogram, type Op } from '../../components/QuantumViews';
import { PhaseClocks, turnsLabel } from '../../components/FourierViews';
import { Button, Card, Row, Slider, WhatHappened } from '../../components/ui';
import { ChapterFrame } from './ChapterFrame';
import s from '../screen.module.css';

const meta = chapterBySlug('phase')!;
const TAU = 2 * Math.PI;

export function ChapterPhase() {
  const [h1, setH1] = useState(false);
  const [h2, setH2] = useState(false);
  const [phi, setPhi] = useState(0);
  const [counts, setCounts] = useState<number[] | null>(null);
  const [f, setF] = useState(0);
  const [seenF, setSeenF] = useState<number[]>([]);
  const [done, setDone] = useState([false, false, false, false]);
  const [msg, setMsg] = useState<{ text: string; deeper?: string; tone?: 'good' | 'info' } | null>(null);
  const [rng] = useState(() => makeRng(202));
  const mark = (i: number) => setDone((d) => d.map((v, j) => (j === i ? true : v)));

  const state = useMemo(() => {
    const st = new QState(1);
    if (h1) st.h(0).phase(0, phi);
    if (h2) st.h(0);
    return st;
  }, [h1, h2, phi]);
  const ops: Op[] = [];
  if (h1) ops.push({ g: 'H', q: 0 });
  if (h1 && Math.abs(phi) > 1e-9) ops.push({ g: 'P', q: 0, t: phi });
  if (h2) ops.push({ g: 'H', q: 0 });
  const p1 = state.prob1(0);

  const eight = useMemo(() => {
    const st = new QState(3);
    for (let q = 0; q < 3; q++) st.h(q).phase(q, (TAU * f * 2 ** q) / 8);
    return st;
  }, [f]);

  const pressH = () => {
    setCounts(null);
    if (!h1) {
      setH1(true);
      mark(0);
      setMsg({
        text: 'H made |+⟩: two equal amplitudes, and both clock hands point the same way (no turn between them).',
        deeper: 'H|0⟩ = (|0⟩ + |1⟩)/√2. The disk size shows how big each amplitude is; the hand shows its direction, the phase.',
      });
    } else if (!h2) {
      setH2(true);
      const q1 = new QState(1).h(0).phase(0, phi).h(0).prob1(0);
      setMsg({
        text:
          q1 > 0.999
            ? 'With a half turn between the paths, the second H sends everything to |1⟩. The two paths to |0⟩ point in opposite directions and cancel. Run 100 shots to check.'
            : q1 < 0.001
              ? 'No turn between the paths, so the second H brings the qubit straight back to |0⟩. Now turn the dial and watch the odds change.'
              : `The second H made the paths interfere: P(1) = sin²(φ/2) = ${(100 * q1).toFixed(0)}%. The hidden phase is now visible as a probability.`,
        deeper: 'H P(φ) H|0⟩ = e^{iφ/2} (cos(φ/2)|0⟩ − i sin(φ/2)|1⟩), so P(1) = sin²(φ/2). Interference converts a direction into odds.',
      });
    }
  };

  const shots = () => {
    const ct = state.sample(100, rng.next);
    setCounts([ct[0], ct[1]]);
    if (h1 && !h2 && Math.abs(phi - Math.PI) < 0.01) {
      mark(1);
      setMsg({
        text: `Still about 50/50 (${ct[0]} vs ${ct[1]}). The |1⟩ hand now points backwards, but a measurement only sees how big each amplitude is, never which way it points.`,
        tone: 'good',
        deeper: 'This state is |−⟩ = (|0⟩ − |1⟩)/√2. It differs from |+⟩ only in phase, and gives exactly the same Z-measurement statistics.',
      });
    } else if (h2 && p1 > 0.999) {
      mark(2);
      setMsg({ text: `All ${ct[1]} shots gave 1. Interference turned the half-turn phase into a certain answer. That is how quantum algorithms read phases.`, tone: 'good' });
    } else {
      setMsg({ text: `${ct[0]} zeros and ${ct[1]} ones from 100 fresh copies.` });
    }
  };

  const setFreq = (v: number) => {
    setF(v);
    const seen = [...new Set([...seenF, v])];
    setSeenF(seen);
    if (seen.includes(1) && seen.includes(2) && !done[3]) {
      mark(3);
      setMsg({
        tone: 'good',
        text: 'At f = 1 the eight clocks wind once around; at f = 2, twice. Each qubit only got its own turn: q0 by f/8, q1 twice that, q2 four times that.',
        deeper: 'The state (1/√8) Σ_y e^{2πi f y/8}|y⟩ factors into three single-qubit states, (|0⟩ + e^{2πi f 2^q/8}|1⟩)/√2 for q = 0, 1, 2. The quantum Fourier transform makes exactly these states.',
      });
    }
  };

  const reset = () => {
    setH1(false);
    setH2(false);
    setPhi(0);
    setCounts(null);
    setMsg(null);
  };

  const tasks = [
    { label: <>Apply <b>H</b> to make |+⟩ and look at the two clocks.</>, done: done[0] },
    { label: <>Turn the |1⟩ clock <b>half a turn</b> (180°), then run 100 shots.</>, done: done[1] },
    { label: <>Apply <b>H again</b> and get 100% ones: interference reads the phase.</>, done: done[2] },
    { label: <>Eight clocks: set the frequency to <b>1</b>, then <b>2</b>.</>, done: done[3] },
  ];

  return (
    <ChapterFrame
      meta={meta}
      clip={{ id: 'qubit', caption: 'From the film: a qubit as an arrow, and the phase you cannot see.' }}
      goal="Find the part of a qubit that measurement can't see, and the trick that reveals it."
      tasks={tasks}
      complete={done.every(Boolean)}
      canvas={
        <div className={s.stateGrid}>
          <Card title="One qubit: disk size = how much, hand = which way (the phase)">
            <div className={s.blochRow} style={{ alignItems: 'center', gap: 24 }}>
              <BlochSphere bloch={state.bloch(0)} label="qubit" size={170} />
              <div style={{ width: 200 }}>
                <PhaseClocks re={state.re} im={state.im} labels={['|0⟩', '|1⟩']} size={92} caption="the two amplitudes" />
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <CircuitStrip n={1} ops={ops} />
            </div>
            {counts && <Histogram counts={counts} labels={['0', '1']} expected={[1 - p1, p1]} caption="100 shots (dashed: expected)" />}
          </Card>
          <Card title="Three qubits, eight clocks">
            <Slider
              label="Frequency f"
              value={f}
              min={0}
              max={7}
              step={1}
              onChange={setFreq}
              format={(v) => `${v} wind${v === 1 ? '' : 's'} around`}
              hint="H on all three qubits, then turn qubit q by f·2^q/8 of a turn."
            />
            <PhaseClocks re={eight.re} im={eight.im} size={60} labels={Array.from({ length: 8 }, (_, i) => String(i))} caption="Clock y has turned f·y/8 of a turn: a wave with frequency f." />
            <div className={s.blochRow}>
              {[0, 1, 2].map((q) => (
                <div key={q} style={{ display: 'grid', justifyItems: 'center' }}>
                  <BlochSphere bloch={eight.bloch(q)} label={`q${q}`} size={118} />
                  <span className="faint" style={{ fontSize: '0.78rem' }}>
                    {turnsLabel((TAU * f * 2 ** q) / 8)}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      }
      panel={
        <>
          <Card title="Controls">
            <Row>
              <Button variant="primary" onClick={pressH} disabled={h2}>
                {h1 ? 'H again' : 'H'}
              </Button>
              <Button onClick={shots}>Run 100 shots</Button>
              <Button variant="ghost" onClick={reset}>
                Reset to |0⟩
              </Button>
            </Row>
            <div style={{ marginTop: 14, opacity: h1 ? 1 : 0.5 }}>
              <Slider
                label="Phase dial: turn the |1⟩ clock"
                value={phi}
                min={0}
                max={TAU}
                step={Math.PI / 12}
                onChange={(v) => (h1 ? (setPhi(v), setCounts(null)) : undefined)}
                format={(v) => `${Math.round((v * 180) / Math.PI)}° · ${turnsLabel(v)}`}
                hint={h1 ? 'The phase gate P(φ) sits between the two H gates.' : 'Apply H first.'}
              />
            </div>
          </Card>
          {msg && (
            <WhatHappened tone={msg.tone} deeper={msg.deeper}>
              {msg.text}
            </WhatHappened>
          )}
        </>
      }
    />
  );
}
