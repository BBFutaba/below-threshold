// The three noise models.
//
//  bitflip          X on each data qubit with probability p; perfect checks.
//  depolarizing     X, Y or Z each with probability p/3; perfect checks.
//  phenomenological data noise each round (bit-flip by default), plus every check
//                   result flipped with probability q; `rounds` noisy rounds then a
//                   perfect final readout that closes the time stack.

import type { Rng } from './rng';
import type { SurfaceCode } from './surfaceCode';
import { emptyFrame, syndrome, xorInto, type PauliFrame } from './pauliFrame';

export type NoiseModel =
  | { kind: 'bitflip'; p: number }
  | { kind: 'depolarizing'; p: number }
  | { kind: 'phenomenological'; p: number; q: number; rounds: number; data?: 'bitflip' | 'depolarizing' };

export interface CodeCapacitySample {
  kind: 'codeCapacity';
  error: PauliFrame;
  /** True syndrome of `error` (checks are perfect). */
  syndrome: Uint8Array;
}

export interface PhenomenologicalSample {
  kind: 'phenomenological';
  rounds: number;
  /** New data errors that struck during round t (t = 0..rounds-1). */
  dataErrors: PauliFrame[];
  /** Check-result flips in round t (t = 0..rounds-1). The final readout is perfect. */
  measErrors: Uint8Array[];
  /** Reported check results per layer t = 0..rounds (layer `rounds` is the perfect final readout). */
  measured: Uint8Array[];
  /** Detection events: measured[t] xor measured[t-1] (measured[-1] = all zeros). */
  detections: Uint8Array[];
  /** Accumulated data error after the last round. */
  totalError: PauliFrame;
}

export type NoiseSample = CodeCapacitySample | PhenomenologicalSample;

function sampleDataError(f: PauliFrame, kind: 'bitflip' | 'depolarizing', p: number, rng: Rng): void {
  for (let i = 0; i < f.x.length; i++) {
    const r = rng.next();
    if (r >= p) continue;
    if (kind === 'bitflip') {
      f.x[i] ^= 1;
    } else {
      // r is uniform in [0, p): split into thirds for X, Y, Z.
      const which = Math.floor((r / p) * 3);
      if (which === 0) f.x[i] ^= 1;
      else if (which === 1) {
        f.x[i] ^= 1;
        f.z[i] ^= 1;
      } else f.z[i] ^= 1;
    }
  }
}

export function sampleNoise(code: SurfaceCode, m: NoiseModel, rng: Rng): NoiseSample {
  if (m.kind === 'bitflip' || m.kind === 'depolarizing') {
    const error = emptyFrame(code.n);
    sampleDataError(error, m.kind, m.p, rng);
    return { kind: 'codeCapacity', error, syndrome: syndrome(code, error) };
  }
  return samplePhenomenological(code, m, rng);
}

function samplePhenomenological(
  code: SurfaceCode,
  m: Extract<NoiseModel, { kind: 'phenomenological' }>,
  rng: Rng,
): PhenomenologicalSample {
  const S = code.stabilizers.length;
  const totalError = emptyFrame(code.n);
  const dataErrors: PauliFrame[] = [];
  const measErrors: Uint8Array[] = [];
  const measured: Uint8Array[] = [];
  for (let t = 0; t < m.rounds; t++) {
    const e = emptyFrame(code.n);
    sampleDataError(e, m.data ?? 'bitflip', m.p, rng);
    xorInto(totalError, e);
    dataErrors.push(e);
    const flips = new Uint8Array(S);
    for (let s = 0; s < S; s++) if (rng.next() < m.q) flips[s] = 1;
    measErrors.push(flips);
    const truth = syndrome(code, totalError);
    for (let s = 0; s < S; s++) truth[s] ^= flips[s];
    measured.push(truth);
  }
  measured.push(syndrome(code, totalError)); // perfect final readout
  return {
    kind: 'phenomenological',
    rounds: m.rounds,
    dataErrors,
    measErrors,
    measured,
    detections: detectionEvents(measured),
    totalError,
  };
}

export function detectionEvents(measured: Uint8Array[]): Uint8Array[] {
  return measured.map((m, t) => {
    const out = m.slice();
    if (t > 0) for (let s = 0; s < out.length; s++) out[s] ^= measured[t - 1][s];
    return out;
  });
}

/** Code-capacity sample conditioned on at least one check firing (the game's "noise strikes" step). */
export function sampleVisibleError(code: SurfaceCode, m: NoiseModel, rng: Rng, maxTries = 10_000): CodeCapacitySample {
  for (let i = 0; i < maxTries; i++) {
    const s = sampleNoise(code, m, rng);
    if (s.kind !== 'codeCapacity') throw new Error('sampleVisibleError needs a code-capacity model');
    if (s.syndrome.some((b) => b === 1)) return s;
  }
  throw new Error('sampleVisibleError: no visible error after many tries (error rate too low?)');
}

/** Exactly k errors of the given Pauli type on distinct random qubits (levels 1 and 2). */
export function sampleExactErrors(
  code: SurfaceCode,
  k: number,
  pauli: 'X' | 'Z',
  rng: Rng,
  requireVisible = true,
): CodeCapacitySample {
  for (let tries = 0; tries < 10_000; tries++) {
    const error = emptyFrame(code.n);
    const picked = new Set<number>();
    while (picked.size < k) picked.add(rng.int(code.n));
    for (const q of picked) (pauli === 'X' ? error.x : error.z)[q] = 1;
    const syn = syndrome(code, error);
    if (!requireVisible || syn.some((b) => b === 1)) return { kind: 'codeCapacity', error, syndrome: syn };
  }
  throw new Error('sampleExactErrors: could not find a visible error');
}
