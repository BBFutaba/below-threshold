// Chapter 4: Measurement and syndrome extraction.
// Part A: measuring a data qubit directly destroys the information.
// Part B: parity checks through ancillas find a hidden X error without revealing alpha, beta.

import { useMemo, useState } from 'react';
import { makeRng } from '../../../core/rng';
import { chapterBySlug } from '../../content';
import { AmplitudeBars, CircuitStrip, FidelityMeter } from '../../components/QuantumViews';
import { Button, Card, Pill, Row, Segmented, WhatHappened } from '../../components/ui';
import { play } from '../../sound';
import { ChapterFrame } from './ChapterFrame';
import { useCircuit } from './useCircuit';
import { checkOps, dataBlock, dataFidelity, encodedData, encodeOps, SYNDROME_TABLE } from './repetition';
import s from '../screen.module.css';

const meta = chapterBySlug('syndrome')!;
const THETA = 1.23; // the stored state; the checks never reveal it
const ROUNDS_NEEDED = 3;

type Phase = 'noise' | 'checked' | 'measured' | 'fixed';

export function Chapter4() {
  const [part, setPart] = useState<'A' | 'B'>('A');
  const init = useMemo(() => (st: import('../../../core/quantum').QState) => {
    st.ry(0, THETA);
    for (const o of encodeOps()) if (o.g === 'CNOT') st.cnot(o.c, o.t);
  }, []);
  const c = useCircuit(5, 404, init);
  const target = useMemo(() => encodedData(THETA), []);
  const errRng = useMemo(() => makeRng(4040), []);
  const [hidden, setHidden] = useState<number>(-2); // -2 = no round yet, -1 = none, else qubit
  const [phase, setPhase] = useState<Phase>('noise');
  const [syn, setSyn] = useState<[number, number] | null>(null);
  const [correct, setCorrect] = useState(0);
  const [measuredA, setMeasuredA] = useState(false);
  const [lastFix, setLastFix] = useState<{ fix: number; right: boolean } | null>(null);
  const [peek, setPeek] = useState(false);

  const fid = dataFidelity(c.state, target);

  const startRound = () => {
    const e = errRng.int(4) - 1; // none, q0, q1, q2 equally likely
    c.reset();
    if (e >= 0) c.add({ g: 'ERR', q: e, p: 'X', hidden: true });
    setHidden(e);
    setPhase('noise');
    setSyn(null);
    setLastFix(null);
  };

  const runChecks = () => {
    c.add(checkOps());
    setPhase('checked');
  };
  const measureAnc = () => {
    // Read the outcomes by replaying with the measurement ops appended.
    const before = c.state.clone();
    const a = before.prob1(3) > 0.5 ? 1 : 0;
    const b = before.prob1(4) > 0.5 ? 1 : 0;
    c.add([
      { g: 'M', q: 3 },
      { g: 'M', q: 4 },
    ]);
    setSyn([a, b]);
    setPhase('measured');
    if (a || b) play('tick');
  };
  const applyFix = (q: number) => {
    const ops: import('../../components/QuantumViews').Op[] = [];
    if (q >= 0) ops.push({ g: 'X', q });
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

  const measureDirect = () => {
    c.add({ g: 'M', q: 0 });
    setMeasuredA(true);
  };

  const shownOps = c.ops.filter((o) => o.g !== 'ERR');
  const complete = measuredA && correct >= ROUNDS_NEEDED;

  let msg: { text: string; deeper?: string; tone?: 'good' | 'bad' | 'info' | 'warn' } | null = null;
  if (part === 'A') {
    msg = measuredA
      ? {
          tone: 'bad',
          text: `Measuring qubit 0 gave ${c.ops.at(-1)?.g === 'M' ? (c.ops.at(-1) as { out?: number }).out : '?'} and collapsed all three qubits. The fidelity dropped: the superposition, and the information, are gone.`,
          deeper: 'Asking "what is qubit 0?" forces an answer, 0 or 1, and destroys α and β. Error correction must never ask that question.',
        }
      : { text: 'Qubits 0 to 2 hold α|000⟩ + β|111⟩. What happens if we look at one of them directly?' };
  } else if (phase === 'noise' && hidden > -2) {
    msg = { text: 'Noise may have flipped one data qubit (or none). Run the check circuit to find out without looking at the data.' };
  } else if (phase === 'checked') {
    msg = { text: 'The CNOTs copied two parities onto the ancillas: "do 0 and 1 agree?" and "do 1 and 2 agree?". Now measure the ancillas.' };
  } else if (phase === 'measured' && syn) {
    msg = { text: `Syndrome (${syn[0]},${syn[1]}). Use the table to decide which qubit to flip back.`, deeper: 'Only the ancillas were measured. They hold parities, not values, so α and β stay hidden.' };
  } else if (phase === 'fixed' && lastFix) {
    msg = lastFix.right
      ? {
          tone: 'good',
          text: `Fixed. Fidelity is back to 100%, and α and β were never revealed. ${correct >= ROUNDS_NEEDED ? '' : `${ROUNDS_NEEDED - correct} more round${ROUNDS_NEEDED - correct > 1 ? 's' : ''} to go.`}`,
        }
      : {
          tone: 'bad',
          text: `Not quite: the hidden error was ${hidden < 0 ? 'no error at all' : `on qubit ${hidden}`}. Syndrome (${syn?.join(',')}) means ${SYNDROME_TABLE[syn?.join(',') ?? '0,0'] < 0 ? 'no error' : `qubit ${SYNDROME_TABLE[syn?.join(',') ?? '0,0']}`}. Try another round.`,
        };
  }

  return (
    <ChapterFrame
      meta={meta}
      clip={{ id: 'parity', caption: 'From the film: parity checks, the syndrome table, and a perfect fix.' }}
      goal="Detect an error without destroying the stored information."
      tasks={[
        { label: <>Part A, the wrong way: <b>measure data qubit 0</b> directly.</>, done: measuredA },
        { label: <>Part B, the right way: find and fix the hidden error with parity checks ({Math.min(correct, ROUNDS_NEEDED)}/{ROUNDS_NEEDED}).</>, done: correct >= ROUNDS_NEEDED },
      ]}
      complete={complete}
      canvas={
        <div className={s.stateGrid}>
          <Card title="Circuit: data q0–q2, ancillas a3, a4">
            <CircuitStrip n={5} ops={shownOps} qubitLabels={['q0', 'q1', 'q2', 'a3', 'a4']} />
            {hidden > -2 && part === 'B' && (
              <p className="faint" style={{ margin: '8px 0 0', fontSize: '0.85rem' }}>
                Noise struck before the checks (hidden). The circuit shows only what we did.
              </p>
            )}
          </Card>
          <FidelityMeter value={fid} label="Fidelity of the data qubits with α|000⟩ + β|111⟩" />
          {syn && (
            <Row>
              <span className="muted">Syndrome:</span>
              <Pill tone={syn[0] ? 'teal' : undefined}>a3 = {syn[0]}</Pill>
              <Pill tone={syn[1] ? 'teal' : undefined}>a4 = {syn[1]}</Pill>
            </Row>
          )}
          <div>
            <Button small variant="ghost" onClick={() => setPeek((p) => !p)} aria-pressed={peek}>
              {peek ? 'Hide' : 'Peek at'} the full data state (a real computer cannot)
            </Button>
            {peek && <AmplitudeBars state={dataBlock(c.state, syn ? syn[0] | (syn[1] << 1) : 0)} height={90} />}
          </div>
        </div>
      }
      panel={
        <>
          <Segmented
            label="Part"
            value={part}
            onChange={(p) => {
              setPart(p);
              c.reset();
              setHidden(-2);
              setSyn(null);
              setPhase('noise');
            }}
            options={[
              { value: 'A', label: 'A · Wrong way' },
              { value: 'B', label: 'B · Right way' },
            ]}
          />
          {part === 'A' ? (
            <Card title="Look directly">
              <Row>
                <Button variant="primary" onClick={measureDirect} disabled={measuredA && c.ops.length > 0}>
                  Measure data qubit 0
                </Button>
                <Button variant="ghost" onClick={() => c.reset()}>
                  Restore encoded state
                </Button>
              </Row>
              {measuredA && (
                <Button small style={{ marginTop: 10 }} onClick={() => (setPart('B'), c.reset(), setHidden(-2))}>
                  Now try the right way →
                </Button>
              )}
            </Card>
          ) : (
            <Card title={`Round ${Math.min(correct + 1, ROUNDS_NEEDED)} · ${correct} fixed`}>
              <div className={s.stateGrid} style={{ gap: 10 }}>
                {(hidden === -2 || phase === 'fixed') && (
                  <Button variant="primary" onClick={startRound}>
                    {hidden === -2 ? 'Let noise strike' : 'Next round'}
                  </Button>
                )}
                {phase === 'noise' && hidden > -2 && (
                  <Button variant="primary" onClick={runChecks}>
                    Run the check circuit
                  </Button>
                )}
                {phase === 'checked' && (
                  <Button variant="primary" onClick={measureAnc}>
                    Measure the ancillas
                  </Button>
                )}
                {phase === 'measured' && (
                  <div className={s.palette} role="group" aria-label="Correction">
                    {[0, 1, 2].map((q) => (
                      <button key={q} className={s.gateBtn} onClick={() => applyFix(q)}>
                        X <small>on q{q}</small>
                      </button>
                    ))}
                    <button className={s.gateBtn} onClick={() => applyFix(-1)}>
                      none
                    </button>
                  </div>
                )}
                <table style={{ fontSize: '0.88rem', borderCollapse: 'collapse' }}>
                  <caption className="faint" style={{ textAlign: 'left', fontSize: '0.8rem', paddingBottom: 4 }}>
                    Syndrome table
                  </caption>
                  <tbody>
                    {[
                      ['(0,0)', 'no error'],
                      ['(1,0)', 'qubit 0'],
                      ['(1,1)', 'qubit 1'],
                      ['(0,1)', 'qubit 2'],
                    ].map(([k, v]) => (
                      <tr key={k} style={{ background: syn && `(${syn.join(',')})` === k ? 'var(--blue-tint)' : undefined }}>
                        <td className="mono" style={{ padding: '3px 10px 3px 0' }}>
                          {k}
                        </td>
                        <td>{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
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
