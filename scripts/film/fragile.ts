// Chapter 1: a real noisy drift of one qubit, and the CNOT "copy machine" on |+>.
import { QState } from '../../src/core/quantum';
import { makeRng } from '../../src/core/rng';
import { gauss, write } from './_util';

const rng = makeRng(1001);
const q = new QState(1).ry(0, 1.15);
const drift: { x: number; y: number; z: number }[] = [];
for (let i = 0; i < 90; i++) {
  const b = q.bloch(0);
  drift.push({ x: b.x, y: b.y, z: b.z });
  // Small random over-rotations about X and Y (sigma ~ 5.7 degrees per step).
  q.rx(0, 0.1 * gauss(rng.next));
  q.ry(0, 0.1 * gauss(rng.next));
}

const plus = new QState(2).h(0);
const copied = plus.clone().cnot(0, 1);
const ideal = new QState(2).h(0).h(1);
write('fragile', {
  start: { theta: 1.15 },
  drift,
  driftModel: 'seed 1001: per step Rx(0.1 g1) Ry(0.1 g2), g ~ N(0,1)',
  clone: {
    before: plus.terms().map((t) => ({ label: t.label, re: t.re })),
    after: copied.terms().map((t) => ({ label: t.label, re: t.re })),
    blochAfter: [copied.bloch(0), copied.bloch(1)],
    fidelity: copied.fidelity(ideal),
  },
});
