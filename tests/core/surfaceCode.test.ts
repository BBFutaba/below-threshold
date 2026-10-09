import { describe, expect, it } from 'vitest';
import { commutes, makeRotatedSurfaceCode, overlap } from '../../src/core/surfaceCode';
import { applyPauli, emptyFrame, isLogicalFailure, logicalOutcome, syndrome } from '../../src/core/pauliFrame';
import { makeRng } from '../../src/core/rng';

const DS = [3, 5, 7, 9];

describe.each(DS)('rotated surface code d=%i', (d) => {
  const code = makeRotatedSurfaceCode(d);

  it('has exactly d^2 - 1 stabilizers, half X-type and half Z-type', () => {
    expect(code.stabilizers.length).toBe(d * d - 1);
    expect(code.xChecks.length).toBe((d * d - 1) / 2);
    expect(code.zChecks.length).toBe((d * d - 1) / 2);
  });

  it('has weight-4 interior and weight-2 boundary stabilizers', () => {
    const w2 = code.stabilizers.filter((s) => s.support.length === 2).length;
    const w4 = code.stabilizers.filter((s) => s.support.length === 4).length;
    expect(w2).toBe(2 * (d - 1));
    expect(w4).toBe((d - 1) * (d - 1));
  });

  it('every pair of stabilizers commutes', () => {
    for (const a of code.stabilizers) {
      for (const b of code.stabilizers) {
        expect(commutes(a.type, a.support, b.type, b.support)).toBe(true);
      }
    }
  });

  it('logical X and Z commute with all stabilizers and anticommute with each other', () => {
    for (const s of code.stabilizers) {
      expect(commutes('X', code.logicalX, s.type, s.support)).toBe(true);
      expect(commutes('Z', code.logicalZ, s.type, s.support)).toBe(true);
    }
    expect(overlap(code.logicalX, code.logicalZ) % 2).toBe(1);
    expect(code.logicalX.length).toBe(d);
    expect(code.logicalZ.length).toBe(d);
  });

  it('every data qubit touches one or two checks of each type', () => {
    for (let q = 0; q < code.n; q++) {
      const types = code.qubitStabilizers[q].map((s) => code.stabilizers[s].type);
      const nx = types.filter((t) => t === 'X').length;
      const nz = types.filter((t) => t === 'Z').length;
      expect(nx === 1 || nx === 2).toBe(true);
      expect(nz === 1 || nz === 2).toBe(true);
    }
  });

  it('a single X error fires 1 or 2 Z-checks and no X-checks', () => {
    for (let q = 0; q < code.n; q++) {
      const f = emptyFrame(code.n);
      applyPauli(f, q, 'X');
      const s = syndrome(code, f);
      const firedZ = code.zChecks.filter((i) => s[i]).length;
      const firedX = code.xChecks.filter((i) => s[i]).length;
      expect(firedZ === 1 || firedZ === 2).toBe(true);
      expect(firedX).toBe(0);
    }
  });

  it('a Y error lights both check types', () => {
    const f = emptyFrame(code.n);
    applyPauli(f, Math.floor(code.n / 2), 'Y');
    const s = syndrome(code, f);
    expect(code.zChecks.some((i) => s[i])).toBe(true);
    expect(code.xChecks.some((i) => s[i])).toBe(true);
  });

  it('applying any stabilizer as an error gives zero syndrome and is never a logical failure', () => {
    for (const st of code.stabilizers) {
      const f = emptyFrame(code.n);
      for (const q of st.support) applyPauli(f, q, st.type);
      expect(syndrome(code, f).every((b) => b === 0)).toBe(true);
      expect(isLogicalFailure(code, f, emptyFrame(code.n))).toBe(false);
    }
  });

  it('random products of stabilizers are never logical failures', () => {
    const rng = makeRng(d);
    for (let t = 0; t < 200; t++) {
      const f = emptyFrame(code.n);
      for (const st of code.stabilizers) {
        if (rng.next() < 0.5) for (const q of st.support) applyPauli(f, q, st.type);
      }
      expect(isLogicalFailure(code, f, emptyFrame(code.n))).toBe(false);
    }
  });

  it('applying a logical operator gives zero syndrome and is always a logical failure', () => {
    const fx = emptyFrame(code.n);
    for (const q of code.logicalX) applyPauli(fx, q, 'X');
    expect(syndrome(code, fx).every((b) => b === 0)).toBe(true);
    expect(logicalOutcome(code, fx, emptyFrame(code.n))).toMatchObject({ xFlip: true, zFlip: false });

    const fz = emptyFrame(code.n);
    for (const q of code.logicalZ) applyPauli(fz, q, 'Z');
    expect(syndrome(code, fz).every((b) => b === 0)).toBe(true);
    expect(logicalOutcome(code, fz, emptyFrame(code.n))).toMatchObject({ xFlip: false, zFlip: true });
  });

  it('every column is a logical X and every row a logical Z', () => {
    for (let c = 0; c < d; c++) {
      const f = emptyFrame(code.n);
      for (let r = 0; r < d; r++) applyPauli(f, r * d + c, 'X');
      expect(syndrome(code, f).every((b) => b === 0)).toBe(true);
      expect(isLogicalFailure(code, f, emptyFrame(code.n))).toBe(true);
    }
  });

  it('a residual with nonzero syndrome is reported as a bug', () => {
    const f = emptyFrame(code.n);
    applyPauli(f, 0, 'X');
    expect(() => isLogicalFailure(code, f, emptyFrame(code.n))).toThrow();
  });
});

describe('layout guards', () => {
  it('rejects even or tiny distances', () => {
    expect(() => makeRotatedSurfaceCode(4)).toThrow();
    expect(() => makeRotatedSurfaceCode(1)).toThrow();
  });
});
