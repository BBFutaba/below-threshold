// The narrated explainer film, with captions and chapter navigation.

import { useEffect, useRef, useState } from 'react';
import { ButtonLink, Card, Pill } from '../components/ui';
import { TeamLogo } from '../components/TeamLogo';
import s from './screen.module.css';
import css from './Film.module.css';

interface SceneEntry {
  id: string;
  chapter: string;
  /** Part of the story ("Part II · Shor's algorithm"); absent in older manifests. */
  part?: string;
  title: string;
  durationSec: number;
  filmStartSec: number;
}
interface Manifest {
  scenes: SceneEntry[];
  film: { mp4: string; poster: string; captions: string; durationSec: number; narrated: boolean } | null;
}

/** Where to try each chapter's idea in the app. */
const LEARN: Record<string, string> = {
  qubit: '/learn/phase',
  period: '/learn/period',
  qft: '/learn/qft',
  shor: '/learn/shor',
  noise: '/learn/noise',
  fragile: '/learn/no-cloning',
  parity: '/learn/syndrome',
  digital: '/learn/discretization',
  surface: '/bridge',
  matching: '/play',
  spacetime: '/realtime',
  threshold: '/lab',
  realtime: '/realtime',
};

const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

export function Film() {
  const [m, setM] = useState<Manifest | null>(null);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(0);
  const video = useRef<HTMLVideoElement>(null);
  const base = import.meta.env.BASE_URL;

  useEffect(() => {
    fetch(`${base}media/manifest.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: Manifest) => (j.film ? setM(j) : setFailed(true)))
      .catch(() => setFailed(true));
  }, [base]);

  const seek = (t: number) => {
    const v = video.current;
    if (!v) return;
    v.currentTime = t + 0.05;
    void v.play().catch(() => undefined);
  };
  const chapters = m?.scenes.filter((x) => x.chapter) ?? [];
  const current = chapters.filter((c) => c.filmStartSec <= now).at(-1)?.id;

  return (
    <div className={s.page}>
      <header className={css.head}>
        <div>
          <p className={s.eyebrow}>The film</p>
          <h1>Below Threshold, in {m?.film ? Math.round(m.film.durationSec / 60) : 'a few'} minutes</h1>
          <p className={s.lede}>
            A narrated explainer in the spirit of 3Blue1Brown and 2swap: what a qubit holds, how Shor&apos;s algorithm and the quantum Fourier transform factor a number,
            and, to close, how error correction keeps the machine alive long enough to do it. Every state, peak, lattice and curve on screen comes from the same
            simulation code as the app.
          </p>
        </div>
        <TeamLogo height={56} />
      </header>
      {failed && (
        <p className="muted">
          The film has not been built yet. Run <code>media/film_build.py</code>.
        </p>
      )}
      {m?.film && (
        <div className={css.layout}>
          <figure className={css.player}>
            <video
              ref={video}
              className={s.video}
              controls
              playsInline
              crossOrigin="anonymous"
              preload="metadata"
              poster={`${base}${m.film.poster}`}
              onTimeUpdate={(e) => setNow(e.currentTarget.currentTime)}
              aria-label="Below Threshold explainer film"
            >
              <source src={`${base}${m.film.mp4}`} type="video/mp4" />
              <track kind="captions" src={`${base}${m.film.captions}`} srcLang="en" label="English" default />
            </video>
            <figcaption className="faint" style={{ fontSize: '0.85rem', marginTop: 8 }}>
              {m.film.narrated ? 'Narrated by Team PhASE.' : 'Narration is being recorded; the captions carry the script for now.'}
            </figcaption>
          </figure>
          <Card title="Chapters">
            <ol className={css.chapters}>
              {chapters.map((c, i) => (
                <li key={c.id} data-current={current === c.id ? 1 : 0} data-part-start={c.part && c.part !== chapters[i - 1]?.part ? 1 : 0}>
                  {c.part && c.part !== chapters[i - 1]?.part && <span className={css.partHead}>{c.part}</span>}
                  <button onClick={() => seek(c.filmStartSec)} aria-label={`Play ${c.chapter}: ${c.title}`}>
                    <span className="mono faint">{mmss(c.filmStartSec)}</span>
                    <span>
                      <span className={css.chap}>{c.chapter}</span> {c.title}
                    </span>
                  </button>
                  {LEARN[c.id] && (
                    <ButtonLink to={LEARN[c.id]} small variant="ghost" aria-label={`Try ${c.title} in the app`}>
                      Try it
                    </ButtonLink>
                  )}
                </li>
              ))}
            </ol>
            <p className="faint" style={{ fontSize: '0.82rem', margin: '10px 0 0' }}>
              <Pill>{m.film.narrated ? 'narrated' : 'captions'}</Pill> The 1080p version and subtitles are in the repository under <code>docs/media/</code>.
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}
