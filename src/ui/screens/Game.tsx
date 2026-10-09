// Main game: protect a logical qubit on the surface code. Errors are hidden; only lit
// checks are visible. Clear every lit check, submit, then see what really happened and
// watch the decoder play the same puzzle.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LEVELS, decoderBatch, evaluate, hint as computeHint, liveSyndrome, makePuzzle, type Evaluation, type Puzzle } from '../../core/game';
import { applyPauli, cloneFrame, emptyFrame, type Pauli, type PauliFrame } from '../../core/pauliFrame';
import { edgeSegments, qubitPos } from '../components/latticeGeometry';
import { Lattice } from '../components/Lattice';
import { Button, ButtonLink, Card, GoalLine, Kbd, Pill, Row, WhatHappened, pct } from '../components/ui';
import { useApp } from '../../store/app';
import { play } from '../sound';
import s from './screen.module.css';
import css from './Game.module.css';

type Phase = 'playing' | 'revealed';

interface RunState {
  level: number;
  pos: number; // puzzle position within the level (0..puzzles-1)
  score: number;
  lives: number;
  over: boolean;
  won: boolean;
}

const START_LIVES = 3;

export function Game() {
  const params = useParams();
  const navigate = useNavigate();
  const startLevel = Math.min(7, Math.max(1, Number(params.level) || 1));
  const recordPuzzle = useApp((st) => st.recordPuzzle);
  const clearLevel = useApp((st) => st.clearLevel);
  const addScore = useApp((st) => st.addScore);
  const playerName = useApp((st) => st.playerName);
  const seenTwist = useApp((st) => st.seenTwist);
  const setSeenTwist = useApp((st) => st.setSeenTwist);
  const records = useApp((st) => st.puzzles);
  const levelsCleared = useApp((st) => st.levelsCleared);

  const [run, setRun] = useState<RunState>({ level: startLevel, pos: 0, score: 0, lives: START_LIVES, over: false, won: false });
  const seedK = useRef<Record<number, number>>({});
  const nextK = (level: number) => {
    const k = seedK.current[level] ?? 0;
    seedK.current[level] = k + 1;
    return k;
  };
  const [puzzle, setPuzzle] = useState<Puzzle>(() => makePuzzle(startLevel, nextK(startLevel)));
  const [corr, setCorr] = useState<PauliFrame>(() => emptyFrame(puzzle.code.n));
  const [history, setHistory] = useState<PauliFrame[]>([]);
  const [phase, setPhase] = useState<Phase>('playing');
  const [ev, setEv] = useState<Evaluation | null>(null);
  const [showDecoder, setShowDecoder] = useState(false);
  const [hinted, setHinted] = useState<number[]>([]);
  const [hintMsg, setHintMsg] = useState<string | null>(null);
  const [hints, setHints] = useState(0);
  const [touched, setTouched] = useState(false);
  const [twist, setTwist] = useState<{ saved: number; total: number; ms: number } | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [submitNote, setSubmitNote] = useState<string | null>(null);

  const cfg = LEVELS[run.level - 1];
  const syn = useMemo(() => liveSyndrome(puzzle, corr), [puzzle, corr]);
  const lit = syn.reduce((a, b) => a + b, 0);

  const loadPuzzle = useCallback((level: number) => {
    const p = makePuzzle(level, nextK(level));
    setPuzzle(p);
    setCorr(emptyFrame(p.code.n));
    setHistory([]);
    setPhase('playing');
    setEv(null);
    setShowDecoder(false);
    setHinted([]);
    setHintMsg(null);
    setHints(0);
    setSubmitNote(null);
    setTimeLeft(LEVELS[level - 1].timerSec ?? null);
  }, []);

  // Jumping to /play/:level starts a fresh run at that level.
  useEffect(() => {
    if (Number(params.level) && Number(params.level) !== run.level) {
      setRun({ level: startLevel, pos: 0, score: 0, lives: START_LIVES, over: false, won: false });
      loadPuzzle(startLevel);
    }
  }, [params.level]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (cfg.timerSec && timeLeft === null && phase === 'playing') setTimeLeft(cfg.timerSec);
  }, [cfg.timerSec, timeLeft, phase]);

  // Boss timer.
  useEffect(() => {
    if (phase !== 'playing' || timeLeft === null || run.over) return;
    if (timeLeft <= 0) {
      submit(true);
      return;
    }
    const id = window.setTimeout(() => setTimeLeft((t) => (t === null ? t : t - 1)), 1000);
    return () => window.clearTimeout(id);
  });

  const onCorrect = (q: number, p: Pauli) => {
    if (phase !== 'playing') return;
    setTouched(true);
    setHistory((h) => [...h, corr]);
    const next = cloneFrame(corr);
    applyPauli(next, q, p);
    const before = liveSyndrome(puzzle, corr).reduce((a, b) => a + b, 0);
    const after = liveSyndrome(puzzle, next).reduce((a, b) => a + b, 0);
    setCorr(next);
    setHinted([]);
    setHintMsg(null);
    setSubmitNote(null);
    play(after > before ? 'tick' : 'click');
  };

  const undo = () => {
    if (!history.length || phase !== 'playing') return;
    setCorr(history[history.length - 1]);
    setHistory((h) => h.slice(0, -1));
  };
  const reset = () => {
    if (phase !== 'playing') return;
    setHistory((h) => [...h, corr]);
    setCorr(emptyFrame(puzzle.code.n));
  };

  const useHint = () => {
    const h = computeHint(puzzle, corr);
    if (!h) return;
    setHints((n) => n + 1);
    setHinted(h.checks);
    setHintMsg(
      h.boundary
        ? 'This lit check most likely pairs with the edge of the lattice: an error on a qubit along the boundary. (−25 points)'
        : 'These two lit checks most likely share one error chain between them. (−25 points)',
    );
  };

  function submit(timeout = false) {
    if (phase !== 'playing') return;
    if (!timeout && lit > 0) {
      setSubmitNote(`${lit} check${lit > 1 ? 's are' : ' is'} still lit. Every check must be dark before you submit.`);
      return;
    }
    const e = evaluate(puzzle, corr, hints, timeLeft ?? 0);
    const saved = e.saved && !(timeout && lit > 0);
    const result: Evaluation = timeout && lit > 0 ? { ...e, saved: false, points: 0, unavoidable: false } : e;
    setEv(result);
    setPhase('revealed');
    recordPuzzle({ level: run.level, seed: puzzle.seed, humanSaved: saved, decoderSaved: e.decoder.saved });
    play(saved ? 'chime' : 'fail');
    setRun((r) => {
      let lives = r.lives;
      if (!saved && !result.unavoidable) lives -= 1;
      return { ...r, score: r.score + result.points, lives, over: lives <= 0 };
    });
    if (!saved && !seenTwist) triggerTwist();
  }

  const triggerTwist = () => {
    setTwist(decoderBatch(3, 1000));
    setSeenTwist();
  };

  const next = () => {
    if (!ev) return;
    if (run.over) return;
    const failed = !ev.saved && !ev.unavoidable;
    if (failed) {
      // A lost life resets the current level, not the run.
      setRun((r) => ({ ...r, pos: 0 }));
      loadPuzzle(run.level);
      return;
    }
    if (run.pos + 1 < cfg.puzzles) {
      setRun((r) => ({ ...r, pos: r.pos + 1 }));
      loadPuzzle(run.level);
      return;
    }
    clearLevel(run.level);
    if (run.level === 3 && !seenTwist) triggerTwist();
    if (run.level >= 7) {
      setRun((r) => ({ ...r, won: true, over: true }));
      return;
    }
    const nl = run.level + 1;
    setRun((r) => ({ ...r, level: nl, pos: 0 }));
    loadPuzzle(nl);
    navigate(`/play/${nl}`, { replace: true });
  };

  const restart = (level = 1) => {
    setRun({ level, pos: 0, score: 0, lives: START_LIVES, over: false, won: false });
    loadPuzzle(level);
    navigate(level === 1 ? '/play' : `/play/${level}`, { replace: true });
  };

  const saveScore = () => {
    const mine = records.filter((r) => r.level === 3);
    const humanRate = mine.length ? mine.filter((r) => r.humanSaved).length / mine.length : 0;
    addScore({ name: playerName || anonName(run.score), score: run.score, levels: levelsCleared.length, humanRate, date: new Date().toISOString() });
    navigate('/leaderboard');
  };

  // Decoder paths for the replay.
  const decoderPaths = useMemo(() => {
    if (!ev || !showDecoder) return undefined;
    const d = ev.decoder;
    return [...edgeSegments(d.graphs.X, d.results.X.edges), ...edgeSegments(d.graphs.Z, d.results.Z.edges)];
  }, [ev, showDecoder]);

  const humanStats = useMemo(() => {
    const l3 = records.filter((r) => r.level === 3);
    return { n: l3.length, rate: l3.length ? l3.filter((r) => r.humanSaved).length / l3.length : 0 };
  }, [records]);

  const ghost = run.level === 1 && run.pos === 0 && !touched && phase === 'playing';
  const ghostQ = ghost ? puzzle.error.x.findIndex((b) => b === 1) : -1;

  let card: { text: React.ReactNode; tone: 'good' | 'bad' | 'warn' | 'info'; deeper?: React.ReactNode } | null = null;
  if (phase === 'revealed' && ev) {
    if (ev.saved) {
      card = {
        tone: 'good',
        text: <>Qubit saved. Your fix plus the noise formed only harmless loops (stabilizers). +{ev.points} points.</>,
        deeper: <>The hidden errors (coral rings) times your corrections (blue) commute with both logical operators, so the stored information is unchanged. You used {ev.playerWeight} correction{ev.playerWeight === 1 ? '' : 's'}; the decoder used {ev.decoder.weight}.</>,
      };
    } else if (timeLeft !== null && timeLeft <= 0 && lit > 0) {
      card = { tone: 'bad', text: "Time's up with checks still lit. On a real machine, errors keep arriving while you think." };
    } else if (ev.unavoidable) {
      card = {
        tone: 'warn',
        text: <>Logical error, but the decoder failed on this one too, so no life lost. The most likely explanation of these checks was not what actually happened.</>,
        deeper: 'With more errors than the code can handle, some syndromes are genuinely ambiguous. That is why we need bigger codes and lower error rates.',
      };
    } else {
      card = {
        tone: 'bad',
        text: <>Logical error. Your fix plus the noise formed a chain from one edge to the other. That flips the stored information.</>,
        deeper: 'The coral-outlined qubits are the residual: error times correction. It has no lit checks but stretches across the lattice, which is exactly a logical operator.',
      };
    }
  }

  return (
    <div className={s.page}>
      <div className={s.statusBar} role="status" aria-label="Game status">
        <div className={s.statusGroup}>
          <span className={s.stat}>
            Level <b>{run.level}/7</b>
          </span>
          <span className={s.stat}>
            Puzzle <b>{Math.min(run.pos + 1, cfg.puzzles)}/{cfg.puzzles}</b>
          </span>
          <span className={s.stat}>
            Score <b>{run.score}</b>
          </span>
          <span className={s.stat} aria-label={`${run.lives} lives`}>
            Lives{' '}
            <span className={css.lives} aria-hidden>
              {Array.from({ length: START_LIVES }, (_, i) => (
                <span key={i} data-on={i < run.lives ? 1 : 0}>
                  ●
                </span>
              ))}
            </span>
          </span>
          {timeLeft !== null && phase === 'playing' && (
            <span className={s.stat}>
              Time <b style={{ color: timeLeft <= 10 ? 'var(--coral)' : undefined }}>{timeLeft}s</b>
            </span>
          )}
        </div>
        <div className={css.levelPick} role="group" aria-label="Jump to level">
          {LEVELS.map((l) => (
            <button key={l.level} aria-pressed={l.level === run.level} onClick={() => restart(l.level)} title={`Level ${l.level}: ${l.title}`} data-cleared={levelsCleared.includes(l.level) ? 1 : 0}>
              {l.level}
            </button>
          ))}
        </div>
      </div>

      <div className={s.split}>
        <div className={s.canvas}>
          <div className={css.latticeHead}>
            <Pill tone={lit ? 'amber' : 'green'}>{lit ? `${lit} lit check${lit > 1 ? 's' : ''}` : 'All checks dark'}</Pill>
            <span className="faint" style={{ fontSize: '0.85rem' }}>
              d = {cfg.d} · {cfg.errorsLabel} · {cfg.noiseLabel}
            </span>
          </div>
          <div style={{ position: 'relative' }}>
            <Lattice
              code={puzzle.code}
              syndrome={phase === 'revealed' && showDecoder ? new Uint8Array(puzzle.code.stabilizers.length) : syn}
              errors={phase === 'revealed' ? puzzle.error : null}
              corrections={phase === 'revealed' && showDecoder ? ev?.decoder.correction : corr}
              paths={decoderPaths}
              chain={phase === 'revealed' && ev && !ev.saved && !showDecoder ? ev.residual : undefined}
              hinted={hinted}
              flash={phase === 'revealed' && ev ? (ev.saved ? 'good' : 'bad') : null}
              mode={phase === 'playing' ? cfg.mode : 'none'}
              onCorrect={onCorrect}
              onSubmit={() => submit()}
              label="Game lattice"
              muteType={cfg.mode === 'x' ? 'X' : undefined}
              overlay={
                ghost && ghostQ >= 0 ? (
                  <g className={css.ghost} aria-hidden>
                    <circle className={css.ghostRing} cx={qubitPos(puzzle.code, ghostQ).x} cy={qubitPos(puzzle.code, ghostQ).y} r={22} />
                    <text className={css.ghostLabel} x={qubitPos(puzzle.code, ghostQ).x} y={qubitPos(puzzle.code, ghostQ).y + 38}>
                      tap
                    </text>
                  </g>
                ) : undefined
              }
              maxWidth={cfg.d === 3 ? 440 : cfg.d === 5 ? 540 : 620}
            />
          </div>
          {phase === 'revealed' && ev && !ev.saved && !showDecoder && (
            <div className={`${s.banner} ${s.bannerBad}`} role="alert">
              Logical error
            </div>
          )}
          <div className={s.legend}>
            <span className={s.legendItem}>
              <span className={s.swatch} style={{ background: 'var(--teal-fire)' }} /> Z-check (bit flips)
            </span>
            {cfg.mode === 'xyz' && (
              <span className={s.legendItem}>
                <span className={s.swatch} style={{ background: 'var(--violet-fire)' }} /> X-check (phase flips)
              </span>
            )}
            <span className={s.legendItem}>● lit = something is wrong nearby</span>
            <span className={s.legendItem}>
              <span className={s.swatch} style={{ background: 'var(--blue)', borderRadius: '50%' }} /> your correction
            </span>
            {phase === 'revealed' && (
              <span className={s.legendItem}>
                <span className={s.swatch} style={{ border: '2px solid var(--coral)', borderRadius: '50%' }} /> hidden error
              </span>
            )}
          </div>
        </div>

        <div className={s.panel}>
          <Card>
            <GoalLine step={run.level}>
              {phase === 'playing' ? 'Clear every glowing check without corrupting the qubit.' : 'See what really happened.'}
            </GoalLine>
            <p className="muted" style={{ margin: '-6px 0 12px', fontSize: '0.92rem' }}>
              {cfg.title}: {cfg.idea}
            </p>
            {phase === 'playing' ? (
              <>
                <p className="faint" style={{ fontSize: '0.86rem' }}>
                  {cfg.mode === 'x' ? (
                    <>Tap a qubit to flip it (X). Keyboard: arrows, <Kbd>X</Kbd>, <Kbd>Enter</Kbd>.</>
                  ) : (
                    <>Tap a qubit, then pick X (bit), Z (phase) or Y (both). Keyboard: arrows, <Kbd>X</Kbd> <Kbd>Z</Kbd> <Kbd>Y</Kbd>, <Kbd>Enter</Kbd>.</>
                  )}
                </p>
                <Row>
                  <Button variant="primary" onClick={() => submit()} aria-disabled={lit > 0}>
                    Submit
                  </Button>
                  <Button onClick={undo} disabled={!history.length}>
                    Undo
                  </Button>
                  <Button variant="ghost" onClick={reset}>
                    Reset
                  </Button>
                  <Button variant="ghost" onClick={useHint} disabled={lit === 0}>
                    Hint (−25)
                  </Button>
                </Row>
                {submitNote && (
                  <p className={css.note} role="alert">
                    {submitNote}
                  </p>
                )}
              </>
            ) : (
              <Row>
                {!run.over && (
                  <Button variant="primary" onClick={next}>
                    {ev && !ev.saved && !ev.unavoidable ? 'Retry level' : run.pos + 1 < cfg.puzzles ? 'Next puzzle' : run.level < 7 ? `Level ${run.level + 1} →` : 'Finish'}
                  </Button>
                )}
                <Button onClick={() => setShowDecoder((v) => !v)} aria-pressed={showDecoder}>
                  {showDecoder ? 'Show my fix' : 'Watch the decoder'}
                </Button>
              </Row>
            )}
          </Card>
          {hintMsg && phase === 'playing' && <WhatHappened title="Hint" tone="warn">{hintMsg}</WhatHappened>}
          {card && (
            <WhatHappened tone={card.tone} deeper={card.deeper}>
              {card.text}
            </WhatHappened>
          )}
          {phase === 'revealed' && ev && showDecoder && (
            <WhatHappened title="The decoder's turn" tone={ev.decoder.saved ? 'good' : 'bad'}>
              Exact matching (MWPM) paired the lit checks by the shortest total path (dashed lines) and {ev.decoder.saved ? 'saved the qubit' : ev.saved ? 'failed where you succeeded' : 'also failed'} with{' '}
              {ev.decoder.weight} correction{ev.decoder.weight === 1 ? '' : 's'}, in {ev.decoder.ms < 1 ? `${(ev.decoder.ms * 1000).toFixed(0)} µs` : `${ev.decoder.ms.toFixed(2)} ms`}.
              {!ev.decoder.saved && ' The shortest explanation is usually right, but not always: this puzzle has more errors than a distance-' + puzzle.code.d + ' code can always fix.'}
            </WhatHappened>
          )}
          {run.over && (
            <Card title={run.won ? 'You protected the qubit through all 7 levels' : 'Out of lives'}>
              <p>
                Final score <b className="mono">{run.score}</b>. Levels cleared: {levelsCleared.length}.
              </p>
              <Row>
                <Button variant="primary" onClick={saveScore}>
                  Save to leaderboard
                </Button>
                <Button onClick={() => restart(1)}>Play again</Button>
                <ButtonLink to="/realtime">Real-time mode →</ButtonLink>
              </Row>
            </Card>
          )}
        </div>
      </div>

      {twist && (
        <div className={css.twistBack} role="dialog" aria-modal="true" aria-label="The twist">
          <div className={css.twist}>
            <p className={s.eyebrow}>The twist</p>
            <h2>Machines decode better than us.</h2>
            <div className={css.twistStats}>
              <div>
                <span className={css.big}>{pct(twist.saved / twist.total, 1)}</span>
                <span className="muted">
                  of {twist.total.toLocaleString()} level-3 puzzles saved by the decoder, in {twist.ms < 1000 ? `${twist.ms.toFixed(0)} ms` : `${(twist.ms / 1000).toFixed(2)} s`}
                </span>
              </div>
              <div>
                <span className={css.big}>{humanStats.n ? pct(humanStats.rate, 0) : '–'}</span>
                <span className="muted">your level-3 success rate{humanStats.n ? ` (${humanStats.n} puzzle${humanStats.n > 1 ? 's' : ''})` : ' (not played yet)'}</span>
              </div>
            </div>
            <p>
              But real quantum computers produce these puzzles about a <b>million times per second</b>. Can a decoder keep up?
            </p>
            <Row>
              <ButtonLink to="/realtime" variant="primary">
                Find out in real-time mode →
              </ButtonLink>
              <Button onClick={() => setTwist(null)}>Keep playing</Button>
            </Row>
          </div>
        </div>
      )}
    </div>
  );
}

const ANIMALS = ['Otter', 'Heron', 'Lynx', 'Axolotl', 'Ibis', 'Marten', 'Puffin', 'Quokka', 'Gecko', 'Tapir', 'Okapi', 'Narwhal'];
function anonName(seed: number) {
  return `Anonymous ${ANIMALS[Math.abs(seed + Date.now()) % ANIMALS.length]}`;
}
