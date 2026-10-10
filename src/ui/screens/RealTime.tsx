// Realistic noise and real-time decoding.
// Part 1: checks that lie (measurement errors) and the time stack.
// Part 2: syndrome rounds arrive on a clock; if the decoder is slower than the clock a
// backlog builds and logical operations that must wait for it stall.

import { useEffect, useMemo, useRef, useState } from 'react';
import { findStackPuzzle, type StackPuzzle } from '../../core/timeStack';
import { nodeInfo } from '../../core/decodingGraph';
import { makeRotatedSurfaceCode } from '../../core/surfaceCode';
import { makeRng } from '../../core/rng';
import { sampleNoise } from '../../core/noise';
import { applyPauli, cloneFrame, emptyFrame, logicalOutcome, multiply, syndrome, type Pauli, type PauliFrame } from '../../core/pauliFrame';
import { backlog, currentWait, newQueue, stepQueue, utilization, HARDWARE_ROUND_US, type QueueState } from '../../core/realtime';
import type { DecoderId } from '../../core/decoders/index';
import { checkCenter, edgeSegments, qubitPos } from '../components/latticeGeometry';
import { Lattice } from '../components/Lattice';
import { MediaClip } from '../components/MediaClip';
import { Button, ButtonLink, Card, GoalLine, Pill, Row, Segmented, Slider, WhatHappened, pct } from '../components/ui';
import { sim } from '../../workers/client';
import type { TimingResult } from '../../workers/sim.worker';
import { play } from '../sound';
import s from './screen.module.css';
import css from './RealTime.module.css';

type Tab = 'lie' | 'decoders' | 'human' | 'tune';

export function RealTime() {
  const [tab, setTab] = useState<Tab>('decoders');
  return (
    <div className={s.page}>
      <header className={s.header}>
        <p className={s.eyebrow}>Realistic noise and real-time decoding</p>
        <h1>Can a decoder keep up?</h1>
        <p className={s.lede}>
          Real superconducting chips run about one round of checks per <b>microsecond</b>. The decoder must keep pace, or a backlog builds and the computer
          stalls.
        </p>
      </header>
      <div style={{ marginBottom: 18 }}>
        <Segmented
          label="Section"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'lie', label: '1 · Checks that lie' },
            { value: 'decoders', label: '2 · Pick a decoder' },
            { value: 'human', label: '3 · You are the decoder' },
            { value: 'tune', label: '4 · Tune the machine' },
          ]}
        />
      </div>
      {tab === 'lie' && <ChecksThatLie />}
      {tab === 'decoders' && <PickDecoder />}
      {tab === 'human' && <HumanDecoder />}
      {tab === 'tune' && <TuneMachine />}
    </div>
  );
}

// =============================================================================== Part 1

function ChecksThatLie() {
  const [start, setStart] = useState(1);
  const puzzle = useMemo(() => findStackPuzzle(start), [start]);
  const [view, setView] = useState<'raw' | 'changes'>('changes');
  const [labels, setLabels] = useState<Record<number, 'qubit' | 'check'>>({});
  const [revealed, setRevealed] = useState(false);
  const allLabeled = puzzle.pairs.every((_, i) => labels[i]);
  const right = puzzle.pairs.filter((p, i) => labels[i] === p.kind).length;

  const next = () => {
    setStart(puzzle.seed + 1);
    setLabels({});
    setRevealed(false);
  };

  return (
    <div className={s.split}>
      <div className={s.canvas}>
        <div className={css.stackHead}>
          <Segmented
            label="Show"
            value={view}
            onChange={setView}
            options={[
              { value: 'raw', label: 'Raw check results' },
              { value: 'changes', label: 'Detection events (changes)' },
            ]}
          />
        </div>
        <TimeStack puzzle={puzzle} view={view} revealed={revealed} />
        <p className="faint" style={{ fontSize: '0.84rem', marginTop: 10 }}>
          Bit-flip noise, d = 3. Each round, every data qubit flips with probability 5% and every check result is misreported with probability 7%. The final
          readout measures the data directly, so it is perfect and closes the stack (as in real memory experiments). Seed {puzzle.seed}.
        </p>
      </div>
      <div className={s.panel}>
        <Card>
          <GoalLine>Label each numbered pair of detection events: a qubit error or a check that lied?</GoalLine>
          <p className="muted" style={{ fontSize: '0.92rem' }}>
            A <b>detection event</b> is a check whose result changed since the previous round. A data error lights a pair in the <b>same round</b>; a misreported
            check lights the <b>same check</b> in two consecutive rounds.
          </p>
          <div className={css.pairList}>
            {puzzle.pairs.map((p, i) => (
              <div key={i} className={css.pairRow} data-state={revealed ? (labels[i] === p.kind ? 'right' : 'wrong') : undefined}>
                <span className={css.badge}>{i + 1}</span>
                <Segmented
                  label={`Pair ${i + 1}`}
                  value={labels[i] ?? ('' as 'qubit')}
                  onChange={(v) => !revealed && setLabels((l) => ({ ...l, [i]: v }))}
                  options={[
                    { value: 'qubit', label: 'qubit error' },
                    { value: 'check', label: 'check error' },
                  ]}
                />
                {revealed && <span className="faint">{p.kind === 'qubit' ? 'qubit error' : 'check lied'}</span>}
              </div>
            ))}
          </div>
          <Row style={{ marginTop: 12 }}>
            {!revealed ? (
              <Button variant="primary" disabled={!allLabeled} onClick={() => (setRevealed(true), play(right === puzzle.pairs.length ? 'chime' : 'fail'))}>
                Show the decoder's space-time matching
              </Button>
            ) : (
              <Button variant="primary" onClick={next}>
                Another stack
              </Button>
            )}
          </Row>
        </Card>
        {revealed && (
          <WhatHappened
            tone={right === puzzle.pairs.length ? 'good' : 'warn'}
            deeper="The decoding graph is copied once per round. Space edges are data qubits; time edges join the same check in consecutive rounds and stand for a misreported result. Matching now happens across space and time."
          >
            You got {right} of {puzzle.pairs.length}. The decoder matched detection events in space <i>and time</i>: dashed paths inside a round are qubit errors; pairs
            on the same check one round apart (marked ↕) are checks that lied.
          </WhatHappened>
        )}
        {!revealed && (
          <WhatHappened title="Key idea">
            Because a check can lie, we repeat the checks every round and look for <b>changes</b>. Toggle “Raw check results” to see why: a single real error keeps
            its checks lit in every later round.
          </WhatHappened>
        )}
        <MediaClip id="spacetime" caption="From the film: the checks lie, so decoding moves into space and time." />
      </div>
    </div>
  );
}

function TimeStack({ puzzle, view, revealed }: { puzzle: StackPuzzle; view: 'raw' | 'changes'; revealed: boolean }) {
  const { code, graph: g, sample, pairs } = puzzle;
  const layers = puzzle.rounds + 1;
  const C = g.checks.length;
  const badges = (t: number) => {
    const out: { check: number; label: string; time: boolean }[] = [];
    pairs.forEach((p, i) => {
      for (const node of p.nodes) {
        if (node === g.boundary) continue;
        const ni = nodeInfo(g, node);
        if (ni.layer === t) out.push({ check: ni.check, label: String(i + 1), time: p.kind === 'check' });
      }
    });
    return out;
  };
  return (
    <div className={css.stack} role="list" aria-label="Time stack of check rounds">
      {Array.from({ length: layers }, (_, t) => {
        const synFull = view === 'raw' ? sample.measured[t] : sample.detections[t];
        const syn = new Uint8Array(code.stabilizers.length);
        for (const st of code.zChecks) syn[st] = synFull[st];
        const err = emptyFrame(code.n);
        if (revealed && t < puzzle.rounds) for (let q = 0; q < code.n; q++) if (sample.dataErrors[t].x[q]) err.x[q] = 1;
        const lied = revealed && t < puzzle.rounds ? code.zChecks.filter((st) => sample.measErrors[t][st]) : [];
        const segs = revealed ? edgeSegments(g, pairs.map((p) => p.edge), t) : undefined;
        return (
          <div key={t} className={css.layer} role="listitem">
            <div className={css.layerLabel}>{t < puzzle.rounds ? `Round ${t + 1}` : 'Final readout'}</div>
            <Lattice
              code={code}
              syndrome={syn}
              show="Z"
              errors={revealed ? err : null}
              paths={segs}
              maxWidth={260}
              label={`Round ${t + 1}`}
              overlay={
                <>
                  {view === 'changes' &&
                    badges(t).map((b, i) => {
                      const c = checkCenter(code, b.check);
                      return (
                        <g key={i}>
                          <circle cx={c.x + 17} cy={c.y - 17} r={14} className={css.badgeSvg} />
                          <text x={c.x + 17} y={c.y - 17} className={css.badgeText}>
                            {b.label}
                            {revealed && b.time ? '↕' : ''}
                          </text>
                        </g>
                      );
                    })}
                  {lied.map((st) => {
                    const c = checkCenter(code, st);
                    return (
                      <text key={st} x={c.x} y={c.y + 22} className={css.liedText}>
                        lied
                      </text>
                    );
                  })}
                </>
              }
            />
          </div>
        );
      })}
      <span className="visually-hidden">{`${C} checks per round`}</span>
    </div>
  );
}

// =============================================================================== Part 2: lanes

const LANE_DECODERS: { id: DecoderId; name: string; blurb: string }[] = [
  { id: 'mwpm', name: 'Exact matching (MWPM)', blurb: 'most accurate, slowest' },
  { id: 'unionFind', name: 'Union-find', blurb: 'fast, nearly as accurate' },
  { id: 'greedy', name: 'Greedy', blurb: 'fast, less accurate' },
];

const SPEEDUPS = [1, 10, 100, 1000];
const DISPLAY_ROUNDS_PER_SEC = 8;
const T_EVERY = 16;

function useMeasurements(d: number, p: number, ids: DecoderId[], samples: number) {
  const [res, setRes] = useState<Partial<Record<DecoderId, TimingResult>>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    setBusy(true);
    setRes({});
    (async () => {
      for (const id of ids) {
        const r = await sim().measure({ d, p, decoder: id, samples, seed: 77 + d * 100 });
        if (!alive) return;
        setRes((prev) => ({ ...prev, [id]: r }));
      }
      if (alive) setBusy(false);
    })();
    return () => {
      alive = false;
    };
  }, [d, p, ids.join(','), samples]); // eslint-disable-line react-hooks/exhaustive-deps
  return { res, busy };
}

function useClock(running: boolean, rate = DISPLAY_ROUNDS_PER_SEC) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000 / rate);
    return () => window.clearInterval(id);
  }, [running, rate]);
  return [tick, setTick] as const;
}

function PickDecoder() {
  const [d, setD] = useState(9);
  const [p, setP] = useState(0.03);
  const [speedup, setSpeedup] = useState(10);
  const [running, setRunning] = useState(false);
  const ids = useMemo(() => LANE_DECODERS.map((x) => x.id), []);
  const { res, busy } = useMeasurements(d, p, ids, 200);
  const [tick, setTick] = useClock(running);

  useEffect(() => {
    setTick(0);
  }, [d, p, speedup, setTick]);

  return (
    <div className={s.split}>
      <div className={s.canvas} style={{ display: 'grid', gap: 14 }}>
        <div className={css.clockLine}>
          <span className={css.clockDot} data-on={running ? 1 : 0} aria-hidden />
          <span>
            Round <b className="mono">{tick}</b>
          </span>
          <span className="faint">
            On screen {DISPLAY_ROUNDS_PER_SEC} rounds per second, {(1e6 / DISPLAY_ROUNDS_PER_SEC / HARDWARE_ROUND_US / 1000).toLocaleString()}k× slower than a real chip (≈ 1 µs per
            round)
          </span>
        </div>
        {LANE_DECODERS.map((dec) => (
          <Lane key={`${dec.id}-${d}-${p}-${speedup}`} name={dec.name} blurb={dec.blurb} timing={res[dec.id]} speedup={speedup} tick={tick} />
        ))}
        {busy && <p className="faint">Measuring decode times in your browser…</p>}
      </div>
      <div className={s.panel}>
        <Card>
          <GoalLine>Start the clock and watch which decoders keep up.</GoalLine>
          <Row>
            <Button variant="primary" onClick={() => setRunning((r) => !r)} disabled={busy && !running}>
              {running ? 'Pause' : tick ? 'Resume' : 'Start the clock'}
            </Button>
            <Button variant="ghost" onClick={() => setTick(0)}>
              Reset
            </Button>
          </Row>
        </Card>
        <Card title="Machine">
          <div className={s.stateGrid} style={{ gap: 14 }}>
            <Segmented label="Code distance" value={d} onChange={setD} options={[5, 7, 9].map((v) => ({ value: v, label: `d = ${v}` }))} />
            <Segmented label="Physical error rate" value={p} onChange={setP} options={[0.01, 0.02, 0.03].map((v) => ({ value: v, label: `p = ${v * 100}%` }))} />
            <div>
              <div className="muted" style={{ fontSize: '0.88rem', marginBottom: 6 }}>
                Decoder hardware speed-up
              </div>
              <Segmented
                label="Hardware speed-up"
                value={speedup}
                onChange={setSpeedup}
                options={SPEEDUPS.map((v) => ({ value: v, label: v === 1 ? 'browser ×1' : `×${v}` }))}
              />
            </div>
          </div>
        </Card>
        <WhatHappened title="Honest speed modeling" tone="info">
          Decode times are <b>measured in your browser right now</b> with performance.now on these exact settings, then divided by the hardware speed-up you choose
          (×1 means no assumption). The speed-up stands in for custom decoding hardware (FPGA or ASIC); it is a labeled assumption, not a measurement.
        </WhatHappened>
        {speedup === 1 && Object.keys(res).length === 3 && (
          <WhatHappened tone="warn">
            In plain browser JavaScript every decoder is slower than a real chip&apos;s 1 µs round. That is why companies build custom decoding hardware.
          </WhatHappened>
        )}
        <WhatHappened title="Aha" tone="good">
          Error correction isn&apos;t only about accuracy. A decoder that is right but too slow still stops the computer. That&apos;s why companies build custom decoding
          hardware.
        </WhatHappened>
      </div>
    </div>
  );
}

function Lane({ name, blurb, timing, speedup, tick }: { name: string; blurb: string; timing?: TimingResult; speedup: number; tick: number }) {
  const qRef = useRef<QueueState>(newQueue());
  const rngRef = useRef(makeRng(31));
  const lastTick = useRef(0);
  const [, force] = useState(0);

  useEffect(() => {
    if (tick === 0) {
      qRef.current = newQueue();
      lastTick.current = 0;
      force((x) => x + 1);
      return;
    }
    if (!timing) return;
    let q = qRef.current;
    while (lastTick.current < tick) {
      lastTick.current++;
      const sample = timing.perRoundUs[rngRef.current.int(timing.perRoundUs.length)] / speedup;
      q = stepQueue(q, sample, lastTick.current % T_EVERY === 0);
    }
    qRef.current = q;
    force((x) => x + 1);
  }, [tick, timing, speedup]);

  const q = qRef.current;
  const eff = timing ? timing.medianUs / speedup : NaN;
  const rho = timing ? utilization(timing.perRoundUs.map((x) => x / speedup)) : NaN;
  const keeping = rho < 1;
  const bl = backlog(q);
  const wait = currentWait(q);
  return (
    <div className={css.lane} data-state={timing ? (keeping ? 'ok' : 'behind') : 'idle'}>
      <div className={css.laneHead}>
        <div>
          <b>{name}</b> <span className="faint">· {blurb}</span>
        </div>
        {timing && <Pill tone={keeping ? 'green' : 'amber'}>{keeping ? 'keeping up' : 'falling behind'}</Pill>}
      </div>
      <div className={css.laneStats}>
        <span>
          measured <b className="mono">{timing ? fmtUs(timing.medianUs) : '…'}</b> per round
        </span>
        <span>
          with ×{speedup}: <b className="mono">{timing ? fmtUs(eff) : '…'}</b>
        </span>
        <span>
          logical error / round <b className="mono">{timing ? (timing.failures ? pct(timing.pLround, 2) : `< ${pct(1 / (timing.trials * 3), 2)}`) : '…'}</b>
        </span>
      </div>
      <BacklogMeter value={bl} />
      <div className={css.laneFoot}>
        <span>
          backlog <b className="mono">{bl}</b> round{bl === 1 ? '' : 's'}
        </span>
        <span style={{ color: wait > T_EVERY ? 'var(--amber)' : undefined }}>
          {q.tWaiting.length ? (
            <>
              T gate waiting <b className="mono">{wait}</b> rounds{wait > T_EVERY ? ' · computation stalled' : ''}
            </>
          ) : (
            <>T gates done: {q.tDone.length}</>
          )}
        </span>
      </div>
    </div>
  );
}

export function BacklogMeter({ value, cap = 48 }: { value: number; cap?: number }) {
  const shown = Math.min(value, cap);
  return (
    <div className={css.backlog} role="meter" aria-label="Backlog of undecoded rounds" aria-valuenow={value} aria-valuemin={0}>
      {Array.from({ length: shown }, (_, i) => (
        <span key={i} className={css.block} data-old={i < shown - 3 ? 1 : 0} />
      ))}
      {value > cap && <span className={css.more}>+{value - cap}</span>}
      {value === 0 && <span className="faint" style={{ fontSize: '0.8rem' }}>empty</span>}
    </div>
  );
}

function fmtUs(us: number): string {
  if (!Number.isFinite(us)) return '…';
  if (us < 1) return `${(us * 1000).toFixed(0)} ns`;
  if (us < 1000) return `${us.toFixed(us < 10 ? 2 : 0)} µs`;
  return `${(us / 1000).toFixed(1)} ms`;
}

// =============================================================================== Part 3: human

interface HumanRound {
  id: number;
  error: PauliFrame;
  arrivedAt: number;
}

function HumanDecoder() {
  const code = useMemo(() => makeRotatedSurfaceCode(3), []);
  const rng = useMemo(() => makeRng(8080), []);
  const [running, setRunning] = useState(false);
  const [queue, setQueue] = useState<HumanRound[]>([]);
  const [corr, setCorr] = useState<PauliFrame>(() => emptyFrame(code.n));
  const [stats, setStats] = useState({ arrived: 0, decoded: 0, failures: 0, totalMs: 0, empty: 0 });
  const [period, setPeriod] = useState(3000);
  const nextId = useRef(0);
  const MAX_BACKLOG = 8;
  const over = queue.length >= MAX_BACKLOG;

  useEffect(() => {
    if (!running || over) return;
    const id = window.setTimeout(() => {
      // A new round arrives: fresh bit-flip noise on top of corrected data (checks are perfect here).
      const smp = sampleNoise(code, { kind: 'bitflip', p: 0.07 }, rng);
      if (smp.kind !== 'codeCapacity') return;
      setStats((st) => ({ ...st, arrived: st.arrived + 1 }));
      if (!smp.syndrome.some((b) => b)) {
        setStats((st) => ({ ...st, empty: st.empty + 1, decoded: st.decoded + 1 }));
      } else {
        setQueue((q) => [...q, { id: nextId.current++, error: smp.error, arrivedAt: performance.now() }]);
        play('tick');
      }
      setPeriod((pp) => Math.max(900, pp * 0.94)); // the clock speeds up
    }, period);
    return () => window.clearTimeout(id);
  }, [running, period, over, code, rng, queue.length]);

  const head = queue[0];
  const syn = head ? syndrome(code, multiply(head.error, corr)) : new Uint8Array(code.stabilizers.length);
  const lit = syn.reduce((a, b) => a + b, 0);

  const onCorrect = (q: number, p: Pauli) => {
    if (!head) return;
    const n = cloneFrame(corr);
    applyPauli(n, q, p);
    setCorr(n);
  };
  const submit = () => {
    if (!head || lit > 0) return;
    const out = logicalOutcome(code, head.error, corr);
    const ms = performance.now() - head.arrivedAt;
    setStats((st) => ({ ...st, decoded: st.decoded + 1, failures: st.failures + (out.failed ? 1 : 0), totalMs: st.totalMs + ms }));
    setQueue((q) => q.slice(1));
    setCorr(emptyFrame(code.n));
    play(out.failed ? 'fail' : 'click');
  };
  const reset = () => {
    setRunning(false);
    setQueue([]);
    setCorr(emptyFrame(code.n));
    setStats({ arrived: 0, decoded: 0, failures: 0, totalMs: 0, empty: 0 });
    setPeriod(3000);
  };

  const humanDecoded = stats.decoded - stats.empty;
  const avgS = humanDecoded ? stats.totalMs / humanDecoded / 1000 : 0;
  return (
    <div className={s.split}>
      <div className={s.canvas}>
        <div className={css.clockLine}>
          <span className={css.clockDot} data-on={running && !over ? 1 : 0} aria-hidden />
          <span>
            A new round every <b className="mono">{(period / 1000).toFixed(1)} s</b> (and speeding up)
          </span>
        </div>
        <BacklogMeter value={queue.length} cap={MAX_BACKLOG} />
        <div style={{ marginTop: 12 }}>
          <Lattice code={code} syndrome={syn} corrections={corr} mode={head && running ? 'x' : 'none'} onCorrect={onCorrect} onSubmit={submit} label="Oldest undecoded round" maxWidth={380} />
        </div>
        {over && (
          <div className={`${s.banner} ${s.bannerWarn}`} role="alert">
            Backlog full: {queue.length} rounds waiting. The computer has stalled.
          </div>
        )}
      </div>
      <div className={s.panel}>
        <Card>
          <GoalLine>Decode each round before the next ones pile up.</GoalLine>
          <p className="muted" style={{ fontSize: '0.9rem' }}>
            Each round brings fresh bit-flip noise (7% per qubit). Rounds with no lit checks pass straight through. Tap qubits to clear the lit checks, then press
            Enter or Done.
          </p>
          <Row>
            {!running ? (
              <Button variant="primary" onClick={() => setRunning(true)} disabled={over}>
                {stats.arrived ? 'Resume' : 'Start the clock'}
              </Button>
            ) : (
              <Button onClick={() => setRunning(false)}>Pause</Button>
            )}
            <Button onClick={submit} disabled={!head || lit > 0}>
              Done with this round
            </Button>
            <Button variant="ghost" onClick={reset}>
              Reset
            </Button>
          </Row>
        </Card>
        <Card title="You vs a chip">
          <div className={css.vs}>
            <span>
              rounds arrived <b className="mono">{stats.arrived}</b>
            </span>
            <span>
              decoded <b className="mono">{stats.decoded}</b>
            </span>
            <span>
              logical errors <b className="mono">{stats.failures}</b>
            </span>
            <span>
              your time per round <b className="mono">{avgS ? `${avgS.toFixed(1)} s` : '–'}</b>
            </span>
            <span>
              a real chip <b className="mono">0.000001 s</b>
            </span>
          </div>
        </Card>
        {(over || stats.decoded > 6) && (
          <WhatHappened tone="warn">
            {avgS ? `At ${avgS.toFixed(1)} s per round you are about ${Math.round(avgS * 1e6).toLocaleString()} times too slow for real hardware. ` : ''}
            Humans fall behind quickly; so do software decoders, just a million times later.
          </WhatHappened>
        )}
      </div>
    </div>
  );
}

// =============================================================================== Part 4: tune

function TuneMachine() {
  const [d, setD] = useState(5);
  const [p, setP] = useState(0.01);
  const [logSpeed, setLogSpeed] = useState(1);
  const [decoder, setDecoder] = useState<DecoderId>('unionFind');
  const speedup = Math.round(10 ** logSpeed);
  const ids = useMemo(() => [decoder], [decoder]);
  const { res, busy } = useMeasurements(d, p, ids, 200);
  const [running, setRunning] = useState(true);
  const [tick, setTick] = useClock(running);
  useEffect(() => setTick(0), [d, p, speedup, decoder, setTick]);
  const t = res[decoder];
  const fast = t ? utilization(t.perRoundUs.map((x) => x / speedup)) < 1 : false;
  const target = 0.01;
  const accurate = t ? (t.failures ? t.pLround < target : true) : false;

  return (
    <div className={s.split}>
      <div className={s.canvas} style={{ display: 'grid', gap: 14 }}>
        <Lane name={LANE_DECODERS.find((x) => x.id === decoder)!.name} blurb={`d = ${d}, p = ${(p * 100).toFixed(1)}%`} timing={t} speedup={speedup} tick={tick} />
        <div className={css.verdict}>
          <div data-ok={accurate ? 1 : 0}>
            <span className={css.verdictMark}>{t ? (accurate ? '✓' : '✗') : '…'}</span>
            <div>
              <b>Accurate enough</b>
              <div className="faint">logical error per round below {pct(target, 0)}</div>
            </div>
          </div>
          <div data-ok={fast ? 1 : 0}>
            <span className={css.verdictMark}>{t ? (fast ? '✓' : '✗') : '…'}</span>
            <div>
              <b>Fast enough</b>
              <div className="faint">decoder time per round below 1 µs</div>
            </div>
          </div>
        </div>
        {t && accurate && fast && (
          <div className={`${s.banner} ${s.bannerGood}`} role="status">
            This machine keeps up and protects the qubit.
          </div>
        )}
        <MediaClip id="realtime" caption="From the film: the backlog problem, using measured decode times." />
      </div>
      <div className={s.panel}>
        <Card>
          <GoalLine>Find settings that are both accurate and fast enough.</GoalLine>
          <div className={s.stateGrid} style={{ gap: 14 }}>
            <Segmented label="Decoder" value={decoder} onChange={setDecoder} options={LANE_DECODERS.map((x) => ({ value: x.id, label: x.name.replace(' (MWPM)', '') }))} />
            <Slider label="Code distance d" value={d} min={3} max={11} step={2} onChange={setD} format={(v) => `d = ${v}`} />
            <Slider label="Physical error rate p" value={p} min={0.005} max={0.04} step={0.005} onChange={setP} format={(v) => `${(v * 100).toFixed(1)}%`} />
            <Slider
              label="Decoder hardware speed-up (assumed)"
              value={logSpeed}
              min={0}
              max={3}
              step={0.25}
              onChange={setLogSpeed}
              format={() => `×${speedup}`}
              hint="×1 is your browser as measured. Larger values stand in for custom hardware."
            />
            <Row>
              <Button onClick={() => setRunning((r) => !r)}>{running ? 'Pause clock' : 'Run clock'}</Button>
            </Row>
          </div>
        </Card>
        {busy && <p className="faint">Measuring {200} decodes in your browser…</p>}
        <WhatHappened title="What to notice">
          Bigger codes are more accurate below threshold but take longer to decode. Higher error rates create more detection events, which slows matching down
          most. Accuracy and speed pull against each other.
        </WhatHappened>
        <ButtonLink to="/lab">See the threshold in the lab →</ButtonLink>
      </div>
    </div>
  );
}

void qubitPos;
