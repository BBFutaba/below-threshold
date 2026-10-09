// Lazily created simulation workers (a small pool so lab points run in parallel).

import * as Comlink from 'comlink';
import type { SimApi } from './sim.worker';

let pool: Comlink.Remote<SimApi>[] | null = null;
let workers: Worker[] = [];

export function simPool(): Comlink.Remote<SimApi>[] {
  if (!pool) {
    const n = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1));
    workers = Array.from({ length: n }, () => new Worker(new URL('./sim.worker.ts', import.meta.url), { type: 'module' }));
    pool = workers.map((w) => Comlink.wrap<SimApi>(w));
  }
  return pool;
}

export function sim(): Comlink.Remote<SimApi> {
  return simPool()[0];
}

/** Kill and recreate workers (used to cancel a long lab run immediately). */
export function resetPool(): void {
  for (const w of workers) w.terminate();
  workers = [];
  pool = null;
}
