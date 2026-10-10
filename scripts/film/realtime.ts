// Chapter 8: a race against the clock.
//
// - Per-round decode times are the measured medians in src/data/bench.json (d = 9, p = 3%,
//   phenomenological noise, decode time per shot divided by d + 1 layers).
// - The queue is src/core/realtime.ts (stepQueue, FIFO, 1 us round period). We export a
//   trace per lane for a default T-gate request round, plus the exact T-gate wait for a
//   request at every round 1..MAX_R (one run with a request each round: requests do not
//   add decode work, and they are released in FIFO order, so each gets its own wait).
//   The scene re-runs the same rule in Python for its actual request round and checks
//   itself against this trace.
// - The "requirement" lane is not a measured decoder: it is the rule's behaviour for any
//   decoder under one round period per round (simulated at 0.9 us).
// - The chip's pulses are real detection events of one seeded phenomenological d = 9 run.
import { readFileSync } from 'node:fs';
import { makeRotatedSurfaceCode } from '../../src/core/surfaceCode';
import { makeRng } from '../../src/core/rng';
import { sampleNoise } from '../../src/core/noise';
import { HARDWARE_ROUND_US, newQueue, stepQueue, utilization, type QueueState } from '../../src/core/realtime';
import { layout, ones, write } from './_util';

type Row = { decoder: string; d: number; p: number; medianUs: number; p99Us: number; trials: number };
const bench = JSON.parse(readFileSync('src/data/bench.json', 'utf8')) as { date: string; cpu: string; node: string; results: Row[] };
const pick = (decoder: string) => bench.results.find((r) => r.decoder === decoder && r.d === 9 && r.p === 0.03)!;

const REQUIREMENT_US = 0.9;
const lanes = {
  mwpm: { serviceUs: pick('mwpm').medianUs, p99Us: pick('mwpm').p99Us, measured: true, label: 'MWPM (exact matching)' },
  unionFind: { serviceUs: pick('unionFind').medianUs, p99Us: pick('unionFind').p99Us, measured: true, label: 'union-find' },
  requirement: { serviceUs: REQUIREMENT_US, measured: false, label: 'requirement: under 1 us per round (not a measured decoder)' },
};

const STEPS = 700;
const DEFAULT_R = 40;
const MAX_R = 400;

function trace(serviceUs: number, requestRound: number) {
  let s: QueueState = newQueue();
  const rows: { round: number; backlog: number; decoded: number; head: number; tWaiting: number; tDone: number[] }[] = [];
  for (let i = 0; i < STEPS; i++) {
    s = stepQueue(s, serviceUs, s.round + 1 === requestRound);
    rows.push({ round: s.round, backlog: s.pending.length, decoded: s.decoded, head: s.pending[0], tWaiting: s.tWaiting.length, tDone: s.tDone.slice() });
  }
  return rows;
}

/** Wait (rounds) of a T gate requested at round r, for r = 1..MAX_R. */
function waits(serviceUs: number): number[] {
  let s: QueueState = newQueue();
  while (s.tDone.length < MAX_R) s = stepQueue(s, serviceUs, s.round < MAX_R);
  return s.tDone.slice();
}

const code = makeRotatedSurfaceCode(9);
const NOISE = { kind: 'phenomenological' as const, p: 0.03, q: 0.03, rounds: 900 };
const CHIP_SEED = 8090;
const sample = sampleNoise(code, NOISE, makeRng(CHIP_SEED));
if (sample.kind !== 'phenomenological') throw new Error();
const detections = sample.detections.slice(0, NOISE.rounds).map((d) => ones(d));

write('realtime', {
  bench: { date: bench.date, cpu: bench.cpu, node: bench.node, d: 9, p: 0.03, note: 'median per-round decode time; phenomenological noise, q = p, d rounds; per shot / (d + 1) layers' },
  roundPeriodUs: HARDWARE_ROUND_US,
  lanes: Object.fromEntries(
    Object.entries(lanes).map(([k, v]) => [k, { ...v, utilization: utilization([v.serviceUs]), waitByRequestRound: waits(v.serviceUs), trace: trace(v.serviceUs, DEFAULT_R) }]),
  ),
  defaultRequestRound: DEFAULT_R,
  chip: { layout: layout(code), noise: NOISE, seed: CHIP_SEED, detections },
});
for (const [k, v] of Object.entries(lanes)) {
  const w = waits(v.serviceUs);
  console.log(k, v.serviceUs.toFixed(2), 'us/round; T wait at r=40:', w[39], ' r=60:', w[59]);
}
