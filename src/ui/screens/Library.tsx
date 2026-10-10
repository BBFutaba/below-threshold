// Concept Library: the chapters in three parts (qubits, Shor's algorithm, error correction).
// Pick any chapter, in any order. Nothing is locked.

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CHAPTERS, LIBRARY_TAGS, PARTS, PATHS, chapterBySlug } from '../content';
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
          Eleven short, hands-on chapters on an exact quantum simulator, in three parts: what a qubit holds, how Shor&apos;s
          algorithm factors numbers with the quantum Fourier transform, and how error correction keeps the machine alive long
          enough to run it. No background needed; play them in any order.
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

      {PARTS.map((part) => {
        const inPart = list.filter((c) => c.part === part.id);
        if (!inPart.length) return null;
        return (
          <section key={part.id} className={css.part} aria-labelledby={`part-${part.id}`}>
            <header className={css.partHead}>
              <span className={css.partLabel}>{part.label}</span>
              <h2 id={`part-${part.id}`}>{part.name}</h2>
              <p className="muted">{part.blurb}</p>
            </header>
            <ul className={css.grid}>
              {inPart.map((c) => {
                const isDone = done.includes(c.slug);
                const helpful = c.helpfulFirst?.map((h) => chapterBySlug(h)!).filter((h) => !done.includes(h.slug));
                return (
                  <li key={c.slug}>
                    <Link to={`/learn/${c.slug}`} className={css.card} data-done={isDone ? 1 : 0} data-star={c.slug === 'qft' ? 1 : 0}>
                      <div className={css.cardTop}>
                        <span className={css.num}>{c.n}</span>
                        {isDone ? <Pill tone="green">✓ Completed</Pill> : c.slug === 'qft' ? <Pill tone="violet">Featured</Pill> : <Pill>{c.difficulty}</Pill>}
                      </div>
                      <h3 className={css.cardTitle}>{c.title}</h3>
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
            </ul>
          </section>
        );
      })}
      {list.length === 0 && <p className="muted">No chapter matches “{q}”.</p>}

      <section className={css.more} aria-label="Game and lab">
        <div>
          <h2>Ready to play?</h2>
          <p className="muted">The game, real-time mode and lab are always open. Part III helps but is never required.</p>
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
