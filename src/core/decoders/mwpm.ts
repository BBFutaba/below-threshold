// Minimum-weight perfect matching decoder.
//
// Shortest-path distances between defects (and from each defect to the boundary) are
// computed on the decoding graph, then the standard complete graph is built: each defect,
// a boundary twin per defect, defect-to-defect edges, defect-to-own-twin edges, and
// zero-weight twin-to-twin edges. A perfect matching on it always exists (everything to
// the boundary), and its minimum weight is the most likely error under independent noise.
// Solved with Edmonds' blossom algorithm (blossom.ts) by maximizing (M - weight) over
// maximum-cardinality matchings.

import { distance, type DecodingGraph } from '../decodingGraph';
import { maxWeightMatching, type WeightedEdge } from './blossom';
import { intDist, now, resultFromMatching, type Decoder } from './index';

export function mwpmMatching(g: DecodingGraph, defects: number[]): [number, number][] {
  const k = defects.length;
  if (k === 0) return [];
  if (k === 1) return [[defects[0], g.boundary]];
  const B = defects.map((d) => intDist(distance(g, d, g.boundary)));
  const raw: WeightedEdge[] = [];
  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) {
      const dij = intDist(distance(g, defects[i], defects[j]));
      // Pruning is exact: if pairing costs at least as much as sending both to the
      // boundary, the boundary option is never worse.
      if (Number.isFinite(dij) && dij < B[i] + B[j]) raw.push([i, j, dij]);
    }
    raw.push([i, k + i, B[i]]);
    for (let j = i + 1; j < k; j++) raw.push([k + i, k + j, 0]);
  }
  let maxW = 0;
  for (const e of raw) if (e[2] > maxW) maxW = e[2];
  const M = maxW + 1;
  const edges: WeightedEdge[] = raw.map(([a, b, w]) => [a, b, M - w]);
  const mate = maxWeightMatching(edges, true);
  const matching: [number, number][] = [];
  for (let i = 0; i < k; i++) {
    const m = mate[i];
    if (m === k + i) matching.push([defects[i], g.boundary]);
    else if (m >= 0 && m < k) {
      if (i < m) matching.push([defects[i], defects[m]]);
    } else throw new Error(`mwpm: defect ${i} left unmatched (mate ${m}); blossom bug`);
  }
  return matching;
}

export const mwpmDecoder: Decoder = {
  id: 'mwpm',
  name: 'Exact matching (MWPM)',
  decode(g, defects) {
    const t0 = now();
    return resultFromMatching(g, mwpmMatching(g, defects), t0);
  },
};
