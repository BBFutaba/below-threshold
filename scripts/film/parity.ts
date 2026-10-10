// Chapter 2: the 3-qubit bit-flip code, run end to end on the exact state-vector simulator.
//
// Qubits 0-2 are data, 3 and 4 are ancillas. The input is the chapter 1 qubit Ry(1.15)|0>.
// Two CNOTs spread it into alpha|000> + beta|111>; an X error strikes data qubit 1; the
// ancillas collect the parities Z0Z1 and Z1Z2 and are measured; the syndrome table (itself
// computed by running every single-flip case through the same circuit) names the qubit to
// flip back, and the fidelity with the encoded state is read off QState.
import { QState, type Bloch } from '../../src/core/quantum';
import { makeRng } from '../../src/core/rng';
import { write } from './_util';

const THETA = 1.15; // the chapter 1 qubit
const ERROR_QUBIT = 1;
const SEED = 2002;

const DATA = [0, 1, 2];
const vec = (b: Bloch) => ({ x: b.x, y: b.y, z: b.z, length: b.length });
const blochs = (s: QState) => DATA.map((q) => vec(s.bloch(q)));
// QState labels print qubit 0 first: "|abcde>" = data abc, ancillas de.
const terms = (s: QState) =>
  s.terms().map((t) => ({ data: t.label.slice(1, 4), anc: t.label.slice(4, 6), re: t.re, im: t.im, p: t.p }));

function extract(s: QState, rand: () => number) {
  const t = s.clone();
  t.cnot(0, 3).cnot(1, 3); // ancilla 3 <- parity of data 0, 1
  t.cnot(1, 4).cnot(2, 4); // ancilla 4 <- parity of data 1, 2
  const p1 = [t.prob1(3), t.prob1(4)];
  const s1 = t.measure(3, rand);
  const s2 = t.measure(4, rand);
  return { state: t, syndrome: [s1, s2] as [number, number], p1 };
}

const input = new QState(5).ry(0, THETA);
const afterCnot1 = input.clone().cnot(0, 1);
const encoded = afterCnot1.clone().cnot(0, 2);

// Syndrome table: every single bit flip (and none) through the same circuit.
const tableRng = makeRng(SEED + 1);
const table = [null, 0, 1, 2].map((flip) => {
  const s = encoded.clone();
  if (flip !== null) s.x(flip);
  const r = extract(s, tableRng.next);
  return { flip, syndrome: r.syndrome, p1: r.p1 };
});
const lookup = (syn: [number, number]) => table.find((r) => r.syndrome[0] === syn[0] && r.syndrome[1] === syn[1])!.flip;

// The run shown on screen.
const rng = makeRng(SEED);
const errored = encoded.clone().x(ERROR_QUBIT);
const fidelityAfterError = errored.fidelity(encoded);
const meas = extract(errored, rng.next);
const decoded = lookup(meas.syndrome);
const corrected = meas.state.clone();
if (decoded !== null) corrected.x(decoded);
// The ancillas are reset (we know their outcomes) so the state can be compared with the encoded one.
if (meas.syndrome[0]) corrected.x(3);
if (meas.syndrome[1]) corrected.x(4);
const fidelityAfterCorrection = corrected.fidelity(encoded);

const alpha = Math.cos(THETA / 2);
const beta = Math.sin(THETA / 2);
write('parity', {
  theta: THETA,
  seed: SEED,
  alpha,
  beta,
  reducedLength: Math.abs(alpha ** 2 - beta ** 2),
  input: { terms: terms(input), bloch: blochs(input) },
  afterCnot1: { terms: terms(afterCnot1), bloch: blochs(afterCnot1) },
  encoded: { terms: terms(encoded), bloch: blochs(encoded) },
  error: { qubit: ERROR_QUBIT, pauli: 'X' },
  errored: { terms: terms(errored), bloch: blochs(errored), fidelity: fidelityAfterError },
  measured: { syndrome: meas.syndrome, p1: meas.p1, terms: terms(meas.state) },
  table,
  decoded,
  corrected: { terms: terms(corrected), bloch: blochs(corrected), fidelity: fidelityAfterCorrection },
});
