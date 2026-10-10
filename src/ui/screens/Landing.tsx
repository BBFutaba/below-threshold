// Landing: a live, softly animated lattice (real noise, real syndromes) behind the title,
// then the three-part story (qubits, Shor's algorithm, keeping it alive) and the tools.

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { makeRotatedSurfaceCode } from '../../core/surfaceCode';
import { makeRng } from '../../core/rng';
import { sampleNoise } from '../../core/noise';
import { Lattice } from '../components/Lattice';
import { ButtonLink, Card } from '../components/ui';
import { useApp } from '../../store/app';
import { CHAPTERS, PARTS } from '../content';
import { TeamLogo } from '../components/TeamLogo';
import css from './Landing.module.css';

export function Landing() {
  const code = useMemo(() => makeRotatedSurfaceCode(7), []);
  const rng = useMemo(() => makeRng(2026), []);
  const [syn, setSyn] = useState<Uint8Array>(() => new Uint8Array(code.stabilizers.length));
  const motion = useApp((s) => s.motion);
  const completed = useApp((s) => s.completedChapters.length);

  useEffect(() => {
    const reduced = motion === 'reduced' || (motion === 'system' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    const tick = () => {
      const s = sampleNoise(code, { kind: 'depolarizing', p: 0.035 }, rng);
      if (s.kind === 'codeCapacity') setSyn(s.syndrome);
    };
    tick();
    if (reduced) return;
    const id = window.setInterval(tick, 1600);
    return () => window.clearInterval(id);
  }, [code, rng, motion]);

  return (
    <div className={css.landing}>
      <div className={css.bg} aria-hidden>
        <Lattice code={code} syndrome={syn} maxWidth={760} label="Animated background lattice" />
      </div>
      <div className={css.hero}>
        <div className={css.byline}>
          <TeamLogo height={40} />
        </div>
        <p className={css.kicker}>An interactive guide to Shor&apos;s algorithm and quantum error correction</p>
        <h1 className={css.title}>Below Threshold</h1>
        <p className={css.sentence}>Factor a number with a quantum computer. Then keep it alive long enough to do it.</p>
        <div className={css.ctas}>
          <ButtonLink to={completed ? '/learn' : '/learn/superposition'} variant="primary">
            {completed ? 'Continue the story' : 'Start the story'}
          </ButtonLink>
          <ButtonLink to="/learn/qft">Try the QFT</ButtonLink>
          <ButtonLink to="/play">Jump to the game</ButtonLink>
          <ButtonLink to="/film">▶ Watch the film</ButtonLink>
        </div>
        <p className={css.note}>
          Every check that lights up behind this text is a real syndrome from simulated noise on a distance-7 surface code.
        </p>
      </div>
      <section className={css.story} aria-label="The story in three parts">
        {PARTS.map((p) => {
          const chs = CHAPTERS.filter((c) => c.part === p.id);
          return (
            <Link key={p.id} to={`/learn/${chs[0].slug}`} className={css.part} data-part={p.id}>
              <span className={css.partLabel}>{p.label}</span>
              <span className={css.partName}>{p.name}</span>
              <span className={css.partBlurb}>{p.blurb}</span>
              <span className={css.partChapters}>{chs.map((c) => c.title.split(':')[0]).join(' · ')}</span>
            </Link>
          );
        })}
      </section>
      <div className={css.cards}>
        <Card title="Play">
          <p>Errors are hidden; only alarms light up, like on real hardware. A guided first level teaches you in a minute.</p>
        </Card>
        <Card title="Real-time">
          <p>Alarms arrive on a clock. A decoder that is right but too slow still stops the computer.</p>
        </Card>
        <Card title="Lab">
          <p>Run Monte Carlo experiments live and watch the threshold appear: below it, bigger codes win.</p>
        </Card>
        <Card title="Film">
          <p>A narrated tour from qubits through Shor&apos;s algorithm to error correction, drawn from the same simulations.</p>
        </Card>
      </div>
    </div>
  );
}
