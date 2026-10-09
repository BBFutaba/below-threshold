// Geometry for drawing the rotated surface code (shared by Lattice, TimeStack and Landing).

import type { SurfaceCode } from '../../core/surfaceCode';
import type { DecodingGraph } from '../../core/decodingGraph';

export const S = 60; // spacing between data qubits (viewBox units)
export const M = 54; // margin around the grid (room for boundary half-discs)

export interface Pt {
  x: number;
  y: number;
}

export function viewSize(d: number): number {
  return 2 * M + (d - 1) * S;
}

export function qubitPos(code: SurfaceCode, q: number): Pt {
  const { r, c } = code.dataQubits[q];
  return { x: M + c * S, y: M + r * S };
}

export type CheckShape =
  | { kind: 'square'; x: number; y: number; size: number }
  | { kind: 'half'; cx: number; cy: number; r: number; side: 'top' | 'bottom' | 'left' | 'right' };

export function checkShape(code: SurfaceCode, s: number): CheckShape {
  const { r, c } = code.stabilizers[s].pos;
  const d = code.d;
  const cx = M + (c - 0.5) * S;
  const cy = M + (r - 0.5) * S;
  if (r === 0) return { kind: 'half', cx, cy: M, r: S / 2, side: 'top' };
  if (r === d) return { kind: 'half', cx, cy: M + (d - 1) * S, r: S / 2, side: 'bottom' };
  if (c === 0) return { kind: 'half', cx: M, cy, r: S / 2, side: 'left' };
  if (c === d) return { kind: 'half', cx: M + (d - 1) * S, cy, r: S / 2, side: 'right' };
  return { kind: 'square', x: cx - S / 2, y: cy - S / 2, size: S };
}

/** Visual center of a check (the centroid of a half-disc is 4r/3pi from its flat side). */
export function checkCenter(code: SurfaceCode, s: number): Pt {
  const sh = checkShape(code, s);
  if (sh.kind === 'square') return { x: sh.x + sh.size / 2, y: sh.y + sh.size / 2 };
  const off = (4 * sh.r) / (3 * Math.PI);
  switch (sh.side) {
    case 'top':
      return { x: sh.cx, y: sh.cy - off };
    case 'bottom':
      return { x: sh.cx, y: sh.cy + off };
    case 'left':
      return { x: sh.cx - off, y: sh.cy };
    case 'right':
      return { x: sh.cx + off, y: sh.cy };
  }
}

export function halfDiscPath(sh: Extract<CheckShape, { kind: 'half' }>): string {
  const { cx, cy, r, side } = sh;
  switch (side) {
    case 'top':
      return `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy} Z`;
    case 'bottom':
      return `M ${cx - r} ${cy} A ${r} ${r} 0 0 0 ${cx + r} ${cy} Z`;
    case 'left':
      return `M ${cx} ${cy - r} A ${r} ${r} 0 0 0 ${cx} ${cy + r} Z`;
    case 'right':
      return `M ${cx} ${cy - r} A ${r} ${r} 0 0 1 ${cx} ${cy + r} Z`;
  }
}

/** Where a boundary edge leaves the lattice: just outside the data qubit, away from the grid. */
export function boundaryExit(code: SurfaceCode, q: number, errorType: 'X' | 'Z'): Pt {
  const p = qubitPos(code, q);
  const { r, c } = code.dataQubits[q];
  const d = code.d;
  const out = S * 0.62;
  if (errorType === 'X') {
    // X strings end on the top/bottom edges.
    return r === 0 ? { x: p.x, y: p.y - out } : { x: p.x, y: p.y + out };
  }
  return c === 0 ? { x: p.x - out, y: p.y } : { x: p.x + out, y: p.y };
  void d;
}

export interface Segment {
  a: Pt;
  b: Pt;
  type: 'X' | 'Z';
}

/** Line segments for a set of decoding-graph edges, drawn in one layer of the lattice. */
export function edgeSegments(g: DecodingGraph, edgeIds: number[], layer?: number): Segment[] {
  const out: Segment[] = [];
  const C = g.checks.length;
  for (const eid of edgeIds) {
    const e = g.edges[eid];
    if (e.kind === 'time') continue;
    if (layer !== undefined && e.layer !== layer) continue;
    const su = g.checks[e.u % C];
    const a = checkCenter(g.code, su);
    if (e.kind === 'boundary') {
      const q = qubitPos(g.code, e.qubit);
      const exit = boundaryExit(g.code, e.qubit, g.errorType);
      out.push({ a, b: q, type: g.errorType });
      out.push({ a: q, b: exit, type: g.errorType });
    } else {
      const sv = g.checks[e.v % C];
      out.push({ a, b: checkCenter(g.code, sv), type: g.errorType });
    }
  }
  return out;
}
