// Chapter 3: why errors become digital.
//
// Re-runs the discretization experiment of scripts/manim-data.ts exactly (seed 6006,
// theta = 0.9, 200 runs, the 3-qubit code with ancillas 3 and 4 collecting Z0Z1 and Z1Z2)
// and checks it against media/data/discretization.json, then adds what the film draws:
// the single-qubit state Rx(theta)|0> term by term and the Bloch vector before and after
// each run's measurement.
import { readFileSync } from 'node:fs';
import { Gates, QState } from '../../src/core/quantum';
import { makeRng } from '../../src/core/rng';
import { write } from './_util';

const theta = 0.9;
const runs = 200;
const seed = 6006;
const rng = makeRng(seed);

const ideal = new QState(5);
const sequence: string[] = [];
const blochAfterZ: number[] = [];
const fidelityAfterCorrection: number[] = [];
const counts: Record<string, number> = { '00': 0, '10': 0, '01': 0, '11': 0 };
for (let i = 0; i < runs; i++) {
  const s = new QState(5);
  s.rx(0, theta);
  s.cnot(0, 3).cnot(1, 3);
  s.cnot(1, 4).cnot(2, 4);
  const s1 = s.measure(3, rng.next);
  const s2 = s.measure(4, rng.next);
  if (s1) s.x(3);
  if (s2) s.x(4);
  counts[`${s1}${s2}`]++;
  sequence.push(`${s1}${s2}`);
  blochAfterZ.push(Math.round(s.bloch(0).z * 1e9) / 1e9);
  // Undo the flip the syndrome names (10 -> X on qubit 0) and compare with |000>.
  if (s1 && !s2) s.x(0);
  fidelityAfterCorrection.push(s.fidelity(ideal));
}

// Cross-check against the existing export (same code, same seed).
const ref = JSON.parse(readFileSync('media/data/discretization.json', 'utf-8'));
const refSeq: string[] = ref.sequence.map((k: string) => (k === 'none' ? '00' : k === 'flip1' ? '10' : k.slice(5)));
if (JSON.stringify(refSeq) !== JSON.stringify(sequence)) throw new Error('digital: sequence differs from discretization.json');
if (JSON.stringify(ref.counts) !== JSON.stringify(counts)) throw new Error('digital: counts differ from discretization.json');

// Pre-measurement probabilities read off the state vector.
const pre = new QState(5).rx(0, theta).cnot(0, 3).cnot(1, 3).cnot(1, 4).cnot(2, 4);
const probs = pre.probabilities();
const pSyn: Record<string, number> = { '00': 0, '10': 0, '01': 0, '11': 0 };
for (let i = 0; i < probs.length; i++) pSyn[`${(i >> 3) & 1}${(i >> 4) & 1}`] += probs[i];

const one = new QState(1).rx(0, theta);
// The error operator itself, Rx(theta) = cos(theta/2) I - i sin(theta/2) X, as the simulator defines it.
const [ar, ai, br, bi, cr, ci, dr, di] = Gates.Rx(theta);
const rxMatrix = { a: [ar, ai], b: [br, bi], c: [cr, ci], d: [dr, di] };
const c2 = Math.cos(theta / 2),
  s2 = Math.sin(theta / 2);
const rxDecomposition = { I: c2, X_im: -s2 };
const rxErr = Math.max(Math.abs(ar - c2), Math.abs(ai), Math.abs(br), Math.abs(bi + s2), Math.abs(cr), Math.abs(ci + s2), Math.abs(dr - c2), Math.abs(di));
if (rxErr > 1e-12) throw new Error('Rx is not cos I - i sin X');
write('digital', {
  theta,
  runs,
  seed,
  prep: 'logical |0> = |000>, Rx(theta) on data qubit 0',
  rxMatrix,
  rxDecomposition,
  single: {
    terms: one.terms().map((t) => ({ label: t.label, re: t.re, im: t.im, p: t.p })),
    bloch: one.bloch(0),
  },
  sequence,
  counts,
  measured: Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, v / runs])),
  stateVectorProb: pSyn,
  formula: { '00': Math.cos(theta / 2) ** 2, '10': Math.sin(theta / 2) ** 2 },
  blochAfterZ,
  minFidelityAfterCorrection: Math.min(...fidelityAfterCorrection),
});
