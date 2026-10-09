// Greedy matching baseline: repeatedly match the closest remaining pair of defects,
// or a defect with the boundary if that is closer. Fast and simple, but it can pick a
// locally short pairing that forces long, wrong chains elsewhere.

import { distance, type DecodingGraph } from '../decodingGraph';
import { now, resultFromMatching, type Decoder } from './index';

export function greedyMatching(g: DecodingGraph, defects: number[]): [number, number][] {
  const k = defects.length;
  const cand: [number, number, number][] = []; // [cost, i, j] with j = -1 for boundary
  for (let i = 0; i < k; i++) {
    cand.push([distance(g, defects[i], g.boundary), i, -1]);
    for (let j = i + 1; j < k; j++) cand.push([distance(g, defects[i], defects[j]), i, j]);
  }
  // Ties broken by pair-before-boundary, then index, so the result is deterministic.
  cand.sort((a, b) => a[0] - b[0] || (b[2] === -1 ? -1 : 0) - (a[2] === -1 ? -1 : 0) || a[1] - b[1] || a[2] - b[2]);
  const used = new Uint8Array(k);
  const matching: [number, number][] = [];
  let left = k;
  for (const [, i, j] of cand) {
    if (left === 0) break;
    if (used[i]) continue;
    if (j === -1) {
      used[i] = 1;
      left--;
      matching.push([defects[i], g.boundary]);
    } else if (!used[j]) {
      used[i] = used[j] = 1;
      left -= 2;
      matching.push([defects[i], defects[j]]);
    }
  }
  return matching;
}

export const greedyDecoder: Decoder = {
  id: 'greedy',
  name: 'Greedy',
  decode(g, defects) {
    const t0 = now();
    return resultFromMatching(g, greedyMatching(g, defects), t0);
  },
};
