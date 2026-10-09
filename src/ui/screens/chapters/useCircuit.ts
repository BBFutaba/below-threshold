// A replayable circuit: the state is always rebuilt from the op list, so "tap a gate to
// undo back to that point" is exact. Measurement outcomes are drawn from a seeded rng
// when the op is added and stored on the op, so replays are deterministic.

import { useCallback, useMemo, useRef, useState } from 'react';
import { QState } from '../../../core/quantum';
import { makeRng } from '../../../core/rng';
import { applyOp, type Op } from '../../components/QuantumViews';

export function forced(out: number): () => number {
  return () => (out ? 0 : 1 - 1e-12);
}

export function replay(n: number, ops: Op[], init?: (s: QState) => void): QState {
  const s = new QState(n);
  init?.(s);
  for (const op of ops) applyOp(s, op, op.g === 'M' ? forced(op.out ?? 0) : undefined);
  return s;
}

export function useCircuit(n: number, seed: number, init?: (s: QState) => void) {
  const [ops, setOps] = useState<Op[]>([]);
  const rng = useRef(makeRng(seed));
  const initRef = useRef(init);
  initRef.current = init;
  const [initVersion, setInitVersion] = useState(0);
  const state = useMemo(() => replay(n, ops, initRef.current), [n, ops, initVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  const add = useCallback(
    (op: Op | Op[]) => {
      setOps((prev) => {
        const list = Array.isArray(op) ? op : [op];
        const cur = replay(n, prev, initRef.current);
        const out: Op[] = [...prev];
        for (const o of list) {
          if (o.g === 'M') {
            const res = cur.measure(o.q, rng.current.next);
            out.push({ ...o, out: res });
          } else {
            applyOp(cur, o);
            out.push(o);
          }
        }
        return out;
      });
    },
    [n],
  );

  const undoTo = useCallback((i: number) => setOps((prev) => prev.slice(0, i)), []);
  const reset = useCallback((nextInit?: (s: QState) => void) => {
    if (nextInit) initRef.current = nextInit;
    setInitVersion((v) => v + 1);
    setOps([]);
  }, []);
  const random = useCallback(() => rng.current.next(), []);

  return { state, ops, add, undoTo, reset, random, setOps };
}
