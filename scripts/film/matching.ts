// Chapter 5: decoding is a matching problem.
//
// Two real seeded d = 5 bit-flip instances decoded by the project's MWPM decoder:
//  - success (p = 8%): four lit checks, so the matching graph is K5 (four checks plus the
//    boundary node). Exports the pairwise shortest-path distances (decodingGraph.distance)
//    and the shortest chains themselves (pathEdges) for every pair and every check-to-boundary
//    option, the MWPM matching, the correction, and the residual, which is one X plaquette
//    (a harmless loop).
//  - failure (p = 12%, "push the noise higher"): MWPM picks the wrong explanation; the residual
//    error * correction is a logical X, a single chain from the top edge to the bottom edge.
import { makeRotatedSurfaceCode, type SurfaceCode } from '../../src/core/surfaceCode';
import { makeRng } from '../../src/core/rng';
import { sampleNoise, type NoiseModel } from '../../src/core/noise';
import { graphsFor, defectsFor, decodeSample } from '../../src/core/simulate';
import { distance, pathEdges, type DecodingGraph } from '../../src/core/decodingGraph';
import { DECODERS } from '../../src/core/decoders/all';
import { multiply, logicalOutcome } from '../../src/core/pauliFrame';
import { layout, ones, write } from './_util';

const D = 5;
const code = makeRotatedSurfaceCode(D);

/** One chain between two graph nodes: stabilizer index per node (-1 = boundary) and the qubit per edge. */
function chain(g: DecodingGraph, a: number, b: number) {
  const edges = pathEdges(g, a, b).reverse(); // pathEdges walks b -> a
  const nodes: number[] = [a];
  const qubits: number[] = [];
  let cur = a;
  for (const eid of edges) {
    const e = g.edges[eid];
    const nxt = e.u === cur ? e.v : e.u;
    nodes.push(nxt);
    qubits.push(e.qubit);
    cur = nxt;
  }
  const st = (n: number) => (n === g.boundary ? -1 : g.checks[n]);
  return {
    from: st(a),
    to: st(b),
    toBoundary: b === g.boundary,
    nodes: nodes.map(st),
    qubits,
    length: distance(g, a, b),
  };
}

/** GF(2): write an X-type zero-syndrome residual as a product of X stabilizers (null if it is a logical). */
function asStabilizers(c: SurfaceCode, bits: Uint8Array): number[] | null {
  const checks = c.xChecks;
  const rows = Array.from({ length: c.n }, (_, q) => ({
    v: Uint8Array.from(checks, (s) => (c.stabilizers[s].support.includes(q) ? 1 : 0)),
    rhs: bits[q],
  }));
  const pivots: number[] = [];
  let r = 0;
  for (let col = 0; col < checks.length && r < rows.length; col++) {
    const p = rows.findIndex((row, i) => i >= r && row.v[col] === 1);
    if (p < 0) continue;
    [rows[r], rows[p]] = [rows[p], rows[r]];
    rows.forEach((row, i) => {
      if (i !== r && row.v[col]) {
        for (let k = 0; k < checks.length; k++) row.v[k] ^= rows[r].v[k];
        row.rhs ^= rows[r].rhs;
      }
    });
    pivots.push(col);
    r++;
  }
  for (let i = r; i < rows.length; i++) if (rows[i].rhs) return null;
  const sol = new Uint8Array(checks.length);
  pivots.forEach((col, i) => (sol[col] = rows[i].rhs));
  return checks.filter((_, j) => sol[j]);
}

/** A zero-syndrome residual as a walk in the decoding graph from the boundary back to the boundary. */
function residualWalk(g: DecodingGraph, qubits: number[]) {
  const edges = qubits.map((q) => g.edges.findIndex((e) => e.qubit === q));
  const used = new Set<number>();
  const st = (n: number) => (n === g.boundary ? -1 : g.checks[n]);
  const nodes: number[] = [g.boundary];
  const qs: number[] = [];
  let cur = g.boundary;
  for (;;) {
    const next = edges.find((eid) => !used.has(eid) && (g.edges[eid].u === cur || g.edges[eid].v === cur));
    if (next === undefined) break;
    used.add(next);
    const e = g.edges[next];
    cur = e.u === cur ? e.v : e.u;
    nodes.push(cur);
    qs.push(e.qubit);
    if (cur === g.boundary) break;
  }
  return { nodes: nodes.map(st), qubits: qs, complete: used.size === edges.length && cur === g.boundary };
}

/** Total weight of every way to pair the defects up or send them to the boundary (brute force). */
function allMatchings(g: DecodingGraph, defects: number[]): number[] {
  const out: number[] = [];
  const rec = (left: number[], w: number) => {
    if (!left.length) return void out.push(w);
    const [a, ...rest] = left;
    rec(rest, w + distance(g, a, g.boundary));
    rest.forEach((b, i) => rec(rest.filter((_, j) => j !== i), w + distance(g, a, b)));
  };
  rec(defects, 0);
  return out;
}

const flags = process.argv.includes('--list');

function instance(model: Extract<NoiseModel, { kind: 'bitflip' }>, seed: number) {
  const sample = sampleNoise(code, model, makeRng(seed));
  if (sample.kind !== 'codeCapacity') throw new Error('expected code capacity');
  const res = decodeSample(code, model, sample, DECODERS.mwpm);
  const g = graphsFor(code, model).X;
  const defects = defectsFor(g, sample);
  const r = res.results.X;
  const pairs = r.matching.map(([a, b]) => chain(g, a, b));
  const residual = multiply(res.error, res.correction);
  const outcome = logicalOutcome(code, res.error, res.correction);
  return { sample, res, g, defects, r, pairs, residual, outcome, errors: ones(sample.error.x) };
}

function serialize(inst: ReturnType<typeof instance>, seed: number, p: number) {
  const { g, defects, r, pairs, residual, outcome, errors, res, sample } = inst;
  // Consistency: the per-pair chains reproduce the decoder's flips exactly.
  const parity = new Uint8Array(code.n);
  for (const pp of pairs) for (const q of pp.qubits) parity[q] ^= 1;
  if (JSON.stringify(ones(parity)) !== JSON.stringify([...r.flips].sort((a, b) => a - b)))
    throw new Error('pair chains disagree with decoder flips');
  const k = defects.length;
  const lit = defects.map((n) => g.checks[n]);
  // The matching problem: pairwise distances and distances to the boundary (decodingGraph.distance).
  const dist = defects.map((a) => defects.map((b) => distance(g, a, b)));
  const toBoundary = defects.map((a) => distance(g, a, g.boundary));
  const candidates: ReturnType<typeof chain>[] = [];
  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) candidates.push(chain(g, defects[i], defects[j]));
    candidates.push(chain(g, defects[i], g.boundary));
  }
  const resQ = ones(residual.x);
  const loop = resQ.length ? asStabilizers(code, residual.x) : [];
  return {
    seed,
    model: { kind: 'bitflip', p },
    decoder: 'mwpm',
    errors,
    fired: ones(sample.syndrome),
    lit, // stabilizer index of each defect, in defect order
    dist,
    toBoundary,
    candidates,
    matching: pairs,
    // Every other way to pair the lit checks costs more (brute force over all pairings).
    allPairingWeights: allMatchings(g, defects).sort((a, b) => a - b),
    // What the true errors would cost as an explanation: their number (every edge weighs 1).
    trueWeight: errors.length,
    weight: r.weight,
    correction: ones(res.correction.x),
    residual: resQ,
    residualAsStabilizers: loop,
    residualWalk: loop === null ? residualWalk(g, resQ) : null,
    logical: outcome,
  };
}


// ---------------------------------------------------------------- success: K5, one harmless loop
// The search below accepts the first seed that meets every criterion; it starts at the seed we
// picked from the --list output (lit checks spread over all four quadrants of the grid).
const pGood = 0.08;
const GOOD_FROM = flags ? 1 : 10060;
let good: ReturnType<typeof serialize> | null = null;
for (let seed = GOOD_FROM; seed < 200_000 && !good; seed++) {
  const inst = instance({ kind: 'bitflip', p: pGood }, seed);
  if (inst.outcome.failed || inst.defects.length !== 4) continue;
  const nB = inst.pairs.filter((pp) => pp.toBoundary).length;
  if (nB < 1 || nB === inst.pairs.length) continue;
  if (inst.errors.length < 3 || inst.errors.length > 5) continue;
  const loop = asStabilizers(code, inst.residual.x);
  if (!loop || loop.length !== 1 || code.stabilizers[loop[0]].support.length !== 4) continue;
  if (Math.max(...inst.pairs.map((pp) => pp.qubits.length)) < 2) continue;
  // The matching should not be the obvious one: the cheapest single pair is not in the optimum,
  // or at least the optimum beats "everything to the boundary" by a clear margin.
  // The optimum must be unique (no tie with another pairing), so "the best guess" is well defined.
  const ws = allMatchings(inst.g, inst.defects).sort((a, b) => a - b);
  if (Math.abs(ws[0] - inst.r.weight) > 1e-9 || ws[1] - ws[0] < 1 - 1e-9) continue;
  if (flags) {
    console.log(seed, 'errors', inst.errors, 'lit', inst.defects.map((n) => inst.g.checks[n]), 'w', inst.r.weight, 'next', ws[1], 'pairs', inst.pairs.map((pp) => `${pp.from}-${pp.to}(${pp.length})`).join(' '), 'res', ones(inst.residual.x));
    if (seed > 60000) break;
    continue;
  }
  good = serialize(inst, seed, pGood);
}

// ---------------------------------------------------------------- failure: a clean top-to-bottom chain
// Picked: seed 153, whose residual is the whole left column (errors and corrections alternate on it).
const pBad = 0.12;
const BAD_FROM = flags ? 1 : 153;
let bad: ReturnType<typeof serialize> | null = null;
for (let seed = BAD_FROM; seed < 200_000 && !bad; seed++) {
  const inst = instance({ kind: 'bitflip', p: pBad }, seed);
  if (!inst.outcome.failed) continue;
  const resQ = ones(inst.residual.x);
  if (resQ.length !== D) continue; // the residual is exactly a minimum-length logical chain
  const walk = residualWalk(inst.g, resQ);
  if (!walk.complete) continue;
  if (inst.defects.length < 3 || inst.defects.length > 5 || inst.errors.length < 3) continue;
  if (flags) {
    console.log('bad', seed, 'errors', inst.errors, 'lit', inst.defects.map((n) => inst.g.checks[n]), 'corr', ones(inst.res.correction.x), 'res', resQ);
    if (seed > 3000) break;
    continue;
  }
  bad = serialize(inst, seed, pBad);
}

if (!flags) {
  if (!good || !bad) throw new Error('seed search failed');
  write('matching', {
    layout: layout(code),
    note: 'd=5 rotated surface code, bit-flip noise, MWPM (src/core/decoders/mwpm.ts). dist/toBoundary from decodingGraph.distance; candidates and matching chains from pathEdges.',
    success: good,
    failure: bad,
  });
}
