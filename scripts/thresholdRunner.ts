// Run Monte Carlo points with our decoders and print one JSON result per line.
// Usage: tsx scripts/thresholdRunner.ts '<json array of PointSpec>'
import { runPoint, type PointSpec } from '../src/core/simulate';

const specs: PointSpec[] = JSON.parse(process.argv[2]);
for (const spec of specs) {
  const t0 = Date.now();
  const r = runPoint(spec);
  console.log(JSON.stringify({ ...r, model: spec.model, seconds: (Date.now() - t0) / 1000 }));
}
