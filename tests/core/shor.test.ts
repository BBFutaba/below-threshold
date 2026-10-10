import { describe, expect, it } from 'vitest';
import {
  coprimeBases,
  convergents,
  gcd,
  inputDistribution,
  isPeak,
  modPow,
  multiplicativeOrder,
  noisyShor,
  outputValues,
  peakFraction,
  postprocess,
  qftOfComb,
  randomGuessSuccess,
  registers,
  runShorCircuit,
  successProbability,
} from '../../src/core/shor';

const near = (a: number, b: number, tol = 1e-9) => expect(Math.abs(a - b)).toBeLessThan(tol);

describe('number theory', () => {
  it('gcd, modPow and the period', () => {
    expect(gcd(48, 15)).toBe(3);
    expect(gcd(50, 15)).toBe(5);
    expect(modPow(7, 4, 15)).toBe(1);
    expect(multiplicativeOrder(7, 15)).toBe(4);
    expect(multiplicativeOrder(2, 21)).toBe(6);
    expect(multiplicativeOrder(5, 21)).toBe(6);
    expect(() => multiplicativeOrder(3, 15)).toThrow();
  });

  it('convergents of 85/256 approach 1/3', () => {
    const cs = convergents(85, 256);
    expect(cs[0]).toEqual({ p: 0, q: 1 });
    expect(cs.some((c) => c.p === 1 && c.q === 3)).toBe(true);
    expect(cs.at(-1)).toEqual({ p: 85, q: 256 });
  });
});

describe('Shor, register level', () => {
  it('N = 15, a = 7: the output register shows 1, 7, 4, 13 equally often', () => {
    const R = registers(15, 7, 4);
    expect(R.r).toBe(4);
    expect(outputValues(R)).toEqual([
      { v: 1, count: 4 },
      { v: 4, count: 4 },
      { v: 7, count: 4 },
      { v: 13, count: 4 },
    ]);
    const { p } = qftOfComb(R, 7);
    for (const k of [0, 4, 8, 12]) near(p[k], 0.25);
  });

  it('every measured peak of N = 15 either factors 15 or is the useless k = 0', () => {
    for (const k of [4, 8, 12]) {
      const res = postprocess(k, 16, 15, 7);
      expect(res.status).toBe('ok');
      expect(res.factors).toEqual([3, 5]);
    }
    expect(postprocess(0, 16, 15, 7).status).toBe('zero');
  });

  it('N = 21, a = 2 (r = 6) factors as 3 x 7 from a peak near 128/6', () => {
    const R = registers(21, 2, 7);
    const P = inputDistribution(R);
    // The first nonzero peak sits at the integer nearest 128/6 = 21.3.
    let best = 1;
    for (let k = 1; k < 40; k++) if (P[k] > P[best]) best = k;
    expect(best).toBe(21);
    const res = postprocess(best, 128, 21, 2);
    expect(res.r).toBe(6);
    expect(res.factors).toEqual([3, 7]);
    expect(successProbability(R)).toBeGreaterThan(0.3);
  });

  it('a = 5 for N = 21 has the right period but a trivial square root, so it never factors', () => {
    const res = postprocess(43, 256, 21, 5);
    expect(res.r).toBe(6);
    expect(res.status).toBe('trivial');
    expect(successProbability(registers(21, 5, 8))).toBe(0);
  });

  it('an odd period is reported as such', () => {
    // 4 has order 3 mod 21 (4^3 = 64 = 1 mod 21).
    expect(multiplicativeOrder(4, 21)).toBe(3);
    expect(postprocess(85, 256, 21, 4).status).toBe('odd');
  });

  it('distributions sum to 1', () => {
    for (const N of [15, 21, 33, 35]) {
      const a = coprimeBases(N)[0];
      const P = inputDistribution(registers(N, a, 7));
      near(
        P.reduce((s, x) => s + x, 0),
        1,
      );
    }
  });
});

describe('Shor, gate level', () => {
  it('without noise the gate circuit gives exactly the register-level distribution', () => {
    for (const [N, a, t] of [
      [15, 7, 4],
      [15, 2, 6],
      [15, 11, 5],
      [21, 2, 5],
    ]) {
      const want = inputDistribution(registers(N, a, t));
      const got = runShorCircuit(N, a, t);
      for (let k = 0; k < want.length; k++) near(got[k], want[k]);
    }
  });

  it('noise washes out the peaks: the signal falls to the random baseline', () => {
    const clean = noisyShor(15, 7, 6, 0, 200, 9);
    const noisy = noisyShor(15, 7, 6, 0.05, 200, 9);
    // Clean runs only ever land on the four peaks 0, 16, 32, 48.
    expect(peakFraction(clean.counts, 64, 4)).toBe(1);
    expect(peakFraction(noisy.counts, 64, 4)).toBeLessThan(0.2);
    expect(noisy.successes).toBeLessThan(clean.successes);
  });

  it('for tiny N a random guess often factors it too (the honest baseline)', () => {
    expect(isPeak(21, 128, 6)).toBe(true);
    expect(isPeak(24, 128, 6)).toBe(false);
    const quantum = successProbability(registers(21, 2, 7));
    const guess = randomGuessSuccess(21, 2, 128);
    expect(guess).toBeGreaterThan(0.2);
    expect(quantum).toBeGreaterThan(guess);
  });
});
