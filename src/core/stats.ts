// Statistics: Wilson confidence intervals, per-round rates and threshold crossings.

export interface Interval {
  p: number;
  lo: number;
  hi: number;
}

/** Wilson score interval for k failures in n trials (95% by default). */
export function wilson(k: number, n: number, z = 1.96): Interval {
  if (n <= 0) return { p: 0, lo: 0, hi: 1 };
  const p = k / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return { p, lo: Math.max(0, center - half), hi: Math.min(1, center + half) };
}

/**
 * Convert a logical error probability over R rounds into a per-round rate, assuming
 * independent flips each round: P(R) = (1 - (1 - 2e)^R) / 2.
 */
export function perRound(PL: number, rounds: number): number {
  if (rounds <= 1) return PL;
  const x = 1 - 2 * PL;
  if (x <= 0) return 0.5;
  return (1 - Math.pow(x, 1 / rounds)) / 2;
}

export interface CurvePoint {
  p: number;
  pL: number;
}

/**
 * Physical error rates where two logical-error curves cross, found by linear
 * interpolation of log(pL) against log(p). Points must share the same p grid.
 */
export function crossings(a: CurvePoint[], b: CurvePoint[]): number[] {
  const out: number[] = [];
  const n = Math.min(a.length, b.length);
  const diff = (i: number) => Math.log(Math.max(a[i].pL, 1e-12)) - Math.log(Math.max(b[i].pL, 1e-12));
  for (let i = 0; i + 1 < n; i++) {
    const d0 = diff(i),
      d1 = diff(i + 1);
    if (d0 === 0) out.push(a[i].p);
    else if (d0 * d1 < 0) {
      const x0 = Math.log(a[i].p),
        x1 = Math.log(a[i + 1].p);
      const t = d0 / (d0 - d1);
      out.push(Math.exp(x0 + t * (x1 - x0)));
    }
  }
  return out;
}

/** Suppression factor Lambda between distance d and d + 2 at one physical rate. */
export function suppression(pLd: number, pLd2: number): number {
  if (pLd2 <= 0) return Infinity;
  return pLd / pLd2;
}

export function median(xs: number[]): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export function quantile(xs: number[], q: number): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos),
    hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

/** Interpolate log(pL) linearly in log(p) between sampled points (null outside the range). */
export function interpLogLog(points: CurvePoint[], p: number): number | null {
  const pts = points.filter((x) => x.pL > 0).sort((a, b) => a.p - b.p);
  if (pts.length === 0) return null;
  if (p <= pts[0].p) return p === pts[0].p ? pts[0].pL : null;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i],
      b = pts[i + 1];
    if (p >= a.p && p <= b.p) {
      const t = (Math.log(p) - Math.log(a.p)) / (Math.log(b.p) - Math.log(a.p));
      return Math.exp(Math.log(a.pL) + t * (Math.log(b.pL) - Math.log(a.pL)));
    }
  }
  return null;
}
