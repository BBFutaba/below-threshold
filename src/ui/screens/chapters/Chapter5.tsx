// Chapter 5: Phase errors and interference.
// Part A: a Z error is invisible to the bit-flip checks, yet the fidelity drops.
// Part B: re-encode in the phase-flip code (|+++>, |--->) and use the H sandwich: H turns
// the phase flip into a bit flip the same checks can see.
//
// Note: Part B must re-encode first. Wrapping the checks in H gates on the bit-flip
// encoding measures X-type parities that are not stabilizers of that code, which
// disturbs the state (covered by a unit test).

import { useMemo, useState } from 'react';
import { makeRng } from '../../../core/rng';
import type { QState } from '../../../core/quantum';
import { chapterBySlug } from '../../content';
import { AmplitudeBars, CircuitStrip, FidelityMeter, type Op } from '../../components/QuantumViews';
import { Button, Card, Pill, Row, Segmented, WhatHappened } from '../../components/ui';
import { play } from '../../sound';
import { ChapterFrame } from './ChapterFrame';
import { useCircuit } from './useCircuit';
import { checkOps, dataBlock, dataFidelity, encodedData, hSandwich, SYNDROME_TABLE } from './repetition';
import s from '../screen.module.css';

const meta = chapterBySlug('phase-errors')!;
const THETA = 2 * Math.asin(Math.sqrt(0.3)); // 70/30, so the relative phase is visible
const ROUNDS_NEEDED = 2;
type Phase = 'idle' | 'noise' | 'checked' | 'measured' | 'fixed';

function encoder(phaseFlip: boolean) {
  return (st: QState) => {
    st.ry(0, THETA).cnot(0, 1).cnot(0, 2);
    if (phaseFlip) for (const q of [0, 1, 2]) st.h(q);
  };
}

export function Chapter5() {
  const [part, setPart] = useState<'A' | 'B'>('A');
  const c = useCircuit(5, 505, encoder(part === 'B'));
  const targetA = useMemo(() => encodedData(THETA, false), []);
  const targetB = useMemo(() => encodedData(THETA, true), []);
  const target = part === 'A' ? targetA : targetB;
  const errRng = useMemo(() => makeRng(5050), []);
  const [hidden, setHidden] = useState(-2);
  const [phase, setPhase] = useState<Phase>('idle');
  const [syn, setSyn] = useState<[number, number] | null>(null);
  const [doneA, setDoneA] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [lastFix, setLastFix] = useState<{ fix: number; right: boolean } | null>(null);

  const fid = dataFidelity(c.state, target);

  const strike = () => {
    const e = part === 'A' ? errRng.int(3) : errRng.int(4) - 1;
    c.reset(encoder(part === 'B'));
    if (e >= 0) c.add({ g: 'ERR', q: e, p: 'Z', hidden: true });
    setHidden(e);
    setPhase('noise');
    setSyn(null);
    setLastFix(null);
  };

  const runChecks = () => {
    const ops: Op[] = part === 'A' ? checkOps() : [...hSandwich(), ...checkOps(), ...hSandwich()];
    c.add(ops);
    setPhase('checked');
  };

  const measure = () => {
    const a = c.state.prob1(3) > 0.5 ? 1 : 0;
    const b = c.state.prob1(4) > 0.5 ? 1 : 0;
    c.add([
      { g: 'M', q: 3 },
      { g: 'M', q: 4 },
    ]);
    setSyn([a, b]);
    setPhase('measured');
    if (part === 'A') setDoneA(true);
    if (a || b) play('tick');
  };

  const fix = (q: number) => {
    const ops: Op[] = [];
    if (q >= 0) ops.push({ g: 'Z', q });
    if (syn?.[0]) ops.push({ g: 'X', q: 3 });
    if (syn?.[1]) ops.push({ g: 'X', q: 4 });
    if (ops.length) c.add(ops);
    const right = q === hidden;
    setLastFix({ fix: q, right });
    setPhase('fixed');
    if (right) {
      setCorrect((n) => n + 1);
      play('chime');
    } else play('fail');
  };

  const switchPart = (p: 'A' | 'B') => {
    c.reset(encoder(p === 'B'));
    setPart(p);
    setHidden(-2);
    setPhase('idle');
    setSyn(null);
    setLastFix(null);
  };

  let msg: { text: string; deeper?: string; tone?: 'good' | 'bad' | 'info' | 'warn' } | null = null;
  if (part === 'A') {
    if (phase === 'measured' || phase === 'fixed')
      msg = {
        tone: 'warn',
        text: `Syndrome (0,0): "all clear". Yet the fidelity dropped to ${(100 * fid).toFixed(0)}%. A phase flip changed the sign of |111⟩; the bit-flip checks cannot see it.`,
        deeper: 'Z on any qubit maps α|000⟩ + β|111⟩ to α|000⟩ − β|111⟩. Both terms have the same parities, so every bit-flip check passes. The fidelity is (|α|² − |β|²)² = (0.7 − 0.3)² = 16%. Watch the color of the |111⟩ bar.',
      };
    else if (phase === 'checked') msg = { text: 'The same Chapter 4 checks. Now measure the ancillas.' };
    else if (phase === 'noise') msg = { text: 'Noise struck with a hidden phase flip (Z). Run the Chapter 4 checks.' };
    else msg = { text: 'The data holds a 70/30 state α|000⟩ + β|111⟩. Let a hidden phase error strike.' };
  } else {
    if (phase === 'idle')
      msg = {
        text: 'Re-encoded in the phase-flip code: α|+++⟩ + β|−−−⟩. The checks only work on the code they were designed for, so we encode first.',
        deeper: 'H on each qubit after the CNOTs. In this basis a Z error swaps |+⟩ and |−⟩, which is exactly a bit flip in the H basis.',
      };
    else if (phase === 'noise') msg = { text: 'A hidden phase error (or none) struck. Run the checks inside an H sandwich.' };
    else if (phase === 'checked') msg = { text: 'H turned the phase flip into a bit flip, the checks copied the parities, and H turned it back. Measure the ancillas.' };
    else if (phase === 'measured' && syn) msg = { text: `Syndrome (${syn.join(',')}). Apply Z to the qubit it points to.` };
    else if (phase === 'fixed' && lastFix)
      msg = lastFix.right
        ? { tone: 'good', text: 'Phase error found and fixed: fidelity back to 100%. Interference turned an invisible error into a visible one.' }
        : { tone: 'bad', text: `The hidden error was ${hidden < 0 ? 'none' : `Z on qubit ${hidden}`}; syndrome (${syn?.join(',')}) points to ${SYNDROME_TABLE[syn?.join(',') ?? '0,0'] < 0 ? 'no error' : `qubit ${SYNDROME_TABLE[syn?.join(',') ?? '0,0']}`}. Try again.` };
  }

  const shownOps = c.ops.filter((o) => o.g !== 'ERR');
  const block = dataBlock(c.state, syn ? syn[0] | (syn[1] << 1) : 0);

  return (
    <ChapterFrame
      meta={meta}
      clip={{ id: 'surface', caption: 'From the film: the invisible phase flip, and the grid that catches both kinds of error.' }}
      goal="Discover a second kind of error that the bit-flip code cannot see."
      tasks={[
        { label: <>Part A: let a hidden <b>Z</b> error strike and run the Chapter 4 checks.</>, done: doneA },
        { label: <>Part B: use the <b>H sandwich</b> to catch and fix phase errors ({Math.min(correct, ROUNDS_NEEDED)}/{ROUNDS_NEEDED}).</>, done: correct >= ROUNDS_NEEDED },
      ]}
      complete={doneA && correct >= ROUNDS_NEEDED}
      canvas={
        <div className={s.stateGrid}>
          <Card title={part === 'A' ? 'Bit-flip code, data q0–q2' : 'Phase-flip code, data q0–q2'}>
            <AmplitudeBars state={block} height={110} />
          </Card>
          <FidelityMeter value={fid} label={`Fidelity with ${part === 'A' ? 'α|000⟩ + β|111⟩' : 'α|+++⟩ + β|−−−⟩'}`} />
          {syn && (
            <Row>
              <span className="muted">Syndrome:</span>
              <Pill tone={syn[0] ? 'teal' : undefined}>a3 = {syn[0]}</Pill>
              <Pill tone={syn[1] ? 'teal' : undefined}>a4 = {syn[1]}</Pill>
              {part === 'A' && <Pill tone="amber">“all clear”</Pill>}
            </Row>
          )}
          <Card title="Circuit after encoding">
            <CircuitStrip n={5} ops={shownOps} qubitLabels={['q0', 'q1', 'q2', 'a3', 'a4']} />
          </Card>
        </div>
      }
      panel={
        <>
          <Segmented
            label="Part"
            value={part}
            onChange={switchPart}
            options={[
              { value: 'A', label: 'A · Invisible error' },
              { value: 'B', label: 'B · H sandwich' },
            ]}
          />
          <Card title={part === 'A' ? 'Bit-flip checks' : `Phase-flip code · ${correct} fixed`}>
            <div className={s.stateGrid} style={{ gap: 10 }}>
              {(phase === 'idle' || phase === 'fixed' || (part === 'A' && phase === 'measured')) && (
                <Button variant="primary" onClick={strike}>
                  {phase === 'idle' ? 'Let a phase error strike' : 'Next round'}
                </Button>
              )}
              {phase === 'noise' && (
                <Button variant="primary" onClick={runChecks}>
                  {part === 'A' ? 'Run the Chapter 4 checks' : 'Run checks with the H sandwich'}
                </Button>
              )}
              {phase === 'checked' && (
                <Button variant="primary" onClick={measure}>
                  Measure the ancillas
                </Button>
              )}
              {phase === 'measured' && part === 'B' && (
                <div className={s.palette} role="group" aria-label="Correction">
                  {[0, 1, 2].map((q) => (
                    <button key={q} className={s.gateBtn} onClick={() => fix(q)}>
                      Z <small>on q{q}</small>
                    </button>
                  ))}
                  <button className={s.gateBtn} onClick={() => fix(-1)}>
                    none
                  </button>
                </div>
              )}
              {part === 'A' && doneA && (
                <Button onClick={() => switchPart('B')}>Fix it with the H sandwich →</Button>
              )}
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
