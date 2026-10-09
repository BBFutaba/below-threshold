// Concept Library: pick any chapter, in any order. Nothing is locked.

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CHAPTERS, LIBRARY_TAGS, PATHS, chapterBySlug } from '../content';
import { useApp } from '../../store/app';
import { ButtonLink, Pill } from '../components/ui';
import s from './screen.module.css';
import css from './Library.module.css';

export function Library() {
  const done = useApp((st) => st.completedChapters);
  const [tag, setTag] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return CHAPTERS.filter((c) => (!tag || c.tags.includes(tag)) && (!needle || `${c.title} ${c.question} ${c.tags.join(' ')} ${c.slug} ${c.aha}`.toLowerCase().includes(needle)));
  }, [tag, q]);

  return (
    <div className={s.page}>
      <header className={s.header}>
        <p className={s.eyebrow}>Concept Library</p>
        <h1>Choose what to learn</h1>
        <p className={s.lede}>
          Six self-contained chapters, each one to two minutes on an exact quantum simulator. Play them in any order; the
          numbers are only a suggested path.
        </p>
      </header>

      <section aria-label="Suggested paths" className={css.paths}>
        {PATHS.map((p) => {
          const first = CHAPTERS.find((c) => c.n === p.chapters.find((n) => !done.includes(CHAPTERS[n - 1].slug)) ) ?? CHAPTERS[p.chapters[0] - 1];
          return (
            <Link key={p.name} to={`/learn/${first.slug}`} className={css.path}>
              <span className={css.pathName}>{p.name}</span>
              <span className={css.pathSteps}>
                {p.chapters.map((n) => (
                  <span key={n} className={css.step} data-done={done.includes(CHAPTERS[n - 1].slug) ? 1 : 0}>
                    {n}
                  </span>
                ))}
                {p.then && <span className="faint">then {p.then}</span>}
              </span>
            </Link>
          );
        })}
      </section>

      <div className={css.filters}>
        <div className={css.tags} role="group" aria-label="Filter by topic">
          <button aria-pressed={tag === null} onClick={() => setTag(null)}>
            All
          </button>
          {LIBRARY_TAGS.map((t) => (
            <button key={t} aria-pressed={tag === t} onClick={() => setTag(tag === t ? null : t)}>
              {t}
            </button>
          ))}
        </div>
        <input
          className={css.search}
          type="search"
          placeholder='Search ("phase", "copy"...)'
          aria-label="Search chapters"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <ul className={css.grid}>
        {list.map((c) => {
          const isDone = done.includes(c.slug);
          const helpful = c.helpfulFirst?.map((h) => chapterBySlug(h)!).filter((h) => !done.includes(h.slug));
          return (
            <li key={c.slug}>
              <Link to={`/learn/${c.slug}`} className={css.card} data-done={isDone ? 1 : 0}>
                <div className={css.cardTop}>
                  <span className={css.num}>{c.n}</span>
                  {isDone ? <Pill tone="green">✓ Completed</Pill> : <Pill>{c.difficulty}</Pill>}
                </div>
                <h2 className={css.cardTitle}>{c.title}</h2>
                <p className={css.question}>{c.question}</p>
                <div className={css.meta}>
                  <span>{c.minutes}</span>
                  <span>·</span>
                  <span>{c.tags.join(', ')}</span>
                </div>
                {helpful && helpful.length > 0 && <p className={css.helpful}>Helpful first: {helpful.map((h) => h.title).join(', ')}</p>}
              </Link>
            </li>
          );
        })}
        {list.length === 0 && <li className="muted">No chapter matches “{q}”.</li>}
      </ul>

      <section className={css.more} aria-label="Game and lab">
        <div>
          <h2>Ready to play?</h2>
          <p className="muted">The game, real-time mode and lab are always open. The chapters help but are never required.</p>
        </div>
        <div className={css.moreBtns}>
          <ButtonLink to="/bridge">From 3 qubits to the surface code</ButtonLink>
          <ButtonLink to="/play" variant="primary">
            Play the game
          </ButtonLink>
          <ButtonLink to="/realtime">Real-time mode</ButtonLink>
          <ButtonLink to="/lab">Threshold lab</ButtonLink>
        </div>
      </section>
    </div>
  );
}
