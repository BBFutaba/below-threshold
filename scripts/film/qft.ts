// Chapter 3: the quantum Fourier transform.
//
// The classical DFT of a comb signal (the "listen" analogy), QFT|1> and QFT|3> on three
// qubits, the gate-by-gate run of the 3-qubit circuit on |5> with every qubit's Bloch vector
// after each gate, the phasor sums behind two outputs of the period-4 comb, and the QFT of
// period-4 (16 values) and period-3 (64 values) combs. All from qft.ts and QState.
import { applyQftGate, basisState, dft, periodicState, qft, qftCircuit } from '../../src/core/qft';
import { write } from './_util';

const amp = (re: ArrayLike<number>, im: ArrayLike<number>) => Array.from({ length: re.length }, (_, i) => ({ re: re[i], im: im[i] }));

const signal = Array.from({ length: 16 }, (_, x) => (x % 4 === 0 ? 1 : 0));
const spec = dft(signal, new Array(16).fill(0));
const spectrum = Array.from({ length: 16 }, (_, k) => Math.hypot(spec.re[k], spec.im[k]));

const clocks = [1, 3].map((x) => {
  const s = qft(basisState(3, x), 3);
  return { x, amps: amp(s.re, s.im) };
});

const gates = qftCircuit(3);
const s5 = basisState(3, 5);
const steps = [{ gate: null as unknown, bloch: [0, 1, 2].map((q) => s5.bloch(q)) }];
for (const g of gates) {
  applyQftGate(s5, g);
  steps.push({ gate: g, bloch: [0, 1, 2].map((q) => s5.bloch(q)) });
}
// After the full circuit qubit q sits on the equator at 5 * 2^q / 8 of a turn.
for (let q = 0; q < 3; q++) {
  const b = steps.at(-1)!.bloch[q];
  const ang = (2 * Math.PI * 5 * 2 ** q) / 8;
  if (Math.abs(b.x - Math.cos(ang)) > 1e-9 || Math.abs(b.y - Math.sin(ang)) > 1e-9) throw new Error('qubit clock mismatch');
}

// Offset 1 (teeth at 1, 5, 9, 13) so the input comb and the output peaks (0, 4, 8, 12) are visibly different.
const comb4 = periodicState(4, 4, 1);
const out4 = qft(comb4.clone(), 4);
// The amplitude of output k is (1/sqrt N) * sum over the teeth x of a_x e^{2 pi i x k / N}; here a_x = 1/2, 1/sqrt N = 1/4.
const teeth = [1, 5, 9, 13];
const phasors = [4, 1].map((k) => ({
  k,
  terms: teeth.map((x) => ({ x, re: Math.cos((2 * Math.PI * x * k) / 16) / 8, im: Math.sin((2 * Math.PI * x * k) / 16) / 8 })),
  total: { re: out4.re[k], im: out4.im[k] },
}));
for (const ph of phasors) {
  const sr = ph.terms.reduce((a, t) => a + t.re, 0),
    si = ph.terms.reduce((a, t) => a + t.im, 0);
  if (Math.abs(sr - ph.total.re) > 1e-9 || Math.abs(si - ph.total.im) > 1e-9) throw new Error('phasor sum mismatch');
}

const comb3 = qft(periodicState(6, 3, 0), 6);
write('qft', {
  listen: { signal, spectrum },
  clocks,
  circuit: { n: 3, x: 5, gates, steps },
  comb: { n: 4, r: 4, offset: 1, input: Array.from(comb4.probabilities()), output: Array.from(out4.probabilities()), phasors },
  blur: { n: 6, r: 3, input: Array.from(periodicState(6, 3, 0).probabilities()), output: Array.from(comb3.probabilities()) },
});
