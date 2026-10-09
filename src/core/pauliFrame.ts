// Pauli frame: errors are tracked as two bit arrays per data qubit, x[i] and z[i].
// Y means both are set. This is exact for Pauli noise on stabilizer codes
// (Gottesman-Knill), which is why the lattice game can run classically.

import type { SurfaceCode } from './surfaceCode';

export type Pauli = 'I' | 'X' | 'Y' | 'Z';

export interface PauliFrame {
  x: Uint8Array;
  z: Uint8Array;
}

export function emptyFrame(n: number): PauliFrame {
  return { x: new Uint8Array(n), z: new Uint8Array(n) };
}

export function cloneFrame(f: PauliFrame): PauliFrame {
  return { x: f.x.slice(), z: f.z.slice() };
}

/** XOR a single Pauli onto qubit q. */
export function applyPauli(f: PauliFrame, q: number, p: Pauli): void {
  if (p === 'X' || p === 'Y') f.x[q] ^= 1;
  if (p === 'Z' || p === 'Y') f.z[q] ^= 1;
}

export function pauliAt(f: PauliFrame, q: number): Pauli {
  const x = f.x[q],
    z = f.z[q];
  return x && z ? 'Y' : x ? 'X' : z ? 'Z' : 'I';
}

/** In-place a ^= b. */
export function xorInto(a: PauliFrame, b: PauliFrame): void {
  for (let i = 0; i < a.x.length; i++) {
    a.x[i] ^= b.x[i];
    a.z[i] ^= b.z[i];
  }
}

export function multiply(a: PauliFrame, b: PauliFrame): PauliFrame {
  const out = cloneFrame(a);
  xorInto(out, b);
  return out;
}

export function weight(f: PauliFrame): number {
  let w = 0;
  for (let i = 0; i < f.x.length; i++) if (f.x[i] || f.z[i]) w++;
  return w;
}

/**
 * One bit per stabilizer. A Z-type check fires if an odd number of qubits on its
 * support have x set; an X-type check fires if an odd number have z set.
 */
export function syndrome(code: SurfaceCode, f: PauliFrame): Uint8Array {
  const out = new Uint8Array(code.stabilizers.length);
  code.stabilizers.forEach((s, i) => {
    const bits = s.type === 'Z' ? f.x : f.z;
    let parity = 0;
    for (const q of s.support) parity ^= bits[q];
    out[i] = parity;
  });
  return out;
}

function parityOn(bits: Uint8Array, qubits: number[]): number {
  let p = 0;
  for (const q of qubits) p ^= bits[q];
  return p;
}

export interface LogicalOutcome {
  /** The residual flipped logical X (its x bits anticommute with logical Z). */
  xFlip: boolean;
  /** The residual flipped logical Z (its z bits anticommute with logical X). */
  zFlip: boolean;
  failed: boolean;
}

/**
 * Logical outcome of error times correction. The residual must have zero syndrome;
 * a nonzero syndrome means the correction was incomplete, which is a bug in the caller.
 */
export function logicalOutcome(code: SurfaceCode, error: PauliFrame, correction: PauliFrame): LogicalOutcome {
  const residual = multiply(error, correction);
  const s = syndrome(code, residual);
  for (let i = 0; i < s.length; i++) {
    if (s[i]) throw new Error('logicalOutcome: residual has nonzero syndrome (correction incomplete)');
  }
  const xFlip = parityOn(residual.x, code.logicalZ) === 1;
  const zFlip = parityOn(residual.z, code.logicalX) === 1;
  return { xFlip, zFlip, failed: xFlip || zFlip };
}

export function isLogicalFailure(code: SurfaceCode, error: PauliFrame, correction: PauliFrame): boolean {
  return logicalOutcome(code, error, correction).failed;
}

export function frameFromList(n: number, entries: [number, Pauli][]): PauliFrame {
  const f = emptyFrame(n);
  for (const [q, p] of entries) applyPauli(f, q, p);
  return f;
}
