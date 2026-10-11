// App shell: top navigation, settings, glossary drawer, theme and motion handling.

import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useApp } from '../store/app';
import { GLOSSARY } from './content';
import { Button } from './components/ui';
import { TeamLogo } from './components/TeamLogo';
import css from './Shell.module.css';

const NAV = [
  { to: '/learn', label: 'Learn' },
  { to: '/learn/qft', label: 'QFT' },
  { to: '/learn/shor', label: "Shor's" },
  { to: '/play', label: 'Play' },
  { to: '/realtime', label: 'Real-time' },
  { to: '/lab', label: 'Lab' },
  { to: '/film', label: 'Film' },
];

export function Shell() {
  const theme = useApp((s) => s.theme);
  const motion = useApp((s) => s.motion);
  const [drawer, setDrawer] = useState<'glossary' | 'settings' | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const loc = useLocation();
  // "Learn" covers every chapter except the two with their own nav entries.
  const inLearn = loc.pathname.startsWith('/learn') && !/^\/learn\/(qft|shor)\/?$/.test(loc.pathname);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  useEffect(() => {
    if (motion === 'system') delete document.documentElement.dataset.motion;
    else document.documentElement.dataset.motion = motion;
  }, [motion]);
  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo?.(0, 0);
  }, [loc.pathname]);
  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawer(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawer]);

  return (
    <div className={css.app}>
      <a href="#main" className={css.skip}>
        Skip to content
      </a>
      <header className={css.top}>
        <NavLink to="/" className={css.brand} aria-label="Below Threshold home">
          <Logo />
          <span>Below Threshold</span>
        </NavLink>
        <nav className={css.nav} data-open={menuOpen ? 1 : 0} aria-label="Main">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) => [css.navLink, (n.to === '/learn' ? inLearn : isActive) && css.active].filter(Boolean).join(' ')}
            >
              {n.label}
            </NavLink>
          ))}
          <NavLink to="/honesty" className={({ isActive }) => [css.navLink, css.navMinor, isActive && css.active].filter(Boolean).join(' ')}>
            What we simplify
          </NavLink>
        </nav>
        <div className={css.tools}>
          <Button variant="ghost" small onClick={() => setDrawer('glossary')} aria-label="Open glossary">
            Glossary
          </Button>
          <Button variant="ghost" small iconOnly onClick={() => setDrawer('settings')} aria-label="Settings">
            <GearIcon />
          </Button>
          <Button variant="ghost" small iconOnly className={css.menuBtn} onClick={() => setMenuOpen((o) => !o)} aria-label="Menu" aria-expanded={menuOpen}>
            <MenuIcon />
          </Button>
        </div>
      </header>
      <main id="main" className={css.main}>
        <Outlet />
      </main>
      <footer className={css.footer}>
        <NavLink to="/team" className={css.footerBrand} aria-label="Made by Team PhASE: meet the team">
          <span className="faint">Made by</span>
          <TeamLogo height={30} />
        </NavLink>
        <span className="faint">Every number on this site is computed live or comes from our validation suite.</span>
        <NavLink to="/leaderboard" className={css.footerLink}>
          Leaderboard
        </NavLink>
        <NavLink to="/honesty" className={css.footerLink}>
          What we simplify
        </NavLink>
      </footer>
      {drawer && (
        <Drawer title={drawer === 'glossary' ? 'Glossary' : 'Settings'} onClose={() => setDrawer(null)}>
          {drawer === 'glossary' ? <GlossaryList /> : <Settings />}
        </Drawer>
      )}
    </div>
  );
}

function Drawer({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className={css.drawerBack} onClick={onClose}>
      <aside className={css.drawer} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className={css.drawerHead}>
          <h2>{title}</h2>
          <Button variant="ghost" small onClick={onClose} autoFocus aria-label="Close">
            Close
          </Button>
        </div>
        {children}
      </aside>
    </div>
  );
}

function GlossaryList() {
  return (
    <dl className={css.glossary}>
      {GLOSSARY.map(([t, d]) => (
        <div key={t}>
          <dt>{t}</dt>
          <dd>{d}</dd>
        </div>
      ))}
    </dl>
  );
}

function Settings() {
  const { theme, setTheme, sound, setSound, motion, setMotion, resetProgress, playerName, setPlayerName } = useApp();
  const [confirm, setConfirm] = useState(false);
  return (
    <div className={css.settings}>
      <label className={css.setRow}>
        <span>Theme</span>
        <select value={theme} onChange={(e) => setTheme(e.target.value as 'dark' | 'light')}>
          <option value="dark">Dark</option>
          <option value="light">Light</option>
        </select>
      </label>
      <label className={css.setRow}>
        <span>Sound</span>
        <input type="checkbox" checked={sound} onChange={(e) => setSound(e.target.checked)} />
      </label>
      <label className={css.setRow}>
        <span>Motion</span>
        <select value={motion} onChange={(e) => setMotion(e.target.value as 'system' | 'full' | 'reduced')}>
          <option value="system">Follow system</option>
          <option value="full">Full</option>
          <option value="reduced">Reduced</option>
        </select>
      </label>
      <label className={css.setRow}>
        <span>Leaderboard name</span>
        <input type="text" value={playerName} placeholder="anonymous" maxLength={24} onChange={(e) => setPlayerName(e.target.value)} />
      </label>
      <div className={css.setRow}>
        <span>Progress</span>
        {confirm ? (
          <span style={{ display: 'flex', gap: 8 }}>
            <Button small onClick={() => (resetProgress(), setConfirm(false))}>
              Yes, reset
            </Button>
            <Button small variant="ghost" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
          </span>
        ) : (
          <Button small onClick={() => setConfirm(true)}>
            Reset progress
          </Button>
        )}
      </div>
      <p className="faint" style={{ fontSize: '0.85rem' }}>
        Progress is saved in this browser only. In the game: arrow keys move over qubits; X, Z, Y apply corrections; Enter submits.
      </p>
    </div>
  );
}

export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <rect x="7" y="7" width="9" height="9" rx="2" fill="var(--teal)" opacity="0.85" />
      <rect x="16" y="16" width="9" height="9" rx="2" fill="none" stroke="var(--violet)" strokeWidth="1.6" />
      <g fill="var(--bg)" stroke="var(--text)" strokeWidth="1.6">
        <circle cx="7" cy="7" r="2.6" />
        <circle cx="16" cy="16" r="2.6" />
        <circle cx="25" cy="25" r="2.6" />
        <circle cx="25" cy="7" r="2.6" />
        <circle cx="7" cy="25" r="2.6" />
      </g>
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}
