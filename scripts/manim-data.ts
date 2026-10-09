// Export the exact data the Manim explainer scenes draw (media/scenes/*.py).
// Every lattice, syndrome, error, matching, correction and frequency in the videos
// comes from the project's own simulation code through this script.
//
// Usage:  npx tsx scripts/manim-data.ts                    (everything; the threshold sweep takes ~1 min)
//         npx tsx scripts/manim-data.ts --skip-threshold   (reuse the cached runPoint sweep in
//                                                            media/data/threshold.json, re-merge validation.json)
// Writes: media/data/{bridge,decoder,discretization,threshold,backlog}.json
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { makeRng } from '../src/core/rng';
import { makeRotatedSurfaceCode, type SurfaceCode, type Stabilizer } from '../src/core/surfaceCode';
import { emptyFrame, applyPauli, syndrome, logicalOutcome, multiply } from '../src/core/pauliFrame';
import { sampleNoise, type NoiseModel } from '../src/core/noise';
import { graphsFor, defectsFor, decodeSample, runPoint, type PointResult } from '../src/core/simulate';
import { pathEdges, type DecodingGraph } from '../src/core/decodingGraph';
import { DECODERS } from '../src/core/decoders/all';
import { QState } from '../src/core/quantum';
import { crossings } from '../src/core/stats';

const OUT = 'media/data';
mkdirSync(OUT, { recursive: true });
const write = (name: string, obj: unknown) => {
  writeFileSync(`${OUT}/${name}.json`, JSON.stringify(obj, null, 1));
  console.log(`wrote ${OUT}/${name}.json`);
};

// ---------------------------------------------------------------- layout helpers

function layout(code: SurfaceCode) {
  return {
    d: code.d,
    n: code.n,
    dataQubits: code.dataQubits,
    stabilizers: code.stabilizers.map((s: Stabilizer, i) => ({
      index: i,
      type: s.type,
      support: s.support,
      pos: s.pos,
      weight: s.support.length,
      // Which edge a weight-2 check sits on (drawn as a half-disk outside the grid).
      edge:
        s.support.length === 2
          ? s.pos.r === 0
            ? 'top'
            : s.pos.r === code.d
              ? 'bottom'
              : s.pos.c === 0
                ? 'left'
                : 'right'
          : null,
    })),
    logicalX: code.logicalX,
    logicalZ: code.logicalZ,
  };
}

const fired = (syn: Uint8Array) => [...syn].flatMap((b, i) => (b ? [i] : []));
const onesOf = (bits: Uint8Array) => [...bits].flatMap((b, i) => (b ? [i] : []));

/** Express an X-type residual (zero syndrome) as a product of X stabilizers, if possible (GF(2) solve). */
function decomposeIntoStabilizers(code: SurfaceCode, bits: Uint8Array, type: 'X' | 'Z'): number[] | null {
  const checks = type === 'X' ? code.xChecks : code.zChecks;
  const n = code.n;
  // Columns = checks, rows = qubits. Solve A s = bits.
  const rows: { v: Uint8Array; rhs: number }[] = [];
  for (let q = 0; q < n; q++) {
    const v = new Uint8Array(checks.length);
    checks.forEach((s, j) => {
      if (code.stabilizers[s].support.includes(q)) v[j] = 1;
    });
    rows.push({ v, rhs: bits[q] });
  }
  const pivots: number[] = [];
  let r = 0;
  for (let c = 0; c < checks.length && r < rows.length; c++) {
    let p = -1;
    for (let i = r; i < rows.length; i++)
      if (rows[i].v[c]) {
        p = i;
        break;
      }
    if (p < 0) continue;
    [rows[r], rows[p]] = [rows[p], rows[r]];
    for (let i = 0; i < rows.length; i++) {
      if (i !== r && rows[i].v[c]) {
        for (let k = 0; k < checks.length; k++) rows[i].v[k] ^= rows[r].v[k];
        rows[i].rhs ^= rows[r].rhs;
      }
    }
    pivots.push(c);
    r++;
  }
  for (let i = r; i < rows.length; i++) if (rows[i].rhs) return null; // not in the stabilizer span
  const sol = new Uint8Array(checks.length);
  pivots.forEach((c, i) => (sol[c] = rows[i].rhs));
  return checks.filter((_, j) => sol[j]);
}

/** One matched pair: the ordered chain of graph nodes and the data qubits its path flips. */
function pairPath(g: DecodingGraph, a: number, b: number) {
  const edges = pathEdges(g, a, b).reverse(); // pathEdges walks b -> a; reverse to a -> b
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
  const toStab = (node: number) => (node === g.boundary ? -1 : g.checks[node]);
  return {
    from: toStab(a),
    to: toStab(b),
    toBoundary: b === g.boundary,
    nodes: nodes.map(toStab), // stabilizer index per node, -1 = boundary
    qubits, // data qubit flipped by each edge, in order a -> b
    edges,
  };
}

function decodeInstance(d: number, model: NoiseModel, seed: number) {
  const code = makeRotatedSurfaceCode(d);
  const rng = makeRng(seed);
  const sample = sampleNoise(code, model, rng);
  if (sample.kind !== 'codeCapacity') throw new Error('expected code capacity');
  const res = decodeSample(code, model, sample, DECODERS.mwpm);
  const g = graphsFor(code, model).X;
  const defects = defectsFor(g, sample);
  const r = res.results.X;
  const pairs = r.matching.map(([a, b]) => pairPath(g, a, b));
  // Consistency: the per-pair paths must give exactly the decoder's flips.
  const parity = new Uint8Array(code.n);
  for (const p of pairs) for (const q of p.qubits) parity[q] ^= 1;
  const flipsCheck = onesOf(parity);
  if (JSON.stringify(flipsCheck) !== JSON.stringify([...r.flips].sort((x, y) => x - y)))
    throw new Error('pair paths disagree with decoder flips');
  const residual = multiply(res.error, res.correction);
  const out = logicalOutcome(code, res.error, res.correction);
  return {
    code,
    sample,
    res,
    defects,
    pairs,
    residualX: onesOf(residual.x),
    residualFrame: residual,
    outcome: out,
  };
}

// ---------------------------------------------------------------- 1. bridge

function bridgeData() {
  const code3 = makeRotatedSurfaceCode(3);
  const code5 = makeRotatedSurfaceCode(5);
  const code7 = makeRotatedSurfaceCode(7);
  // The 3-qubit repetition code as two weight-2 Z checks, run through the same syndrome().
  const rep = {
    d: 3,
    n: 3,
    dataQubits: [0, 1, 2].map((c) => ({ r: 0, c })),
    stabilizers: [
      { type: 'Z' as const, support: [0, 1], pos: { r: 0, c: 1 } },
      { type: 'Z' as const, support: [1, 2], pos: { r: 0, c: 2 } },
    ],
  } as unknown as SurfaceCode;
  const repX = emptyFrame(3);
  applyPauli(repX, 0, 'X');
  const repZ = emptyFrame(3);
  applyPauli(repZ, 1, 'Z');

  // On the d = 3 surface code: an X error and a Z error, each through syndrome().
  const xq = 3; // (1, 0)
  const zq = 4; // (1, 1): the same qubit as the repetition-code Z error
  const sx = emptyFrame(9);
  applyPauli(sx, xq, 'X');
  const sz = emptyFrame(9);
  applyPauli(sz, zq, 'Z');
  // The repetition code is embedded as the middle row of the d = 3 code; its two checks
  // become the two Z plaquettes that each contain a neighbouring pair of that row.
  const row = [3, 4, 5];
  const repToSurface = [
    [3, 4],
    [4, 5],
  ].map((pair) =>
    code3.stabilizers.findIndex((s) => s.type === 'Z' && pair.every((q) => s.support.includes(q))),
  );
  return {
    repetition: {
      n: 3,
      checks: rep.stabilizers.map((s) => ({ type: s.type, support: s.support })),
      xError: { qubit: 0, fired: fired(syndrome(rep, repX)) },
      zError: { qubit: 1, fired: fired(syndrome(rep, repZ)) },
    },
    surface3: layout(code3),
    surface5: layout(code5),
    surface7: layout(code7),
    embedRow: row,
    repToSurface,
    surfaceXError: { qubit: xq, fired: fired(syndrome(code3, sx)) },
    surfaceZError: { qubit: zq, fired: fired(syndrome(code3, sz)) },
  };
}

// ---------------------------------------------------------------- 2. decoder

function serializeInstance(inst: ReturnType<typeof decodeInstance>, seed: number, p: number) {
  const { code, sample, res, pairs, residualX, outcome } = inst;
  const loop = residualX.length ? decomposeIntoStabilizers(code, inst.residualFrame.x, 'X') : [];
  return {
    seed,
    model: { kind: 'bitflip', p },
    decoder: 'mwpm',
    errors: onesOf(sample.error.x).map((q) => ({ qubit: q, pauli: 'X' })),
    fired: fired(sample.syndrome),
    matching: pairs.map((pp) => ({
      from: pp.from,
      to: pp.to,
      toBoundary: pp.toBoundary,
      nodes: pp.nodes,
      qubits: pp.qubits,
    })),
    correction: onesOf(res.correction.x),
    weight: res.results.X.weight,
    residual: residualX,
    residualAsStabilizers: loop, // null if the residual is a logical operator
    logical: { xFlip: outcome.xFlip, zFlip: outcome.zFlip, failed: outcome.failed },
    // Parity of the residual on the logical Z row decides a logical X flip.
    logicalRow: code.logicalZ,
  };
}

function decoderData() {
  const d = 5;
  const p = 0.08; // below the ~9.7% bit-flip threshold
  const model: NoiseModel = { kind: 'bitflip', p };
  let good: ReturnType<typeof serializeInstance> | null = null;
  let bad: ReturnType<typeof serializeInstance> | null = null;
  for (let seed = 1; seed < 200_000 && (!good || !bad); seed++) {
    const inst = decodeInstance(d, model, seed);
    const k = inst.sample.error.x.reduce((a, b) => a + b, 0);
    const nPairs = inst.pairs.length;
    const nBoundary = inst.pairs.filter((pp) => pp.toBoundary).length;
    if (
      !good &&
      !inst.outcome.failed &&
      k >= 3 &&
      k <= 5 &&
      nPairs >= 2 &&
      nPairs <= 3 &&
      nBoundary >= 1 &&
      nBoundary < nPairs
    ) {
      // Want a visible "harmless loop": residual is exactly one weight-4 X plaquette.
      const loop = decomposeIntoStabilizers(inst.code, inst.residualFrame.x, 'X');
      const longest = Math.max(...inst.pairs.map((pp) => pp.qubits.length));
      if (loop && loop.length === 1 && inst.code.stabilizers[loop[0]].support.length === 4 && longest >= 2)
        good = serializeInstance(inst, seed, p);
    }
    if (!bad && inst.outcome.failed && k >= 3 && k <= 3 && nPairs <= 2) {
      bad = serializeInstance(inst, seed, p);
    }
  }
  if (!good || !bad) throw new Error('decoder seed search failed');
  return { layout: layout(makeRotatedSurfaceCode(d)), success: good, failure: bad };
}

// ---------------------------------------------------------------- 3. discretization

function discretizationData() {
  const theta = 0.9;
  const runs = 200;
  const seed = 6006;
  const rng = makeRng(seed);
  // Logical |0> = |000>. (Any alpha|000> + beta|111> gives the same outcome statistics:
  // the parity checks never look at alpha, beta.) Qubits 0-2 are data, 3-4 are ancillas.
  const prepare = () => new QState(5);
  const ideal = prepare();
  const idealFlipped = prepare().x(0);
  const outcomes: { s1: number; s2: number; fidelityNoFlip: number; fidelityFlip: number; blochZ: number }[] =
    [];
  const counts: Record<string, number> = { '00': 0, '10': 0, '01': 0, '11': 0 };
  for (let i = 0; i < runs; i++) {
    const s = prepare();
    s.rx(0, theta); // small coherent drift on qubit 1 (index 0)
    s.cnot(0, 3).cnot(1, 3); // ancilla 3 <- Z0 Z1 parity
    s.cnot(1, 4).cnot(2, 4); // ancilla 4 <- Z1 Z2 parity
    const s1 = s.measure(3, rng.next);
    const s2 = s.measure(4, rng.next);
    // Remove the ancillas' |1> by resetting them (classical knowledge of the outcome).
    if (s1) s.x(3);
    if (s2) s.x(4);
    const fNo = s.fidelity(ideal);
    const fFlip = s.fidelity(idealFlipped);
    outcomes.push({ s1, s2, fidelityNoFlip: fNo, fidelityFlip: fFlip, blochZ: s.bloch(0).z });
    counts[`${s1}${s2}`]++;
  }
  // The pre-measurement probabilities, read off the state vector (not the formula).
  const pre = prepare().rx(0, theta).cnot(0, 3).cnot(1, 3).cnot(1, 4).cnot(2, 4);
  const probs = pre.probabilities();
  let pFlip = 0;
  for (let i = 0; i < probs.length; i++) if ((i >> 3) & 1 && !((i >> 4) & 1)) pFlip += probs[i];
  // Fidelity after snapping: worst case over runs (should be 1 to machine precision).
  const flipRuns = outcomes.filter((o) => o.s1 === 1 && o.s2 === 0);
  const noRuns = outcomes.filter((o) => o.s1 === 0 && o.s2 === 0);
  return {
    theta,
    runs,
    seed,
    prep: 'logical |0> = |000>',
    // Bloch vector of qubit 1 right after the drift, and after each run's check measurement.
    blochBefore: prepare().rx(0, theta).bloch(0),
    blochAfterZ: outcomes.map((o) => Math.round(o.blochZ * 1e9) / 1e9),
    sequence: outcomes.map((o) =>
      o.s1 === 0 && o.s2 === 0 ? 'none' : o.s1 === 1 && o.s2 === 0 ? 'flip1' : `other${o.s1}${o.s2}`,
    ),
    counts,
    measured: { none: counts['00'] / runs, flip1: counts['10'] / runs },
    stateVectorProb: { none: 1 - pFlip, flip1: pFlip },
    formula: { none: Math.cos(theta / 2) ** 2, flip1: Math.sin(theta / 2) ** 2 },
    minFidelityAfterSnap: {
      flip1: Math.min(...flipRuns.map((o) => o.fidelityFlip)),
      none: Math.min(...noRuns.map((o) => o.fidelityNoFlip)),
    },
  };
}

// ---------------------------------------------------------------- 4. threshold

type CurvePt = {
  p: number;
  pL: number;
  lo: number;
  hi: number;
  trials: number;
  failures: number;
  seed?: number;
  source: string;
};

/** Our own wide-range sweep (runPoint, bit-flip, MWPM). Cached in media/data/threshold.json. */
function thresholdRuns(ds: number[], ps: number[]): Record<string, CurvePt[]> {
  const curves: Record<string, CurvePt[]> = {};
  for (const d of ds) {
    curves[d] = [];
    for (const [j, p] of ps.entries()) {
      const t0 = Date.now();
      const seed = 7_000_000 + d * 1000 + j;
      const r: PointResult = runPoint({
        d,
        model: { kind: 'bitflip', p },
        decoder: 'mwpm',
        seed,
        maxFailures: 1500,
        maxTrials: 300_000,
      });
      curves[d].push({
        p: r.p,
        pL: r.pL,
        lo: r.ci.lo,
        hi: r.ci.hi,
        trials: r.trials,
        failures: r.failures,
        seed,
        source: 'runPoint',
      });
      console.log(
        `  d=${d} p=${p.toFixed(2)} pL=${r.pL.toExponential(3)} (${r.failures}/${r.trials}) ${((Date.now() - t0) / 1000).toFixed(1)}s`,
      );
    }
  }
  return curves;
}

function thresholdData(rerun: boolean) {
  const ds = [5, 7, 9];
  const ps = [0.04, 0.05, 0.06, 0.07, 0.08, 0.09, 0.1, 0.11, 0.12, 0.13, 0.14, 0.15, 0.16];
  const cached = existsSync(`${OUT}/threshold.json`)
    ? JSON.parse(readFileSync(`${OUT}/threshold.json`, 'utf8'))
    : null;
  let own: Record<string, CurvePt[]>;
  if (!rerun && cached?.runPointCurves) {
    own = cached.runPointCurves;
    console.log('threshold: reusing cached runPoint sweep');
  } else {
    console.log('threshold: running Monte Carlo (bitflip, mwpm) ...');
    own = thresholdRuns(ds, ps);
  }
  // The validation runs (src/data/validation.json, 4000 failures per point) cover the
  // crossing region densely; our sweep extends the range on both sides.
  let verdict: unknown = null;
  const valCurves: Record<string, CurvePt[]> = {};
  let valDistances: number[] = [];
  let valRange: [number, number] | null = null;
  if (existsSync('src/data/validation.json')) {
    const v = JSON.parse(readFileSync('src/data/validation.json', 'utf8'));
    verdict =
      (v.verdicts ?? []).find(
        (x: { model: string; decoder: string }) => x.model === 'bitflip' && x.decoder === 'mwpm',
      ) ?? null;
    const pts: {
      d: number;
      p: number;
      pL: number;
      ci: { lo: number; hi: number };
      trials: number;
      failures: number;
    }[] = v.curves?.bitflip?.mwpm ?? [];
    valDistances = [...new Set(pts.map((x) => x.d))].sort((a, b) => a - b);
    for (const d of ds) {
      valCurves[d] = pts
        .filter((x) => x.d === d)
        .map((x) => ({
          p: x.p,
          pL: x.pL,
          lo: x.ci.lo,
          hi: x.ci.hi,
          trials: x.trials,
          failures: x.failures,
          source: 'validation.json',
        }))
        .sort((a, b) => a.p - b.p);
    }
    const allP = pts.map((x) => x.p);
    if (allP.length) valRange = [Math.min(...allP), Math.max(...allP)];
  }
  const useVal = valRange !== null && ds.every((d) => (valCurves[d] ?? []).length > 0);
  const merged: Record<string, CurvePt[]> = {};
  for (const d of ds) {
    const outside = own[d].filter((x) => !useVal || x.p < valRange![0] - 1e-9 || x.p > valRange![1] + 1e-9);
    merged[d] = [...outside, ...(useVal ? valCurves[d] : [])].sort((a, b) => a.p - b.p);
  }
  const cross: Record<string, number[]> = {};
  for (let i = 0; i + 1 < ds.length; i++)
    cross[`${ds[i]}/${ds[i + 1]}`] = crossings(merged[ds[i]], merged[ds[i + 1]]);
  cross[`${ds[0]}/${ds[ds.length - 1]}`] = crossings(merged[ds[0]], merged[ds[ds.length - 1]]);
  return {
    model: 'bitflip',
    decoder: 'mwpm',
    distances: ds,
    ps: merged[ds[0]].map((x) => x.p),
    sampling:
      'p in the validation window: src/data/validation.json (until 4000 failures or 400k trials); elsewhere runPoint until 1500 failures or 300k trials. 95% Wilson intervals.',
    validationWindow: useVal ? valRange : null,
    validationDistances: valDistances,
    curves: merged,
    crossings: cross,
    validationVerdict: verdict,
    runPointCurves: own,
  };
}

// ---------------------------------------------------------------- 5. backlog

function backlogData() {
  const bench = JSON.parse(readFileSync('src/data/bench.json', 'utf8'));
  const pick = (decoder: string, d: number, p: number) => {
    const r = bench.results.find(
      (x: { decoder: string; d: number; p: number }) =>
        x.decoder === decoder && x.d === d && Math.abs(x.p - p) < 1e-9,
    );
    if (!r) throw new Error(`bench.json has no ${decoder} d=${d} p=${p}`);
    return { decoder, d, p, medianUs: r.medianUs, p99Us: r.p99Us, trials: r.trials };
  };
  return {
    source: 'src/data/bench.json',
    benchDate: bench.date,
    cpu: (bench.cpu ?? '').trim(),
    node: bench.node,
    noise: 'phenomenological, q = p, d rounds; decode time divided by d + 1 layers',
    roundPeriodUs: 1.0,
    roundPeriodNote: 'superconducting hardware runs about one syndrome round per microsecond',
    mwpm: pick('mwpm', 9, 0.03),
    unionFind: pick('unionFind', 9, 0.03),
    greedy: pick('greedy', 9, 0.03),
    all: bench.results,
  };
}

// ---------------------------------------------------------------- main

const skipThreshold = process.argv.includes('--skip-threshold');
write('bridge', bridgeData());
const dec = decoderData();
write('decoder', dec);
console.log(`decoder: success seed ${dec.success.seed}, failure seed ${dec.failure.seed}`);
write('discretization', discretizationData());
write('backlog', backlogData());
if (process.argv.includes('--no-threshold')) {
  console.log('threshold: skipped');
} else {
  write('threshold', thresholdData(!skipThreshold));
}
