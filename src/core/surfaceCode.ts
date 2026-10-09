// Rotated surface code layout (distance d, odd).
//
// Data qubits sit on a d x d grid at (r, c); data index = r * d + c.
// Plaquettes sit at the corners (r, c) with r, c in 0..d and touch the data qubits
// (r-1, c-1), (r-1, c), (r, c-1), (r, c) that exist.
// Type by checkerboard: (r + c) even = X-type, odd = Z-type.
// Interior plaquettes (weight 4) are all kept. On the top and bottom edges only
// X-type weight-2 plaquettes are kept; on the left and right edges only Z-type.
// Corners are never used. That gives exactly d^2 - 1 stabilizers.
//
// With this boundary choice X strings can end on the top/bottom edges (no Z-check
// there to notice them), so logical X runs down a column and logical Z along a row.

export type PauliType = 'X' | 'Z';

export interface Stabilizer {
  type: PauliType;
  /** Data qubit indices in the support. */
  support: number[];
  /** Corner position of the plaquette, r and c in 0..d. */
  pos: { r: number; c: number };
}

export interface SurfaceCode {
  d: number;
  n: number;
  dataQubits: { r: number; c: number }[];
  stabilizers: Stabilizer[];
  /** Indices into `stabilizers` of the X-type and Z-type checks. */
  xChecks: number[];
  zChecks: number[];
  /** For each data qubit, the stabilizer indices that touch it. */
  qubitStabilizers: number[][];
  /** Data qubit indices of logical X (one column, top to bottom). */
  logicalX: number[];
  /** Data qubit indices of logical Z (one row). */
  logicalZ: number[];
}

const cache = new Map<number, SurfaceCode>();

export function makeRotatedSurfaceCode(d: number): SurfaceCode {
  if (!Number.isInteger(d) || d < 3 || d % 2 === 0) {
    throw new Error(`distance must be an odd integer >= 3, got ${d}`);
  }
  const hit = cache.get(d);
  if (hit) return hit;

  const idx = (r: number, c: number) => r * d + c;
  const dataQubits: { r: number; c: number }[] = [];
  for (let r = 0; r < d; r++) for (let c = 0; c < d; c++) dataQubits.push({ r, c });

  const stabilizers: Stabilizer[] = [];
  for (let r = 0; r <= d; r++) {
    for (let c = 0; c <= d; c++) {
      const type: PauliType = (r + c) % 2 === 0 ? 'X' : 'Z';
      const onTopBottom = r === 0 || r === d;
      const onLeftRight = c === 0 || c === d;
      if (onTopBottom && onLeftRight) continue; // corners never used
      if (onTopBottom && type !== 'X') continue;
      if (onLeftRight && type !== 'Z') continue;
      const support: number[] = [];
      for (const [rr, cc] of [
        [r - 1, c - 1],
        [r - 1, c],
        [r, c - 1],
        [r, c],
      ]) {
        if (rr >= 0 && rr < d && cc >= 0 && cc < d) support.push(idx(rr, cc));
      }
      stabilizers.push({ type, support, pos: { r, c } });
    }
  }

  const xChecks: number[] = [];
  const zChecks: number[] = [];
  const qubitStabilizers: number[][] = dataQubits.map(() => []);
  stabilizers.forEach((s, i) => {
    (s.type === 'X' ? xChecks : zChecks).push(i);
    for (const q of s.support) qubitStabilizers[q].push(i);
  });

  const mid = (d - 1) / 2;
  const logicalX: number[] = [];
  const logicalZ: number[] = [];
  for (let r = 0; r < d; r++) logicalX.push(idx(r, mid));
  for (let c = 0; c < d; c++) logicalZ.push(idx(mid, c));

  const code: SurfaceCode = {
    d,
    n: d * d,
    dataQubits,
    stabilizers,
    xChecks,
    zChecks,
    qubitStabilizers,
    logicalX,
    logicalZ,
  };
  cache.set(d, code);
  return code;
}

/** Size of the overlap between two supports. */
export function overlap(a: number[], b: number[]): number {
  const set = new Set(a);
  let k = 0;
  for (const q of b) if (set.has(q)) k++;
  return k;
}

/** Two Pauli operators commute iff the X part of one overlaps the Z part of the other an even number of times. */
export function commutes(aType: PauliType, a: number[], bType: PauliType, b: number[]): boolean {
  if (aType === bType) return true;
  return overlap(a, b) % 2 === 0;
}
