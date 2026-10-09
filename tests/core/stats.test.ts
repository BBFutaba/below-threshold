import { describe, expect, it } from 'vitest';
import { crossings, perRound, quantile, wilson } from '../../src/core/stats';
import { makeRng, deriveSeed } from '../../src/core/rng';
import { makeRotatedSurfaceCode } from '../../src/core/surfaceCode';
import { sampleExactErrors, sampleNoise, sampleVisibleError } from '../../src/core/noise';

describe('statistics', () => {
  it('Wilson interval matches a known value', () => {
    const r = wilson(10, 100);
    expect(r.p).toBeCloseTo(0.1);
    expect(r.lo).toBeCloseTo(0.0552, 3);
    expect(r.hi).toBeCloseTo(0.1744, 3);
  });

  it('Wilson interval is sane at the edges', () => {
    expect(wilson(0, 100).lo).toBe(0);
    expect(wilson(0, 100).hi).toBeGreaterThan(0);
    expect(wilson(100, 100).hi).toBeCloseTo(1, 12);
  });

  it('perRound inverts the multi-round composition', () => {
    const e = 0.01,
      R = 7;
    const P = (1 - Math.pow(1 - 2 * e, R)) / 2;
    expect(perRound(P, R)).toBeCloseTo(e, 12);
  });

  it('finds the crossing of two log-log lines', () => {
    const ps = [0.05, 0.08, 0.1, 0.12, 0.15];
    const a = ps.map((p) => ({ p, pL: Math.pow(p / 0.1, 2) * 0.1 }));
    const b = ps.map((p) => ({ p, pL: Math.pow(p / 0.1, 3) * 0.1 }));
    const x = crossings(a, b);
    expect(x.length).toBe(1);
    expect(x[0]).toBeCloseTo(0.1, 6);
  });

  it('quantile', () => {
    expect(quantile([1, 2, 3, 4, 5], 0.5)).toBe(3);
    expect(quantile([1, 2, 3, 4, 5], 0.99)).toBeCloseTo(4.96);
  });
});

describe('rng and noise', () => {
  it('rng is deterministic and roughly uniform', () => {
    const a = makeRng(5),
      b = makeRng(5);
    let sum = 0;
    for (let i = 0; i < 10000; i++) {
      const x = a.next();
      expect(x).toBe(b.next());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      sum += x;
    }
    expect(sum / 10000).toBeCloseTo(0.5, 1);
    expect(deriveSeed(1, 0)).not.toBe(deriveSeed(1, 1));
  });

  it('bit-flip noise hits the requested rate', () => {
    const code = makeRotatedSurfaceCode(7);
    const rng = makeRng(3);
    let flips = 0;
    const T = 2000;
    for (let t = 0; t < T; t++) {
      const s = sampleNoise(code, { kind: 'bitflip', p: 0.1 }, rng);
      if (s.kind === 'codeCapacity') flips += s.error.x.reduce((a, b) => a + b, 0);
    }
    expect(flips / (T * code.n)).toBeCloseTo(0.1, 2);
  });

  it('depolarizing noise splits evenly into X, Y, Z', () => {
    const code = makeRotatedSurfaceCode(7);
    const rng = makeRng(4);
    const c = { X: 0, Y: 0, Z: 0 };
    for (let t = 0; t < 3000; t++) {
      const s = sampleNoise(code, { kind: 'depolarizing', p: 0.15 }, rng);
      if (s.kind !== 'codeCapacity') continue;
      for (let i = 0; i < code.n; i++) {
        if (s.error.x[i] && s.error.z[i]) c.Y++;
        else if (s.error.x[i]) c.X++;
        else if (s.error.z[i]) c.Z++;
      }
    }
    const tot = c.X + c.Y + c.Z;
    expect(tot / (3000 * code.n)).toBeCloseTo(0.15, 2);
    for (const k of ['X', 'Y', 'Z'] as const) expect(c[k] / tot).toBeCloseTo(1 / 3, 1);
  });

  it('phenomenological detection events telescope to the final syndrome', () => {
    const code = makeRotatedSurfaceCode(5);
    const rng = makeRng(9);
    for (let t = 0; t < 200; t++) {
      const s = sampleNoise(code, { kind: 'phenomenological', p: 0.05, q: 0.05, rounds: 5 }, rng);
      if (s.kind !== 'phenomenological') throw new Error();
      expect(s.detections.length).toBe(6);
      const acc = new Uint8Array(code.stabilizers.length);
      for (const det of s.detections) for (let i = 0; i < acc.length; i++) acc[i] ^= det[i];
      expect(Array.from(acc)).toEqual(Array.from(s.measured[5]));
    }
  });

  it('visible-error sampling always lights at least one check', () => {
    const code = makeRotatedSurfaceCode(3);
    const rng = makeRng(10);
    for (let t = 0; t < 200; t++) {
      expect(sampleVisibleError(code, { kind: 'bitflip', p: 0.05 }, rng).syndrome.some((b) => b)).toBe(true);
      const e = sampleExactErrors(code, 2, 'X', rng);
      expect(e.error.x.reduce((a, b) => a + b, 0)).toBe(2);
    }
  });
});
