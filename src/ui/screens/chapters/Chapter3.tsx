// Chapter 3: Entanglement. Build a Bell pair, then spread alpha|0> + beta|1> across three
// qubits with two CNOTs. Each qubit's own Bloch arrow shrinks: the information lives in
// the correlations.

import { useEffect, useMemo, useState } from 'react';
import { QState } from '../../../core/quantum';
import { chapterBySlug } from '../../content';
import { AmplitudeBars, BlochSphere, CircuitStrip, Histogram } from '../../components/QuantumViews';
import { Button, Card, Row, Segmented, Slider, WhatHappened } from '../../components/ui';
import { ChapterFrame, GatePalette } from './ChapterFrame';
import { useCircuit } from './useCircuit';
import s from '../screen.module.css';

const meta = chapterBySlug('entanglement')!;

export function Chapter3() {
  const [part, setPart] = useState<'bell' | 'encode'>('bell');
  const [theta, setTheta] = useState(1.1);
  const n = part === 'bell' ? 2 : 3;
  const c = useCircuit(n, 303 + (part === 'bell' ? 0 : 1), part === 'encode' ? (st) => st.ry(0, theta) : undefined);
  const [counts, setCounts] = useState<number[] | null>(null);
  const [done, setDone] = useState([false, false]);

  const bell = useMemo(() => new QState(2).h(0).cnot(0, 1), []);
  const target = useMemo(() => new QState(3).ry(0, theta).cnot(0, 1).cnot(0, 2), [theta]);
  const isBell = part === 'bell' && c.state.fidelity(bell) > 0.999;
  const isEncoded = part === 'encode' && c.state.fidelity(target) > 0.999;
  useEffect(() => {
    if (isEncoded) setDone((d) => (d[1] ? d : [d[0], true]));
  }, [isEncoded]);

  const shots = () => {
    const ct = c.state.sample(100, c.random);
    setCounts(Array.from(ct));
    if (isBell) setDone((d) => [true, d[1]]);
  };

  const switchPart = (p: 'bell' | 'encode') => {
    c.reset(); // clear ops in the same render as the qubit count changes
    setPart(p);
    setCounts(null);
  };

  const gates =
    part === 'bell'
      ? [
          { id: 'H0', label: 'H q0', title: 'Hadamard on qubit 0' },
          { id: 'X0', label: 'X q0', title: 'X on qubit 0' },
          { id: 'C01', label: 'CNOT 0→1', title: 'CNOT: control qubit 0, target qubit 1' },
        ]
      : [
          { id: 'C01', label: 'CNOT 0→1', title: 'CNOT: control 0, target 1' },
          { id: 'C02', label: 'CNOT 0→2', title: 'CNOT: control 0, target 2' },
          { id: 'C12', label: 'CNOT 1→2', title: 'CNOT: control 1, target 2' },
        ];
  const onGate = (id: string) => {
    setCounts(null);
    if (id === 'H0') c.add({ g: 'H', q: 0 });
    if (id === 'X0') c.add({ g: 'X', q: 0 });
    if (id === 'C01') c.add({ g: 'CNOT', c: 0, t: 1 });
    if (id === 'C02') c.add({ g: 'CNOT', c: 0, t: 2 });
    if (id === 'C12') c.add({ g: 'CNOT', c: 1, t: 2 });
  };

  const a2 = Math.cos(theta / 2) ** 2,
    b2 = Math.sin(theta / 2) ** 2;
  let msg: { text: string; deeper?: string; tone?: 'good' | 'info' } | null = null;
  if (part === 'bell' && counts && isBell) {
    msg = {
      tone: 'good',
      text: `Only 00 and 11 appeared (${counts[0]} and ${counts[3]}), never 01 or 10. Each qubit alone is random, but they always agree.`,
      deeper: 'The Bell state (|00⟩ + |11⟩)/√2. Look at the Bloch spheres: each arrow has length 0, because neither qubit has a state of its own.',
    };
  } else if (part === 'bell' && isBell) {
    msg = { text: 'That is a Bell pair. Run 100 shots to see the correlations.' };
  } else if (isEncoded) {
    msg = {
      tone: 'good',
      text: `Encoded: α|000⟩ + β|111⟩. Every Bloch arrow shrank to length ${Math.abs(a2 - b2).toFixed(2)}. Individually the qubits look random; the information lives only in their correlations.`,
      deeper: 'Each qubit\'s reduced state is |α|²|0⟩⟨0| + |β|²|1⟩⟨1|, a mixture with Bloch length ||α|² − |β|²|. Drag the slider to α = β and the length is exactly 0.',
    };
  } else if (part === 'encode') {
    msg = { text: 'Qubit 0 holds an arbitrary state α|0⟩ + β|1⟩. Spread it onto qubits 1 and 2 using two CNOTs.' };
  }

  return (
    <ChapterFrame
      meta={meta}
      goal="Spread one qubit's information across three qubits so no single qubit holds it."
      tasks={[
        { label: <>Build a Bell pair with <b>H</b> then <b>CNOT</b>, and run 100 shots.</>, done: done[0] },
        { label: <>Encode α|0⟩ + β|1⟩ into <b>α|000⟩ + β|111⟩</b> with two CNOTs.</>, done: done[1] },
      ]}
      complete={done.every(Boolean)}
      canvas={
        <div className={s.stateGrid}>
          <div className={s.blochRow}>
            {Array.from({ length: n }, (_, q) => (
              <BlochSphere key={`${part}${q}`} bloch={c.state.bloch(q)} label={`qubit ${q}`} size={n === 3 ? 140 : 170} />
            ))}
          </div>
          <AmplitudeBars state={c.state} />
          <Card title="Circuit (tap a gate to undo back to it)">
            <CircuitStrip n={n} ops={c.ops} onUndoTo={(i) => (c.undoTo(i), setCounts(null))} />
          </Card>
          {counts && <Histogram counts={counts} labels={Array.from({ length: 1 << n }, (_, i) => c.state.label(i))} />}
        </div>
      }
      panel={
        <>
          <Segmented
            label="Part"
            value={part}
            onChange={switchPart}
            options={[
              { value: 'bell', label: '1 · Bell pair' },
              { value: 'encode', label: '2 · Encode three' },
            ]}
          />
          <Card title="Gates">
            <GatePalette gates={gates} onGate={onGate} />
            {part === 'encode' && (
              <div style={{ marginTop: 14 }}>
                <Slider
                  label="Starting state of qubit 0"
                  value={theta}
                  min={0}
                  max={Math.PI}
                  step={0.01}
                  onChange={(v) => {
                    setTheta(v);
                    c.reset((st) => st.ry(0, v));
                    setCounts(null);
                  }}
                  format={() => `|α|² = ${(100 * a2).toFixed(0)}%, |β|² = ${(100 * b2).toFixed(0)}%`}
                />
              </div>
            )}
          </Card>
          <Row>
            <Button variant="primary" onClick={shots}>
              Run 100 shots
            </Button>
            <Button variant="ghost" onClick={() => (c.reset(part === 'encode' ? (st) => st.ry(0, theta) : undefined), setCounts(null))}>
              Reset
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
