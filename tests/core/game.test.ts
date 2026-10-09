import { describe, expect, it } from 'vitest';
import { LEVELS, decoderBatch, decoderPlay, evaluate, hint, liveSyndrome, makePuzzle } from '../../src/core/game';
import { emptyFrame, multiply } from '../../src/core/pauliFrame';

describe('main game', () => {
  it('has seven levels matching the plan', () => {
    expect(LEVELS.map((l) => l.d)).toEqual([3, 3, 3, 5, 5, 7, 7]);
    expect(LEVELS[6].timerSec).toBe(45);
  });

  it('puzzles are seeded (level * 1000 + index) and always light at least one check', () => {
    for (const cfg of LEVELS) {
      for (let i = 0; i < 20; i++) {
        const a = makePuzzle(cfg.level, i);
        const b = makePuzzle(cfg.level, i);
        expect(a.seed).toBe(cfg.level * 1000 + i);
        expect(Array.from(a.error.x)).toEqual(Array.from(b.error.x));
        expect(a.syndrome.some((x) => x)).toBe(true);
      }
    }
  });

  it('levels 1 and 2 have exactly 1 and 2 X errors; level 4 has no Y errors', () => {
    for (let i = 0; i < 30; i++) {
      const p1 = makePuzzle(1, i);
      expect(p1.error.x.reduce((a, b) => a + b, 0)).toBe(1);
      expect(p1.error.z.reduce((a, b) => a + b, 0)).toBe(0);
      const p2 = makePuzzle(2, i);
      expect(p2.error.x.reduce((a, b) => a + b, 0)).toBe(2);
      const p4 = makePuzzle(4, i);
      for (let q = 0; q < p4.code.n; q++) expect(p4.error.x[q] && p4.error.z[q]).toBeFalsy();
    }
  });

  it('applying the decoder correction clears the syndrome and level 1 is always saved', () => {
    for (let i = 0; i < 30; i++) {
      const p = makePuzzle(1, i);
      const dec = decoderPlay(p.code, p.error);
      expect(liveSyndrome(p, dec.correction).every((b) => b === 0)).toBe(true);
      expect(dec.saved).toBe(true);
      const ev = evaluate(p, dec.correction, 0);
      expect(ev.saved).toBe(true);
      expect(ev.points).toBe(150);
    }
  });

  it('correcting with the error itself always saves; hints cost 25 points', () => {
    const p = makePuzzle(5, 3);
    const ev = evaluate(p, p.error, 1);
    expect(ev.saved).toBe(true);
    expect(ev.residual.length).toBe(0);
    expect(ev.points).toBeLessThanOrEqual(150 - 25);
  });

  it('a correction that completes a logical operator is a logical error', () => {
    const p = makePuzzle(1, 0);
    // error + correction = a full column => logical X
    const d = p.code.d;
    const q = p.error.x.findIndex((b) => b === 1);
    const col = q % d;
    const corr = emptyFrame(p.code.n);
    for (let r = 0; r < d; r++) if (r * d + col !== q) corr.x[r * d + col] = 1;
    const ev = evaluate(p, corr, 0);
    expect(ev.saved).toBe(false);
    expect(ev.points).toBe(0);
    expect(ev.unavoidable).toBe(false);
  });

  it('hints point at lit checks', () => {
    const p = makePuzzle(3, 2);
    const h = hint(p, emptyFrame(p.code.n));
    expect(h).not.toBeNull();
    for (const s of h!.checks) expect(p.syndrome[s]).toBe(1);
    // After the decoder correction there is nothing left to hint.
    const dec = decoderPlay(p.code, p.error);
    expect(hint(p, multiply(dec.correction, emptyFrame(p.code.n)))).toBeNull();
  });

  it('the twist batch runs 1,000 level-3 puzzles and the decoder saves most of them', () => {
    const r = decoderBatch(3, 1000);
    expect(r.total).toBe(1000);
    expect(r.saved / r.total).toBeGreaterThan(0.8);
  });
});
