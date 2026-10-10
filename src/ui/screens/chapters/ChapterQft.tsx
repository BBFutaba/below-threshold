// Chapter 6: The quantum Fourier transform. Pick an input (a single number, or a pattern
// that repeats every r), then step through the real gate circuit (Hadamards, controlled
// phase turns, swaps) and watch the register's clocks and each qubit's Bloch arrow.
// Ends with the frequency detective: name a hidden period from QFT measurement samples.

import { useEffect, useMemo, useRef, useState } from 'react';
import { applyQftGate, basisState, describeGate, expectedPeaks, periodicState, qftCircuit } from '../../../core/qft';
import { makeRng } from '../../../core/rng';
import { sampleIndex } from '../../../core/shor';
import { useApp } from '../../../store/app';
import { chapterBySlug } from '../../content';
import { BlochSphere } from '../../components/QuantumViews';
import { PhaseClocks, ProbChart, QftCircuitDiagram } from '../../components/FourierViews';
import { Button, Card, Row, Segmented, Slider, WhatHappened } from '../../components/ui';
import { ChapterFrame } from './ChapterFrame';
import s from '../screen.module.css';
import css from './Shor.module.css';

const meta = chapterBySlug('qft')!;
type Kind = 'basis' | 'comb';
const MYSTERY = [2, 3, 4, 5, 8];

export function ChapterQft() {
  const motion = useApp((st) => st.motion);
  const reduced = motion === 'reduced' || (motion === 'system' && typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const [kind, setKind] = useState<Kind>('basis');
  const [n, setN] = useState<3 | 4>(3);
  const [x, setX] = useState(0);
  const [r, setR] = useState(4);
  const [off, setOff] = useState(0);
  const [step, setStep] = useState(0);
  const [singleSteps, setSingleSteps] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [done, setDone] = useState([false, false, false, false, false, false]);
  const [msg, setMsg] = useState<{ text: string; tone?: 'good' | 'info' | 'warn' | 'bad'; deeper?: string } | null>(null);
  const evaluated = useRef('');
  const mark = (i: number) => setDone((d) => d.map((v, j) => (j === i ? true : v)));

  const N = 2 ** n;
  const gates = useMemo(() => qftCircuit(n), [n]);
  const input = useMemo(() => (kind === 'basis' ? basisState(n, Math.min(x, N - 1)) : periodicState(n, r, off)), [kind, n, x, r, off, N]);
  const state = useMemo(() => {
    const st = input.clone();
    for (let i = 0; i < step; i++) applyQftGate(st, gates[i]);
    return st;
  }, [input, gates, step]);
  const finished = step === gates.length;
  const probs = state.probabilities();
  const labels = Array.from({ length: N }, (_, i) => String(i));
  const teeth = Array.from({ length: N }, (_, x) => x).filter((x) => x % r === off % r);
  const inputCaption =
    kind === 'basis'
      ? `The input: all of the amplitude on ${Math.min(x, N - 1)}.`
      : teeth.length > 1
        ? `The input: equal amplitude on ${teeth.slice(0, 5).join(', ')}${teeth.length > 5 ? ', …' : ''} (every ${r}th value).`
        : `The input: only ${teeth[0]} fits in ${N} values, so there is no rhythm to hear. Try a smaller r or 4 qubits.`;

  const resetRun = () => {
    setStep(0);
    setSingleSteps(0);
    setPlaying(false);
    evaluated.current = '';
  };
  const changeInput = (fn: () => void) => {
    fn();
    resetRun();
  };

  // Auto-play: one gate at a time.
  useEffect(() => {
    if (!playing) return;
    if (step >= gates.length) {
      setPlaying(false);
      return;
    }
    if (reduced) {
      setStep(gates.length);
      return;
    }
    const id = window.setTimeout(() => setStep((v) => Math.min(gates.length, v + 1)), 420);
    return () => window.clearTimeout(id);
  }, [playing, step, gates.length, reduced]);

  // When a run reaches the end, say what happened and tick tasks (once per input).
  useEffect(() => {
    if (!finished) return;
    const key = `${kind}-${n}-${x}-${r}-${off}-${singleSteps >= gates.length}`;
    if (evaluated.current === key) return;
    evaluated.current = key;
    if (kind === 'basis') {
      if (x === 0) {
        mark(0);
        setMsg({
          tone: 'good',
          text: 'Every output clock has the same size and points the same way: the QFT of 0, a number with no rhythm at all, is an even spread over all values.',
        });
      } else if (n === 3 && x === 5 && singleSteps >= gates.length) {
        mark(1);
        mark(2);
        setMsg({
          tone: 'good',
          text: 'Look at the three Bloch arrows: each qubit ended on the equator at its own angle. q0 turned 5/8 of a turn, q1 twice as much, q2 four times as much. The QFT writes the number as a set of clock speeds.',
          deeper: 'QFT|x⟩ = ⊗_q (|0⟩ + e^{2πi x 2^q / N}|1⟩)/√2. That is why the circuit only needs n Hadamards and n(n−1)/2 controlled turns instead of N² multiplications.',
        });
      } else {
        mark(1);
        setMsg({
          tone: 'good',
          text: `QFT|${x}⟩: clock y has turned ${x}·y/${N} of a turn, so the clocks wind ${x} time${x === 1 ? '' : 's'} around. A bigger input gives a faster wave; every output is equally likely.`,
          deeper: `QFT|x⟩ = (1/√${N}) Σ_y e^{2πi x y/${N}} |y⟩. Try stepping through x = 5 on 3 qubits one gate at a time.`,
        });
      }
    } else {
      const divides = N % r === 0;
      if (divides && r === 4 && n === 4) mark(3);
      if (!divides) mark(4);
      setMsg(
        divides
          ? {
              tone: 'good',
              text: `The rhythm "every ${r}" became ${r} sharp peaks at multiples of ${N}/${r} = ${N / r}. All other values canceled out exactly. Read the spacing, and you know r.`,
              deeper: 'Shifting the pattern (the offset slider) only turns the clocks; the peak positions stay put. That is why Shor’s algorithm does not care which value the output register showed.',
            }
          : {
              tone: 'good',
              text: `${N}/${r} = ${(N / r).toFixed(2)} is not a whole number, so each peak smears over its nearest values. They still sit near multiples of ${N}/${r}; a bigger register sharpens them, and the next chapter recovers r anyway.`,
            },
      );
    }
  }, [finished]); // eslint-disable-line react-hooks/exhaustive-deps

  const stepOnce = () => {
    if (step >= gates.length) return;
    setPlaying(false);
    setStep(step + 1);
    setSingleSteps((k) => k + 1);
  };
  const back = () => {
    setPlaying(false);
    setStep(Math.max(0, step - 1));
  };

  const markers = kind === 'comb' && finished ? expectedPeaks(n, r) : undefined;
  const gateNote = step === 0 ? 'Press Step to apply the first gate, or Run all.' : finished ? 'Done: this is the QFT of the input.' : `Step ${step} of ${gates.length}. ${describeGate(gates[step - 1], n)}`;

  // ---------------------------------------------------------------- frequency detective
  const rng = useRef(makeRng(4040));
  const [mystery, setMystery] = useState<{ r: number; off: number } | null>(null);
  const [samples, setSamples] = useState<number[]>(() => new Array(16).fill(0));
  const [guesses, setGuesses] = useState<Record<number, 'right' | 'wrong'>>({});
  const mysteryProbs = useMemo(() => {
    if (!mystery) return null;
    const st = periodicState(4, mystery.r, mystery.off);
    for (const g of qftCircuit(4)) applyQftGate(st, g);
    return st.probabilities();
  }, [mystery]);
  const newMystery = () => {
    const rr = MYSTERY[rng.current.int(MYSTERY.length)];
    setMystery({ r: rr, off: rng.current.int(rr) });
    setSamples(new Array(16).fill(0));
    setGuesses({});
  };
  const measureMore = () => {
    if (!mysteryProbs) return;
    const next = [...samples];
    for (let i = 0; i < 10; i++) next[sampleIndex(mysteryProbs, rng.current)]++;
    setSamples(next);
  };
  const guess = (g: number) => {
    if (!mystery) return;
    const right = g === mystery.r;
    setGuesses((m) => ({ ...m, [g]: right ? 'right' : 'wrong' }));
    if (right) {
      mark(5);
      setMsg({ tone: 'good', text: `Right: the hidden pattern repeated every ${mystery.r}. You just did the quantum part of Shor's algorithm by eye.` });
    } else {
      setMsg({ tone: 'warn', text: `Not ${g}. The peaks sit about 16/r apart: count the spacing between the tall bars.` });
    }
  };
  const nSamples = samples.reduce((a, b) => a + b, 0);

  const tasks = [
    { label: <>Run the QFT on <b>|0⟩</b> (press Run all).</>, done: done[0] },
    { label: <>Pick another number x and run it. Watch the clocks wind.</>, done: done[1] },
    { label: <>On 3 qubits, step through <b>x = 5</b> one gate at a time with Step.</>, done: done[2] },
    { label: <>Feed it a rhythm: a pattern that repeats <b>every 4</b>, on 4 qubits.</>, done: done[3] },
    { label: <>Try a rhythm that does not fit evenly, like <b>every 3</b>.</>, done: done[4] },
    { label: <>Frequency detective: name a hidden period from measurements alone.</>, done: done[5] },
  ];

  return (
    <ChapterFrame
      meta={meta}
      clip={{ id: 'qft', caption: 'From the film: the quantum Fourier transform, clock by clock.' }}
      goal="See how a quantum circuit turns a repeating pattern into sharp peaks."
      tasks={tasks}
      complete={done.every(Boolean)}
      canvas={
        <div className={s.stateGrid}>
          <Card title="1 · Choose what goes in">
            <div className={css.controls}>
              <Segmented
                label="Input type"
                value={kind}
                onChange={(v) => changeInput(() => setKind(v))}
                options={[
                  { value: 'basis', label: 'A single number |x⟩' },
                  { value: 'comb', label: 'A repeating pattern' },
                ]}
              />
              <Segmented
                label="Number of qubits"
                value={n}
                onChange={(v) => changeInput(() => (setN(v), setX((xx) => Math.min(xx, 2 ** v - 1)), setOff((o) => Math.min(o, 2 ** v - 1))))}
                options={[
                  { value: 3, label: '3 qubits (8 values)' },
                  { value: 4, label: '4 qubits (16 values)' },
                ]}
              />
            </div>
            <div style={{ marginTop: 12 }}>
              {kind === 'basis' ? (
                <Slider label="Input number x" value={x} min={0} max={N - 1} step={1} onChange={(v) => changeInput(() => setX(v))} format={(v) => `x = ${v} (binary ${v.toString(2).padStart(n, '0')})`} />
              ) : (
                <div className={css.twoCol}>
                  <Slider label="Repeats every r" value={r} min={2} max={8} step={1} onChange={(v) => changeInput(() => (setR(v), setOff((o) => Math.min(o, v - 1))))} format={(v) => `r = ${v}`} />
                  <Slider label="Starting at" value={off} min={0} max={r - 1} step={1} onChange={(v) => changeInput(() => setOff(v))} format={(v) => `offset ${v}`} />
                </div>
              )}
            </div>
            <PhaseClocks re={input.re} im={input.im} labels={labels} size={50} caption={inputCaption} />
          </Card>

          <Card title="2 · Run the circuit">
            <QftCircuitDiagram n={n} gates={gates} step={step} onJump={(k) => (setPlaying(false), setStep(k))} />
            <div className={css.controls} style={{ marginTop: 10 }}>
              <Button small variant="ghost" onClick={resetRun} aria-label="Back to the input">
                ⏮ Reset
              </Button>
              <Button small onClick={back} disabled={step === 0} aria-label="Undo one gate">
                ◀ Back
              </Button>
              <Button small variant="primary" onClick={stepOnce} disabled={finished} aria-label="Apply the next gate">
                Step ▶
              </Button>
              <Button small onClick={() => (finished ? (resetRun(), setPlaying(true)) : setPlaying((p) => !p))} aria-label={playing ? 'Pause' : 'Run all gates'}>
                {playing ? '❚❚ Pause' : finished ? '↻ Run again' : '▶▶ Run all'}
              </Button>
            </div>
            <p className={css.explain} aria-live="polite">
              {gateNote}
            </p>
          </Card>

          <Card title={finished ? '3 · The output: the QFT of your input' : '3 · The register right now'}>
            <PhaseClocks re={state.re} im={state.im} labels={labels} size={50} highlight={markers?.filter((m) => Number.isInteger(m))} caption="Disk size = amplitude, hand = phase. Hover a clock for exact values." />
            <ProbChart
              values={probs}
              markers={markers}
              height={90}
              label={`Measurement probabilities: ${Array.from(probs)
                .map((p, i) => (p > 0.005 ? `${i}: ${(100 * p).toFixed(0)}%` : null))
                .filter(Boolean)
                .join(', ')}`}
              caption={markers ? `Chance of measuring each value. Dashed lines: multiples of ${N}/${r}.` : 'Chance of measuring each value.'}
            />
            <div className={s.blochRow} style={{ marginTop: 6 }}>
              {Array.from({ length: n }, (_, q) => n - 1 - q).map((q) => (
                <BlochSphere key={q} bloch={state.bloch(q)} label={`q${q} (×${2 ** q})`} size={104} />
              ))}
            </div>
          </Card>
        </div>
      }
      panel={
        <>
          {msg && (
            <WhatHappened tone={msg.tone} deeper={msg.deeper}>
              {msg.text}
            </WhatHappened>
          )}
          <Card title="Frequency detective">
            <p className="muted" style={{ fontSize: '0.9rem', marginTop: 0 }}>
              We hide a pattern that repeats every r (on 4 qubits), run the QFT, and measure. You only see the results. What is r?
            </p>
            {!mystery ? (
              <Button variant="primary" onClick={newMystery}>
                Hide a pattern
              </Button>
            ) : (
              <>
                <Row>
                  <Button variant="primary" small onClick={measureMore}>
                    Measure 10 times
                  </Button>
                  <Button small variant="ghost" onClick={newMystery}>
                    New mystery
                  </Button>
                </Row>
                {nSamples > 0 && <ProbChart values={samples} asCounts height={70} label={`Measurement counts after ${nSamples} runs`} caption={`${nSamples} measurements`} />}
                <div className={css.detective} role="group" aria-label="Guess the period">
                  {[2, 3, 4, 5, 6, 7, 8].map((g) => (
                    <button key={g} data-state={guesses[g]} onClick={() => guess(g)} disabled={nSamples === 0} aria-label={`Guess r = ${g}`}>
                      {g}
                    </button>
                  ))}
                </div>
              </>
            )}
          </Card>
          <Card title="The idea in one line">
            <p style={{ margin: 0, fontSize: '0.92rem' }}>
              Like a prism splitting light into colors, the QFT splits a quantum state into its frequencies: a rhythm in the input becomes a peak in the output.
              Unlike a prism, it acts on all {N} amplitudes at once with only {gates.length} gates.
            </p>
          </Card>
        </>
      }
    />
  );
}
