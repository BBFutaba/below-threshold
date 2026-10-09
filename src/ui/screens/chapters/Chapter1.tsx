// Chapter 1: Superposition.

import { useState } from 'react';
import { chapterBySlug } from '../../content';
import { AmplitudeBars, BlochSphere, CircuitStrip, Histogram } from '../../components/QuantumViews';
import { Button, Card, Row, Slider, WhatHappened } from '../../components/ui';
import { ChapterFrame, GatePalette } from './ChapterFrame';
import { useCircuit } from './useCircuit';
import s from '../screen.module.css';

const meta = chapterBySlug('superposition')!;

export function Chapter1() {
  const c = useCircuit(1, 101);
  const [counts, setCounts] = useState<number[] | null>(null);
  const [done, setDone] = useState([false, false, false, false]);
  const [msg, setMsg] = useState<{ text: string; deeper?: string; tone?: 'good' | 'info' } | null>(null);
  const [ryMode, setRyMode] = useState(false);
  const [theta, setTheta] = useState(0);

  const p1 = c.state.prob1(0);
  const mark = (i: number) => setDone((d) => d.map((v, j) => (j === i ? true : v)));
  const opsKey = c.ops.map((o) => o.g).join('');

  const gate = (g: string) => {
    setRyMode(false);
    setCounts(null);
    c.add({ g: g as 'X' | 'H' | 'Z', q: 0 });
    const next = [...opsKey.split(''), g].join('');
    const after = c.state.clone();
    if (g === 'X') after.x(0);
    if (g === 'H') after.h(0);
    if (g === 'Z') after.z(0);
    const q1 = after.prob1(0);
    if (g === 'X' && q1 > 0.999) {
      mark(0);
      setMsg({ text: 'X flipped the qubit from |0⟩ to |1⟩, like a classical NOT.', tone: 'good' });
    } else if (g === 'H' && Math.abs(q1 - 0.5) < 1e-9) {
      setMsg({
        text: 'H put the qubit in an equal superposition: amplitude 1/√2 on |0⟩ and on |1⟩. Now run 100 shots.',
        deeper: 'Probability is the squared amplitude: (1/√2)² = 1/2. The state is not secretly 0 or 1; each measurement is genuinely random.',
      });
    } else if (g === 'H' && next.endsWith('HH') && q1 < 1e-9) {
      setMsg({
        text: 'Two H gates brought the qubit back to |0⟩. The two paths to |1⟩ had opposite signs and canceled: interference.',
        deeper: 'H|0⟩ = (|0⟩ + |1⟩)/√2. Applying H again sends |0⟩ → (|0⟩+|1⟩)/√2 and |1⟩ → (|0⟩−|1⟩)/√2; the |1⟩ parts cancel exactly. Run shots to confirm it is 0 every time.',
      });
    } else if (g === 'Z') {
      setMsg({ text: 'Z flips the sign (phase) of |1⟩. Probabilities do not change, but the bar color does: phase is real and matters for interference.' });
    }
  };

  const shots = () => {
    const ct = c.state.sample(100, c.random);
    setCounts([ct[0], ct[1]]);
    if (!ryMode && Math.abs(p1 - 0.5) < 1e-9 && c.ops.length > 0) {
      mark(1);
      setMsg({ text: `About half 0 and half 1 (${ct[0]} vs ${ct[1]}). Each shot measures a fresh copy of the same state.`, tone: 'good' });
    } else if (!ryMode && p1 < 1e-9 && opsKey.endsWith('HH')) {
      mark(3);
      setMsg({ text: `All ${ct[0]} shots gave 0. The amplitudes for 1 canceled out. That is interference, and it has no classical analogue.`, tone: 'good' });
    } else {
      setMsg({ text: `${ct[0]} zeros and ${ct[1]} ones from 100 fresh copies.` });
    }
  };

  const measureOnce = () => {
    setRyMode(false);
    c.add({ g: 'M', q: 0 });
    setCounts(null);
    setMsg({ text: 'Measuring collapsed the state to a single answer. The superposition is gone; measuring again gives the same result.' });
  };

  const setRy = (t: number) => {
    setRyMode(true);
    setTheta(t);
    setCounts(null);
    c.setOps([{ g: 'Ry', q: 0, t }]);
    const prob1 = Math.sin(t / 2) ** 2;
    if (Math.abs(prob1 - 0.25) < 0.01) {
      mark(2);
      setMsg({ text: 'You hit 75/25: Ry(θ) set the amplitudes to √0.75 and √0.25.', tone: 'good', deeper: 'Ry(θ)|0⟩ = cos(θ/2)|0⟩ + sin(θ/2)|1⟩, so P(1) = sin²(θ/2) = 0.25 at θ = 2·asin(0.5) = 60°.' });
    }
  };

  const allDone = done.every(Boolean);
  const tasks = [
    { label: <>Turn |0⟩ into |1⟩ using <b>X</b>.</>, done: done[0] },
    { label: <>Make a 50/50 state with <b>H</b> and run 100 shots.</>, done: done[1] },
    { label: <>Use the <b>Ry</b> slider to hit a 75/25 target (75% zeros).</>, done: done[2] },
    { label: <>Interference puzzle: from |0⟩, apply <b>H twice</b> and run shots.</>, done: done[3] },
  ];

  return (
    <ChapterFrame
      meta={meta}
      goal="Find out what a qubit really holds, and what measuring it does."
      tasks={tasks}
      complete={allDone}
      canvas={
        <div className={s.stateGrid}>
          <div className={s.blochRow}>
            <BlochSphere bloch={c.state.bloch(0)} label="qubit 0" size={190} />
          </div>
          <AmplitudeBars state={c.state} />
          <Card title="Circuit (tap a gate to undo back to it)">
            <CircuitStrip n={1} ops={c.ops} onUndoTo={(i) => (c.undoTo(i), setCounts(null), setRyMode(false))} />
          </Card>
          {counts && <Histogram counts={counts} labels={['0', '1']} expected={[1 - p1, p1]} caption="100 shots (dashed: expected)" />}
        </div>
      }
      panel={
        <>
          <Card title="Gates">
            <GatePalette
              gates={[
                { id: 'X', label: 'X', title: 'X gate: flip 0 and 1' },
                { id: 'H', label: 'H', title: 'Hadamard: make an equal superposition' },
                { id: 'Z', label: 'Z', title: 'Z gate: flip the phase of |1⟩' },
              ]}
              onGate={gate}
            />
            <div style={{ marginTop: 14 }}>
              <Slider
                label="Ry(θ) from |0⟩"
                value={theta}
                min={0}
                max={Math.PI}
                step={Math.PI / 180}
                onChange={setRy}
                format={(v) => `${Math.round((v * 180) / Math.PI)}° · P(1) = ${(100 * Math.sin(v / 2) ** 2).toFixed(1)}%`}
              />
            </div>
          </Card>
          <Row>
            <Button onClick={measureOnce}>Measure once</Button>
            <Button variant="primary" onClick={shots}>
              Run 100 shots
            </Button>
            <Button variant="ghost" onClick={() => (c.reset(), setCounts(null), setRyMode(false), setTheta(0), setMsg(null))}>
              Reset to |0⟩
            </Button>
          </Row>
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
