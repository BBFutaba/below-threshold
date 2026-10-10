// Main game: protect a logical qubit on the surface code while it runs Shor's algorithm.
// Errors are hidden; only lit checks ("alarms") are visible. Clear every alarm, submit,
// then see what really happened and watch the decoder play the same puzzle.
//
// Beginner support: a guided walkthrough on level 1, a plain-language guide for each level,
// live coaching after every move, alarms that show which qubits they watch on hover, and a
// progress bar for the Shor's algorithm run the player is keeping alive.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  LEVELS,
  decoderBatch,
  evaluate,
  hint as computeHint,
  liveSyndrome,
  makePuzzle,
  type Evaluation,
  type Puzzle,
} from '../../core/game';
import { applyPauli, cloneFrame, emptyFrame, type Pauli, type PauliFrame } from '../../core/pauliFrame';
import { edgeSegments, qubitPos } from '../components/latticeGeometry';
import { Lattice } from '../components/Lattice';
import { MediaClip } from '../components/MediaClip';
import { Button, ButtonLink, Card, Kbd, Pill, Row, WhatHappened, pct } from '../components/ui';
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
const TOTAL_ROUNDS = LEVELS.reduce((a, l) => a + l.puzzles, 0);
const roundsBefore = (level: number) => LEVELS.slice(0, level - 1).reduce((a, l) => a + l.puzzles, 0);

/** What each level adds, in plain words, and one tip. */
const GUIDE: Record<number, { what: string; tip: string }> = {
  1: {
    what: 'One qubit has flipped. It lights the teal alarms it touches: usually two, or just one when the qubit sits on the edge of the grid.',
    tip: 'Find the qubit that touches every lit alarm, and tap it.',
  },
  2: {
    what: 'Two qubits have flipped. Each lit alarm pairs up with another lit alarm, or with the edge of the grid.',
    tip: 'Fix one pair at a time. A lit alarm with no partner nearby means the flip sits on the edge.',
  },
  3: {
    what: 'Now the errors are random: one, two, sometimes more. You never know exactly how many.',
    tip: 'Pick the fewest flips that turn every alarm off. The simplest explanation is usually right.',
  },
  4: {
    what: 'New: phase flips. Violet alarms catch phase flips (Z); teal alarms catch bit flips (X). Two separate puzzles share one grid.',
    tip: 'Tap a qubit, then choose X for a teal problem or Z for a violet one.',
  },
  5: {
    what: 'New: Y errors, a bit flip and a phase flip at once. A Y lights both colors of alarm around one qubit.',
    tip: 'Teal and violet alarms lit around the same qubit? Try Y there.',
  },
  6: {
    what: 'A bigger grid (distance 7). More qubits means more errors, but it takes a longer chain of errors to corrupt the data.',
    tip: 'Work one cluster of alarms at a time.',
  },
  7: {
    what: 'Boss level: the same puzzle against a 45-second clock.',
    tip: 'On a real machine new errors arrive every microsecond, so speed matters. That is the real-time problem.',
  },
};

/** The guided first puzzle: what to look at, one step at a time. */
const INTRO: { title: string; body: ReactNode }[] = [
  {
    title: 'These circles are qubits',
    body: (
      <>
        Together they store <b>one protected qubit</b> of a quantum computer running Shor&apos;s algorithm. If
        too many of them go wrong in the wrong way, the computation crashes.
      </>
    ),
  },
  {
    title: 'The tiles are alarms',
    body: (
      <>
        Each tile watches the qubits at its corners (ringed in amber) and{' '}
        <b>lights up when an odd number of them flipped</b>. Hover over any tile to see which qubits it
        watches.
      </>
    ),
  },
  {
    title: 'Errors are invisible',
    body: (
      <>
        Looking at the qubits directly would destroy the stored information, so the errors stay hidden. All
        you get are the lit alarms.
      </>
    ),
  },
  {
    title: 'Your move',
    body: (
      <>
        <b>Tap the qubit you think flipped.</b> If you are right, its alarms switch off. Turn off every alarm,
        then press <b>Submit</b> to see what really happened.
      </>
    ),
  },
];

interface Move {
  before: number;
  after: number;
}

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
  const seenGameIntro = useApp((st) => st.seenGameIntro);
  const setSeenGameIntro = useApp((st) => st.setSeenGameIntro);
  const records = useApp((st) => st.puzzles);
  const levelsCleared = useApp((st) => st.levelsCleared);

  const [run, setRun] = useState<RunState>({
    level: startLevel,
    pos: 0,
    score: 0,
    lives: START_LIVES,
    over: false,
    won: false,
  });
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
  const [move, setMove] = useState<Move | null>(null);
  const [hoverCheck, setHoverCheck] = useState<number | null>(null);
  // The walkthrough opens on a first visit to level 1, and any time from "How to play".
  const [intro, setIntro] = useState<number | null>(() => (!seenGameIntro && startLevel === 1 ? 0 : null));

  const cfg = LEVELS[run.level - 1];
  const syn = useMemo(() => liveSyndrome(puzzle, corr), [puzzle, corr]);
  const lit = syn.reduce((a, b) => a + b, 0);
  const litChecks = useMemo(() => Array.from(syn).flatMap((b, i) => (b ? [i] : [])), [syn]);
  const guide = GUIDE[run.level];

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
    setMove(null);
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

  const finishIntro = () => {
    setIntro(null);
    setSeenGameIntro(true);
  };

  const onCorrect = (q: number, p: Pauli) => {
    if (phase !== 'playing') return;
    setTouched(true);
    if (intro !== null && intro < INTRO.length - 1) setIntro(INTRO.length - 1);
    setHistory((h) => [...h, corr]);
    const next = cloneFrame(corr);
    applyPauli(next, q, p);
    const before = liveSyndrome(puzzle, corr).reduce((a, b) => a + b, 0);
    const after = liveSyndrome(puzzle, next).reduce((a, b) => a + b, 0);
    setCorr(next);
    setMove({ before, after });
    setHinted([]);
    setHintMsg(null);
    setSubmitNote(null);
    play(after > before ? 'tick' : 'click');
  };

  const undo = () => {
    if (!history.length || phase !== 'playing') return;
    setCorr(history[history.length - 1]);
    setHistory((h) => h.slice(0, -1));
    setMove(null);
  };
  const reset = () => {
    if (phase !== 'playing') return;
    setHistory((h) => [...h, corr]);
    setCorr(emptyFrame(puzzle.code.n));
    setMove(null);
  };

  const useHint = () => {
    const h = computeHint(puzzle, corr);
    if (!h) return;
    setHints((n) => n + 1);
    setHinted(h.checks);
    setHintMsg(
      h.boundary
        ? 'This lit alarm most likely pairs with the edge of the grid: the flip is on a qubit along the boundary next to it. (−25 points)'
        : 'These two lit alarms most likely share one error, or a short chain of them, between them. (−25 points)',
    );
  };

  function submit(timeout = false) {
    if (phase !== 'playing') return;
    if (!timeout && lit > 0) {
      setSubmitNote(
        `${lit} alarm${lit > 1 ? 's are' : ' is'} still lit. Turn every alarm off before you submit.`,
      );
      return;
    }
    const e = evaluate(puzzle, corr, hints, timeLeft ?? 0);
    const saved = e.saved && !(timeout && lit > 0);
    const result: Evaluation = timeout && lit > 0 ? { ...e, saved: false, points: 0, unavoidable: false } : e;
    setEv(result);
    setPhase('revealed');
    if (intro !== null) finishIntro();
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
    addScore({
      name: playerName || anonName(run.score),
      score: run.score,
      levels: levelsCleared.length,
      humanRate,
      date: new Date().toISOString(),
    });
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

  // Shor's-run progress: one round of error correction survived per saved puzzle.
  const roundsDone = run.won
    ? TOTAL_ROUNDS
    : roundsBefore(run.level) +
      run.pos +
      (phase === 'revealed' && ev && (ev.saved || ev.unavoidable) ? 1 : 0);

  // Walkthrough highlights.
  const introQubits =
    intro === 0
      ? puzzle.code.dataQubits.map((_, q) => q)
      : intro === 1 && litChecks.length
        ? puzzle.code.stabilizers[litChecks[0]].support
        : undefined;
  const introChecks = intro === 1 && litChecks.length ? [litChecks[0]] : intro === 2 ? litChecks : [];

  const ghost =
    run.level === 1 &&
    run.pos === 0 &&
    !touched &&
    phase === 'playing' &&
    (intro === null || intro === INTRO.length - 1);
  const ghostQ = ghost ? puzzle.error.x.findIndex((b) => b === 1) : -1;

  // Live coaching: one plain sentence about the last move.
  let coach: { text: string; tone: 'good' | 'warn' | 'info' } | null = null;
  if (phase === 'playing') {
    if (lit === 0 && touched)
      coach = {
        tone: 'good',
        text: 'All alarms are off. Press Submit to see whether the stored qubit survived.',
      };
    else if (move) {
      const d = move.after - move.before;
      if (d <= -2) coach = { tone: 'good', text: `Nice: that turned off ${-d} alarms.` };
      else if (d === -1) coach = { tone: 'good', text: 'That turned off an alarm at the edge of the grid.' };
      else if (d === 0)
        coach = {
          tone: 'info',
          text: 'That moved an alarm instead of clearing it: you are tracing a chain. Keep following it toward another lit alarm or the edge.',
        };
      else
        coach = {
          tone: 'warn',
          text: `That lit ${d} new alarm${d > 1 ? 's' : ''}: probably not the right qubit. Undo, or try a neighbor.`,
        };
    } else if (!touched) coach = { tone: 'info', text: guide.tip };
  }
  const hovered = hoverCheck !== null ? puzzle.code.stabilizers[hoverCheck] : null;

  // On phones the walkthrough sits above the grid; on wide screens, at the top of the side panel.
  const introCard =
    intro === null ? null : (
      <section className={css.intro} aria-label="How to play" aria-live="polite">
        <div className={css.introHead}>
          <span className={s.eyebrow} style={{ margin: 0 }}>
            How to play · {intro + 1} of {INTRO.length}
          </span>
          <button className={css.introSkip} onClick={finishIntro}>
            Skip
          </button>
        </div>
        <h3>{INTRO[intro].title}</h3>
        <p>{INTRO[intro].body}</p>
        <div className={css.introDots} aria-hidden>
          {INTRO.map((_, i) => (
            <span key={i} data-on={i === intro ? 1 : 0} />
          ))}
        </div>
        <Row>
          {intro > 0 && (
            <Button small onClick={() => setIntro(intro - 1)}>
              Back
            </Button>
          )}
          {intro < INTRO.length - 1 ? (
            <Button small variant="primary" onClick={() => setIntro(intro + 1)}>
              Next
            </Button>
          ) : (
            <Button small variant="primary" onClick={finishIntro}>
              Got it, let me play
            </Button>
          )}
        </Row>
      </section>
    );

  let card: { text: ReactNode; tone: 'good' | 'bad' | 'warn' | 'info'; deeper?: ReactNode } | null = null;
  if (phase === 'revealed' && ev) {
    if (ev.saved) {
      card = {
        tone: 'good',
        text: (
          <>
            Qubit saved. Your fixes plus the hidden errors only formed harmless loops, so the stored
            information is untouched. +{ev.points} points.
          </>
        ),
        deeper: (
          <>
            The coral rings are the errors that really happened; blue is your fix. Wherever they differ, the
            difference closes into loops, which the code ignores. You used {ev.playerWeight} correction
            {ev.playerWeight === 1 ? '' : 's'}; the decoder used {ev.decoder.weight}.
          </>
        ),
      };
    } else if (timeLeft !== null && timeLeft <= 0 && lit > 0) {
      card = {
        tone: 'bad',
        text: "Time's up with alarms still lit. On a real machine, errors keep arriving while you think.",
      };
    } else if (ev.unavoidable) {
      card = {
        tone: 'warn',
        text: (
          <>
            The stored qubit flipped, but the decoder failed on this one too, so no life is lost. The most
            likely explanation of these alarms was not what actually happened.
          </>
        ),
        deeper:
          'With more errors than the code can handle, some alarm patterns are genuinely ambiguous. That is why we need bigger codes and lower error rates.',
      };
    } else {
      card = {
        tone: 'bad',
        text: (
          <>
            The stored qubit flipped: the Shor run would now give garbage. All alarms were off, but your fixes
            plus the errors made a chain from one edge of the grid to the other.
          </>
        ),
        deeper:
          'The coral-outlined qubits are the leftover (error plus fix). It lights no alarm, but it stretches across the grid, which is exactly what flips the stored bit.',
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
            Puzzle{' '}
            <b>
              {Math.min(run.pos + 1, cfg.puzzles)}/{cfg.puzzles}
            </b>
          </span>
          <span className={s.stat}>
            Score <b>{run.score}</b>
          </span>
          <span
            className={s.stat}
            aria-label={`${run.lives} lives`}
            title="You lose a life when the stored qubit flips (unless the decoder would have failed too)."
          >
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
        <div
          className={css.shorRun}
          title="Each puzzle you save is one round of error correction that the factoring computation survives."
        >
          <span className={css.shorLabel}>Shor run: factoring 15</span>
          <span
            className={css.shorTrack}
            role="progressbar"
            aria-label="Shor's algorithm run progress"
            aria-valuemin={0}
            aria-valuemax={TOTAL_ROUNDS}
            aria-valuenow={roundsDone}
          >
            <span className={css.shorFill} style={{ width: `${(100 * roundsDone) / TOTAL_ROUNDS}%` }} />
          </span>
          <span className="mono faint">
            {roundsDone}/{TOTAL_ROUNDS}
          </span>
        </div>
        <Row gap={6}>
          <Button small variant="ghost" onClick={() => setIntro(0)}>
            How to play
          </Button>
          <ButtonLink small variant="ghost" to="/leaderboard">
            Leaderboard
          </ButtonLink>
        </Row>
      </div>

      <nav className={css.levelPick} aria-label="Levels">
        {LEVELS.map((l) => (
          <button
            key={l.level}
            aria-pressed={l.level === run.level}
            onClick={() => restart(l.level)}
            title={`Level ${l.level}: ${l.title}. ${l.idea}`}
            data-cleared={levelsCleared.includes(l.level) ? 1 : 0}
          >
            <span className={css.levelNum}>{levelsCleared.includes(l.level) ? '✓' : l.level}</span>
            <span className={css.levelName}>{l.timerSec ? 'Boss round' : l.title}</span>
          </button>
        ))}
      </nav>

      {introCard && <div className={css.introMobile}>{introCard}</div>}

      <div className={s.split}>
        <div className={s.canvas}>
          <div className={css.latticeHead}>
            <Pill tone={lit ? 'amber' : 'green'}>
              {lit ? `${lit} alarm${lit > 1 ? 's' : ''} lit` : 'All alarms off'}
            </Pill>
            <span className="faint" style={{ fontSize: '0.85rem' }}>
              {cfg.errorsLabel} · {cfg.noiseLabel} · distance {cfg.d}
            </span>
          </div>
          <div style={{ position: 'relative' }}>
            <Lattice
              code={puzzle.code}
              syndrome={
                phase === 'revealed' && showDecoder ? new Uint8Array(puzzle.code.stabilizers.length) : syn
              }
              errors={phase === 'revealed' ? puzzle.error : null}
              corrections={phase === 'revealed' && showDecoder ? ev?.decoder.correction : corr}
              paths={decoderPaths}
              chain={phase === 'revealed' && ev && !ev.saved && !showDecoder ? ev.residual : undefined}
              hinted={introChecks.length ? introChecks : hinted}
              highlightQubits={introQubits}
              onHoverCheck={setHoverCheck}
              flash={phase === 'revealed' && ev ? (ev.saved ? 'good' : 'bad') : null}
              mode={phase === 'playing' ? cfg.mode : 'none'}
              onCorrect={onCorrect}
              onSubmit={() => submit()}
              label="Game lattice"
              muteType={cfg.mode === 'x' ? 'X' : undefined}
              overlay={
                ghost && ghostQ >= 0 ? (
                  <g className={css.ghost} aria-hidden>
                    <circle
                      className={css.ghostRing}
                      cx={qubitPos(puzzle.code, ghostQ).x}
                      cy={qubitPos(puzzle.code, ghostQ).y}
                      r={22}
                    />
                    <text
                      className={css.ghostLabel}
                      x={qubitPos(puzzle.code, ghostQ).x}
                      y={qubitPos(puzzle.code, ghostQ).y + 38}
                    >
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
              Logical error: the stored qubit flipped
            </div>
          )}
          <p className={css.coach} data-tone={hovered ? 'info' : (coach?.tone ?? 'info')} aria-live="polite">
            {hovered
              ? `${hovered.type === 'Z' ? 'Teal alarm: catches bit flips' : 'Violet alarm: catches phase flips'}. It watches the ${hovered.support.length} ringed qubits and lights up when an odd number of them ${hovered.type === 'Z' ? 'flipped' : 'had a phase flip'}.`
              : (coach?.text ??
                (phase === 'revealed' ? 'Coral rings show the errors that really happened.' : ''))}
          </p>
          <div className={s.legend}>
            <span className={s.legendItem}>
              <span className={s.swatch} style={{ background: 'var(--teal-fire)' }} /> Teal alarm: bit flips
            </span>
            {cfg.mode === 'xyz' && (
              <span className={s.legendItem}>
                <span className={s.swatch} style={{ background: 'var(--violet-fire)' }} /> Violet alarm: phase
                flips
              </span>
            )}
            <span className={s.legendItem}>● lit = something nearby went wrong</span>
            <span className={s.legendItem}>
              <span className={s.swatch} style={{ background: 'var(--blue)', borderRadius: '50%' }} /> your
              fix
            </span>
            {phase === 'revealed' && (
              <span className={s.legendItem}>
                <span
                  className={s.swatch}
                  style={{ border: '2px solid var(--coral)', borderRadius: '50%' }}
                />{' '}
                hidden error
              </span>
            )}
          </div>
        </div>

        <div className={s.panel}>
          {introCard && <div className={css.introDesk}>{introCard}</div>}

          <Card>
            <p className={s.eyebrow} style={{ marginBottom: 4 }}>
              Level {run.level} of 7
            </p>
            <h2 className={css.levelTitle}>{cfg.title}</h2>
            <p className={css.levelWhat}>{guide.what}</p>
            {phase === 'playing' ? (
              <>
                <p className="faint" style={{ fontSize: '0.86rem' }}>
                  {cfg.mode === 'x' ? (
                    <>
                      Tap a qubit to flip it back. Keyboard: arrows, <Kbd>X</Kbd>, <Kbd>Enter</Kbd>.
                    </>
                  ) : (
                    <>
                      Tap a qubit, then pick X (bit), Z (phase) or Y (both). Keyboard: arrows, <Kbd>X</Kbd>{' '}
                      <Kbd>Z</Kbd> <Kbd>Y</Kbd>, <Kbd>Enter</Kbd>.
                    </>
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
                {run.level <= 2 && (
                  <p className="faint" style={{ fontSize: '0.82rem', margin: '10px 0 0' }}>
                    New to this? <Link to="/learn/syndrome">The 2-minute chapter on alarms (syndromes)</Link>{' '}
                    explains the idea on 3 qubits.
                  </p>
                )}
              </>
            ) : (
              <Row>
                {!run.over && (
                  <Button variant="primary" onClick={next}>
                    {ev && !ev.saved && !ev.unavoidable
                      ? 'Retry level'
                      : run.pos + 1 < cfg.puzzles
                        ? 'Next puzzle'
                        : run.level < 7
                          ? `Level ${run.level + 1} →`
                          : 'Finish'}
                  </Button>
                )}
                <Button onClick={() => setShowDecoder((v) => !v)} aria-pressed={showDecoder}>
                  {showDecoder ? 'Show my fix' : 'Watch the decoder'}
                </Button>
              </Row>
            )}
          </Card>
          {hintMsg && phase === 'playing' && (
            <WhatHappened title="Hint" tone="warn">
              {hintMsg}
            </WhatHappened>
          )}
          {card && (
            <WhatHappened tone={card.tone} deeper={card.deeper}>
              {card.text}
            </WhatHappened>
          )}
          {phase === 'revealed' && ev && showDecoder && (
            <WhatHappened title="The decoder's turn" tone={ev.decoder.saved ? 'good' : 'bad'}>
              Exact matching (MWPM) paired the lit alarms by the shortest total path (dashed lines) and{' '}
              {ev.decoder.saved ? 'saved the qubit' : ev.saved ? 'failed where you succeeded' : 'also failed'}{' '}
              with {ev.decoder.weight} correction
              {ev.decoder.weight === 1 ? '' : 's'}, in{' '}
              {ev.decoder.ms < 1
                ? `${(ev.decoder.ms * 1000).toFixed(0)} µs`
                : `${ev.decoder.ms.toFixed(2)} ms`}
              .
              {!ev.decoder.saved &&
                ' The shortest explanation is usually right, but not always: this puzzle has more errors than a distance-' +
                  puzzle.code.d +
                  ' code can always fix.'}
            </WhatHappened>
          )}
          {phase === 'revealed' && showDecoder && (
            <Card title="How a decoder thinks">
              <MediaClip
                id="matching"
                caption="From the film: decoding as a matching problem, on a real seeded d = 5 puzzle (and one it gets wrong)."
              />
            </Card>
          )}
          {run.over && (
            <Card
              title={
                run.won ? 'You kept the Shor run alive: 15 = 3 × 5' : 'Out of lives: the computation crashed'
              }
            >
              <p>
                {run.won
                  ? `All ${TOTAL_ROUNDS} rounds of error correction survived, so the factoring finished. `
                  : `The run survived ${roundsDone} of ${TOTAL_ROUNDS} rounds. `}
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
                  of {twist.total.toLocaleString()} level-3 puzzles saved by the decoder, in{' '}
                  {twist.ms < 1000 ? `${twist.ms.toFixed(0)} ms` : `${(twist.ms / 1000).toFixed(2)} s`}
                </span>
              </div>
              <div>
                <span className={css.big}>{humanStats.n ? pct(humanStats.rate, 0) : '–'}</span>
                <span className="muted">
                  your level-3 success rate
                  {humanStats.n
                    ? ` (${humanStats.n} puzzle${humanStats.n > 1 ? 's' : ''})`
                    : ' (not played yet)'}
                </span>
              </div>
            </div>
            <p>
              But real quantum computers produce these puzzles about a <b>million times per second</b>. Can a
              decoder keep up?
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

const ANIMALS = [
  'Otter',
  'Heron',
  'Lynx',
  'Axolotl',
  'Ibis',
  'Marten',
  'Puffin',
  'Quokka',
  'Gecko',
  'Tapir',
  'Okapi',
  'Narwhal',
];
function anonName(seed: number) {
  return `Anonymous ${ANIMALS[Math.abs(seed + Date.now()) % ANIMALS.length]}`;
}
