// Team PhASE: who built this, and how to reach us.

import { TeamLogo } from '../components/TeamLogo';
import { Card, Pill } from '../components/ui';
import s from './screen.module.css';

const PROGRAM = 'NYU MS in Applied Quantum Science and Technology';

const MEMBERS: { name: string; email: string; roles: string[] }[] = [
  { name: 'Prahlad MV', email: 'pmv6845@nyu.edu', roles: ['Develop', 'Design', 'Voice Over', 'Theory Crafting'] },
  { name: 'Dennis Li', email: 'zl2941@nyu.edu', roles: ['Develop', 'Design', 'Voice Over', 'Theory Crafting'] },
  { name: 'Ben Kahl', email: 'bk3362@nyu.edu', roles: ['Voice Over', 'Theory Crafting'] },
  { name: 'Siwei Zhang', email: 'sz5789@nyu.edu', roles: ['Voice Over', 'Theory Crafting'] },
];

export function Team() {
  return (
    <div className={`${s.page} ${s.narrow}`}>
      <header className={s.header}>
        <p className={s.eyebrow}>The team</p>
        <h1>Team PhASE</h1>
        <div style={{ margin: '12px 0' }}>
          <TeamLogo height={48} />
        </div>
        <p className="muted" style={{ margin: 0 }}>
          Four students in the {PROGRAM} program. We wrote the code, the theory and the narration for this site and its film.
        </p>
      </header>
      <div className={s.teamGrid}>
        {MEMBERS.map((m) => (
          <Card key={m.email} title={m.name}>
            <p style={{ margin: '0 0 8px' }}>
              <a href={`mailto:${m.email}`}>{m.email}</a>
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {m.roles.map((r) => (
                <Pill key={r}>{r}</Pill>
              ))}
            </div>
            <p className="faint" style={{ margin: 0, fontSize: '0.85rem' }}>
              {PROGRAM}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
