import { describe, expect, it } from 'vitest';
import { makeRotatedSurfaceCode } from '../../src/core/surfaceCode';
import { makeRng } from '../../src/core/rng';
import { applyPauli, emptyFrame, isLogicalFailure, syndrome } from '../../src/core/pauliFrame';
import { sampleNoise, type NoiseModel } from '../../src/core/noise';
import {
  buildCodeCapacityGraph,
  buildPhenomenologicalGraph,
  defectsFromSyndrome,
  distance,
  edgesClearDefects,
  flipsToFrame,
} from '../../src/core/decodingGraph';
import { DECODERS } from '../../src/core/decoders/all';
import { exactMinWeight } from '../../src/core/decoders/exactSmall';
import { mwpmMatching } from '../../src/core/decoders/mwpm';
import { maxWeightMatching } from '../../src/core/decoders/blossom';
import { intDist } from '../../src/core/decoders/index';
import { decodeSample, defectsFor, graphsFor, runTrial } from '../../src/core/simulate';
import type { DecoderId } from '../../src/core/decoders/index';

const DECODER_IDS: DecoderId[] = ['mwpm', 'unionFind', 'greedy'];

describe('blossom maximum-weight matching', () => {
  // Brute force over all matchings of a small graph.
  function bruteMax(n: number, edges: [number, number, number][], maxCard: boolean): [number, number] {
    let best: [number, number] = [-1, -Infinity]; // [cardinality, weight]
    const used = new Uint8Array(n);
    const rec = (i: number, card: number, w: number) => {
      if (i === edges.length) {
        const better = maxCard ? card > best[0] || (card === best[0] && w > best[1]) : w > best[1];
        if (better) best = [card, w];
        return;
      }
      rec(i + 1, card, w);
      const [a, b, wt] = edges[i];
      if (!used[a] && !used[b]) {
        used[a] = used[b] = 1;
        rec(i + 1, card + 1, w + wt);
        used[a] = used[b] = 0;
      }
    };
    rec(0, 0, 0);
    return best;
  }

  it('matches brute force on 2,000 random small graphs', () => {
    const rng = makeRng(99);
    for (let t = 0; t < 2000; t++) {
      const n = 2 + rng.int(7);
      const edges: [number, number, number][] = [];
      for (let a = 0; a < n; a++)
        for (let b = a + 1; b < n; b++) if (rng.next() < 0.6) edges.push([a, b, 1 + rng.int(20)]);
      if (edges.length === 0 || edges.length > 16) continue;
      for (const maxCard of [false, true]) {
        const mate = maxWeightMatching(edges, maxCard);
        let w = 0,
          card = 0;
        for (const [a, b, wt] of edges) {
          if (mate[a] === b) {
            expect(mate[b]).toBe(a);
            w += wt;
            card++;
          }
        }
        const [bc, bw] = bruteMax(n, edges, maxCard);
        if (maxCard) expect(card).toBe(bc);
        expect(w).toBe(bw);
      }
    }
  });
});

describe('MWPM equals the exact bitmask decoder', () => {
  it.each([3, 5, 7])('on random code-capacity instances with <= 16 defects (d=%i)', (d) => {
    const code = makeRotatedSurfaceCode(d);
    const g = buildCodeCapacityGraph(code, 'X', 0.1);
    const rng = makeRng(1000 + d);
    let checked = 0;
    for (let t = 0; t < 3000; t++) {
      const s = sampleNoise(code, { kind: 'bitflip', p: 0.05 + 0.15 * rng.next() }, rng);
      if (s.kind !== 'codeCapacity') throw new Error();
      const defects = defectsFromSyndrome(g, s.syndrome);
      if (defects.length > 16) continue;
      const exact = exactMinWeight(g, defects).weight;
      const r = DECODERS.mwpm.decode(g, defects);
      expect(intDist(r.weight)).toBe(exact);
      checked++;
    }
    expect(checked).toBeGreaterThan(2000);
  });

  it('on random phenomenological instances (d=3 and d=5, p = q)', () => {
    const rng = makeRng(7);
    for (const d of [3, 5]) {
      const code = makeRotatedSurfaceCode(d);
      const m: NoiseModel = { kind: 'phenomenological', p: 0.03, q: 0.03, rounds: d };
      const g = graphsFor(code, m).X;
      for (let t = 0; t < 1500; t++) {
        const s = sampleNoise(code, m, rng);
        const defects = defectsFor(g, s);
        if (defects.length > 16) continue;
        const exact = exactMinWeight(g, defects).weight;
        const mm = mwpmMatching(g, defects);
        const r = DECODERS.mwpm.decode(g, defects);
        expect(intDist(r.weight)).toBe(exact);
        expect(mm.length).toBeGreaterThanOrEqual(Math.ceil(defects.length / 2));
      }
    }
  });

  it('with unequal space and time weights (p != q)', () => {
    const rng = makeRng(8);
    const code = makeRotatedSurfaceCode(5);
    const m: NoiseModel = { kind: 'phenomenological', p: 0.02, q: 0.05, rounds: 5 };
    const g = graphsFor(code, m).X;
    for (let t = 0; t < 1000; t++) {
      const s = sampleNoise(code, m, rng);
      const defects = defectsFor(g, s);
      if (defects.length > 14) continue;
      const exact = exactMinWeight(g, defects).weight;
      // Both solve the same integer-rounded distance problem, so compare in those units.
      const mm = mwpmMatching(g, defects);
      const w = mm.reduce((acc, [a, b]) => acc + intDist(distance(g, a, b)), 0);
      expect(w).toBe(exact);
    }
  });
});

describe.each(DECODER_IDS)('%s decoder', (id) => {
  const decoder = DECODERS[id];

  it('every correction clears the syndrome (100,000 random instances)', () => {
    const configs: { d: number; m: NoiseModel; n: number }[] = [
      { d: 3, m: { kind: 'bitflip', p: 0.1 }, n: 20_000 },
      { d: 5, m: { kind: 'depolarizing', p: 0.12 }, n: 20_000 },
      { d: 7, m: { kind: 'bitflip', p: 0.08 }, n: 25_000 },
      { d: 3, m: { kind: 'phenomenological', p: 0.04, q: 0.04, rounds: 3 }, n: 20_000 },
      { d: 5, m: { kind: 'phenomenological', p: 0.02, q: 0.03, rounds: 5 }, n: 15_000 },
    ];
    let total = 0;
    for (const { d, m, n } of configs) {
      const code = makeRotatedSurfaceCode(d);
      const rng = makeRng(d * 31 + n);
      const graphs = graphsFor(code, m);
      for (let t = 0; t < n; t++) {
        const s = sampleNoise(code, m, rng);
        for (const g of [graphs.X, graphs.Z]) {
          if (!g) continue;
          const defects = defectsFor(g, s);
          const r = decoder.decode(g, defects);
          if (!edgesClearDefects(g, r.edges, defects)) {
            throw new Error(`${id} failed to clear defects at d=${d}, ${m.kind}, trial ${t}`);
          }
        }
        // decodeSample asserts the residual syndrome is zero (throws otherwise).
        decodeSample(code, m, s, decoder);
        total++;
      }
    }
    expect(total).toBe(100_000);
  });

  it('any single error is always corrected, at every distance', () => {
    for (const d of [3, 5, 7, 9]) {
      const code = makeRotatedSurfaceCode(d);
      const g = buildCodeCapacityGraph(code, 'X', 0.1);
      for (let q = 0; q < code.n; q++) {
        const e = emptyFrame(code.n);
        applyPauli(e, q, 'X');
        const r = decoder.decode(g, defectsFromSyndrome(g, syndrome(code, e)));
        expect(isLogicalFailure(code, e, flipsToFrame(g, r.flips))).toBe(false);
      }
    }
  });

  it('same seed gives the same instance and the same decoder output', () => {
    const code = makeRotatedSurfaceCode(5);
    const m: NoiseModel = { kind: 'depolarizing', p: 0.1 };
    const a = runTrial(code, m, decoder, makeRng(123));
    const b = runTrial(code, m, decoder, makeRng(123));
    expect(Array.from(a.error.x)).toEqual(Array.from(b.error.x));
    expect(a.results.X.flips).toEqual(b.results.X.flips);
    expect(a.failed).toBe(b.failed);
  });
});

describe('distance guarantee', () => {
  function combinations(n: number, k: number, cb: (c: number[]) => void, start = 0, acc: number[] = []) {
    if (acc.length === k) return cb(acc);
    for (let i = start; i < n; i++) {
      acc.push(i);
      combinations(n, k, cb, i + 1, acc);
      acc.pop();
    }
  }

  it.each(['mwpm', 'unionFind'] as DecoderId[])(
    '%s corrects every error of weight up to (d-1)/2 (exhaustive for d=3,5; sampled for d=7)',
    (id) => {
      const decoder = DECODERS[id];
      for (const d of [3, 5, 7]) {
        const code = makeRotatedSurfaceCode(d);
        const g = buildCodeCapacityGraph(code, 'X', 0.1);
        const t = (d - 1) / 2;
        const check = (qs: number[]) => {
          const e = emptyFrame(code.n);
          for (const q of qs) applyPauli(e, q, 'X');
          const r = decoder.decode(g, defectsFromSyndrome(g, syndrome(code, e)));
          if (isLogicalFailure(code, e, flipsToFrame(g, r.flips))) {
            throw new Error(`${id} failed on weight-${qs.length} error ${qs} at d=${d}`);
          }
        };
        if (d <= 5) {
          for (let w = 1; w <= t; w++) combinations(code.n, w, check);
        } else {
          const rng = makeRng(5);
          for (let s = 0; s < 3000; s++) {
            const set = new Set<number>();
            while (set.size < t) set.add(rng.int(code.n));
            check([...set]);
          }
        }
      }
    },
  );

  it('MWPM corrects every phenomenological fault set of weight <= (d-1)/2 at d=3', () => {
    const d = 3;
    const code = makeRotatedSurfaceCode(d);
    const g = buildPhenomenologicalGraph(code, 'X', 0.05, 0.05, d);
    // Weight-1 faults: every single edge of the 3D graph (data or measurement error).
    for (let eid = 0; eid < g.edges.length; eid++) {
      const e = g.edges[eid];
      const defects = [e.u, e.v].filter((x) => x !== g.boundary);
      const r = DECODERS.mwpm.decode(g, defects);
      const err = emptyFrame(code.n);
      if (e.qubit >= 0) err.x[e.qubit] ^= 1;
      expect(isLogicalFailure(code, err, flipsToFrame(g, r.flips))).toBe(false);
    }
  });
});
