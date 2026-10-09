// Heavy simulation off the main thread: Monte Carlo points for the lab and live decoder
// timing for real-time mode. Exposed with Comlink.

import * as Comlink from 'comlink';
import { runPoint, graphsFor, defectsFor, decodeSample, type PointSpec, type PointResult } from '../core/simulate';
import { makeRotatedSurfaceCode } from '../core/surfaceCode';
import { makeRng } from '../core/rng';
import { sampleNoise, type NoiseModel } from '../core/noise';
import { DECODERS } from '../core/decoders/all';
import type { DecoderId } from '../core/decoders/index';
import { perRound } from '../core/stats';

export interface TimingSpec {
  d: number;
  p: number;
  decoder: DecoderId;
  samples: number;
  seed: number;
}

export interface TimingResult {
  d: number;
  p: number;
  decoder: DecoderId;
  /** Measured decode time per round (microseconds) for each sample. */
  perRoundUs: number[];
  medianUs: number;
  /** Logical error rate per round, from decoding the same samples. */
  pLround: number;
  failures: number;
  trials: number;
}

const api = {
  runPoint(spec: PointSpec): PointResult {
    return runPoint(spec);
  },

  /** Decode phenomenological samples (d rounds, q = p) and time every decode. */
  measure(spec: TimingSpec): TimingResult {
    const code = makeRotatedSurfaceCode(spec.d);
    const model: NoiseModel = { kind: 'phenomenological', p: spec.p, q: spec.p, rounds: spec.d };
    const g = graphsFor(code, model).X;
    const rng = makeRng(spec.seed);
    const dec = DECODERS[spec.decoder];
    const layers = spec.d + 1;
    // Warm up the JIT and shortest-path cache.
    for (let i = 0; i < 10; i++) dec.decode(g, defectsFor(g, sampleNoise(code, model, rng)));
    const times: number[] = [];
    let failures = 0;
    for (let i = 0; i < spec.samples; i++) {
      const s = sampleNoise(code, model, rng);
      const r = decodeSample(code, model, s, dec);
      if (r.failed) failures++;
      // Browsers coarsen performance.now() (to ~100 us without cross-origin isolation),
      // so repeat each decode until at least 0.5 ms has elapsed and divide.
      const defects = defectsFor(g, s);
      let reps = 0;
      const t0 = performance.now();
      let t1 = t0;
      do {
        dec.decode(g, defects);
        reps++;
        t1 = performance.now();
      } while (t1 - t0 < 0.5 && reps < 2000);
      times.push(((t1 - t0) * 1000) / reps / layers);
    }
    const sorted = [...times].sort((a, b) => a - b);
    return {
      d: spec.d,
      p: spec.p,
      decoder: spec.decoder,
      perRoundUs: times,
      medianUs: sorted[sorted.length >> 1],
      pLround: perRound(failures / spec.samples, spec.d),
      failures,
      trials: spec.samples,
    };
  },
};

export type SimApi = typeof api;
Comlink.expose(api);
