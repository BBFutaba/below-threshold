// Monte Carlo trials: sample noise, decode, check the logical outcome.
// Shared by the lab's Web Worker, the real-time mode and the Node validation scripts.

import { makeRng, type Rng } from './rng';
import { makeRotatedSurfaceCode, type SurfaceCode } from './surfaceCode';
import { emptyFrame, logicalOutcome, type PauliFrame } from './pauliFrame';
import { sampleNoise, type NoiseModel, type NoiseSample } from './noise';
import {
  buildCodeCapacityGraph,
  buildPhenomenologicalGraph,
  defectsFromDetections,
  defectsFromSyndrome,
  flipsToFrame,
  type DecodingGraph,
} from './decodingGraph';
import type { Decoder, DecodeResult } from './decoders/index';
import { DECODERS } from './decoders/all';
import type { DecoderId } from './decoders/index';
import { perRound, wilson, type Interval } from './stats';

export interface GraphSet {
  X: DecodingGraph;
  Z?: DecodingGraph;
}

const graphCache = new Map<string, GraphSet>();

function modelKey(d: number, m: NoiseModel): string {
  return m.kind === 'phenomenological'
    ? `${d}|ph|${m.p}|${m.q}|${m.rounds}|${m.data ?? 'bitflip'}`
    : `${d}|${m.kind}|${m.p}`;
}

/** Decoding graphs for a model (cached). Bit-flip noise only needs the X-error graph. */
export function graphsFor(code: SurfaceCode, m: NoiseModel): GraphSet {
  const key = modelKey(code.d, m);
  const hit = graphCache.get(key);
  if (hit) return hit;
  let out: GraphSet;
  if (m.kind === 'bitflip') {
    out = { X: buildCodeCapacityGraph(code, 'X', m.p) };
  } else if (m.kind === 'depolarizing') {
    // The X component of depolarizing noise has probability 2p/3 (X or Y).
    out = { X: buildCodeCapacityGraph(code, 'X', (2 * m.p) / 3), Z: buildCodeCapacityGraph(code, 'Z', (2 * m.p) / 3) };
  } else {
    const pe = m.data === 'depolarizing' ? (2 * m.p) / 3 : m.p;
    out = { X: buildPhenomenologicalGraph(code, 'X', pe, m.q, m.rounds) };
    if (m.data === 'depolarizing') out.Z = buildPhenomenologicalGraph(code, 'Z', pe, m.q, m.rounds);
  }
  if (graphCache.size > 64) graphCache.clear();
  graphCache.set(key, out);
  return out;
}

export interface DecodedSample {
  sample: NoiseSample;
  error: PauliFrame;
  correction: PauliFrame;
  results: { X: DecodeResult; Z?: DecodeResult };
  defects: { X: number[]; Z?: number[] };
  failed: boolean;
  xFlip: boolean;
  zFlip: boolean;
  ms: number;
}

export function defectsFor(g: DecodingGraph, sample: NoiseSample): number[] {
  return sample.kind === 'codeCapacity'
    ? defectsFromSyndrome(g, sample.syndrome)
    : defectsFromDetections(g, sample.detections);
}

export function decodeSample(code: SurfaceCode, m: NoiseModel, sample: NoiseSample, decoder: Decoder): DecodedSample {
  const graphs = graphsFor(code, m);
  const error = sample.kind === 'codeCapacity' ? sample.error : sample.totalError;
  const correction = emptyFrame(code.n);
  const dX = defectsFor(graphs.X, sample);
  const rX = decoder.decode(graphs.X, dX);
  flipsToFrame(graphs.X, rX.flips, correction);
  let rZ: DecodeResult | undefined;
  let dZ: number[] | undefined;
  if (graphs.Z) {
    dZ = defectsFor(graphs.Z, sample);
    rZ = decoder.decode(graphs.Z, dZ);
    flipsToFrame(graphs.Z, rZ.flips, correction);
  }
  const out = logicalOutcome(code, error, correction);
  // Bit-flip models never produce Z errors, so only the X logical can flip there.
  return {
    sample,
    error,
    correction,
    results: { X: rX, Z: rZ },
    defects: { X: dX, Z: dZ },
    failed: out.failed,
    xFlip: out.xFlip,
    zFlip: out.zFlip,
    ms: rX.ms + (rZ?.ms ?? 0),
  };
}

export function runTrial(code: SurfaceCode, m: NoiseModel, decoder: Decoder, rng: Rng): DecodedSample {
  return decodeSample(code, m, sampleNoise(code, m, rng), decoder);
}

export interface PointSpec {
  d: number;
  model: NoiseModel;
  decoder: DecoderId;
  seed: number;
  maxFailures?: number;
  maxTrials?: number;
  /** Stop early after this many milliseconds (keeps the lab responsive). */
  timeBudgetMs?: number;
}

export interface PointResult {
  d: number;
  p: number;
  decoder: DecoderId;
  model: NoiseModel['kind'];
  trials: number;
  failures: number;
  /** Logical error rate per round (equals per shot for code capacity). */
  pL: number;
  ci: Interval;
  /** Failure probability of the whole shot (a d-round memory experiment for phenomenological). */
  pShot: number;
  ciShot: Interval;
  rounds: number;
  meanDecodeMs: number;
}

const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/**
 * Adaptive sampling: run until `maxFailures` logical failures or `maxTrials` trials,
 * whichever comes first (defaults 100 and 20,000, as in the plan).
 */
export function runPoint(spec: PointSpec, onProgress?: (r: PointResult) => void): PointResult {
  const code = makeRotatedSurfaceCode(spec.d);
  const decoder = DECODERS[spec.decoder];
  const rng = makeRng(spec.seed);
  const maxF = spec.maxFailures ?? 100;
  const maxT = spec.maxTrials ?? 20_000;
  const t0 = nowMs();
  let n = 0,
    k = 0,
    ms = 0;
  const result = (): PointResult => {
    const ci = wilson(k, n);
    const rounds = spec.model.kind === 'phenomenological' ? spec.model.rounds : 1;
    return {
      d: spec.d,
      p: spec.model.p,
      decoder: spec.decoder,
      model: spec.model.kind,
      trials: n,
      failures: k,
      pL: perRound(ci.p, rounds),
      ci: { p: perRound(ci.p, rounds), lo: perRound(ci.lo, rounds), hi: perRound(ci.hi, rounds) },
      pShot: ci.p,
      ciShot: ci,
      rounds,
      meanDecodeMs: n ? ms / n : 0,
    };
  };
  while (k < maxF && n < maxT) {
    const r = runTrial(code, spec.model, decoder, rng);
    n++;
    ms += r.ms;
    if (r.failed) k++;
    if (onProgress && n % 500 === 0) onProgress(result());
    if (spec.timeBudgetMs && n % 50 === 0 && nowMs() - t0 > spec.timeBudgetMs) break;
  }
  return result();
}
