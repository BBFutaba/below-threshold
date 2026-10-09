// Helpers for the 3-qubit repetition code chapters (data qubits 0-2, ancillas 3 and 4).

import { QState } from '../../../core/quantum';
import type { Op } from '../../components/QuantumViews';

export const DATA = [0, 1, 2];
export const ANC = [3, 4];

export const encodeOps = (phaseFlip = false): Op[] => [
  { g: 'CNOT', c: 0, t: 1 },
  { g: 'CNOT', c: 0, t: 2 },
  ...(phaseFlip ? DATA.map((q) => ({ g: 'H' as const, q })) : []),
];

/** Ancilla 3 = parity(q0, q1) asks "do 0 and 1 agree?"; ancilla 4 = parity(q1, q2). */
export const checkOps = (): Op[] => [
  { g: 'CNOT', c: 0, t: 3 },
  { g: 'CNOT', c: 1, t: 3 },
  { g: 'CNOT', c: 1, t: 4 },
  { g: 'CNOT', c: 2, t: 4 },
];

export const hSandwich = (): Op[] => DATA.map((q) => ({ g: 'H' as const, q }));

export const SYNDROME_TABLE: Record<string, number> = { '0,0': -1, '1,0': 0, '1,1': 1, '0,1': 2 };

export function encodedData(theta: number, phaseFlip = false): QState {
  const s = new QState(3).ry(0, theta).cnot(0, 1).cnot(0, 2);
  if (phaseFlip) for (const q of DATA) s.h(q);
  return s;
}

/**
 * Fidelity of the data qubits (0-2) with a 3-qubit target, tracing out the ancillas:
 * sum over ancilla basis states a of |<target (x) a | state>|^2.
 */
export function dataFidelity(state: QState, target: QState): number {
  let f = 0;
  for (let a = 0; a < 4; a++) {
    let re = 0,
      im = 0;
    for (let j = 0; j < 8; j++) {
      const i = j | (a << 3);
      re += target.re[j] * state.re[i] + target.im[j] * state.im[i];
      im += target.re[j] * state.im[i] - target.im[j] * state.re[i];
    }
    f += re * re + im * im;
  }
  return f;
}

/** The data block of the state with ancillas in |a>, as a 3-qubit state (for display). */
export function dataBlock(state: QState, a = 0): QState {
  const out = new QState(3);
  out.re[0] = 0;
  let norm = 0;
  for (let j = 0; j < 8; j++) {
    out.re[j] = state.re[j | (a << 3)];
    out.im[j] = state.im[j | (a << 3)];
    norm += out.re[j] ** 2 + out.im[j] ** 2;
  }
  if (norm > 1e-12) {
    const k = 1 / Math.sqrt(norm);
    for (let j = 0; j < 8; j++) {
      out.re[j] *= k;
      out.im[j] *= k;
    }
  }
  return out;
}
