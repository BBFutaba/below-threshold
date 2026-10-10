// Exact state-vector simulator for small systems (the error-correction chapters use at most
// 5 qubits; the Shor's algorithm chapters up to 10).
// Convention: qubit q is bit q of the basis index.
// Labels print qubit 0 first, e.g. "|100>" means qubit 0 is 1.

/** A 2x2 complex matrix [[a, b], [c, d]] flattened as [ar, ai, br, bi, cr, ci, dr, di]. */
export type Matrix2 = readonly [number, number, number, number, number, number, number, number];

const R = Math.SQRT1_2;

export const Gates = {
  I: [1, 0, 0, 0, 0, 0, 1, 0] as Matrix2,
  X: [0, 0, 1, 0, 1, 0, 0, 0] as Matrix2,
  Y: [0, 0, 0, -1, 0, 1, 0, 0] as Matrix2,
  Z: [1, 0, 0, 0, 0, 0, -1, 0] as Matrix2,
  H: [R, 0, R, 0, R, 0, -R, 0] as Matrix2,
  S: [1, 0, 0, 0, 0, 0, 0, 1] as Matrix2,
  Rx: (t: number): Matrix2 => {
    const c = Math.cos(t / 2),
      s = Math.sin(t / 2);
    return [c, 0, 0, -s, 0, -s, c, 0];
  },
  Ry: (t: number): Matrix2 => {
    const c = Math.cos(t / 2),
      s = Math.sin(t / 2);
    return [c, 0, -s, 0, s, 0, c, 0];
  },
  /** Phase gate P(phi) = diag(1, e^{i phi}); P(pi) = Z, P(pi/2) = S. */
  P: (phi: number): Matrix2 => [1, 0, 0, 0, 0, 0, Math.cos(phi), Math.sin(phi)],
};

export const MAX_QUBITS = 10;

export interface Bloch {
  x: number;
  y: number;
  z: number;
  /** Below 1 means the qubit is entangled with the others (mixed reduced state). */
  length: number;
}

export interface Term {
  index: number;
  label: string;
  re: number;
  im: number;
  p: number;
}

export type RandomFn = () => number;

export class QState {
  readonly n: number;
  readonly N: number;
  readonly re: Float64Array;
  readonly im: Float64Array;

  constructor(n: number) {
    if (!Number.isInteger(n) || n < 1 || n > MAX_QUBITS) {
      throw new Error(`QState supports 1 to ${MAX_QUBITS} qubits, got ${n}`);
    }
    this.n = n;
    this.N = 1 << n;
    this.re = new Float64Array(this.N);
    this.im = new Float64Array(this.N);
    this.re[0] = 1;
  }

  clone(): QState {
    const s = new QState(this.n);
    s.re.set(this.re);
    s.im.set(this.im);
    return s;
  }

  /** Apply a 2x2 complex matrix to qubit q. */
  apply(q: number, m: Matrix2): this {
    this.checkQubit(q);
    const [ar, ai, br, bi, cr, ci, dr, di] = m;
    const bit = 1 << q,
      re = this.re,
      im = this.im;
    for (let i = 0; i < this.N; i++) {
      if (i & bit) continue;
      const j = i | bit;
      const xr = re[i],
        xi = im[i],
        yr = re[j],
        yi = im[j];
      re[i] = ar * xr - ai * xi + br * yr - bi * yi;
      im[i] = ar * xi + ai * xr + br * yi + bi * yr;
      re[j] = cr * xr - ci * xi + dr * yr - di * yi;
      im[j] = cr * xi + ci * xr + dr * yi + di * yr;
    }
    return this;
  }

  h(q: number): this {
    return this.apply(q, Gates.H);
  }
  x(q: number): this {
    return this.apply(q, Gates.X);
  }
  y(q: number): this {
    return this.apply(q, Gates.Y);
  }
  z(q: number): this {
    return this.apply(q, Gates.Z);
  }
  s(q: number): this {
    return this.apply(q, Gates.S);
  }
  rx(q: number, t: number): this {
    return this.apply(q, Gates.Rx(t));
  }
  ry(q: number, t: number): this {
    return this.apply(q, Gates.Ry(t));
  }
  phase(q: number, phi: number): this {
    return this.apply(q, Gates.P(phi));
  }

  /** Controlled phase: multiply every amplitude where qubits a and b are both 1 by e^{i phi}. */
  cphase(a: number, b: number, phi: number): this {
    this.checkQubit(a);
    this.checkQubit(b);
    if (a === b) throw new Error('controlled phase needs two different qubits');
    const mask = (1 << a) | (1 << b),
      c = Math.cos(phi),
      s = Math.sin(phi);
    for (let i = 0; i < this.N; i++) {
      if ((i & mask) !== mask) continue;
      const r = this.re[i],
        m = this.im[i];
      this.re[i] = c * r - s * m;
      this.im[i] = s * r + c * m;
    }
    return this;
  }

  swap(a: number, b: number): this {
    this.checkQubit(a);
    this.checkQubit(b);
    if (a === b) return this;
    const ab = 1 << a,
      bb = 1 << b;
    for (let i = 0; i < this.N; i++) {
      if (i & ab && !(i & bb)) {
        const j = (i & ~ab) | bb;
        let t = this.re[i];
        this.re[i] = this.re[j];
        this.re[j] = t;
        t = this.im[i];
        this.im[i] = this.im[j];
        this.im[j] = t;
      }
    }
    return this;
  }

  cnot(c: number, t: number): this {
    this.checkQubit(c);
    this.checkQubit(t);
    if (c === t) throw new Error('CNOT control and target must differ');
    const cb = 1 << c,
      tb = 1 << t,
      re = this.re,
      im = this.im;
    for (let i = 0; i < this.N; i++) {
      if (i & cb && !(i & tb)) {
        const j = i | tb;
        let tmp = re[i];
        re[i] = re[j];
        re[j] = tmp;
        tmp = im[i];
        im[i] = im[j];
        im[j] = tmp;
      }
    }
    return this;
  }

  cz(a: number, b: number): this {
    this.checkQubit(a);
    this.checkQubit(b);
    const mask = (1 << a) | (1 << b);
    for (let i = 0; i < this.N; i++) {
      if ((i & mask) === mask) {
        this.re[i] = -this.re[i];
        this.im[i] = -this.im[i];
      }
    }
    return this;
  }

  /** Probability that measuring qubit q in the Z basis gives 1. */
  prob1(q: number): number {
    this.checkQubit(q);
    const bit = 1 << q;
    let p = 0;
    for (let i = 0; i < this.N; i++) {
      if (i & bit) p += this.re[i] ** 2 + this.im[i] ** 2;
    }
    return Math.min(1, Math.max(0, p));
  }

  /** Probability of each basis state. */
  probabilities(): Float64Array {
    const out = new Float64Array(this.N);
    for (let i = 0; i < this.N; i++) out[i] = this.re[i] ** 2 + this.im[i] ** 2;
    return out;
  }

  /** Projective Z-basis measurement with collapse and renormalization. */
  measure(q: number, rand: RandomFn = Math.random): 0 | 1 {
    const p1 = this.prob1(q);
    let outcome: 0 | 1 = rand() < p1 ? 1 : 0;
    let keep = outcome ? p1 : 1 - p1;
    if (keep < 1e-12) {
      outcome = outcome ? 0 : 1;
      keep = 1 - keep;
    }
    const norm = 1 / Math.sqrt(keep),
      bit = 1 << q;
    for (let i = 0; i < this.N; i++) {
      if ((i & bit ? 1 : 0) === outcome) {
        this.re[i] *= norm;
        this.im[i] *= norm;
      } else {
        this.re[i] = 0;
        this.im[i] = 0;
      }
    }
    return outcome;
  }

  /** Measure qubit q and flip it back to |0> if needed. */
  reset(q: number, rand: RandomFn = Math.random): this {
    if (this.measure(q, rand)) this.x(q);
    return this;
  }

  /**
   * Sample `shots` full measurements of all qubits from fresh copies of this state
   * (no collapse of this state). Returns counts per basis index.
   */
  sample(shots: number, rand: RandomFn = Math.random): Uint32Array {
    const probs = this.probabilities();
    const counts = new Uint32Array(this.N);
    for (let s = 0; s < shots; s++) {
      let r = rand(),
        k = 0;
      while (k < this.N - 1 && r >= probs[k]) {
        r -= probs[k];
        k++;
      }
      counts[k]++;
    }
    return counts;
  }

  /** Bloch vector of one qubit from its reduced density matrix. */
  bloch(q: number): Bloch {
    this.checkQubit(q);
    const bit = 1 << q;
    let r00 = 0,
      r11 = 0,
      r01re = 0,
      r01im = 0;
    for (let i = 0; i < this.N; i++) {
      if (i & bit) continue;
      const j = i | bit;
      const ar = this.re[i],
        ai = this.im[i],
        br = this.re[j],
        bi = this.im[j];
      r00 += ar * ar + ai * ai;
      r11 += br * br + bi * bi;
      r01re += ar * br + ai * bi;
      r01im += ai * br - ar * bi;
    }
    const x = 2 * r01re,
      y = -2 * r01im,
      z = r00 - r11;
    return { x, y, z, length: Math.sqrt(x * x + y * y + z * z) };
  }

  /** |<this|other>|^2 */
  fidelity(other: QState): number {
    if (other.n !== this.n) throw new Error('fidelity: qubit counts differ');
    let sr = 0,
      si = 0;
    for (let i = 0; i < this.N; i++) {
      sr += this.re[i] * other.re[i] + this.im[i] * other.im[i];
      si += this.re[i] * other.im[i] - this.im[i] * other.re[i];
    }
    return sr * sr + si * si;
  }

  label(i: number): string {
    return basisLabel(i, this.n);
  }

  /** Nonzero terms, for displaying the state. */
  terms(eps = 1e-9): Term[] {
    const out: Term[] = [];
    for (let i = 0; i < this.N; i++) {
      const p = this.re[i] ** 2 + this.im[i] ** 2;
      if (p > eps) out.push({ index: i, label: this.label(i), re: this.re[i], im: this.im[i], p });
    }
    return out;
  }

  private checkQubit(q: number): void {
    if (!Number.isInteger(q) || q < 0 || q >= this.n) throw new Error(`qubit ${q} out of range`);
  }
}

export function basisLabel(i: number, n: number): string {
  let s = '';
  for (let q = 0; q < n; q++) s += (i >> q) & 1;
  return `|${s}⟩`;
}
