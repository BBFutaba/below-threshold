// Real-time decoding queue model (no React).
//
// Syndrome rounds arrive on a fixed clock (real superconducting chips: about one round per
// microsecond). Each round needs some decode work; the decoder processes rounds first in,
// first out. If its time per round exceeds the round period, the backlog grows without
// limit. Some logical operations (T gates) must wait until the decoder has caught up to
// the round in which they were requested, so a backlog stalls the computation.

export const HARDWARE_ROUND_US = 1;

export interface QueueState {
  /** Hardware rounds elapsed. */
  round: number;
  /** Remaining decode work (microseconds) of each undecoded round, oldest first. */
  pending: number[];
  /** Number of rounds fully decoded. */
  decoded: number;
  /** Outstanding T-gate requests: the round each one needs decoded. */
  tWaiting: { needs: number; issuedAt: number }[];
  /** Completed T gates and how long each waited (rounds). */
  tDone: number[];
}

export function newQueue(): QueueState {
  return { round: 0, pending: [], decoded: 0, tWaiting: [], tDone: [] };
}

/**
 * Advance one hardware round: the decoder spends one round period of work on the queue,
 * then a new round arrives needing `serviceUs` of work. Optionally a T gate is requested.
 */
export function stepQueue(s: QueueState, serviceUs: number, requestT = false, periodUs = HARDWARE_ROUND_US): QueueState {
  const pending = s.pending.slice();
  let decoded = s.decoded;
  let capacity = periodUs;
  while (capacity > 0 && pending.length > 0) {
    if (pending[0] <= capacity) {
      capacity -= pending[0];
      pending.shift();
      decoded++;
    } else {
      pending[0] -= capacity;
      capacity = 0;
    }
  }
  const round = s.round + 1;
  pending.push(serviceUs);
  const tWaiting = s.tWaiting.slice();
  if (requestT) tWaiting.push({ needs: round, issuedAt: round });
  const tDone = s.tDone.slice();
  while (tWaiting.length && decoded >= tWaiting[0].needs) {
    const t = tWaiting.shift()!;
    tDone.push(round - t.issuedAt);
  }
  return { round, pending, decoded, tWaiting, tDone };
}

export function backlog(s: QueueState): number {
  return s.pending.length;
}

/** Utilization rho = mean service time / round period; above 1 the queue grows without limit. */
export function utilization(serviceUs: number[], periodUs = HARDWARE_ROUND_US): number {
  if (!serviceUs.length) return 0;
  return serviceUs.reduce((a, b) => a + b, 0) / serviceUs.length / periodUs;
}

/** Longest current wait among outstanding T gates, in rounds. */
export function currentWait(s: QueueState): number {
  return s.tWaiting.length ? s.round - s.tWaiting[0].issuedAt : 0;
}
