// Decoder timing benchmarks: median and 99th-percentile decode time per round.
// Usage: npm run bench [-- --quick]   (writes src/data/bench.json)
import { mkdirSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { makeRng } from '../src/core/rng';
import { makeRotatedSurfaceCode } from '../src/core/surfaceCode';
import { sampleNoise, type NoiseModel } from '../src/core/noise';
import { graphsFor, defectsFor } from '../src/core/simulate';
import { DECODERS } from '../src/core/decoders/all';
import type { DecoderId } from '../src/core/decoders/index';
import { median, quantile } from '../src/core/stats';

const quick = process.argv.includes('--quick');
const ds = [3, 5, 7, 9, 11];
const ps = [0.01, 0.03, 0.05];
const ids: DecoderId[] = ['mwpm', 'unionFind', 'greedy'];
const out: { decoder: DecoderId; d: number; p: number; medianUs: number; p99Us: number; trials: number }[] = [];
for (const d of ds) {
  const code = makeRotatedSurfaceCode(d);
  for (const p of ps) {
    const m: NoiseModel = { kind: 'phenomenological', p, q: p, rounds: d };
    const g = graphsFor(code, m).X;
    const rng = makeRng(d * 100 + Math.round(p * 1000));
    const samples = Array.from({ length: quick ? 60 : 300 }, () => defectsFor(g, sampleNoise(code, m, rng)));
    for (const id of ids) {
      // Warm up the shortest-path cache and the JIT, then time.
      for (const s of samples.slice(0, 20)) DECODERS[id].decode(g, s);
      const times: number[] = [];
      for (const s of samples) {
        const t0 = performance.now();
        DECODERS[id].decode(g, s);
        times.push(((performance.now() - t0) * 1000) / (d + 1)); // microseconds per round
      }
      const row = { decoder: id, d, p, medianUs: median(times), p99Us: quantile(times, 0.99), trials: times.length };
      out.push(row);
      console.log(`${id.padEnd(10)} d=${String(d).padStart(2)} p=${p.toFixed(2)}  median ${row.medianUs.toFixed(1).padStart(8)} us/round  p99 ${row.p99Us.toFixed(1).padStart(8)} us/round`);
    }
  }
}
mkdirSync('src/data', { recursive: true });
writeFileSync(
  'src/data/bench.json',
  JSON.stringify({ date: new Date().toISOString(), node: process.version, cpu: cpus()[0]?.model ?? 'unknown', results: out }, null, 1),
);
