// Export seeded instances for validate/cross_check.py.
// Usage: npm run export:instances [-- --quick]
import { mkdirSync, writeFileSync } from 'node:fs';
import { exportInstances, exportLayout } from '../src/core/exportInstances';
import { makeRotatedSurfaceCode } from '../src/core/surfaceCode';
import type { NoiseModel } from '../src/core/noise';

const quick = process.argv.includes('--quick');
const count = quick ? 1000 : 10_000;
mkdirSync('validate/data', { recursive: true });

const configs: { name: string; d: number; model: NoiseModel }[] = [
  { name: 'bitflip_d3', d: 3, model: { kind: 'bitflip', p: 0.1 } },
  { name: 'bitflip_d5', d: 5, model: { kind: 'bitflip', p: 0.1 } },
  { name: 'bitflip_d7', d: 7, model: { kind: 'bitflip', p: 0.09 } },
  { name: 'bitflip_d9', d: 9, model: { kind: 'bitflip', p: 0.08 } },
  { name: 'depolarizing_d5', d: 5, model: { kind: 'depolarizing', p: 0.12 } },
  { name: 'phenom_d3', d: 3, model: { kind: 'phenomenological', p: 0.03, q: 0.03, rounds: 3 } },
  { name: 'phenom_d5', d: 5, model: { kind: 'phenomenological', p: 0.03, q: 0.03, rounds: 5 } },
  { name: 'phenom_d5_unequal', d: 5, model: { kind: 'phenomenological', p: 0.02, q: 0.04, rounds: 5 } },
];

for (const [i, c] of configs.entries()) {
  const t0 = Date.now();
  const file = exportInstances(c.d, c.model, 'mwpm', count, 2026_000 + i);
  writeFileSync(`validate/data/instances_${c.name}.json`, JSON.stringify(file));
  console.log(`${c.name}: ${count} instances in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}
for (const d of [3, 5, 7, 9, 11, 13]) {
  writeFileSync(`validate/data/layout_d${d}.json`, JSON.stringify(exportLayout(makeRotatedSurfaceCode(d))));
}
