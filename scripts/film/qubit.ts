// Chapter 1: arrows, amplitudes and phase.
//
// Everything the scene draws, read off QState: a superposition Ry(theta)|0>, the same state
// with its |1> amplitude turned by P(phi) (probabilities unchanged), the interference sweep
// H P(phi) H |0> with the two amplitudes that meet at the second H, and the eight-clock waves
// of three qubits (H on each, then qubit q turned by f * 2^q / 8 of a turn).
import { QState } from '../../src/core/quantum';
import { write } from './_util';

const TAU = 2 * Math.PI;
const theta = 1.1;
const amp = (s: QState) => Array.from({ length: s.N }, (_, i) => ({ re: s.re[i], im: s.im[i] }));

const sup = new QState(1).ry(0, theta);
const phaseSweep = Array.from({ length: 49 }, (_, i) => {
  const phi = (TAU * i) / 48;
  const s = new QState(1).ry(0, theta).phase(0, phi);
  return { phi, amps: amp(s), p1: s.prob1(0), bloch: s.bloch(0) };
});
for (const p of phaseSweep) if (Math.abs(p.p1 - sup.prob1(0)) > 1e-12) throw new Error('phase changed the odds');

const interference = Array.from({ length: 49 }, (_, i) => {
  const phi = (Math.PI * i) / 48;
  const mid = new QState(1).h(0).phase(0, phi); // the two amplitudes that meet at the second H
  const out = mid.clone().h(0);
  if (Math.abs(out.prob1(0) - Math.sin(phi / 2) ** 2) > 1e-12) throw new Error('interference off the formula');
  return { phi, mid: amp(mid), out: amp(out), p1: out.prob1(0) };
});

const waves = [1, 2].map((f) => {
  const s = new QState(3);
  for (let q = 0; q < 3; q++) s.h(q).phase(q, (TAU * f * 2 ** q) / 8);
  for (let y = 0; y < 8; y++) {
    const want = (TAU * f * y) / 8;
    if (Math.abs(Math.cos(want) / Math.sqrt(8) - s.re[y]) > 1e-12 || Math.abs(Math.sin(want) / Math.sqrt(8) - s.im[y]) > 1e-12) throw new Error('wave mismatch');
  }
  return { f, amps: amp(s) };
});

write('qubit', {
  theta,
  superposition: { amps: amp(sup), p0: 1 - sup.prob1(0), p1: sup.prob1(0), bloch: sup.bloch(0) },
  phaseSweep,
  interference,
  waves,
});
