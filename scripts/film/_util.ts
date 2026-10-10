// Shared helpers for the film data exports (one file per scene in scripts/film/).
import { mkdirSync, writeFileSync } from 'node:fs';
import type { SurfaceCode } from '../../src/core/surfaceCode';

export const OUT = 'media/data/film';

export function write(name: string, obj: unknown): void {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}/${name}.json`, JSON.stringify(obj, null, 1));
  console.log(`wrote ${OUT}/${name}.json`);
}

/** Layout in the shape media/scenes/common.py's Lattice expects. */
export function layout(code: SurfaceCode) {
  const d = code.d;
  return {
    d,
    n: code.n,
    dataQubits: code.dataQubits,
    logicalX: code.logicalX,
    logicalZ: code.logicalZ,
    stabilizers: code.stabilizers.map((s) => {
      const { r, c } = s.pos;
      const edge = r === 0 ? 'top' : r === d ? 'bottom' : c === 0 ? 'left' : c === d ? 'right' : null;
      return { type: s.type, support: s.support, pos: s.pos, weight: s.support.length, edge };
    }),
  };
}

export const ones = (bits: ArrayLike<number>): number[] => Array.from(bits).flatMap((b, i) => (b ? [i] : []));

/** Standard normal from a uniform generator (Box-Muller). */
export function gauss(next: () => number): number {
  const u = Math.max(next(), 1e-12),
    v = next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
