// Landing: a live, softly animated lattice (real noise, real syndromes) behind the title.

import { useEffect, useMemo, useState } from 'react';
import { makeRotatedSurfaceCode } from '../../core/surfaceCode';
import { makeRng } from '../../core/rng';
import { sampleNoise } from '../../core/noise';
import { Lattice } from '../components/Lattice';
import { ButtonLink, Card } from '../components/ui';
import { useApp } from '../../store/app';
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
        <p className={css.kicker}>An interactive guide to quantum error correction</p>
        <h1 className={css.title}>Below Threshold</h1>
        <p className={css.sentence}>Keep a quantum computer alive.</p>
        <div className={css.ctas}>
          <ButtonLink to={completed ? '/learn' : '/learn/superposition'} variant="primary">
            {completed ? 'Continue the story' : 'Start the story'}
          </ButtonLink>
          <ButtonLink to="/play">Jump to the game</ButtonLink>
          <ButtonLink to="/learn" variant="ghost">
            Pick a concept
          </ButtonLink>
        </div>
        <p className={css.note}>
          Every check that lights up behind this text is a real syndrome from simulated noise on a distance-7 surface code.
        </p>
      </div>
      <div className={css.cards}>
        <Card title="Learn">
          <p>Six one-minute chapters on a real quantum simulator: superposition to error discretization.</p>
        </Card>
        <Card title="Play">
          <p>Errors are hidden. Only the checks light up, just like real hardware. Then watch a decoder play.</p>
        </Card>
        <Card title="Real-time">
          <p>Syndromes arrive on a clock. A decoder that is right but too slow still stops the computer.</p>
        </Card>
        <Card title="Lab">
          <p>Run Monte Carlo experiments live and watch the threshold appear: below it, bigger codes win.</p>
        </Card>
      </div>
    </div>
  );
}
