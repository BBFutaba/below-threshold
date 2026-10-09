// Decoding graph construction and shortest paths.
//
// X errors and Z errors are decoded independently. For X errors the nodes are the
// Z-type checks plus one virtual boundary node; each data qubit is an edge between
// the two Z-checks it touches, or between its single Z-check and the boundary.
// For measurement errors the check nodes are copied once per round and the same
// check in consecutive rounds is joined by a time edge.
//
// Edge weights are log((1 - p) / p) for space edges and log((1 - q) / q) for time
// edges, normalized so that space edges weigh exactly 1 (with p = q every weight is 1).

import type { PauliType, SurfaceCode } from './surfaceCode';
import { emptyFrame, type PauliFrame } from './pauliFrame';

export type EdgeKind = 'space' | 'boundary' | 'time';

export interface GraphEdge {
  u: number;
  /** Other endpoint; equals `boundary` for boundary edges. */
  v: number;
  weight: number;
  /** Data qubit flipped by this edge, or -1 for a time edge (a measurement error). */
  qubit: number;
  /** Detector layer of the edge (for time edges, the earlier layer). */
  layer: number;
  kind: EdgeKind;
}

export interface DecodingGraph {
  code: SurfaceCode;
  /** The data-error type this graph corrects: 'X' uses Z-checks, 'Z' uses X-checks. */
  errorType: 'X' | 'Z';
  /** Stabilizer indices used as detectors, in local order. */
  checks: number[];
  /** Local check position of each stabilizer index (-1 if not in this graph). */
  checkLocal: Int32Array;
  /** Number of detector layers (1 for code capacity, rounds + 1 for phenomenological). */
  layers: number;
  numDetectors: number;
  /** Index of the virtual boundary node (= numDetectors). */
  boundary: number;
  edges: GraphEdge[];
  /** Edge ids incident to each node, boundary included. */
  adj: number[][];
  /** Raw (unnormalized) weights, for reporting. */
  spaceWeight: number;
  timeWeight: number;
  /** Shortest-path cache, filled lazily. */
  sp: Map<number, ShortestPaths>;
}

export interface ShortestPaths {
  dist: Float64Array;
  prevEdge: Int32Array;
}

function llr(p: number): number {
  const c = Math.min(Math.max(p, 1e-9), 0.5 - 1e-9);
  return Math.log((1 - c) / c);
}

function detectorChecks(code: SurfaceCode, errorType: 'X' | 'Z'): number[] {
  // X errors flip Z-type checks; Z errors flip X-type checks.
  return errorType === 'X' ? code.zChecks : code.xChecks;
}

function newGraph(
  code: SurfaceCode,
  errorType: 'X' | 'Z',
  layers: number,
  spaceWeight: number,
  timeWeight: number,
): DecodingGraph {
  const checks = detectorChecks(code, errorType);
  const checkLocal = new Int32Array(code.stabilizers.length).fill(-1);
  checks.forEach((s, k) => (checkLocal[s] = k));
  const numDetectors = checks.length * layers;
  return {
    code,
    errorType,
    checks,
    checkLocal,
    layers,
    numDetectors,
    boundary: numDetectors,
    edges: [],
    adj: Array.from({ length: numDetectors + 1 }, () => []),
    spaceWeight,
    timeWeight,
    sp: new Map(),
  };
}

function addEdge(g: DecodingGraph, e: GraphEdge): void {
  const id = g.edges.length;
  g.edges.push(e);
  g.adj[e.u].push(id);
  g.adj[e.v].push(id);
}

function addSpaceLayer(g: DecodingGraph, layer: number, w: number): void {
  const { code } = g;
  const want: PauliType = g.errorType === 'X' ? 'Z' : 'X';
  const base = layer * g.checks.length;
  for (let q = 0; q < code.n; q++) {
    const touching = code.qubitStabilizers[q].filter((s) => code.stabilizers[s].type === want);
    if (touching.length === 2) {
      addEdge(g, {
        u: base + g.checkLocal[touching[0]],
        v: base + g.checkLocal[touching[1]],
        weight: w,
        qubit: q,
        layer,
        kind: 'space',
      });
    } else if (touching.length === 1) {
      addEdge(g, { u: base + g.checkLocal[touching[0]], v: g.boundary, weight: w, qubit: q, layer, kind: 'boundary' });
    } else {
      throw new Error(`qubit ${q} touches ${touching.length} ${want}-checks; layout is broken`);
    }
  }
}

/** Code-capacity decoding graph (perfect checks): one detector layer. */
export function buildCodeCapacityGraph(code: SurfaceCode, errorType: 'X' | 'Z', p = 0.1): DecodingGraph {
  const g = newGraph(code, errorType, 1, llr(p), 0);
  addSpaceLayer(g, 0, 1);
  return g;
}

/**
 * Phenomenological decoding graph: `rounds` noisy rounds then a perfect final readout,
 * so there are rounds + 1 detector layers. Data errors in round t create space edges in
 * layer t; a check misreported in round t creates a time edge between layers t and t + 1.
 */
export function buildPhenomenologicalGraph(
  code: SurfaceCode,
  errorType: 'X' | 'Z',
  p: number,
  q: number,
  rounds: number,
): DecodingGraph {
  const ws = llr(p),
    wt = llr(q);
  const g = newGraph(code, errorType, rounds + 1, ws, wt);
  const timeW = wt / ws;
  for (let t = 0; t < rounds; t++) addSpaceLayer(g, t, 1);
  const C = g.checks.length;
  for (let t = 0; t < rounds; t++) {
    for (let k = 0; k < C; k++) {
      addEdge(g, { u: t * C + k, v: (t + 1) * C + k, weight: timeW, qubit: -1, layer: t, kind: 'time' });
    }
  }
  return g;
}

/** Detector node -> stabilizer index and layer. */
export function nodeInfo(g: DecodingGraph, node: number): { check: number; layer: number } {
  const C = g.checks.length;
  return { check: g.checks[node % C], layer: Math.floor(node / C) };
}

/** Defects (fired detectors) from a code-capacity syndrome over all stabilizers. */
export function defectsFromSyndrome(g: DecodingGraph, syn: Uint8Array): number[] {
  const out: number[] = [];
  g.checks.forEach((s, k) => {
    if (syn[s]) out.push(k);
  });
  return out;
}

/** Defects from per-layer detection events (each over all stabilizers). */
export function defectsFromDetections(g: DecodingGraph, detections: Uint8Array[]): number[] {
  if (detections.length !== g.layers) throw new Error('detection layers do not match graph');
  const C = g.checks.length;
  const out: number[] = [];
  for (let t = 0; t < g.layers; t++) {
    g.checks.forEach((s, k) => {
      if (detections[t][s]) out.push(t * C + k);
    });
  }
  return out;
}

class MinHeap {
  private keys: number[] = [];
  private vals: number[] = [];
  get size() {
    return this.keys.length;
  }
  push(key: number, val: number) {
    const k = this.keys,
      v = this.vals;
    let i = k.length;
    k.push(key);
    v.push(val);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= key) break;
      k[i] = k[p];
      v[i] = v[p];
      i = p;
    }
    k[i] = key;
    v[i] = val;
  }
  pop(): [number, number] {
    const k = this.keys,
      v = this.vals;
    const topK = k[0],
      topV = v[0];
    const lastK = k.pop()!,
      lastV = v.pop()!;
    if (k.length > 0) {
      let i = 0;
      const n = k.length;
      for (;;) {
        const l = 2 * i + 1;
        if (l >= n) break;
        const r = l + 1;
        const c = r < n && k[r] < k[l] ? r : l;
        if (k[c] >= lastK) break;
        k[i] = k[c];
        v[i] = v[c];
        i = c;
      }
      k[i] = lastK;
      v[i] = lastV;
    }
    return [topK, topV];
  }
}

/** Single-source shortest paths (Dijkstra), cached per source node. */
export function shortestFrom(g: DecodingGraph, src: number): ShortestPaths {
  const hit = g.sp.get(src);
  if (hit) return hit;
  const N = g.numDetectors + 1;
  const dist = new Float64Array(N).fill(Infinity);
  const prevEdge = new Int32Array(N).fill(-1);
  dist[src] = 0;
  const heap = new MinHeap();
  heap.push(0, src);
  while (heap.size) {
    const [d, u] = heap.pop();
    if (d > dist[u]) continue;
    // Never route through the boundary node: a path defect -> boundary -> defect is
    // represented explicitly by matching both defects to the boundary.
    if (u === g.boundary && u !== src) continue;
    for (const eid of g.adj[u]) {
      const e = g.edges[eid];
      const w = e.u === u ? e.v : e.u;
      const nd = d + e.weight;
      if (nd < dist[w] - 1e-12) {
        dist[w] = nd;
        prevEdge[w] = eid;
        heap.push(nd, w);
      }
    }
  }
  const out = { dist, prevEdge };
  g.sp.set(src, out);
  return out;
}

export function distance(g: DecodingGraph, a: number, b: number): number {
  return shortestFrom(g, a).dist[b];
}

/** Edge ids on a shortest path from a to b. */
export function pathEdges(g: DecodingGraph, a: number, b: number): number[] {
  const { prevEdge } = shortestFrom(g, a);
  const out: number[] = [];
  let cur = b;
  while (cur !== a) {
    const eid = prevEdge[cur];
    if (eid < 0) throw new Error(`no path from ${a} to ${b}`);
    out.push(eid);
    const e = g.edges[eid];
    cur = e.u === cur ? e.v : e.u;
  }
  return out;
}

/** Data qubits flipped an odd number of times by a set of edges. */
export function flipsFromEdges(g: DecodingGraph, edgeIds: number[]): number[] {
  const count = new Uint8Array(g.code.n);
  for (const eid of edgeIds) {
    const q = g.edges[eid].qubit;
    if (q >= 0) count[q] ^= 1;
  }
  const out: number[] = [];
  for (let q = 0; q < count.length; q++) if (count[q]) out.push(q);
  return out;
}

/** Turn decoder flips on this graph into a Pauli frame (X flips for an X graph, Z for a Z graph). */
export function flipsToFrame(g: DecodingGraph, flips: number[], into?: PauliFrame): PauliFrame {
  const f = into ?? emptyFrame(g.code.n);
  const bits = g.errorType === 'X' ? f.x : f.z;
  for (const q of flips) bits[q] ^= 1;
  return f;
}

/** Sum of weights of a set of edges. */
export function edgesWeight(g: DecodingGraph, edgeIds: number[]): number {
  let w = 0;
  for (const eid of edgeIds) w += g.edges[eid].weight;
  return w;
}

/** Whether the edges' endpoints (mod 2) exactly reproduce the defect set. */
export function edgesClearDefects(g: DecodingGraph, edgeIds: number[], defects: number[]): boolean {
  const parity = new Uint8Array(g.numDetectors + 1);
  for (const eid of edgeIds) {
    const e = g.edges[eid];
    parity[e.u] ^= 1;
    parity[e.v] ^= 1;
  }
  const want = new Uint8Array(g.numDetectors + 1);
  for (const d of defects) want[d] ^= 1;
  for (let i = 0; i < g.numDetectors; i++) if (parity[i] !== want[i]) return false;
  return true;
}
