// Chapter 7: below threshold.
//
// Everything the scene draws comes from the project's own code and Monte Carlo runs:
// - layouts of the d = 5, 7, 9 rotated surface codes (makeRotatedSurfaceCode),
// - "noise strikes" sparks: seeded bit-flip sampleNoise draws on each lattice,
// - the p dial: for each lattice one seeded sampleNoise stream; with bit-flip noise
//   sampleNoise draws exactly one uniform u_i per qubit and flips it iff u_i < p, so the
//   same seed gives nested error sets as p grows. We export u_i and check that claim
//   against sampleNoise at several p,
// - the threshold curves (media/data/threshold.json: validation.json points plus a
//   runPoint sweep; bit-flip noise, MWPM, d = 5, 7, 9),
// - the thresholds of the other noise models (src/data/validation.json verdicts),
// - our own Lambda = eps_d / eps_{d+2} at every p of the sweep below threshold.
import { readFileSync } from 'node:fs';
import { makeRotatedSurfaceCode } from '../../src/core/surfaceCode';
import { makeRng } from '../../src/core/rng';
import { sampleNoise } from '../../src/core/noise';
import { layout, ones, write } from './_util';

type Pt = { p: number; pL: number; lo: number; hi: number; trials: number; failures: number; seed?: number; source: string };

const th = JSON.parse(readFileSync('media/data/threshold.json', 'utf8')) as {
  ps: number[];
  curves: Record<string, Pt[]>;
  crossings: Record<string, number[]>;
  validationVerdict: { estimate: number; range: number[]; published: number; source: string };
  sampling: string;
};
const val = JSON.parse(readFileSync('src/data/validation.json', 'utf8')) as {
  verdicts: { model: string; decoder: string; estimate: number; range: number[]; published: number; source: string; pass: boolean }[];
};

const DS = [5, 7, 9];
const codes = Object.fromEntries(DS.map((d) => [d, makeRotatedSurfaceCode(d)]));

// --- sparks: three bit-flip draws per lattice at p = 6%. A single draw can easily put
// fewer errors on the bigger lattice, which would show the opposite of the average, so
// for each frame we take the first seed (from a fixed base) whose draw is typical: every
// lattice within max(1, 35%) of its expected count n p, and counts increasing with d.
const SPARK_P = 0.06;
const sparkDraw = (d: number, seed: number) => {
  const s = sampleNoise(codes[d], { kind: 'bitflip', p: SPARK_P }, makeRng(seed));
  if (s.kind !== 'codeCapacity') throw new Error();
  return { seed, errors: ones(s.error.x), syndrome: ones(s.syndrome) };
};
const sparks: Record<number, { seed: number; errors: number[]; syndrome: number[] }[]> = { 5: [], 7: [], 9: [] };
const sparkSeeds: number[] = [];
for (let k = 0; k < 3; k++) {
  for (let seed = 7100 + 1000 * k; ; seed++) {
    const draws = DS.map((d) => sparkDraw(d, seed * 16 + d));
    const counts = draws.map((x) => x.errors.length);
    const typical = DS.every((d, i) => Math.abs(counts[i] - codes[d].n * SPARK_P) <= Math.max(1, 0.35 * codes[d].n * SPARK_P));
    if (typical && counts[0] < counts[1] && counts[1] < counts[2]) {
      DS.forEach((d, i) => sparks[d].push(draws[i]));
      sparkSeeds.push(seed);
      break;
    }
  }
}

// --- p dial: per-qubit uniforms of one seeded stream per lattice. Of the first 400
// seeds we keep the most typical one (smallest worst-case gap between the number of
// flipped qubits and n p over the dial's range), again so the picture is the average one.
const DIAL_PS = Array.from({ length: 15 }, (_, i) => 0.02 + 0.01 * i);
const dial: Record<number, { seed: number; u: number[]; score: number }> = {};
for (const d of DS) {
  let best: { seed: number; u: number[]; score: number } | null = null;
  for (let j = 0; j < 400; j++) {
    const seed = 7200 + 1000 * d + j;
    const rng = makeRng(seed);
    const u = Array.from({ length: codes[d].n }, () => rng.next());
    const score = Math.max(...DIAL_PS.map((p) => Math.abs(u.filter((x) => x < p).length - codes[d].n * p)));
    if (!best || score < best.score) best = { seed, u, score };
  }
  for (const p of [0.02, 0.05, 0.08, 0.1, 0.12, 0.15]) {
    const s = sampleNoise(codes[d], { kind: 'bitflip', p }, makeRng(best!.seed));
    if (s.kind !== 'codeCapacity') throw new Error();
    const want = best!.u.flatMap((x, i) => (x < p ? [i] : []));
    if (JSON.stringify(ones(s.error.x)) !== JSON.stringify(want)) throw new Error(`dial mismatch d=${d} p=${p}`);
  }
  dial[d] = best!;
}

// --- Lambda from the sweep, every p below the threshold estimate.
const pth = th.validationVerdict.estimate;
const lambda = th.ps
  .map((p, i) => ({ p, e5: th.curves['5'][i].pL, e7: th.curves['7'][i].pL, e9: th.curves['9'][i].pL }))
  .filter((r) => r.p < pth)
  .map((r) => ({ ...r, l57: r.e5 / r.e7, l79: r.e7 / r.e9 }));
const LAMBDA_P = 0.04;
const chosen = lambda.find((r) => Math.abs(r.p - LAMBDA_P) < 1e-9)!;

const verdict = (model: string) => val.verdicts.find((v) => v.model === model && v.decoder === 'mwpm')!;

write('threshold', {
  layouts: Object.fromEntries(DS.map((d) => [d, layout(codes[d])])),
  sparks: { p: SPARK_P, model: 'bitflip', frameSeeds: sparkSeeds, seedRule: 'lattice d uses makeRng(frameSeed * 16 + d)', draws: sparks },
  dial: { model: 'bitflip', note: 'qubit i is flipped iff u_i < p (checked against sampleNoise with the same seed)', draws: dial },
  curves: { sampling: th.sampling, model: 'bitflip', decoder: 'mwpm', ps: th.ps, byD: th.curves, crossings: th.crossings },
  thresholds: {
    bitflip: { ...verdict('bitflip'), label: 'ours (validation.json)' },
    phenomenological: { ...verdict('phenomenological'), label: 'ours (validation.json)' },
    circuit: { estimate: 0.01, label: 'literature', source: 'Fowler, Mariantoni, Martinis, Cleland, PRA 86, 032324 (2012): circuit-level threshold near 1%' },
  },
  lambda: { table: lambda, chosen, note: 'Lambda = eps_d / eps_{d+2} from the runPoint sweep (bit-flip, MWPM)' },
  google: { lambda: 2.14, pm: 0.02, source: 'Google Quantum AI, Nature 638, 920 (2025); arXiv:2408.13687 (2024)' },
});
console.log('lambda at p=4%:', chosen.l57.toFixed(3), chosen.l79.toFixed(3));
for (const d of DS) console.log('sparks d=' + d, sparks[d].map((s) => s.errors.length), 'dial seed', dial[d].seed, 'score', dial[d].score.toFixed(2));
console.log('spark frame seeds', sparkSeeds);
