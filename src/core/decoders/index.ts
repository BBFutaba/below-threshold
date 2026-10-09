// Shared decoder interface. The UI only talks to decoders through this, so they can be
// swapped or benchmarked without touching screens.

import { flipsFromEdges, pathEdges, edgesWeight, type DecodingGraph } from '../decodingGraph';

export interface DecodeResult {
  /** Data qubits to flip (mod 2). */
  flips: number[];
  /** Matched node pairs; the second entry equals `g.boundary` for a boundary match. */
  matching: [number, number][];
  /** Wall-clock decode time in milliseconds. */
  ms: number;
  /** Edge ids of the correction (for drawing paths). */
  edges: number[];
  /** Total weight of the correction edges. */
  weight: number;
}

export interface Decoder {
  id: DecoderId;
  name: string;
  decode(g: DecodingGraph, defects: number[]): DecodeResult;
}

export type DecoderId = 'mwpm' | 'unionFind' | 'greedy' | 'exact';

export const now: () => number =
  typeof performance !== 'undefined' ? () => performance.now() : () => Date.now();

/** Build a result from a list of matched pairs by walking shortest paths. */
export function resultFromMatching(g: DecodingGraph, matching: [number, number][], t0: number): DecodeResult {
  const edges: number[] = [];
  for (const [a, b] of matching) for (const e of pathEdges(g, a, b)) edges.push(e);
  return { flips: flipsFromEdges(g, edges), matching, ms: now() - t0, edges, weight: edgesWeight(g, edges) };
}

/** Integer distance used by matching algorithms (exact for the uniform-weight case). */
export const SCALE = 1000;
export function intDist(d: number): number {
  return Math.round(d * SCALE);
}
