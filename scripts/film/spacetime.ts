// Chapter 6: when the checks lie.
//
// A real phenomenological instance on the d = 5 code (timeStack.findStackPuzzle: data bit-flips
// p = 5% and check misreports q = 7% per round, 3 noisy rounds + a perfect final readout, so
// 4 detector layers). Every detection event is explained by exactly one fault, and the project's
// MWPM decoder, run on the space-time graph (buildPhenomenologicalGraph), recovers exactly them.
//
// Seed choice (search starts at 157): in round 0 a Z-check lies while no data error has happened
// yet anywhere (the "blink" with nothing nearby); in round 2 a real data error lights a
// same-round pair of checks, and the same check lies again.
import { findStackPuzzle } from '../../src/core/timeStack';
import { nodeInfo, edgesWeight, flipsFromEdges, pathEdges, type DecodingGraph } from '../../src/core/decodingGraph';
import { DECODERS } from '../../src/core/decoders/all';
import { defectsFor } from '../../src/core/simulate';
import { logicalOutcome, emptyFrame } from '../../src/core/pauliFrame';
import { layout, ones, write } from './_util';

const D = 5;
const SEED_FROM = 157;

const pz = findStackPuzzle(SEED_FROM, D);
const { code, graph: g, sample: s } = pz;
const zSet = new Set(code.zChecks);
const zOnly = (bits: Uint8Array) => ones(bits).filter((i) => zSet.has(i));

// The lie we open with: a Z-check misreport in round 0 while there are no data errors in rounds 0 and 1.
const lie0 = zOnly(s.measErrors[0]);
if (lie0.length !== 1 || ones(s.dataErrors[0].x).length || ones(s.dataErrors[1].x).length)
  throw new Error(`seed ${pz.seed}: expected one lone round-0 lie and no data errors in rounds 0-1`);

const off = (D - 1) / 2;
type NodeRef = { node: number; boundary: true } | { node: number; check: number; layer: number; r: number; c: number; x: number; y: number; z: number };
const ref = (gr: DecodingGraph, n: number): NodeRef => {
  if (n === gr.boundary) return { node: n, boundary: true };
  const { check, layer } = nodeInfo(gr, n);
  const { r, c } = code.stabilizers[check].pos;
  // Lattice units, as media/scenes/common.py's Lattice.rc(r - 0.5, c - 0.5); z = detector layer.
  return { node: n, check, layer, r, c, x: c - 0.5 - off, y: -(r - 0.5 - off), z: layer };
};
const edgeOut = (eid: number) => {
  const e = g.edges[eid];
  return { id: eid, kind: e.kind, qubit: e.qubit, layer: e.layer, weight: e.weight, u: ref(g, e.u), v: ref(g, e.v) };
};

const defects = defectsFor(g, s);
const r = DECODERS.mwpm.decode(g, defects);
// The decoder's flips must undo the accumulated data error exactly (a clean instance).
const correction = emptyFrame(code.n);
for (const q of flipsFromEdges(g, r.edges)) correction.x[q] ^= 1;
const outcome = logicalOutcome(code, s.totalError, correction);
if (outcome.failed) throw new Error('expected a decoding success');

write('spacetime', {
  layout: layout(code),
  seed: pz.seed,
  model: { kind: 'phenomenological', p: 0.05, q: 0.07, rounds: pz.rounds, data: 'bitflip' },
  decoder: 'mwpm',
  note: 'timeStack.findStackPuzzle(157, 5) on buildPhenomenologicalGraph (X errors, Z-checks). Layer t = rounds is the perfect final readout.',
  rounds: pz.rounds,
  layers: g.layers,
  zChecks: code.zChecks,
  // Per round t = 0..rounds-1: new data X errors and misreported Z-checks.
  dataErrors: s.dataErrors.map((f) => ones(f.x)),
  lies: s.measErrors.map(zOnly),
  // Per layer t = 0..rounds: reported Z-check results and detection events (changes from layer t - 1).
  measured: s.measured.map(zOnly),
  detections: s.detections.map(zOnly),
  defects: defects.map((n) => ref(g, n)),
  // Weights: space edges 1, time edges log((1-q)/q) / log((1-p)/p).
  timeEdgeWeight: g.timeWeight / g.spaceWeight,
  graph: g.edges.map((_, eid) => edgeOut(eid)),
  // MWPM pairs with the shortest space-time path each one implies (single edges here, see findStackPuzzle).
  matching: r.matching.map(([a, b]) => {
    const edges = pathEdges(g, a, b);
    return { a: ref(g, a), b: ref(g, b), kind: edges.every((e) => g.edges[e].kind === 'time') ? 'check' : 'qubit', edges: edges.map(edgeOut) };
  }),
  weight: edgesWeight(g, r.edges),
  correction: ones(correction.x),
  totalError: ones(s.totalError.x),
  logical: outcome,
});
