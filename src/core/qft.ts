// The quantum Fourier transform: the textbook gate circuit (Hadamards, controlled phase
// rotations, final swaps) run on the state-vector simulator, plus the exact discrete
// Fourier transform it must equal (tested in tests/core/qft.test.ts).
//
// Convention (as in quantum.ts): qubit q is bit q of the basis index, so qubit n-1 is the
// most significant bit. QFT|x> = (1/sqrt N) sum_y e^{2 pi i x y / N} |y>, N = 2^n.

import { QState } from './quantum';

export type QftGate =
  | { g: 'H'; q: number }
  /** Controlled phase rotation R_k: a turn of 2*pi / 2^k when both qubits are 1. */
  | { g: 'CP'; c: number; t: number; k: number }
  | { g: 'SWAP'; a: number; b: number };

/** The QFT circuit on qubits 0..n-1, most significant qubit first. */
export function qftCircuit(n: number): QftGate[] {
  const out: QftGate[] = [];
  for (let j = n - 1; j >= 0; j--) {
    out.push({ g: 'H', q: j });
    for (let m = j - 1; m >= 0; m--) out.push({ g: 'CP', c: m, t: j, k: j - m + 1 });
  }
  for (let i = 0; i < Math.floor(n / 2); i++) out.push({ g: 'SWAP', a: i, b: n - 1 - i });
  return out;
}

export const rotationAngle = (k: number) => (2 * Math.PI) / 2 ** k;

/** Apply one QFT gate; `offset` shifts the register when it is not at qubit 0. */
export function applyQftGate(s: QState, gate: QftGate, offset = 0, inverse = false): QState {
  switch (gate.g) {
    case 'H':
      return s.h(gate.q + offset);
    case 'CP':
      return s.cphase(gate.c + offset, gate.t + offset, (inverse ? -1 : 1) * rotationAngle(gate.k));
    case 'SWAP':
      return s.swap(gate.a + offset, gate.b + offset);
  }
}

/** Run the whole QFT circuit on an n-qubit register starting at `offset`. */
export function qft(s: QState, n: number, offset = 0): QState {
  for (const g of qftCircuit(n)) applyQftGate(s, g, offset);
  return s;
}

/** Plain-language description of a gate, for the step-by-step tutorial. */
export function describeGate(gate: QftGate, n: number): string {
  const name = (q: number) => `q${q}`;
  switch (gate.g) {
    case 'H':
      return `H on ${name(gate.q)}: put it into |0⟩ + |1⟩. If ${name(gate.q)} was 1, the |1⟩ part points the opposite way: half a turn on ${name(gate.q)}'s clock.`;
    case 'CP':
      return `If ${name(gate.c)} is 1, turn ${name(gate.t)}'s clock a further 1/${2 ** gate.k} of a turn. Each smaller turn adds a lower bit of x as a finer tick.`;
    case 'SWAP':
      return `Swap ${name(gate.a)} and ${name(gate.b)}: the circuit builds the answer in reverse order, so swaps put the ${n} qubits back in order.`;
  }
}

/** Exact DFT with the same sign and normalization as the circuit. O(N^2); fine for N <= 1024. */
export function dft(re: ArrayLike<number>, im: ArrayLike<number>): { re: Float64Array; im: Float64Array } {
  const N = re.length;
  const outRe = new Float64Array(N),
    outIm = new Float64Array(N);
  const norm = 1 / Math.sqrt(N);
  for (let y = 0; y < N; y++) {
    let sr = 0,
      si = 0;
    for (let x = 0; x < N; x++) {
      const ang = (2 * Math.PI * ((x * y) % N)) / N;
      const c = Math.cos(ang),
        s = Math.sin(ang);
      sr += re[x] * c - im[x] * s;
      si += re[x] * s + im[x] * c;
    }
    outRe[y] = sr * norm;
    outIm[y] = si * norm;
  }
  return { re: outRe, im: outIm };
}

/** An n-qubit register holding an equal superposition of x = offset, offset + r, offset + 2r, ... */
export function periodicState(n: number, r: number, offset = 0): QState {
  const s = new QState(n);
  s.re[0] = 0;
  const xs: number[] = [];
  for (let x = offset % r; x < s.N; x += r) xs.push(x);
  const a = 1 / Math.sqrt(xs.length);
  for (const x of xs) s.re[x] = a;
  return s;
}

/** A basis state |x> on n qubits. */
export function basisState(n: number, x: number): QState {
  const s = new QState(n);
  for (let q = 0; q < n; q++) if ((x >> q) & 1) s.x(q);
  return s;
}

/** Where the QFT of a period-r comb on N = 2^n states puts its peaks: multiples of N / r. */
export function expectedPeaks(n: number, r: number): number[] {
  const N = 2 ** n;
  return Array.from({ length: r }, (_, j) => (j * N) / r);
}
