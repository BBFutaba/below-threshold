// Shor's algorithm on small numbers, computed two independent ways:
//
// 1. Register level (exact): the state after each step written down directly. After the
//    Hadamards and the modular exponentiation the registers hold
//    (1/sqrt Q) sum_x |x>|a^x mod N>; measuring the output register leaves a comb of
//    x values spaced by the period r; the QFT turns the comb into peaks near multiples
//    of Q/r.
// 2. Gate level: Hadamards, controlled modular multiplications and the textbook QFT
//    circuit run on the state-vector simulator, optionally with a random X, Y or Z error
//    after every gate (the noise chapter).
//
// tests/core/shor.test.ts checks that both give the same distribution without noise.

import { QState } from './quantum';
import { applyQftGate, dft, qftCircuit, type QftGate } from './qft';
import { makeRng, type Rng } from './rng';

export function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

/** base^exp mod m, exact while m < 2^26. */
export function modPow(base: number, exp: number, m: number): number {
  if (m === 1) return 0;
  let r = 1,
    b = base % m,
    e = exp;
  while (e > 0) {
    if (e & 1) r = (r * b) % m;
    b = (b * b) % m;
    e = Math.floor(e / 2);
  }
  return r;
}

/** The period r: the smallest r > 0 with a^r = 1 (mod N). Classical brute force, for checking. */
export function multiplicativeOrder(a: number, N: number): number {
  if (gcd(a, N) !== 1) throw new Error(`${a} and ${N} share a factor; there is no period`);
  let v = a % N;
  for (let r = 1; r <= N; r++) {
    if (v === 1) return r;
    v = (v * a) % N;
  }
  throw new Error('no period found');
}

/** Bits needed to hold the values 0..N-1. */
export const bitsFor = (N: number) => Math.max(1, Math.ceil(Math.log2(N)));

/** Input register size: Q = 2^t >= N^2 is what guarantees the continued fraction works (capped for the browser). */
export const recommendedT = (N: number) => Math.min(9, Math.ceil(Math.log2(N * N)));

/** Bases a with 1 < a < N - 1 that share no factor with N. */
export function coprimeBases(N: number): number[] {
  const out: number[] = [];
  for (let a = 2; a < N - 1; a++) if (gcd(a, N) === 1) out.push(a);
  return out;
}

export interface Convergent {
  p: number;
  q: number;
}

/** Continued fraction terms of num/den. */
export function continuedFraction(num: number, den: number): number[] {
  const terms: number[] = [];
  while (den !== 0) {
    const a = Math.floor(num / den);
    terms.push(a);
    [num, den] = [den, num - a * den];
  }
  return terms;
}

/** Successive best rational approximations p/q of num/den. */
export function convergents(num: number, den: number): Convergent[] {
  const out: Convergent[] = [];
  let [p0, q0, p1, q1] = [0, 1, 1, 0];
  for (const a of continuedFraction(num, den)) {
    [p0, p1] = [p1, a * p1 + p0];
    [q0, q1] = [q1, a * q1 + q0];
    out.push({ p: p1, q: q1 });
  }
  return out;
}

// ----------------------------------------------------------------------------- register level

export interface ShorRegisters {
  N: number;
  a: number;
  /** Input register qubits; Q = 2^t values of x. */
  t: number;
  Q: number;
  /** Output register qubits (enough to hold a^x mod N). */
  m: number;
  /** f(x) = a^x mod N for x = 0..Q-1. */
  f: Int32Array;
  /** The true period (for checking only; the algorithm never reads it). */
  r: number;
}

export function registers(N: number, a: number, t: number): ShorRegisters {
  if (gcd(a, N) !== 1) throw new Error(`gcd(${a}, ${N}) = ${gcd(a, N)}: no quantum step needed`);
  const Q = 2 ** t;
  const f = new Int32Array(Q);
  let v = 1;
  for (let x = 0; x < Q; x++) {
    f[x] = v;
    v = (v * a) % N;
  }
  return { N, a, t, Q, m: bitsFor(N), f, r: multiplicativeOrder(a, N) };
}

/** The values the output register can show, with how many x give each (P(v) = count / Q). */
export function outputValues(R: ShorRegisters): { v: number; count: number }[] {
  const m = new Map<number, number>();
  for (const v of R.f) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([v, count]) => ({ v, count }));
}

/** The x values left in the input register after the output register reads v. */
export function comb(R: ShorRegisters, v: number): number[] {
  const xs: number[] = [];
  for (let x = 0; x < R.Q; x++) if (R.f[x] === v) xs.push(x);
  return xs;
}

/** The input register after measuring v: equal amplitudes on the comb. */
export function combAmplitudes(R: ShorRegisters, v: number): Float64Array {
  const xs = comb(R, v);
  const re = new Float64Array(R.Q);
  for (const x of xs) re[x] = 1 / Math.sqrt(xs.length);
  return re;
}

/** The input register after the QFT, given output value v. */
export function qftOfComb(R: ShorRegisters, v: number): { re: Float64Array; im: Float64Array; p: Float64Array } {
  const re = combAmplitudes(R, v);
  const out = dft(re, new Float64Array(R.Q));
  const p = new Float64Array(R.Q);
  for (let k = 0; k < R.Q; k++) p[k] = out.re[k] ** 2 + out.im[k] ** 2;
  return { ...out, p };
}

/** P(k) for the final input-register measurement, averaged over the output-register outcome. */
export function inputDistribution(R: ShorRegisters): Float64Array {
  const P = new Float64Array(R.Q);
  for (const { v, count } of outputValues(R)) {
    const { p } = qftOfComb(R, v);
    for (let k = 0; k < R.Q; k++) P[k] += (count / R.Q) * p[k];
  }
  return P;
}

export type PostStatus = 'ok' | 'zero' | 'no-period' | 'odd' | 'trivial';

export interface PostResult {
  k: number;
  Q: number;
  /** Convergents of k/Q with denominator below N. */
  convergents: Convergent[];
  /** The denominator the continued fraction suggested. */
  guess: number | null;
  /** The period found (the guess or a small multiple of it that passes a^r = 1 mod N). */
  r: number | null;
  status: PostStatus;
  /** a^(r/2) mod N, when r is even. */
  half?: number;
  factors?: [number, number];
  note: string;
}

/** The classical part: from a measured k, find r with continued fractions, then the factors with gcd. */
export function postprocess(k: number, Q: number, N: number, a: number): PostResult {
  const base = { k, Q, convergents: [] as Convergent[], guess: null as number | null, r: null as number | null };
  if (k === 0) return { ...base, status: 'zero', note: 'k = 0 says nothing about the period (0/Q = 0/r for every r). Run again.' };
  const cs = convergents(k, Q).filter((c) => c.q < N);
  const guess = cs.length ? cs[cs.length - 1].q : null;
  // k/Q is close to j/r, but the fraction may have reduced (gcd(j, r) > 1), so also try a
  // few small multiples of each denominator, as in Nielsen and Chuang. Keep the smallest that works.
  const maxMult = Math.max(2, Math.floor(Math.log2(N)));
  let r: number | null = null;
  for (const c of cs) {
    for (let mult = 1; mult <= maxMult && c.q * mult < N; mult++) {
      const cand = c.q * mult;
      if (cand > 1 && modPow(a, cand, N) === 1 && (r === null || cand < r)) r = cand;
    }
  }
  if (r === null) return { ...base, convergents: cs, guess, status: 'no-period', note: `No denominator below ${N} satisfies ${a}^r ≡ 1 (mod ${N}). This k landed between peaks. Run again.` };
  if (r % 2 === 1) return { ...base, convergents: cs, guess, r, status: 'odd', note: `The period r = ${r} is odd, so ${a}^(r/2) is not a whole number. Pick another a and run again.` };
  const half = modPow(a, r / 2, N);
  const f1 = gcd(half - 1, N);
  const f2 = gcd(half + 1, N);
  const p = f1 > 1 && f1 < N ? f1 : f2 > 1 && f2 < N ? f2 : null;
  if (p === null) {
    const why = half === N - 1 ? `${a}^(r/2) ≡ −1 (mod ${N})` : `${a}^(r/2) ≡ 1 (mod ${N}), so r is a multiple of the true period`;
    return { ...base, convergents: cs, guess, r, half, status: 'trivial', note: `${why}, and the gcd only returns 1 and ${N}. Try another a.` };
  }
  const factors: [number, number] = [Math.min(p, N / p), Math.max(p, N / p)];
  return { ...base, convergents: cs, guess, r, half, factors, status: 'ok', note: `gcd(${half} − 1, ${N}) = ${f1} and gcd(${half} + 1, ${N}) = ${f2}, so ${N} = ${factors[0]} × ${factors[1]}.` };
}

/** Exact probability that one run (one measured k) ends in the factors. */
export function successProbability(R: ShorRegisters, P = inputDistribution(R)): number {
  let s = 0;
  for (let k = 0; k < R.Q; k++) if (P[k] > 1e-12 && postprocess(k, R.Q, R.N, R.a).status === 'ok') s += P[k];
  return s;
}

/** Sample an index from a probability vector. */
export function sampleIndex(P: ArrayLike<number>, rng: Rng): number {
  let u = rng.next();
  for (let i = 0; i < P.length; i++) {
    u -= P[i];
    if (u < 0) return i;
  }
  return P.length - 1;
}

// ----------------------------------------------------------------------------- gate level

/** Multiply the output register (m qubits from `off`) by c mod N, when qubit `control` is 1. */
export function controlledMulMod(s: QState, control: number, off: number, m: number, c: number, N: number): QState {
  const re = Float64Array.from(s.re),
    im = Float64Array.from(s.im);
  const mask = ((1 << m) - 1) << off;
  for (let i = 0; i < s.N; i++) {
    let j = i;
    if ((i >> control) & 1) {
      const y = (i & mask) >> off;
      const y2 = y < N ? (y * c) % N : y; // values >= N never occur; leave them fixed so the map stays a permutation
      j = (i & ~mask) | (y2 << off);
    }
    s.re[j] = re[i];
    s.im[j] = im[i];
  }
  return s;
}

export type ShorGate = { kind: 'H'; q: number } | { kind: 'CU'; control: number; c: number; power: number } | { kind: 'QFT'; gate: QftGate };

/** The gate list: Hadamards on the input register, controlled multiplications by a^(2^j), then the QFT. */
export function shorGates(N: number, a: number, t: number): ShorGate[] {
  const out: ShorGate[] = [];
  for (let q = 0; q < t; q++) out.push({ kind: 'H', q });
  for (let j = 0; j < t; j++) out.push({ kind: 'CU', control: j, c: modPow(a, 2 ** j, N), power: 2 ** j });
  for (const gate of qftCircuit(t)) out.push({ kind: 'QFT', gate });
  return out;
}

function randomPauli(s: QState, q: number, p: number, rng: Rng) {
  if (p <= 0 || rng.next() >= p) return;
  const u = rng.int(3);
  if (u === 0) s.x(q);
  else if (u === 1) s.y(q);
  else s.z(q);
}

function touched(g: ShorGate, t: number, m: number): number[] {
  if (g.kind === 'H') return [g.q];
  if (g.kind === 'CU') return [g.control, ...Array.from({ length: m }, (_, i) => t + i)];
  const q = g.gate;
  return q.g === 'H' ? [q.q] : q.g === 'CP' ? [q.c, q.t] : [q.a, q.b];
}

export type NoiseKind = 'every' | 'touched';

/**
 * One run of the circuit on t + m qubits. With p > 0, after every step each qubit
 * ('every': busy or idle) or only the qubits the gate touched ('touched') suffers a random
 * X, Y or Z with probability p. Returns the input register's measurement distribution.
 */
export function runShorCircuit(N: number, a: number, t: number, p = 0, rng: Rng = makeRng(1), noise: NoiseKind = 'every'): Float64Array {
  const m = bitsFor(N);
  const s = new QState(t + m);
  s.x(t); // output register starts at |1>
  for (const g of shorGates(N, a, t)) {
    if (g.kind === 'H') s.h(g.q);
    else if (g.kind === 'CU') controlledMulMod(s, g.control, t, m, g.c, N);
    else applyQftGate(s, g.gate);
    if (p > 0) for (const q of noise === 'every' ? Array.from({ length: t + m }, (_, i) => i) : touched(g, t, m)) randomPauli(s, q, p, rng);
  }
  const P = new Float64Array(2 ** t);
  const probs = s.probabilities();
  for (let i = 0; i < s.N; i++) P[i & ((1 << t) - 1)] += probs[i];
  return P;
}

export interface NoisyRun {
  counts: Uint32Array;
  successes: number;
  shots: number;
  gates: number;
}

/** `shots` runs at gate error rate p: a histogram of measured k and how many runs found the factors. */
export function noisyShor(N: number, a: number, t: number, p: number, shots: number, seed: number, noise: NoiseKind = 'every'): NoisyRun {
  const rng = makeRng(seed);
  const Q = 2 ** t;
  const counts = new Uint32Array(Q);
  let successes = 0;
  for (let i = 0; i < shots; i++) {
    const P = runShorCircuit(N, a, t, p, rng, noise);
    const k = sampleIndex(P, rng);
    counts[k]++;
    if (postprocess(k, Q, N, a).status === 'ok') successes++;
  }
  return { counts, successes, shots, gates: shorGates(N, a, t).length };
}

/** True when k is within half a step of a multiple j * Q / r (a peak of the ideal distribution). */
export function isPeak(k: number, Q: number, r: number): boolean {
  const j = Math.round((k * r) / Q);
  return Math.abs(k - (j * Q) / r) < 0.5 + 1e-9;
}

/** Fraction of runs that landed on a peak: the quantum signal, which noise destroys. */
export function peakFraction(counts: ArrayLike<number>, Q: number, r: number): number {
  let on = 0,
    all = 0;
  for (let k = 0; k < Q; k++) {
    all += counts[k];
    if (isPeak(k, Q, r)) on += counts[k];
  }
  return all ? on / all : 0;
}

/**
 * How often the classical post-processing would succeed on a k picked uniformly at random,
 * with no quantum computer at all. For tiny N this is high, which is why factoring 15 on a
 * quantum computer proves little by itself.
 */
export function randomGuessSuccess(N: number, a: number, Q: number): number {
  let ok = 0;
  for (let k = 0; k < Q; k++) if (postprocess(k, Q, N, a).status === 'ok') ok++;
  return ok / Q;
}
