// Chapter 4: two kinds of error, one grid.
//
// 1. A Z (phase) error on the 3-qubit code, run on QState: the sign of beta flips and the
//    parity checks Z0Z1, Z1Z2 still read 00 (with certainty).
// 2. H Z H = X, checked on QState (why checking in the rotated basis catches phase flips).
// 3. The real d = 5 rotated surface code, the repetition row embedded as its middle row,
//    and the syndromes (pauliFrame.syndrome) of a growing X chain down the middle column,
//    ending at code.logicalX with every check dark and a logical flip (logicalOutcome).
import { QState } from '../../src/core/quantum';
import { makeRng } from '../../src/core/rng';
import { makeRotatedSurfaceCode } from '../../src/core/surfaceCode';
import { applyPauli, emptyFrame, logicalOutcome, syndrome } from '../../src/core/pauliFrame';
import { layout, ones, write } from './_util';

// ------------------------------------------------------------------ 1. phase flip, 3 qubits
const THETA = 1.15; // same encoded qubit as chapter 2
const rng = makeRng(4004);
const terms = (s: QState) => s.terms().map((t) => ({ data: t.label.slice(1, 4), re: t.re, im: t.im }));
function checks(s: QState) {
  const t = s.clone().cnot(0, 3).cnot(1, 3).cnot(1, 4).cnot(2, 4);
  const p1 = [t.prob1(3), t.prob1(4)];
  return { syndrome: [t.measure(3, rng.next), t.measure(4, rng.next)], p1 };
}
const encoded = new QState(5).ry(0, THETA).cnot(0, 1).cnot(0, 2);
const PHASE_QUBIT = 1;
const phased = encoded.clone().z(PHASE_QUBIT);
const bitFlipped = encoded.clone().x(PHASE_QUBIT);

// HZH = X on an arbitrary state.
const probe = new QState(1).ry(0, 0.7).rx(0, 0.3);
const hzh = probe.clone().h(0).z(0).h(0);
const x = probe.clone().x(0);

// ------------------------------------------------------------------ 2. the d = 5 grid
const code = makeRotatedSurfaceCode(5);
const d = code.d;
const idx = (r: number, c: number) => r * d + c;
const mid = (d - 1) / 2;
const embedRow = [idx(mid, 1), idx(mid, 2), idx(mid, 3)];
const repToSurface = [
  [embedRow[0], embedRow[1]],
  [embedRow[1], embedRow[2]],
].map((pair) => code.stabilizers.findIndex((s) => s.type === 'Z' && pair.every((q) => s.support.includes(q))));
// The X-type (rotated-basis) checks on the same pairs: these are the ones a phase flip trips.
const repToSurfaceX = [
  [embedRow[0], embedRow[1]],
  [embedRow[1], embedRow[2]],
].map((pair) => code.stabilizers.findIndex((s) => s.type === 'X' && pair.every((q) => s.support.includes(q))));
// The chapter's phase flip on the grid: Z on the middle data qubit of the embedded row.
const zFrame = emptyFrame(code.n);
applyPauli(zFrame, embedRow[PHASE_QUBIT], 'Z');
const zError = { qubit: embedRow[PHASE_QUBIT], fired: ones(syndrome(code, zFrame)) };

const stabAt = (r: number, c: number) => code.stabilizers.findIndex((s) => s.pos.r === r && s.pos.c === c);
const legend = {
  qubit: idx(1, 1),
  zTile: stabAt(2, 1),
  xTile: stabAt(2, 4),
  boundary: stabAt(5, 3),
};

// A chain growing down and up the middle column, one X at a time; the last step is code.logicalX.
const col = code.logicalX; // [2, 7, 12, 17, 22]
const order = [col[2], col[3], col[1], col[0], col[4]];
const chain = order.map((_, k) => {
  const f = emptyFrame(code.n);
  const qs = order.slice(0, k + 1);
  for (const q of qs) applyPauli(f, q, 'X');
  const syn = syndrome(code, f);
  const zeroSyndrome = syn.every((b) => b === 0);
  // logicalOutcome needs a zero-syndrome residual, so it is only asked about the closed chain.
  const logicalXFlip = zeroSyndrome ? logicalOutcome(code, f, emptyFrame(code.n)).xFlip : null;
  return { errors: qs, fired: ones(syn), zeroSyndrome, logicalXFlip };
});

write('surface', {
  theta: THETA,
  phase: {
    qubit: PHASE_QUBIT,
    before: terms(encoded),
    after: terms(phased),
    checks: checks(phased),
    bitFlipChecks: checks(bitFlipped),
    overlap: phased.fidelity(encoded),
  },
  hzhEqualsX: hzh.fidelity(x),
  layout: layout(code),
  embedRow,
  repToSurface,
  repToSurfaceX,
  zError,
  legend,
  chain,
  logicalX: code.logicalX,
  logicalZ: code.logicalZ,
});
