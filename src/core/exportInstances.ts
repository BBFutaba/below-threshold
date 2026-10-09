// JSON export of seeded instances for the Python cross-checks (validate/cross_check.py).
// Each export carries the decoding graph, the defects, the true error and our decoder's
// correction, so PyMatching can decode exactly the same problems.

import { makeRng } from './rng';
import { makeRotatedSurfaceCode, type SurfaceCode } from './surfaceCode';
import { sampleNoise, type NoiseModel } from './noise';
import { graphsFor, defectsFor } from './simulate';
import { DECODERS } from './decoders/all';
import type { DecoderId } from './decoders/index';
import type { DecodingGraph } from './decodingGraph';

export interface ExportedGraph {
  errorType: 'X' | 'Z';
  numDetectors: number;
  /** [u, v, qubit, weight]; v = -1 for the boundary, qubit = -1 for a time edge. */
  edges: [number, number, number, number][];
  /** Qubits whose parity decides a logical failure for this error type. */
  logical: number[];
}

export interface ExportedInstance {
  defects: number[];
  /** Data qubits carrying this graph's error type (accumulated over rounds). */
  error: number[];
  ourFlips: number[];
  ourWeight: number;
}

export interface ExportFile {
  config: { d: number; model: NoiseModel; decoder: DecoderId; seed: number; count: number };
  layout: ExportedLayout;
  graphs: { graph: ExportedGraph; instances: ExportedInstance[] }[];
}

export interface ExportedLayout {
  d: number;
  stabilizers: { type: 'X' | 'Z'; support: number[]; r: number; c: number }[];
  logicalX: number[];
  logicalZ: number[];
}

export function exportLayout(code: SurfaceCode): ExportedLayout {
  return {
    d: code.d,
    stabilizers: code.stabilizers.map((s) => ({ type: s.type, support: s.support, r: s.pos.r, c: s.pos.c })),
    logicalX: code.logicalX,
    logicalZ: code.logicalZ,
  };
}

export function exportGraph(g: DecodingGraph): ExportedGraph {
  return {
    errorType: g.errorType,
    numDetectors: g.numDetectors,
    edges: g.edges.map((e) => [e.u, e.v === g.boundary ? -1 : e.v, e.qubit, e.weight]),
    // X errors flip logical X; detected by parity on the logical Z row (and vice versa).
    logical: g.errorType === 'X' ? g.code.logicalZ : g.code.logicalX,
  };
}

export function exportInstances(d: number, model: NoiseModel, decoderId: DecoderId, count: number, seed: number): ExportFile {
  const code = makeRotatedSurfaceCode(d);
  const graphs = graphsFor(code, model);
  const decoder = DECODERS[decoderId];
  const rng = makeRng(seed);
  const list = [graphs.X, graphs.Z].filter((g): g is DecodingGraph => !!g);
  const out = list.map((g) => ({ graph: exportGraph(g), instances: [] as ExportedInstance[] }));
  for (let i = 0; i < count; i++) {
    const s = sampleNoise(code, model, rng);
    const err = s.kind === 'codeCapacity' ? s.error : s.totalError;
    list.forEach((g, gi) => {
      const defects = defectsFor(g, s);
      const r = decoder.decode(g, defects);
      const bits = g.errorType === 'X' ? err.x : err.z;
      const error: number[] = [];
      for (let q = 0; q < bits.length; q++) if (bits[q]) error.push(q);
      out[gi].instances.push({ defects, error, ourFlips: r.flips, ourWeight: r.weight });
    });
  }
  return { config: { d, model, decoder: decoderId, seed, count }, layout: exportLayout(code), graphs: out };
}
