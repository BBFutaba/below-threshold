// Leaderboard and the human-vs-decoder statistic on identical seeded puzzles.

import { useEffect, useMemo, useState } from 'react';
import qrcode from 'qrcode-generator';
import { LEVELS } from '../../core/game';
import { useApp, type ScoreEntry } from '../../store/app';
import { cleanName, fetchShared, postShared, sharedEnabled } from '../leaderboardApi';
import { REPO_URL } from '../content';
import { Button, ButtonLink, Card, Pill, Row, pct } from '../components/ui';
import s from './screen.module.css';
import css from './Leaderboard.module.css';

export function Leaderboard() {
  const scores = useApp((st) => st.scores);
  const puzzles = useApp((st) => st.puzzles);
  const [shared, setShared] = useState<ScoreEntry[] | null>(null);
  const [sharedErr, setSharedErr] = useState(false);
  const [event, setEvent] = useState(false);

  useEffect(() => {
    if (!sharedEnabled) return;
    let alive = true;
    const load = () =>
      fetchShared()
        .then((r) => alive && (setShared(r), setSharedErr(false)))
        .catch(() => alive && setSharedErr(true));
    load();
    const id = window.setInterval(load, event ? 5000 : 30000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [event]);

  // Push local scores once to the shared board (if configured); failures are fine.
  useEffect(() => {
    if (!sharedEnabled || !scores.length) return;
    const k = 'bt-shared-posted';
    let posted: string[] = [];
    try {
      posted = JSON.parse(localStorage.getItem(k) ?? '[]');
    } catch {
      posted = [];
    }
    const todo = scores.filter((e) => !posted.includes(e.date));
    Promise.allSettled(todo.map(postShared)).then(() => {
      try {
        localStorage.setItem(k, JSON.stringify([...posted, ...todo.map((e) => e.date)]));
      } catch {
        /* storage unavailable */
      }
    });
  }, [scores]);

  const stats = useMemo(
    () =>
      LEVELS.map((l) => {
        const rs = puzzles.filter((p) => p.level === l.level);
        return {
          level: l.level,
          n: rs.length,
          human: rs.length ? rs.filter((r) => r.humanSaved).length / rs.length : 0,
          decoder: rs.length ? rs.filter((r) => r.decoderSaved).length / rs.length : 0,
        };
      }),
    [puzzles],
  );
  const l3 = stats[2];
  const board = shared && shared.length ? shared : scores;
  const url = typeof window !== 'undefined' ? `${window.location.origin}${import.meta.env.BASE_URL}play` : '';

  return (
    <div className={s.page}>
      <header className={s.header}>
        <p className={s.eyebrow}>Leaderboard</p>
        <h1>Humans vs the decoder</h1>
        <p className={s.lede}>Every puzzle comes from a seed, so humans and decoders are compared on exactly the same puzzles.</p>
      </header>
      <div className={s.split}>
        <div className={s.canvas} style={{ display: 'grid', gap: 18 }}>
          <div className={css.headline}>
            {l3.n ? (
              <>
                Players on this device solved <b>{pct(l3.human, 0)}</b> of level-3 puzzles; the decoder solved <b>{pct(l3.decoder, 0)}</b> of the same puzzles.
              </>
            ) : (
              <>Play level 3 to compare yourself with the decoder on identical puzzles.</>
            )}
          </div>
          <table className={css.table}>
            <caption className="visually-hidden">Success rate by level</caption>
            <thead>
              <tr>
                <th>Level</th>
                <th>Puzzles</th>
                <th>Humans saved</th>
                <th>Decoder saved (same seeds)</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((r) => (
                <tr key={r.level}>
                  <td>{r.level}</td>
                  <td className="mono">{r.n}</td>
                  <td className="mono">{r.n ? pct(r.human, 0) : '–'}</td>
                  <td className="mono">{r.n ? pct(r.decoder, 0) : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h2 style={{ marginTop: 6 }}>Top scores {shared && shared.length ? <Pill tone="blue">shared event board</Pill> : <Pill>this device</Pill>}</h2>
          {board.length ? (
            <ol className={css.scores}>
              {board.slice(0, 20).map((e, i) => (
                <li key={`${e.date}-${i}`}>
                  <span className={css.rank}>{i + 1}</span>
                  <span className={css.name}>{cleanName(e.name)}</span>
                  <span className="mono">{e.score}</span>
                  <span className="faint">{e.levels} levels</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted">No scores yet. Finish a run in the game to add yours.</p>
          )}
          {sharedEnabled && sharedErr && <p className="faint">The shared board is unreachable right now; showing this device only.</p>}
        </div>
        <div className={s.panel}>
          <Card title="Play">
            <Row>
              <ButtonLink to="/play" variant="primary">
                Play the game
              </ButtonLink>
              <Button onClick={() => setEvent((e) => !e)} aria-pressed={event}>
                {event ? 'Hide QR code' : 'Event mode (QR code)'}
              </Button>
            </Row>
          </Card>
          {event && (
            <Card title="Scan to play on your phone">
              <QR text={url} />
              <p className="mono faint" style={{ fontSize: '0.8rem', wordBreak: 'break-all' }}>
                {url}
              </p>
              {!sharedEnabled && <p className="faint" style={{ fontSize: '0.82rem' }}>Shared scores are off (no backend configured); each phone keeps its own board.</p>}
            </Card>
          )}
          <Card title="Share">
            <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
              {REPO_URL ? (
                <>
                  Code, tests and the validation report: <a href={REPO_URL}>{REPO_URL.replace(/^https?:\/\//, '')}</a> ·{' '}
                  <a href={`${REPO_URL}/blob/main/docs/writeup.md`}>technical write-up</a>
                </>
              ) : (
                <>The source, tests, validation report and technical write-up are in the project repository.</>
              )}
            </p>
          </Card>
          <Card title="Privacy">
            <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
              No emails or personal data. Names are optional (default: an anonymous animal) and filtered for profanity.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function QR({ text }: { text: string }) {
  const svg = useMemo(() => {
    const q = qrcode(0, 'M');
    q.addData(text);
    q.make();
    return q.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
  }, [text]);
  return <div className={css.qr} dangerouslySetInnerHTML={{ __html: svg }} role="img" aria-label={`QR code for ${text}`} />;
}
