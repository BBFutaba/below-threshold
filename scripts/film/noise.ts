// Chapter 5: noise ruins the answer.
//
// The gate-level circuit for N = 15, a = 7 on 10 qubits (6 input + 4 output, 36 steps) run
// 200 times at each error rate with noisyShor (after every step each qubit gets a random
// X, Y or Z with probability p), plus the d = 5 layout the last beat turns into.
import { makeRotatedSurfaceCode } from '../../src/core/surfaceCode';
import { noisyShor, peakFraction, randomGuessSuccess, shorGates } from '../../src/core/shor';
import { layout, write } from './_util';

const N = 15,
  a = 7,
  t = 6,
  shots = 200;
const Q = 2 ** t;
const runs = [0, 0.001, 0.01, 0.05].map((p, i) => {
  const res = noisyShor(N, a, t, p, shots, 5100 + i);
  return { p, counts: Array.from(res.counts), peak: peakFraction(res.counts, Q, 4), success: res.successes / shots };
});
if (runs[0].peak !== 1) throw new Error('clean runs must all land on a peak');
const steps = shorGates(N, a, t).length;
write('noise', {
  N,
  a,
  t,
  Q,
  qubits: t + 4,
  steps,
  shots,
  peaks: [0, 16, 32, 48],
  chance: 4 / Q,
  randomGuess: randomGuessSuccess(N, a, Q),
  runs,
  layout: layout(makeRotatedSurfaceCode(5)),
});
