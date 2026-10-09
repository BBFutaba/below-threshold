// Seeded pseudo-random generator (xoshiro128**, seeded through splitmix32).
// Every random choice in the app goes through one of these, so any puzzle,
// noise sample or Monte Carlo run can be replayed exactly from its seed.

export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [0, n). */
  int(n: number): number;
  /** The seed this generator was created from. */
  readonly seed: number;
}

function splitmix32(a: number): () => number {
  return () => {
    a = (a + 0x9e3779b9) | 0;
    let z = a;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
    return (z ^ (z >>> 16)) >>> 0;
  };
}

function rotl(x: number, k: number): number {
  return (x << k) | (x >>> (32 - k));
}

export function makeRng(seed: number): Rng {
  const sm = splitmix32(seed >>> 0);
  let s0 = sm(),
    s1 = sm(),
    s2 = sm(),
    s3 = sm();
  if ((s0 | s1 | s2 | s3) === 0) s0 = 1;

  const nextU32 = (): number => {
    const result = Math.imul(rotl(Math.imul(s1, 5), 7), 9) >>> 0;
    const t = s1 << 9;
    s2 ^= s0;
    s3 ^= s1;
    s1 ^= s2;
    s0 ^= s3;
    s2 ^= t;
    s3 = rotl(s3, 11);
    return result;
  };

  return {
    seed,
    next: () => nextU32() / 4294967296,
    int: (n: number) => Math.floor((nextU32() / 4294967296) * n),
  };
}

/** Derive an independent child seed, e.g. one per Monte Carlo worker batch. */
export function deriveSeed(seed: number, index: number): number {
  return splitmix32((seed ^ Math.imul(index + 1, 0x9e3779b9)) >>> 0)();
}

/** Seed convention from the plan: level puzzles use level * 1000 + puzzle index. */
export function levelSeed(level: number, puzzleIndex: number): number {
  return level * 1000 + puzzleIndex;
}
