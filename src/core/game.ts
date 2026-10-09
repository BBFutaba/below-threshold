// Main-game logic (no React): levels, seeded puzzles, evaluation, scoring and hints.

import { makeRng, levelSeed, type Rng } from './rng';
import { makeRotatedSurfaceCode, type SurfaceCode } from './surfaceCode';
import { emptyFrame, logicalOutcome, multiply, syndrome, weight, type PauliFrame } from './pauliFrame';
import { sampleExactErrors, sampleNoise, type NoiseModel } from './noise';
import { buildCodeCapacityGraph, defectsFromSyndrome, flipsToFrame, type DecodingGraph } from './decodingGraph';
import { DECODERS } from './decoders/all';
import type { DecodeResult } from './decoders/index';

export type LevelNoise =
  | { kind: 'exactX'; k: number }
  | { kind: 'bitflip'; p: number }
  | { kind: 'xOrZ'; p: number }
  | { kind: 'depolarizing'; p: number };

export interface LevelConfig {
  level: number;
  d: number;
  noise: LevelNoise;
  mode: 'x' | 'xyz';
  puzzles: number;
  timerSec?: number;
  title: string;
  errorsLabel: string;
  noiseLabel: string;
  idea: string;
}

export const LEVELS: LevelConfig[] = [
  { level: 1, d: 3, noise: { kind: 'exactX', k: 1 }, mode: 'x', puzzles: 3, title: 'One flip', errorsLabel: 'Exactly 1 X error', noiseLabel: 'Fixed', idea: 'One flip lights two checks (or one at an edge).' },
  { level: 2, d: 3, noise: { kind: 'exactX', k: 2 }, mode: 'x', puzzles: 3, title: 'Pairs and edges', errorsLabel: 'Exactly 2 X errors', noiseLabel: 'Fixed', idea: 'Pairs of lit checks, and errors at boundaries.' },
  { level: 3, d: 3, noise: { kind: 'bitflip', p: 0.05 }, mode: 'x', puzzles: 3, title: 'Random noise', errorsLabel: 'Random X errors', noiseLabel: 'p = 5%', idea: 'The shortest explanation is usually right.' },
  { level: 4, d: 5, noise: { kind: 'xOrZ', p: 0.04 }, mode: 'xyz', puzzles: 3, title: 'Two kinds of checks', errorsLabel: 'X and Z errors', noiseLabel: 'p = 4%', idea: 'Two check types, two independent puzzles.' },
  { level: 5, d: 5, noise: { kind: 'depolarizing', p: 0.06 }, mode: 'xyz', puzzles: 3, title: 'Y errors', errorsLabel: 'X, Y and Z errors', noiseLabel: 'p = 6%', idea: 'Y errors light both types.' },
  { level: 6, d: 7, noise: { kind: 'depolarizing', p: 0.06 }, mode: 'xyz', puzzles: 3, title: 'A bigger code', errorsLabel: 'X, Y and Z errors', noiseLabel: 'p = 6%', idea: 'A bigger code tolerates more errors.' },
  { level: 7, d: 7, noise: { kind: 'depolarizing', p: 0.08 }, mode: 'xyz', puzzles: 3, timerSec: 45, title: 'Boss: against the clock', errorsLabel: 'Depolarizing noise', noiseLabel: 'p = 8%, 45 s timer', idea: 'Time pressure, which leads into real-time mode.' },
];

export interface Puzzle {
  level: number;
  seed: number;
  code: SurfaceCode;
  error: PauliFrame;
  syndrome: Uint8Array;
}

function sampleLevelError(cfg: LevelConfig, code: SurfaceCode, rng: Rng): PauliFrame {
  const n = cfg.noise;
  for (let tries = 0; tries < 10_000; tries++) {
    let e: PauliFrame;
    if (n.kind === 'exactX') e = sampleExactErrors(code, n.k, 'X', rng, false).error;
    else if (n.kind === 'xOrZ') {
      e = emptyFrame(code.n);
      for (let q = 0; q < code.n; q++) {
        if (rng.next() < n.p) (rng.next() < 0.5 ? e.x : e.z)[q] = 1;
      }
    } else {
      const m: NoiseModel = n.kind === 'bitflip' ? { kind: 'bitflip', p: n.p } : { kind: 'depolarizing', p: n.p };
      const s = sampleNoise(code, m, rng);
      if (s.kind !== 'codeCapacity') throw new Error();
      e = s.error;
    }
    // At least one check must fire (resample otherwise).
    if (syndrome(code, e).some((b) => b === 1)) return e;
  }
  throw new Error('could not sample a visible error');
}

export function makePuzzle(level: number, puzzleIndex: number): Puzzle {
  const cfg = LEVELS[level - 1];
  const code = makeRotatedSurfaceCode(cfg.d);
  const seed = levelSeed(level, puzzleIndex);
  const rng = makeRng(seed);
  const error = sampleLevelError(cfg, code, rng);
  return { level, seed, code, error, syndrome: syndrome(code, error) };
}

/** The syndrome the player currently sees: error times their corrections. */
export function liveSyndrome(p: Puzzle, corrections: PauliFrame): Uint8Array {
  return syndrome(p.code, multiply(p.error, corrections));
}

export interface DecoderPlay {
  correction: PauliFrame;
  results: { X: DecodeResult; Z: DecodeResult };
  graphs: { X: DecodingGraph; Z: DecodingGraph };
  saved: boolean;
  weight: number;
  ms: number;
}

const graphCache = new Map<number, { X: DecodingGraph; Z: DecodingGraph }>();
export function gameGraphs(code: SurfaceCode) {
  let g = graphCache.get(code.d);
  if (!g) {
    g = { X: buildCodeCapacityGraph(code, 'X'), Z: buildCodeCapacityGraph(code, 'Z') };
    graphCache.set(code.d, g);
  }
  return g;
}

/** The decoder (MWPM) plays the same puzzle. */
export function decoderPlay(code: SurfaceCode, error: PauliFrame, decoderId: 'mwpm' | 'unionFind' | 'greedy' = 'mwpm'): DecoderPlay {
  const graphs = gameGraphs(code);
  const syn = syndrome(code, error);
  const dec = DECODERS[decoderId];
  const rX = dec.decode(graphs.X, defectsFromSyndrome(graphs.X, syn));
  const rZ = dec.decode(graphs.Z, defectsFromSyndrome(graphs.Z, syn));
  const correction = emptyFrame(code.n);
  flipsToFrame(graphs.X, rX.flips, correction);
  flipsToFrame(graphs.Z, rZ.flips, correction);
  const out = logicalOutcome(code, error, correction);
  return { correction, results: { X: rX, Z: rZ }, graphs, saved: !out.failed, weight: weight(correction), ms: rX.ms + rZ.ms };
}

export interface Evaluation {
  saved: boolean;
  /** Residual qubits (error times correction), shown as the chain on a logical error. */
  residual: number[];
  playerWeight: number;
  decoder: DecoderPlay;
  points: number;
  /** True when the decoder also failed: no life is lost for a failure nobody could avoid. */
  unavoidable: boolean;
}

export function evaluate(p: Puzzle, corrections: PauliFrame, hintsUsed: number, timeLeftSec = 0): Evaluation {
  const out = logicalOutcome(p.code, p.error, corrections);
  const res = multiply(p.error, corrections);
  const residual: number[] = [];
  for (let q = 0; q < p.code.n; q++) if (res.x[q] || res.z[q]) residual.push(q);
  const decoder = decoderPlay(p.code, p.error);
  const playerWeight = weight(corrections);
  let points = 0;
  if (!out.failed) {
    points = 100 + Math.max(0, 50 - 10 * Math.max(0, playerWeight - decoder.weight));
    points += Math.max(0, Math.round(timeLeftSec)) * 2;
  }
  points = Math.max(0, points - 25 * hintsUsed);
  return { saved: !out.failed, residual, playerWeight, decoder, points, unavoidable: out.failed && !decoder.saved };
}

/** Hint: a pair of lit checks that likely share an error (from MWPM on the current syndrome). */
export function hint(p: Puzzle, corrections: PauliFrame): { checks: number[]; boundary: boolean } | null {
  const syn = liveSyndrome(p, corrections);
  const graphs = gameGraphs(p.code);
  for (const g of [graphs.X, graphs.Z]) {
    const defects = defectsFromSyndrome(g, syn);
    if (!defects.length) continue;
    const r = DECODERS.mwpm.decode(g, defects);
    const pair = r.matching.find(([, b]) => b !== g.boundary) ?? r.matching[0];
    if (!pair) continue;
    const checks = pair.filter((x) => x !== g.boundary).map((k) => g.checks[k]);
    return { checks, boundary: pair[1] === g.boundary };
  }
  return null;
}

/** The twist: the decoder solves many level-3 puzzles. Seeds are disjoint from play seeds. */
export function decoderBatch(level: number, count: number): { saved: number; total: number; ms: number } {
  const cfg = LEVELS[level - 1];
  const code = makeRotatedSurfaceCode(cfg.d);
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  let saved = 0;
  for (let i = 0; i < count; i++) {
    const rng = makeRng(900_000 + level * 10_000 + i);
    const e = sampleLevelError(cfg, code, rng);
    if (decoderPlay(code, e).saved) saved++;
  }
  const ms = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
  return { saved, total: count, ms };
}
