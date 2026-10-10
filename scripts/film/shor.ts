// Chapter 4: Shor's algorithm, end to end, for N = 21, a = 2, t = 7 (Q = 128).
//
// Register-level exact states from shor.ts. The two measurements are seeded draws from the
// exact distributions; the seed is the first one that reads 8 and then 21, the values the
// narration names (asserted below), so the scene shows a real, typical run.
import { makeRng } from '../../src/core/rng';
import { comb, outputValues, postprocess, qftOfComb, registers, sampleIndex, successProbability } from '../../src/core/shor';
import { write } from './_util';

const N = 21,
  a = 2,
  t = 7;
const R = registers(N, a, t);
const outs = outputValues(R);
let seed = -1,
  v = -1,
  k = -1;
for (let s = 1; s < 100_000; s++) {
  const rng = makeRng(s);
  const vv = outs[sampleIndex(outs.map((o) => o.count / R.Q), rng)].v;
  if (vv !== 8) continue;
  const kk = sampleIndex(qftOfComb(R, vv).p, rng);
  if (kk !== 21) continue;
  seed = s;
  v = vv;
  k = kk;
  break;
}
if (seed < 0) throw new Error('no seed reads 8 then 21');
const post = postprocess(k, R.Q, N, a);
if (post.status !== 'ok' || post.r !== 6 || post.factors?.join() !== '3,7') throw new Error('unexpected post-processing');

write('shor', {
  N,
  a,
  t,
  Q: R.Q,
  m: R.m,
  r: R.r,
  seed,
  f: Array.from(R.f),
  values: outs,
  v,
  comb: comb(R, v),
  qft: Array.from(qftOfComb(R, v).p),
  k,
  post,
  successProbability: successProbability(R),
});
