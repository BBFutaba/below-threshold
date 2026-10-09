// Union-find decoder (Delfosse and Nickerson, "Almost-linear time decoding algorithm
// for topological codes", Quantum 2021).
//
// 1. Every defect starts as its own cluster. Odd clusters that do not touch the boundary
//    grow by half-edges; the smallest clusters grow first ("weighted growth").
// 2. When an edge is fully grown, the clusters at its two ends merge (union-find with
//    path compression and union by size).
// 3. Growth stops when every cluster is even or touches the boundary.
// 4. The peeling decoder (Delfosse and Zemor) runs on a spanning forest of the grown
//    edges, leaves first, to produce the correction.

import { flipsFromEdges, edgesWeight, type DecodingGraph } from '../decodingGraph';
import { now, type Decoder, type DecodeResult } from './index';

export function unionFindDecode(g: DecodingGraph, defects: number[]): Omit<DecodeResult, 'ms'> {
  const N = g.numDetectors + 1;
  const B = g.boundary;
  const E = g.edges.length;
  if (defects.length === 0) return { flips: [], matching: [], edges: [], weight: 0 };

  const parent = new Int32Array(N);
  const size = new Int32Array(N).fill(1);
  const parity = new Uint8Array(N);
  const touchesBoundary = new Uint8Array(N);
  for (let i = 0; i < N; i++) parent[i] = i;
  touchesBoundary[B] = 1;
  const isDefect = new Uint8Array(N);
  for (const d of defects) {
    isDefect[d] ^= 1;
  }
  for (let i = 0; i < N; i++) parity[i] = isDefect[i];

  // Half-edge growth: an edge of integer weight w is fully grown at support 2w.
  const support = new Int32Array(E);
  const need = new Int32Array(E);
  for (let e = 0; e < E; e++) need[e] = 2 * Math.max(1, Math.round(g.edges[e].weight));

  // Frontier: members of each cluster that still have a not-fully-grown incident edge.
  const frontier: number[][] = Array.from({ length: N }, () => []);
  for (const d of defects) if (isDefect[d]) frontier[d] = [d];
  for (let i = 0; i < N; i++) if (!isDefect[i]) frontier[i] = [i];

  const find = (a: number): number => {
    let r = a;
    while (parent[r] !== r) r = parent[r];
    while (parent[a] !== r) {
      const nx = parent[a];
      parent[a] = r;
      a = nx;
    }
    return r;
  };

  const union = (a: number, b: number): void => {
    let ra = find(a),
      rb = find(b);
    if (ra === rb) return;
    if (size[ra] < size[rb]) {
      const t = ra;
      ra = rb;
      rb = t;
    }
    parent[rb] = ra;
    size[ra] += size[rb];
    parity[ra] ^= parity[rb];
    touchesBoundary[ra] |= touchesBoundary[rb];
    const fa = frontier[ra],
      fb = frontier[rb];
    for (const x of fb) fa.push(x);
    frontier[rb] = [];
  };

  const active = new Set<number>();
  for (const d of defects) if (isDefect[d]) active.add(find(d));

  const fullyGrown = (u: number): boolean => {
    for (const eid of g.adj[u]) if (support[eid] < need[eid]) return false;
    return true;
  };

  for (let guard = 0; guard < 100_000; guard++) {
    // Collect odd, non-boundary clusters.
    const odd: number[] = [];
    for (const r of active) {
      const root = find(r);
      if (root !== r) continue;
      if (parity[root] && !touchesBoundary[root]) odd.push(root);
    }
    if (odd.length === 0) break;
    let minSize = Infinity;
    for (const r of odd) if (size[r] < minSize) minSize = size[r];
    const growing = odd.filter((r) => size[r] === minSize);

    const newlyFull: number[] = [];
    for (const r of growing) {
      for (const u of frontier[r]) {
        for (const eid of g.adj[u]) {
          if (support[eid] >= need[eid]) continue;
          support[eid]++;
          if (support[eid] >= need[eid]) newlyFull.push(eid);
        }
      }
    }
    for (const eid of newlyFull) {
      const e = g.edges[eid];
      union(e.u, e.v);
    }
    // Refresh the active set and prune frontiers.
    const nextActive = new Set<number>();
    for (const r of active) nextActive.add(find(r));
    active.clear();
    for (const r of nextActive) {
      frontier[r] = frontier[r].filter((u) => !fullyGrown(u));
      active.add(r);
    }
  }

  // Peeling on a spanning forest of the fully grown edges.
  const visited = new Uint8Array(N);
  const parentEdge = new Int32Array(N).fill(-1);
  const order: number[] = [];
  const bfs = (root: number) => {
    visited[root] = 1;
    const queue = [root];
    for (let h = 0; h < queue.length; h++) {
      const u = queue[h];
      order.push(u);
      for (const eid of g.adj[u]) {
        if (support[eid] < need[eid]) continue;
        const e = g.edges[eid];
        const w = e.u === u ? e.v : e.u;
        if (visited[w]) continue;
        visited[w] = 1;
        parentEdge[w] = eid;
        queue.push(w);
      }
    }
  };
  bfs(B);
  for (const d of defects) if (!visited[d]) bfs(d);

  const mark = isDefect.slice();
  const correction: number[] = [];
  for (let i = order.length - 1; i >= 0; i--) {
    const u = order[i];
    if (!mark[u]) continue;
    const eid = parentEdge[u];
    if (eid < 0) {
      if (u !== B) throw new Error('union-find: odd cluster without boundary after growth');
      continue;
    }
    correction.push(eid);
    mark[u] = 0;
    const e = g.edges[eid];
    const p = e.u === u ? e.v : e.u;
    mark[p] ^= 1;
  }
  return { flips: flipsFromEdges(g, correction), matching: [], edges: correction, weight: edgesWeight(g, correction) };
}

export const unionFindDecoder: Decoder = {
  id: 'unionFind',
  name: 'Union-find',
  decode(g, defects) {
    const t0 = now();
    const r = unionFindDecode(g, defects);
    return { ...r, ms: now() - t0 };
  },
};
