// Chapter 2: Many qubits at once. Two qubits hold four amplitudes; X and H on each qubit
// build basis states and an even superposition of all four; measuring one qubit of a
// product state leaves the other alone. Then a slider shows the list doubling per qubit.

import { useMemo, useState } from 'react';
import { chapterBySlug } from '../../content';
import { AmplitudeBars, BlochSphere, CircuitStrip, Histogram } from '../../components/QuantumViews';
import { Button, Card, Row, Slider, WhatHappened } from '../../components/ui';
import { ChapterFrame, GatePalette } from './ChapterFrame';
import { useCircuit } from './useCircuit';
import s from '../screen.module.css';
import css from './Shor.module.css';

const meta = chapterBySlug('multi-qubit')!;

const SCALE: [number, string][] = [
  [2, '4 amplitudes'],
  [10, '1,024 amplitudes'],
  [30, 'about a billion'],
  [50, 'about 10¹⁵: more than any laptop can store'],
  [300, 'about 10⁹⁰: more than atoms in the observable universe'],
];

export function ChapterMulti() {
  const c = useCircuit(2, 404);
  const [counts, setCounts] = useState<number[] | null>(null);
  const [n, setN] = useState(3);
  const [done, setDone] = useState([false, false, false, false]);
  const [msg, setMsg] = useState<{ text: string; deeper?: string; tone?: 'good' | 'info' } | null>(null);
  const mark = (i: number) => setDone((d) => d.map((v, j) => (j === i ? true : v)));
  const probs = c.state.probabilities();

  const onGate = (id: string) => {
    setCounts(null);
    const before = c.state;
    if (id === 'M0') {
      // Measuring needs a superposition to be interesting; the outcome is drawn when the op is added.
      const wasEven = [0, 1, 2, 3].every((i) => Math.abs(before.probabilities()[i] - 0.25) < 1e-9);
      c.add({ g: 'M', q: 0 });
      if (wasEven) {
        mark(2);
        setMsg({
          tone: 'good',
          text: 'Qubit 0 gave a definite answer, and qubit 1 is still exactly 50/50. In this state the two qubits are independent, a product state: measuring one tells you nothing about the other.',
          deeper: 'H⊗H|00⟩ = ½(|0⟩ + |1⟩)(|0⟩ + |1⟩): the state factors into one part per qubit. The next chapter builds a pair that does not factor.',
        });
      } else {
        setMsg({ text: 'Measured qubit 0. Try it on the even superposition of all four (H on both qubits first) to see what happens to qubit 1.' });
      }
      return;
    }
    const op = id === 'X0' ? { g: 'X' as const, q: 0 } : id === 'X1' ? { g: 'X' as const, q: 1 } : id === 'H0' ? { g: 'H' as const, q: 0 } : { g: 'H' as const, q: 1 };
    const after = before.clone();
    if (op.g === 'X') after.x(op.q);
    else after.h(op.q);
    c.add(op);
    const p = after.probabilities();
    if (p[1] > 0.999) {
      mark(0);
      setMsg({
        tone: 'good',
        text: 'That is |10⟩: qubit 0 is 1 and qubit 1 is 0. All of the amplitude sits on one of the four possibilities.',
        deeper: 'Labels list qubit 0 first. Read as a binary number with qubit 0 as the ones place, |10⟩ is 1, |01⟩ is 2 and |11⟩ is 3. The Shor chapters count x this way.',
      });
    } else if ([0, 1, 2, 3].every((i) => Math.abs(p[i] - 0.25) < 1e-9)) {
      mark(1);
      setMsg({
        tone: 'good',
        text: 'Four equal amplitudes: the pair holds 00, 10, 01 and 11 at the same time, or, read as numbers, 0, 1, 2 and 3. One H per qubit put every value into superposition.',
        deeper: 'This is exactly how Shor’s algorithm starts: a Hadamard on each of t qubits puts all 2ᵗ values of x into superposition.',
      });
    } else setMsg(null);
  };

  const shots = () => {
    const ct = c.state.sample(100, c.random);
    setCounts(Array.from(ct));
  };

  const grow = (v: number) => {
    setN(v);
    if (v >= 10 && !done[3]) {
      mark(3);
      setMsg({
        tone: 'good',
        text: `10 qubits: 1,024 amplitudes, every number from 0 to 1023 at once. Shor’s input register in Chapter ${chapterBySlug('shor')!.n} uses up to 9 qubits like this.`,
        deeper: 'Each extra qubit doubles the list. That is why simulating even 50 qubits exactly is beyond ordinary computers, while a quantum computer just has the qubits.',
      });
    }
  };

  const N = 2 ** n;
  const cols = Math.ceil(Math.sqrt(N));
  const grid = useMemo(() => Array.from({ length: N }, (_, i) => i), [N]);

  const tasks = [
    { label: <>Make <b>|10⟩</b>: flip only qubit 0.</>, done: done[0] },
    { label: <>Put <b>both</b> qubits into superposition: four equal amplitudes.</>, done: done[1] },
    { label: <>From that state, <b>measure qubit 0</b> alone and watch qubit 1.</>, done: done[2] },
    { label: <>Grow the register to <b>10 qubits</b>.</>, done: done[3] },
  ];

  return (
    <ChapterFrame
      meta={meta}
      clip={{ id: 'entangle', caption: 'From the film: two qubits hold four amplitudes, and every qubit doubles the list.' }}
      goal="See how the amount a quantum computer holds doubles with every qubit."
      tasks={tasks}
      complete={done.every(Boolean)}
      canvas={
        <div className={s.stateGrid}>
          <Card title="Two qubits, four amplitudes">
            <div className={s.blochRow}>
              <BlochSphere bloch={c.state.bloch(0)} label="qubit 0" size={150} />
              <BlochSphere bloch={c.state.bloch(1)} label="qubit 1" size={150} />
            </div>
            <AmplitudeBars state={c.state} />
            <p className="faint" style={{ fontSize: '0.8rem', margin: '6px 0 0', textAlign: 'center' }}>
              As numbers (qubit 0 is the ones place): |00⟩ = 0 · |10⟩ = 1 · |01⟩ = 2 · |11⟩ = 3
            </p>
            <div style={{ marginTop: 10 }}>
              <CircuitStrip n={2} ops={c.ops} onUndoTo={(i) => (c.undoTo(i), setCounts(null))} />
            </div>
            {counts && <Histogram counts={counts} labels={[0, 1, 2, 3].map((i) => c.state.label(i))} expected={Array.from(probs)} caption="100 shots (dashed: expected)" />}
          </Card>
          <Card title="Every qubit doubles the list">
            <Slider label="Qubits in the register" value={n} min={1} max={12} step={1} onChange={grow} format={(v) => `${v} qubit${v > 1 ? 's' : ''} → ${(2 ** v).toLocaleString()} amplitudes`} />
            <svg viewBox={`0 0 ${cols} ${Math.ceil(N / cols)}`} style={{ width: '100%', maxWidth: 360, height: 'auto', display: 'block', margin: '10px auto 0' }} role="img" aria-label={`${N} amplitudes, one square each`}>
              {grid.map((i) => (
                <rect key={i} x={(i % cols) + 0.08} y={Math.floor(i / cols) + 0.08} width={0.84} height={0.84} rx={0.15} fill="var(--blue)" opacity={0.75} />
              ))}
            </svg>
            <div className={css.scale} style={{ marginTop: 12 }}>
              {SCALE.map(([q, t]) => (
                <div key={q}>
                  <span>{q} qubits</span>
                  <b>{t}</b>
                </div>
              ))}
            </div>
          </Card>
        </div>
      }
      panel={
        <>
          <Card title="Gates">
            <GatePalette
              gates={[
                { id: 'X0', label: 'X q0', title: 'X on qubit 0: flip it' },
                { id: 'X1', label: 'X q1', title: 'X on qubit 1: flip it' },
                { id: 'H0', label: 'H q0', title: 'Hadamard on qubit 0' },
                { id: 'H1', label: 'H q1', title: 'Hadamard on qubit 1' },
                { id: 'M0', label: 'Measure q0', title: 'Measure qubit 0 only' },
              ]}
              onGate={onGate}
            />
          </Card>
          <Row>
            <Button variant="primary" onClick={shots}>
              Run 100 shots
            </Button>
            <Button variant="ghost" onClick={() => (c.reset(), setCounts(null), setMsg(null))}>
              Reset to |00⟩
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
