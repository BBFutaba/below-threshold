// "Checks that lie" mini-puzzle: find seeded phenomenological instances whose detection
// events form clean pairs, each explained by exactly one fault (a data error or a check
// misreport), and where the decoder's space-time matching recovers exactly those faults.

import { makeRng } from './rng';
import { makeRotatedSurfaceCode, type SurfaceCode } from './surfaceCode';
import { sampleNoise, type NoiseModel, type PhenomenologicalSample } from './noise';
import { graphsFor, defectsFor } from './simulate';
import { DECODERS } from './decoders/all';
import type { DecodingGraph } from './decodingGraph';
import { nodeInfo } from './decodingGraph';

export interface StackPair {
  /** Detector nodes (boundary allowed as the second one). */
  nodes: [number, number];
  kind: 'qubit' | 'check';
  edge: number;
}

export interface StackPuzzle {
  seed: number;
  code: SurfaceCode;
  graph: DecodingGraph;
  sample: PhenomenologicalSample;
  pairs: StackPair[];
  rounds: number;
}

export const STACK_ROUNDS = 3; // 3 noisy rounds + 1 perfect final readout = 4 layers

export function findStackPuzzle(startSeed: number, d = 3): StackPuzzle {
  const code = makeRotatedSurfaceCode(d);
  const model: NoiseModel = { kind: 'phenomenological', p: 0.05, q: 0.07, rounds: STACK_ROUNDS };
  const g = graphsFor(code, model).X;
  for (let seed = startSeed; seed < startSeed + 200_000; seed++) {
    const s = sampleNoise(code, model, makeRng(seed));
    if (s.kind !== 'phenomenological') continue;
    // Faults relevant to the X graph: data X errors and misreported Z-checks.
    const faultEdges = new Set<number>();
    let faults = 0;
    for (let t = 0; t < STACK_ROUNDS; t++) {
      for (let q = 0; q < code.n; q++) {
        if (!s.dataErrors[t].x[q]) continue;
        faults++;
        const e = g.edges.findIndex((e) => e.kind !== 'time' && e.layer === t && e.qubit === q);
        faultEdges.add(e);
      }
      for (const st of code.zChecks) {
        if (!s.measErrors[t][st]) continue;
        faults++;
        const k = g.checkLocal[st];
        const e = g.edges.findIndex((e) => e.kind === 'time' && e.layer === t && e.u === t * g.checks.length + k);
        faultEdges.add(e);
      }
    }
    if (faults < 2 || faults > 3 || faultEdges.size !== faults) continue;
    const defects = defectsFor(g, s);
    if (defects.length < 3) continue;
    const r = DECODERS.mwpm.decode(g, defects);
    if (r.edges.length !== r.matching.length) continue; // every pair must be one edge
    const decoded = new Set(r.edges);
    if (decoded.size !== faultEdges.size || [...decoded].some((e) => !faultEdges.has(e))) continue;
    const pairs: StackPair[] = r.matching.map((m, i) => ({
      nodes: m,
      edge: r.edges[i],
      kind: g.edges[r.edges[i]].kind === 'time' ? 'check' : 'qubit',
    }));
    // Each pair's edge must actually join its two nodes (paths are single edges).
    if (pairs.some((p) => !edgeJoins(g, p.edge, p.nodes))) continue;
    const kinds = new Set(pairs.map((p) => p.kind));
    if (kinds.size < 2) continue;
    pairs.sort((a, b) => nodeInfo(g, a.nodes[0]).layer - nodeInfo(g, b.nodes[0]).layer);
    return { seed, code, graph: g, sample: s, pairs, rounds: STACK_ROUNDS };
  }
  throw new Error('no clean time-stack puzzle found');
}

function edgeJoins(g: DecodingGraph, eid: number, [a, b]: [number, number]): boolean {
  const e = g.edges[eid];
  return (e.u === a && e.v === b) || (e.u === b && e.v === a);
}
