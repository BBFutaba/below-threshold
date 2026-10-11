// Shared frame for the chapters: navigation (with a stepper across the three parts),
// optional 30-second primer, goal line, task list, the canvas/panel split and the "aha"
// card on completion.

import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CHAPTERS, PARTS, chapterBySlug, partById, type ChapterMeta } from '../../content';
import { useApp } from '../../../store/app';
import { ButtonLink, Button, GoalLine } from '../../components/ui';
import { play } from '../../sound';
import { MediaClip } from '../../components/MediaClip';
import s from '../screen.module.css';

export interface TaskItem {
  label: ReactNode;
  done: boolean;
}

export function ChapterFrame({
  meta,
  goal,
  tasks,
  canvas,
  panel,
  complete,
  primerFigure,
  clip,
}: {
  meta: ChapterMeta;
  goal: ReactNode;
  tasks: TaskItem[];
  canvas: ReactNode;
  panel: ReactNode;
  complete: boolean;
  primerFigure?: ReactNode;
  /** A chapter of the narrated film that covers the same idea. */
  clip?: { id: string; caption: string };
}) {
  const done = useApp((st) => st.completedChapters);
  const seen = useApp((st) => st.seenPrimers);
  const completeChapter = useApp((st) => st.completeChapter);
  const dismissPrimer = useApp((st) => st.dismissPrimer);

  useEffect(() => {
    if (complete && !done.includes(meta.slug)) {
      completeChapter(meta.slug);
      play('chime');
    }
  }, [complete, done, meta.slug, completeChapter]);

  const next = CHAPTERS.find((c) => c.n === meta.n + 1);
  const part = partById(meta.part);
  const nextPart = next && next.part !== meta.part ? partById(next.part) : null;
  const needsPrimer =
    !!meta.primer && !seen.includes(meta.slug) && (meta.helpfulFirst ?? []).some((h) => !done.includes(h)) && !done.includes(meta.slug);
  const helpful = (meta.helpfulFirst ?? []).map((h) => chapterBySlug(h)!);
  const activeIndex = tasks.findIndex((t) => !t.done);

  return (
    <div className={s.page}>
      <nav className={s.chapterNav} aria-label="Chapter navigation">
        <ButtonLink to="/learn" variant="ghost" small>
          ← Back to library
        </ButtonLink>
        <ChapterStepper current={meta.n} />
        {next ? (
          <ButtonLink to={`/learn/${next.slug}`} small variant={complete ? 'primary' : 'default'}>
            {nextPart ? `Next: ${nextPart.label}, ${next.title}` : `Next: ${next.title}`} →
          </ButtonLink>
        ) : (
          <ButtonLink to="/bridge" small variant={complete ? 'primary' : 'default'}>
            Next: to the surface code →
          </ButtonLink>
        )}
      </nav>

      <header className={s.header}>
        <p className={s.eyebrow}>
          {part.label} · {part.name} · Chapter {meta.n} of {CHAPTERS.length} · {meta.minutes}
        </p>
        <h1>{meta.title}</h1>
        <p className={s.question}>{meta.question}</p>
      </header>

      {needsPrimer && (
        <aside className={s.primer} aria-label="30-second primer">
          <strong>30-second primer</strong>
          <p style={{ margin: 0 }}>{meta.primer}</p>
          {primerFigure}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Button small onClick={() => dismissPrimer(meta.slug)}>
              Got it
            </Button>
            {helpful.map((h) => (
              <Link key={h.slug} to={`/learn/${h.slug}`} style={{ fontSize: '0.88rem' }}>
                Full chapter: {h.title}
              </Link>
            ))}
          </div>
        </aside>
      )}

      <GoalLine>{goal}</GoalLine>

      <div className={s.split}>
        <div className={s.canvas}>{canvas}</div>
        <div className={s.panel}>
          <ol className={s.tasks} aria-label="Tasks">
            {tasks.map((t, i) => (
              <li key={i} className={s.task} data-state={t.done ? 'done' : i === activeIndex ? 'active' : 'todo'}>
                <span className={s.taskMark} aria-hidden>
                  {t.done ? '✓' : i + 1}
                </span>
                <span>
                  <span className="visually-hidden">{t.done ? 'Done: ' : i === activeIndex ? 'Current task: ' : 'Upcoming: '}</span>
                  {t.label}
                </span>
              </li>
            ))}
          </ol>
          {panel}
          {complete && (
            <div className={s.aha} role="status">
              <h3>Aha</h3>
              <p>{meta.aha}</p>
            </div>
          )}
        </div>
      </div>
      {clip && (
        <section className={s.filmClip} aria-label="From the film">
          <h2 className={s.eyebrow}>Watch the idea · from the film</h2>
          <MediaClip id={clip.id} caption={clip.caption} />
        </section>
      )}
    </div>
  );
}

/** Dots for every chapter, grouped by part: where you are, what is done, one click to jump. */
export function ChapterStepper({ current }: { current: number }) {
  const done = useApp((st) => st.completedChapters);
  return (
    <ol className={s.stepper} aria-label="All chapters">
      {PARTS.map((p) => (
        <li key={p.id} className={s.stepperPart}>
          <span className={s.stepperLabel} aria-hidden>
            {p.label.replace('Part ', '')}
          </span>
          <ol>
            {CHAPTERS.filter((c) => c.part === p.id).map((c) => (
              <li key={c.slug}>
                <Link
                  to={`/learn/${c.slug}`}
                  className={s.stepperDot}
                  data-current={c.n === current ? 1 : 0}
                  data-done={done.includes(c.slug) ? 1 : 0}
                  aria-current={c.n === current ? 'step' : undefined}
                  title={`${p.label} · ${c.n}. ${c.title}`}
                  aria-label={`Chapter ${c.n}: ${c.title}${done.includes(c.slug) ? ' (completed)' : ''}`}
                >
                  {c.n}
                </Link>
              </li>
            ))}
          </ol>
        </li>
      ))}
    </ol>
  );
}

export function GatePalette({ gates, onGate, disabled }: { gates: { id: string; label: ReactNode; title: string }[]; onGate: (id: string) => void; disabled?: boolean }) {
  return (
    <div className={s.palette} role="group" aria-label="Gates">
      {gates.map((g) => (
        <button key={g.id} className={s.gateBtn} onClick={() => onGate(g.id)} disabled={disabled} title={g.title} aria-label={g.title}>
          {g.label}
        </button>
      ))}
    </div>
  );
}
