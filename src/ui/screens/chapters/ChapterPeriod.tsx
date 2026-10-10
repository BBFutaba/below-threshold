// Chapter 3: Factoring is a hunt for rhythm. Plot a^x mod N, find where it repeats, then
// turn the period into factors with two gcds. Entirely classical: this is the reduction
// Shor's algorithm relies on, and the period is the one step a quantum computer speeds up.

import { useMemo, useState } from 'react';
import { coprimeBases, gcd, modPow, multiplicativeOrder } from '../../../core/shor';
import { chapterBySlug } from '../../content';
import { Button, Card, Row, Segmented, WhatHappened } from '../../components/ui';
import { ChapterFrame } from './ChapterFrame';
import s from '../screen.module.css';
import css from './Shor.module.css';

const meta = chapterBySlug('period')!;
const NS = [15, 21, 35] as const;
const DEFAULT_A: Record<number, number> = { 15: 7, 21: 2, 35: 2 };

type Recipe = { status: 'ok'; half: number; f1: number; f2: number } | { status: 'odd' } | { status: 'trivial'; half: number };

function recipe(N: number, a: number, r: number): Recipe {
  if (r % 2) return { status: 'odd' };
  const half = modPow(a, r / 2, N);
  if (half === N - 1) return { status: 'trivial', half };
  return { status: 'ok', half, f1: gcd(half - 1, N), f2: gcd(half + 1, N) };
}

export function ChapterPeriod() {
  const [N, setN] = useState<number>(15);
  const [a, setA] = useState(7);
  const [picked, setPicked] = useState<number | null>(null);
  const [found, setFound] = useState(false);
  const [applied, setApplied] = useState(false);
  const [done, setDone] = useState([false, false, false, false]);
  const [msg, setMsg] = useState<{ text: string; tone?: 'good' | 'bad' | 'info' | 'warn'; deeper?: string } | null>(null);
  const mark = (i: number) => setDone((d) => d.map((v, j) => (j === i ? true : v)));

  const r = useMemo(() => multiplicativeOrder(a, N), [a, N]);
  const X = Math.min(36, 3 * r + 1);
  const seq = useMemo(() => Array.from({ length: X }, (_, x) => modPow(a, x, N)), [a, N, X]);
  const rec = recipe(N, a, r);
  const factor = rec.status === 'ok' ? (rec.f1 > 1 && rec.f1 < N ? rec.f1 : rec.f2) : 0;

  const choose = (n: number, base: number) => {
    setN(n);
    setA(base);
    setPicked(null);
    setFound(false);
    setApplied(false);
    setMsg(null);
  };

  const pick = (x: number) => {
    if (x === 0) return;
    setPicked(x);
    if (seq[x] !== 1) {
      setMsg({ text: `${a}^${x} mod ${N} = ${seq[x]}, not 1 yet. Look for the first place the pattern starts over at 1.`, tone: 'info' });
      return;
    }
    if (x !== r) {
      setMsg({ text: `That is back to 1, but the pattern already repeated earlier. Find the first return.`, tone: 'warn' });
      return;
    }
    setFound(true);
    if (N === 15 && a === 7) mark(0);
    setMsg({
      tone: 'good',
      text: `The period is r = ${r}: ${seq.slice(0, r).join(', ')}, then it starts over. Now use the recipe.`,
      deeper: `aʳ ≡ 1 (mod N) means aʳ − 1 = (a^(r/2) − 1)(a^(r/2) + 1) is a multiple of N, so each bracket probably shares a factor with N.`,
    });
  };

  const apply = () => {
    setApplied(true);
    if (rec.status === 'ok') {
      if (N === 15) mark(1);
      if (N === 21) mark(2);
      setMsg({ tone: 'good', text: `${N} = ${Math.min(factor, N / factor)} × ${Math.max(factor, N / factor)}. Two gcds, which are fast even for huge numbers, split ${N} once the period was known.` });
    } else {
      mark(3);
      setMsg({
        tone: 'warn',
        text:
          rec.status === 'odd'
            ? `r = ${r} is odd, so a^(r/2) is not a whole number and the recipe cannot start. Real runs just pick another a.`
            : `${a}^(r/2) ≡ ${N - 1} ≡ −1 (mod ${N}), so the gcds return only 1 and ${N}. An unlucky base; pick another.`,
        deeper: 'For a random base this happens at most half of the time, so a few tries are enough.',
      });
    }
  };

  // Plot geometry.
  const W = 600,
    H = 210,
    padL = 34,
    padB = 26,
    padT = 10;
  const px = (x: number) => padL + (x / (X - 1)) * (W - padL - 14);
  const py = (v: number) => padT + (1 - v / N) * (H - padT - padB);

  const tasks = [
    { label: <>For <b>N = 15, a = 7</b>: click the first x after 0 where the pattern is back at 1.</>, done: done[0] },
    { label: <>Apply the recipe to split <b>15</b>.</>, done: done[1] },
    { label: <>Factor <b>21</b> the same way (find its period first).</>, done: done[2] },
    { label: <>Find a base <b>a</b> where the recipe fails.</>, done: done[3] },
  ];

  return (
    <ChapterFrame
      meta={meta}
      clip={{ id: 'period', caption: 'From the film: factoring becomes a hunt for a period.' }}
      goal="Turn factoring into finding a repeating pattern."
      tasks={tasks}
      complete={done.every(Boolean)}
      canvas={
        <div className={s.stateGrid}>
          <Card title={`The pattern ${a}ˣ mod ${N}`}>
            <svg viewBox={`0 0 ${W} ${H}`} className={css.plot} role="img" aria-label={`Plot of ${a} to the x mod ${N} for x = 0 to ${X - 1}: ${seq.join(', ')}`}>
              <line className={css.axis} x1={padL} x2={W - 8} y1={H - padB} y2={H - padB} />
              <line className={css.axis} x1={padL} x2={padL} y1={padT} y2={H - padB} />
              <line className={css.oneLine} x1={padL} x2={W - 8} y1={py(1)} y2={py(1)} />
              <text className={css.axisText} x={padL - 6} y={py(1) + 4} textAnchor="end">
                1
              </text>
              <text className={css.axisText} x={padL - 6} y={py(N - 1) + 4} textAnchor="end">
                {N - 1}
              </text>
              {found &&
                Array.from({ length: Math.floor((X - 1) / r) }, (_, k) => (
                  <rect key={k} className={css.periodBand} data-odd={k % 2} x={px(k * r)} y={padT} width={px(r) - px(0)} height={H - padT - padB} />
                ))}
              <polyline className={css.seqLine} points={seq.map((v, x) => `${px(x)},${py(v)}`).join(' ')} />
              {seq.map((v, x) => (
                <g key={x} className={css.dotG} onClick={() => pick(x)} role="button" tabIndex={x === 0 ? -1 : 0} aria-label={`x = ${x}: ${v}`} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), pick(x))}>
                  <circle className={css.hit} cx={px(x)} cy={py(v)} r={11} />
                  <circle className={css.dot} data-one={v === 1 ? 1 : 0} data-picked={picked === x ? 1 : 0} cx={px(x)} cy={py(v)} r={5} />
                  {(x % (X > 24 ? 4 : 2) === 0 || x === picked) && (
                    <text className={css.axisText} x={px(x)} y={H - 8} textAnchor="middle">
                      {x}
                    </text>
                  )}
                </g>
              ))}
            </svg>
            <p className={css.seqRow} aria-hidden>
              {seq.map((v, x) => (
                <span key={x} data-first={found && x < r ? 1 : 0} data-one={v === 1 ? 1 : 0}>
                  {v}
                </span>
              ))}
              <span>…</span>
            </p>
          </Card>
          {found && (
            <Card title="The recipe: from the period to the factors">
              <ol className={css.recipe}>
                <li data-ok={r % 2 === 0 ? 1 : 0}>
                  Is r = {r} even? <b>{r % 2 === 0 ? 'Yes' : 'No: stop, pick another a'}</b>
                </li>
                {applied && rec.status !== 'odd' && (
                  <li>
                    a<sup>r/2</sup> mod N = {a}
                    <sup>{r / 2}</sup> mod {N} = <b className="mono">{rec.half}</b>
                    {rec.status === 'trivial' && <> ≡ −1: unlucky, the gcds below are trivial</>}
                  </li>
                )}
                {applied && rec.status !== 'odd' && (
                  <li>
                    gcd({rec.half} − 1, {N}) = <b className="mono">{gcd(rec.half - 1, N)}</b> and gcd({rec.half} + 1, {N}) = <b className="mono">{gcd(rec.half + 1, N)}</b>
                  </li>
                )}
                {applied && rec.status === 'ok' && (
                  <li data-ok={1}>
                    <b>
                      {N} = {Math.min(factor, N / factor)} × {Math.max(factor, N / factor)}
                    </b>
                  </li>
                )}
              </ol>
              {!applied && (
                <Button variant="primary" onClick={apply}>
                  Apply the recipe
                </Button>
              )}
            </Card>
          )}
        </div>
      }
      panel={
        <>
          <Card title="Pick a number and a base">
            <Segmented label="Number to factor" value={N} onChange={(n) => choose(n, DEFAULT_A[n])} options={NS.map((n) => ({ value: n, label: `N = ${n}` }))} />
            <div className={css.bases} role="group" aria-label="Base a">
              {coprimeBases(N).map((b) => (
                <button key={b} aria-pressed={b === a} onClick={() => choose(N, b)}>
                  {b}
                </button>
              ))}
            </div>
            <p className="faint" style={{ fontSize: '0.82rem', margin: '8px 0 0' }}>
              Bases that share a factor with N are left out: gcd(a, N) would give the answer away for free.
            </p>
            <Row style={{ marginTop: 10 }}>
              <Button variant="ghost" small onClick={() => choose(N, a)}>
                Clear
              </Button>
            </Row>
          </Card>
          {msg && (
            <WhatHappened tone={msg.tone} deeper={msg.deeper}>
              {msg.text}
            </WhatHappened>
          )}
          <Card title="Why this is hard for big numbers">
            <p style={{ margin: 0, fontSize: '0.92rem' }}>
              Encryption like RSA multiplies two primes hundreds of digits long. Multiplying is instant; splitting the product is not. The period of aˣ mod N
              can be about as large as N itself, so walking the pattern step by step would take longer than the age of the universe. A quantum computer
              finds r without walking it: that is the next two chapters.
            </p>
          </Card>
        </>
      }
    />
  );
}
