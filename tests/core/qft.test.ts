import { describe, expect, it } from 'vitest';
import { QState } from '../../src/core/quantum';
import { basisState, dft, expectedPeaks, periodicState, qft, qftCircuit } from '../../src/core/qft';
import { makeRng } from '../../src/core/rng';

const near = (a: number, b: number, tol = 1e-9) => expect(Math.abs(a - b)).toBeLessThan(tol);

function randomState(n: number, seed: number): QState {
  const rng = makeRng(seed);
  const s = new QState(n);
  let norm = 0;
  for (let i = 0; i < s.N; i++) {
    s.re[i] = rng.next() - 0.5;
    s.im[i] = rng.next() - 0.5;
    norm += s.re[i] ** 2 + s.im[i] ** 2;
  }
  for (let i = 0; i < s.N; i++) {
    s.re[i] /= Math.sqrt(norm);
    s.im[i] /= Math.sqrt(norm);
  }
  return s;
}

describe('quantum Fourier transform', () => {
  it('has n Hadamards, n(n-1)/2 controlled rotations and floor(n/2) swaps', () => {
    for (let n = 1; n <= 8; n++) {
      const c = qftCircuit(n);
      expect(c.filter((g) => g.g === 'H')).toHaveLength(n);
      expect(c.filter((g) => g.g === 'CP')).toHaveLength((n * (n - 1)) / 2);
      expect(c.filter((g) => g.g === 'SWAP')).toHaveLength(Math.floor(n / 2));
    }
  });

  it('the gate circuit equals the exact DFT on random states (n = 1 to 7)', () => {
    for (let n = 1; n <= 7; n++) {
      const s = randomState(n, 100 + n);
      const want = dft(s.re, s.im);
      const got = qft(s.clone(), n);
      for (let i = 0; i < s.N; i++) {
        near(got.re[i], want.re[i]);
        near(got.im[i], want.im[i]);
      }
    }
  });

  it('QFT|0> is the uniform superposition', () => {
    const s = qft(new QState(4), 4);
    for (let i = 0; i < 16; i++) {
      near(s.re[i], 0.25);
      near(s.im[i], 0);
    }
  });

  it('QFT|x> winds the phase of |y> by x*y/N turns, and each qubit is a clock of its own', () => {
    const n = 3,
      N = 8;
    for (let x = 0; x < N; x++) {
      const s = qft(basisState(n, x), n);
      for (let y = 0; y < N; y++) {
        const ang = (2 * Math.PI * x * y) / N;
        near(s.re[y], Math.cos(ang) / Math.sqrt(N));
        near(s.im[y], Math.sin(ang) / Math.sqrt(N));
      }
      // Product state: qubit q sits on the equator at phase 2*pi*x*2^q/N.
      for (let q = 0; q < n; q++) {
        const b = s.bloch(q);
        near(b.length, 1);
        const phase = (2 * Math.PI * x * 2 ** q) / N;
        near(b.x, Math.cos(phase));
        near(b.y, Math.sin(phase));
      }
    }
  });

  it('a period-r comb turns into peaks at multiples of N/r', () => {
    const n = 4;
    for (const [r, offset] of [
      [2, 1],
      [4, 0],
      [4, 3],
      [8, 5],
    ]) {
      const p = qft(periodicState(n, r, offset), n).probabilities();
      const peaks = expectedPeaks(n, r);
      for (const k of peaks) near(p[k], 1 / r);
      near(
        peaks.reduce((a, k) => a + p[k], 0),
        1,
      );
    }
  });

  it('a period that does not divide N still concentrates near multiples of N/r', () => {
    const n = 6;
    const p = qft(periodicState(n, 3), n).probabilities();
    let nearPeaks = 0;
    for (let k = 0; k < 64; k++) {
      const d = Math.min(...[0, 1, 2, 3].map((j) => Math.abs(k - (j * 64) / 3)));
      if (d < 1) nearPeaks += p[k];
    }
    expect(nearPeaks).toBeGreaterThan(0.8);
  });
});

describe('new gates', () => {
  it('phase(pi) is Z and cphase is symmetric', () => {
    const a = new QState(1).h(0).phase(0, Math.PI);
    const b = new QState(1).h(0).z(0);
    near(a.fidelity(b), 1);
    const s1 = randomState(3, 7);
    const s2 = s1.clone();
    s1.cphase(0, 2, 0.7);
    s2.cphase(2, 0, 0.7);
    near(s1.fidelity(s2), 1);
  });

  it('swap exchanges two qubits', () => {
    const s = new QState(3).x(0);
    s.swap(0, 2);
    near(s.prob1(2), 1);
    near(s.prob1(0), 0);
  });
});
