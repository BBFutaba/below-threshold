// Chapter 2: factoring is a hunt for rhythm.
//
// Two 50-digit primes found by a seeded Miller-Rabin search (BigInt) and their product;
// the powers 7^x mod 15, the period and the gcd recipe; and the pattern 2^x mod 3127
// (= 53 x 59), whose period (1508) already runs off the screen.
import { gcd, modPow, multiplicativeOrder } from '../../src/core/shor';
import { makeRng } from '../../src/core/rng';
import { write } from './_util';

function powmod(b: bigint, e: bigint, m: bigint): bigint {
  let r = 1n;
  b %= m;
  while (e > 0n) {
    if (e & 1n) r = (r * b) % m;
    b = (b * b) % m;
    e >>= 1n;
  }
  return r;
}

function isProbablePrime(n: bigint): boolean {
  if (n < 2n) return false;
  for (const p of [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n]) {
    if (n === p) return true;
    if (n % p === 0n) return false;
  }
  let d = n - 1n,
    s = 0;
  while (d % 2n === 0n) {
    d /= 2n;
    s++;
  }
  // Deterministic bases are not known at this size; 20 fixed bases make an error astronomically unlikely.
  for (const a of [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n, 41n, 43n, 47n, 53n, 59n, 61n, 67n, 71n]) {
    let x = powmod(a, d, n);
    if (x === 1n || x === n - 1n) continue;
    let comp = true;
    for (let r = 1; r < s; r++) {
      x = (x * x) % n;
      if (x === n - 1n) {
        comp = false;
        break;
      }
    }
    if (comp) return false;
  }
  return true;
}

function randomPrime(digits: number, seed: number): bigint {
  const rng = makeRng(seed);
  let s = String(1 + rng.int(9));
  for (let i = 1; i < digits; i++) s += String(rng.int(10));
  let n = BigInt(s) | 1n;
  while (!isProbablePrime(n)) n += 2n;
  return n;
}

const p = randomPrime(50, 2048);
const q = randomPrime(50, 4096);
const N = 15,
  a = 7;
const seq = Array.from({ length: 13 }, (_, x) => modPow(a, x, N));
const r = multiplicativeOrder(a, N);
const half = modPow(a, r / 2, N);
const big = { N: 3127, a: 2, r: multiplicativeOrder(2, 3127), seq: Array.from({ length: 3200 }, (_, x) => modPow(2, x, 3127)) };
if (big.r !== 1508) throw new Error(`unexpected period ${big.r}`);

write('period', {
  primes: { p: p.toString(), q: q.toString(), product: (p * q).toString() },
  N,
  a,
  seq,
  r,
  half,
  gcds: [gcd(half - 1, N), gcd(half + 1, N)],
  big,
});
