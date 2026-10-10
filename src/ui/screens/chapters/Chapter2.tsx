// No-cloning (Part III). A CNOT "copy machine" copies |0> and |1> perfectly but turns
// |+> into an entangled pair with 50% fidelity. "Measure then rebuild" scores 25%.

import { useMemo, useState } from 'react';
import { QState } from '../../../core/quantum';
import { makeRng } from '../../../core/rng';
import { chapterBySlug } from '../../content';
import { AmplitudeBars, BlochSphere, CircuitStrip, FidelityMeter, type Op } from '../../components/QuantumViews';
import { Button, Card, Row, Segmented, WhatHappened } from '../../components/ui';
import { ChapterFrame } from './ChapterFrame';
import s from '../screen.module.css';

const meta = chapterBySlug('no-cloning')!;
type Input = '0' | '1' | '+';

function prepare(input: Input, s: QState, q: number) {
  if (input === '1') s.x(q);
  if (input === '+') s.h(q);
}

function ideal(input: Input): QState {
  const s = new QState(2);
  prepare(input, s, 0);
  prepare(input, s, 1);
  return s;
}

export function Chapter2() {
  const [input, setInput] = useState<Input>('0');
  const [ran, setRan] = useState(false);
  const [copied, setCopied] = useState<Record<Input, boolean>>({ '0': false, '1': false, '+': false });
  const [rebuild, setRebuild] = useState<{ avg: number; trials: number } | null>(null);

  const ops: Op[] = useMemo(() => {
    const o: Op[] = [];
    if (input === '1') o.push({ g: 'X', q: 0 });
    if (input === '+') o.push({ g: 'H', q: 0 });
    if (ran) o.push({ g: 'CNOT', c: 0, t: 1 });
    return o;
  }, [input, ran]);

  const state = useMemo(() => {
    const st = new QState(2);
    prepare(input, st, 0);
    if (ran) st.cnot(0, 1);
    return st;
  }, [input, ran]);
  const fid = state.fidelity(ideal(input));

  const runCopy = () => {
    setRan(true);
    setCopied((c) => ({ ...c, [input]: true }));
  };

  const measureRebuild = () => {
    // 100 seeded trials of: measure the input, then prepare two qubits in the outcome.
    const rng = makeRng(202);
    let total = 0;
    const T = 100;
    for (let t = 0; t < T; t++) {
      const a = new QState(1);
      prepare('+', a, 0);
      const m = a.measure(0, rng.next);
      const out = new QState(2);
      if (m) out.x(0).x(1);
      total += out.fidelity(ideal('+'));
    }
    setRebuild({ avg: total / T, trials: T });
  };

  const b0 = state.bloch(0),
    b1 = state.bloch(1);
  const tasks = [
    { label: <>Feed the copy machine <b>|0⟩</b>.</>, done: copied['0'] },
    { label: <>Feed it <b>|1⟩</b>.</>, done: copied['1'] },
    { label: <>Feed it <b>|+⟩</b>, the 50/50 state.</>, done: copied['+'] },
    { label: <>Second attempt: <b>measure, then rebuild</b> two copies of |+⟩.</>, done: !!rebuild },
  ];
  const complete = tasks.every((t) => t.done);

  let msg: { text: string; deeper?: string; tone?: 'good' | 'bad' | 'info' } | null = null;
  if (rebuild) {
    msg = {
      tone: 'bad',
      text: `Measuring first destroys the superposition: rebuilding from the answer scores only ${(100 * rebuild.avg).toFixed(0)}% on average over ${rebuild.trials} tries.`,
      deeper: 'Measuring |+⟩ gives 0 or 1 at random; rebuilding gives |00⟩ or |11⟩, and each has overlap |⟨++|00⟩|² = 1/4 with the ideal two copies.',
    };
  } else if (ran && input === '+') {
    msg = {
      tone: 'bad',
      text: 'The output is not two copies of |+⟩ but an entangled pair. The fidelity meter reads 50%.',
      deeper: 'CNOT on |+⟩|0⟩ gives (|00⟩ + |11⟩)/√2, whose overlap with |++⟩ is exactly 1/2. Each qubit alone has a zero-length Bloch vector: it is maximally entangled.',
    };
  } else if (ran) {
    msg = { tone: 'good', text: `|${input}⟩ copied perfectly: the output is |${input}${input}⟩. So far the machine looks fine.` };
  }

  return (
    <ChapterFrame
      meta={meta}
      clip={{ id: 'fragile', caption: 'From the film: the copy machine and the no-cloning theorem, with real simulator output.' }}
      goal="See why we cannot protect a qubit by backing it up."
      tasks={tasks}
      complete={complete}
      canvas={
        <div className={s.stateGrid}>
          <div className={s.blochRow}>
            <BlochSphere bloch={b0} label="input (q0)" />
            <BlochSphere bloch={b1} label="copy (q1)" />
          </div>
          <AmplitudeBars state={state} />
          <Card title="Copy machine circuit">
            <CircuitStrip n={2} ops={ops} qubitLabels={['in', 'copy']} />
          </Card>
          <FidelityMeter value={rebuild ? rebuild.avg : fid} label={rebuild ? 'Average fidelity, measure-then-rebuild' : `Fidelity with two perfect copies |${input}${input}⟩`} />
        </div>
      }
      panel={
        <>
          <Card title="Input state">
            <Segmented
              label="Input state"
              value={input}
              onChange={(v) => (setInput(v), setRan(false), setRebuild(null))}
              options={[
                { value: '0', label: '|0⟩' },
                { value: '1', label: '|1⟩' },
                { value: '+', label: '|+⟩ (50/50)' },
              ]}
            />
            <Row style={{ marginTop: 12 }}>
              <Button variant="primary" onClick={runCopy} disabled={ran}>
                Run the copy machine
              </Button>
              <Button onClick={measureRebuild} disabled={!copied['+']} title={copied['+'] ? '' : 'Try copying |+⟩ first'}>
                Measure, then rebuild
              </Button>
            </Row>
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
