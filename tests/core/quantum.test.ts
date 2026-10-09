import { describe, expect, it } from 'vitest';
import { QState } from '../../src/core/quantum';
import { makeRng } from '../../src/core/rng';

const near = (a: number, b: number, tol = 1e-9) => expect(Math.abs(a - b)).toBeLessThan(tol);

describe('state-vector simulator', () => {
  it('H|0> gives a 50/50 state pointing along +x', () => {
    const plus = new QState(1).h(0);
    near(plus.prob1(0), 0.5);
    near(plus.bloch(0).x, 1);
  });

  it('HH|0> returns to |0> (the two paths to |1> cancel)', () => {
    const s = new QState(1).h(0).h(0);
    near(s.prob1(0), 0);
  });

  it('Ry hits a 75/25 target at theta = 2 asin(sqrt(0.25))', () => {
    const s = new QState(1).ry(0, 2 * Math.asin(Math.sqrt(0.25)));
    near(s.prob1(0), 0.25);
  });

  it('Bell state qubits have Bloch length 0', () => {
    const bell = new QState(2).h(0).cnot(0, 1);
    near(bell.bloch(0).length, 0);
    near(bell.bloch(1).length, 0);
    const t = bell.terms();
    expect(t.map((x) => x.label)).toEqual(['|00⟩', '|11⟩']);
  });

  it('cloning |+> with a CNOT gives fidelity 0.5 against |+>|+>', () => {
    const attempt = new QState(2).h(0).cnot(0, 1);
    const ideal = new QState(2).h(0).h(1);
    near(attempt.fidelity(ideal), 0.5);
  });

  it('copying |0> and |1> works perfectly', () => {
    near(new QState(2).cnot(0, 1).fidelity(new QState(2)), 1);
    near(new QState(2).x(0).cnot(0, 1).fidelity(new QState(2).x(0).x(1)), 1);
  });

  it('"measure, then rebuild two copies" of |+> scores 0.25', () => {
    const ideal = new QState(2).h(0).h(1);
    // Either outcome rebuilds |00> or |11>, each with overlap 1/4.
    near(new QState(2).fidelity(ideal), 0.25);
    near(new QState(2).x(0).x(1).fidelity(ideal), 0.25);
  });

  it('measuring renormalizes and collapses', () => {
    const rng = makeRng(1);
    for (let i = 0; i < 50; i++) {
      const s = new QState(2).h(0).cnot(0, 1);
      const m = s.measure(0, rng.next);
      const probs = s.probabilities();
      near(
        probs.reduce((a, b) => a + b, 0),
        1,
      );
      near(s.prob1(1), m); // partner collapsed to the same value
    }
  });

  it('measurement with an injected random function is deterministic', () => {
    const a = new QState(1).h(0).measure(0, () => 0.1);
    const b = new QState(1).h(0).measure(0, () => 0.9);
    expect(a).toBe(1);
    expect(b).toBe(0);
  });

  it('3-qubit encoding alpha|000> + beta|111> has Bloch length |alpha^2 - beta^2|', () => {
    const theta = 1.1;
    const s = new QState(3).ry(0, theta).cnot(0, 1).cnot(0, 2);
    const a2 = Math.cos(theta / 2) ** 2,
      b2 = Math.sin(theta / 2) ** 2;
    for (let q = 0; q < 3; q++) near(s.bloch(q).length, Math.abs(a2 - b2));
  });

  it('Chapter 6: a small rotation error is always fully corrected after the checks (200 seeded trials)', () => {
    const rng = makeRng(42);
    let seenFlip = 0;
    for (let trial = 0; trial < 200; trial++) {
      const s = new QState(5); // qubits 0-2 data, 3-4 ancillas
      s.ry(0, 1.1);
      const target = s.clone().cnot(0, 1).cnot(0, 2);
      s.cnot(0, 1).cnot(0, 2);
      s.rx(1, 0.4);
      s.cnot(0, 3).cnot(1, 3);
      s.cnot(1, 4).cnot(2, 4);
      const a = s.measure(3, rng.next),
        b = s.measure(4, rng.next);
      if (a && b) seenFlip++;
      expect(!a && b ? 1 : 0).toBe(0); // only "none" or "qubit 1" can appear
      expect(a && !b ? 1 : 0).toBe(0);
      if (a && !b) s.x(0);
      if (a && b) s.x(1);
      if (!a && b) s.x(2);
      if (a) s.x(3);
      if (b) s.x(4);
      near(s.fidelity(target), 1);
    }
    // sin^2(0.2) ~ 3.9%: over 200 trials we expect some flips.
    expect(seenFlip).toBeGreaterThan(0);
  });

  it('Chapter 4: syndrome table identifies each single X error without revealing alpha, beta', () => {
    const table: Record<string, number> = { '1,0': 0, '1,1': 1, '0,1': 2 };
    for (const errQ of [-1, 0, 1, 2]) {
      const s = new QState(5).ry(0, 0.9).cnot(0, 1).cnot(0, 2);
      const target = s.clone();
      if (errQ >= 0) s.x(errQ);
      s.cnot(0, 3).cnot(1, 3).cnot(1, 4).cnot(2, 4);
      const a = s.measure(3, () => 0.5),
        b = s.measure(4, () => 0.5);
      const key = `${a},${b}`;
      if (errQ < 0) expect(key).toBe('0,0');
      else expect(table[key]).toBe(errQ);
      if (key !== '0,0') s.x(table[key]);
      if (a) s.x(3);
      if (b) s.x(4);
      near(s.fidelity(target), 1);
    }
  });

  it('Chapter 5: a Z error is invisible to the bit-flip checks but lowers fidelity', () => {
    const theta = 2 * Math.asin(Math.sqrt(0.3)); // 70/30
    const s = new QState(5).ry(0, theta).cnot(0, 1).cnot(0, 2);
    const target = s.clone();
    s.z(1);
    s.cnot(0, 3).cnot(1, 3).cnot(1, 4).cnot(2, 4);
    near(s.prob1(3), 0);
    near(s.prob1(4), 0);
    near(s.fidelity(target), (0.7 - 0.3) ** 2);
  });

  it('Chapter 5: H-sandwiched checks on the bit-flip encoding disturb the state (why Part B re-encodes)', () => {
    const s = new QState(5).ry(0, 1.1).cnot(0, 1).cnot(0, 2);
    for (const q of [0, 1, 2]) s.h(q);
    s.cnot(0, 3).cnot(1, 3);
    for (const q of [0, 1, 2]) s.h(q);
    const p = s.prob1(3);
    expect(p).toBeGreaterThan(0.1); // outcome is random: the check is not a stabilizer of this code
    expect(p).toBeLessThan(0.9);
  });

  it('Chapter 5: the phase-flip code detects and fixes any single Z error', () => {
    for (const errQ of [-1, 0, 1, 2]) {
      const s = new QState(5).ry(0, 1.1).cnot(0, 1).cnot(0, 2);
      for (const q of [0, 1, 2]) s.h(q); // encode into |+++>, |--->
      const target = s.clone();
      if (errQ >= 0) s.z(errQ);
      for (const q of [0, 1, 2]) s.h(q); // H sandwich: Z errors become X errors
      s.cnot(0, 3).cnot(1, 3).cnot(1, 4).cnot(2, 4);
      for (const q of [0, 1, 2]) s.h(q);
      const a = s.measure(3, () => 0.5),
        b = s.measure(4, () => 0.5);
      if (errQ < 0) expect([a, b]).toEqual([0, 0]);
      const fix = a && !b ? 0 : a && b ? 1 : !a && b ? 2 : -1;
      expect(fix).toBe(errQ);
      if (fix >= 0) s.z(fix);
      if (a) s.x(3);
      if (b) s.x(4);
      near(s.fidelity(target), 1);
    }
  });

  it('sampling 100 shots matches the probabilities roughly and is seeded', () => {
    const s = new QState(1).ry(0, 2 * Math.asin(Math.sqrt(0.25)));
    const c1 = s.sample(4000, makeRng(7).next);
    const c2 = s.sample(4000, makeRng(7).next);
    expect(Array.from(c1)).toEqual(Array.from(c2));
    expect(Math.abs(c1[1] / 4000 - 0.25)).toBeLessThan(0.03);
  });
});
