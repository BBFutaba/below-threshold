import { describe, expect, it } from 'vitest';
import { findStackPuzzle } from '../../src/core/timeStack';
import { backlog, currentWait, newQueue, stepQueue, utilization } from '../../src/core/realtime';

describe('real-time queue', () => {
  it('a decoder faster than the clock keeps the backlog at one round', () => {
    let s = newQueue();
    for (let i = 0; i < 1000; i++) s = stepQueue(s, 0.4, i % 10 === 0);
    expect(backlog(s)).toBe(1);
    expect(Math.max(...s.tDone)).toBeLessThanOrEqual(1);
  });

  it('a decoder slower than the clock builds a backlog without limit', () => {
    let s = newQueue();
    for (let i = 0; i < 1000; i++) s = stepQueue(s, 2, i % 10 === 0);
    // Throughput is half the arrival rate, so about half the rounds are still waiting.
    expect(backlog(s)).toBeGreaterThan(450);
    expect(currentWait(s)).toBeGreaterThan(100);
  });

  it('utilization is mean service time over the round period', () => {
    expect(utilization([0.5, 1.5])).toBe(1);
  });

  it('T gates wait until their round is decoded', () => {
    let s = newQueue();
    s = stepQueue(s, 3, true); // needs 3 rounds of work
    expect(s.tWaiting.length).toBe(1);
    s = stepQueue(s, 0.1);
    s = stepQueue(s, 0.1);
    s = stepQueue(s, 0.1);
    expect(s.tWaiting.length).toBe(0);
    expect(s.tDone[0]).toBe(3);
  });
});


describe('time-stack puzzle', () => {
  it('finds clean seeded instances with both qubit and check errors', () => {
    for (const start of [1, 500, 9000]) {
      const p = findStackPuzzle(start);
      expect(p.pairs.length).toBeGreaterThanOrEqual(2);
      expect(new Set(p.pairs.map((x) => x.kind)).size).toBe(2);
      for (const pair of p.pairs) {
        const e = p.graph.edges[pair.edge];
        expect(pair.kind === 'check').toBe(e.kind === 'time');
      }
      expect(findStackPuzzle(start).seed).toBe(p.seed);
    }
  });
});
