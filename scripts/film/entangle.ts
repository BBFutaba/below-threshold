// Chapter 2: many qubits, and entanglement.
//
// From QState: two qubits' four amplitudes at |00>, after H on qubit 0, and after the CNOT
// (the Bell pair); 100 seeded shots of the Bell pair; each qubit's Bloch length at each stage
// (the Bell pair's are 0); and the eight-clock waves of three qubits (H on each, then qubit q
// turned by f * 2^q / 8 of a turn).
import { QState } from '../../src/core/quantum';
import { makeRng } from '../../src/core/rng';
import { write } from './_util';

const TAU = 2 * Math.PI;
const amp = (s: QState) => Array.from({ length: s.N }, (_, i) => ({ re: s.re[i], im: s.im[i] }));
const lengths = (s: QState) => [0, 1].map((q) => s.bloch(q).length);
const vectors = (s: QState) => [0, 1].map((q) => s.bloch(q));

const s0 = new QState(2);
const s1 = s0.clone().h(0);
const s2 = s1.clone().cnot(0, 1);
const shots = Array.from(s2.sample(100, makeRng(707).next));
if (shots[1] || shots[2]) throw new Error('a Bell pair never gives 01 or 10');
if (lengths(s2).some((l) => l > 1e-12)) throw new Error('Bell pair qubits must have zero-length Bloch vectors');

const waves = [1, 2].map((f) => {
  const s = new QState(3);
  for (let q = 0; q < 3; q++) s.h(q).phase(q, (TAU * f * 2 ** q) / 8);
  return { f, amps: amp(s) };
});

write('entangle', {
  labels: [0, 1, 2, 3].map((i) => s0.label(i)),
  stages: [
    { name: 'start', amps: amp(s0), bloch: lengths(s0), vectors: vectors(s0) },
    { name: 'H', amps: amp(s1), bloch: lengths(s1), vectors: vectors(s1) },
    { name: 'CNOT', amps: amp(s2), bloch: lengths(s2), vectors: vectors(s2) },
  ],
  shots,
  growth: Array.from({ length: 10 }, (_, i) => ({ n: i + 1, amplitudes: 2 ** (i + 1) })),
  waves,
});
