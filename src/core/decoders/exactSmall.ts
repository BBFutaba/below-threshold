// Exact minimum-weight matching by bitmask dynamic programming. Each defect is matched
// to another defect or to the boundary. Exponential, so only used in tests (<= 16 defects)
// as ground truth for the blossom implementation.

import { distance, type DecodingGraph } from '../decodingGraph';
import { intDist, now, resultFromMatching, type Decoder } from './index';

export const MAX_EXACT_DEFECTS = 16;

export function exactMinWeight(g: DecodingGraph, defects: number[]): { weight: number; matching: [number, number][] } {
  const k = defects.length;
  if (k > MAX_EXACT_DEFECTS) throw new Error(`exact decoder supports at most ${MAX_EXACT_DEFECTS} defects`);
  const D: number[][] = [];
  const B: number[] = [];
  for (let i = 0; i < k; i++) {
    D.push([]);
    for (let j = 0; j < k; j++) D[i].push(intDist(distance(g, defects[i], defects[j])));
    B.push(intDist(distance(g, defects[i], g.boundary)));
  }
  const full = (1 << k) - 1;
  const dp = new Float64Array(1 << k).fill(Infinity);
  const choice = new Int32Array(1 << k).fill(-2);
  dp[0] = 0;
  // dp[mask] = cost to resolve the defects in mask; always resolve the lowest set bit.
  for (let mask = 1; mask <= full; mask++) {
    const i = 31 - Math.clz32(mask & -mask);
    const rest = mask & ~(1 << i);
    let best = dp[rest] + B[i];
    let bestJ = -1;
    for (let j = i + 1; j < k; j++) {
      if (!(rest & (1 << j))) continue;
      const c = dp[rest & ~(1 << j)] + D[i][j];
      if (c < best) {
        best = c;
        bestJ = j;
      }
    }
    dp[mask] = best;
    choice[mask] = bestJ;
  }
  const matching: [number, number][] = [];
  let mask = full;
  while (mask) {
    const i = 31 - Math.clz32(mask & -mask);
    const j = choice[mask];
    if (j < 0) {
      matching.push([defects[i], g.boundary]);
      mask &= ~(1 << i);
    } else {
      matching.push([defects[i], defects[j]]);
      mask &= ~((1 << i) | (1 << j));
    }
  }
  return { weight: dp[full], matching };
}

export const exactSmallDecoder: Decoder = {
  id: 'exact',
  name: 'Exact (brute force)',
  decode(g, defects) {
    const t0 = now();
    const { matching } = exactMinWeight(g, defects);
    return resultFromMatching(g, matching, t0);
  },
};
