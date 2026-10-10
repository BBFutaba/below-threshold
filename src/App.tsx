import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { Shell } from './ui/Shell';
import { Landing } from './ui/screens/Landing';
import { Library } from './ui/screens/Library';

const Chapter1 = lazy(() => import('./ui/screens/chapters/Chapter1').then((m) => ({ default: m.Chapter1 })));
const Chapter2 = lazy(() => import('./ui/screens/chapters/Chapter2').then((m) => ({ default: m.Chapter2 })));
const Chapter3 = lazy(() => import('./ui/screens/chapters/Chapter3').then((m) => ({ default: m.Chapter3 })));
const Chapter4 = lazy(() => import('./ui/screens/chapters/Chapter4').then((m) => ({ default: m.Chapter4 })));
const Chapter5 = lazy(() => import('./ui/screens/chapters/Chapter5').then((m) => ({ default: m.Chapter5 })));
const Chapter6 = lazy(() => import('./ui/screens/chapters/Chapter6').then((m) => ({ default: m.Chapter6 })));
const ChapterPhase = lazy(() => import('./ui/screens/chapters/ChapterPhase').then((m) => ({ default: m.ChapterPhase })));
const ChapterPeriod = lazy(() => import('./ui/screens/chapters/ChapterPeriod').then((m) => ({ default: m.ChapterPeriod })));
const ChapterQft = lazy(() => import('./ui/screens/chapters/ChapterQft').then((m) => ({ default: m.ChapterQft })));
const ChapterShor = lazy(() => import('./ui/screens/chapters/ChapterShor').then((m) => ({ default: m.ChapterShor })));
const ChapterNoise = lazy(() => import('./ui/screens/chapters/ChapterNoise').then((m) => ({ default: m.ChapterNoise })));
const Bridge = lazy(() => import('./ui/screens/chapters/Bridge').then((m) => ({ default: m.Bridge })));
const Game = lazy(() => import('./ui/screens/Game').then((m) => ({ default: m.Game })));
const RealTime = lazy(() => import('./ui/screens/RealTime').then((m) => ({ default: m.RealTime })));
const Lab = lazy(() => import('./ui/screens/Lab').then((m) => ({ default: m.Lab })));
const Leaderboard = lazy(() => import('./ui/screens/Leaderboard').then((m) => ({ default: m.Leaderboard })));
const Film = lazy(() => import('./ui/screens/Film').then((m) => ({ default: m.Film })));
const Honesty = lazy(() => import('./ui/screens/Honesty').then((m) => ({ default: m.Honesty })));

const CHAPTER_ROUTES: Record<string, React.ComponentType> = {
  superposition: Chapter1,
  phase: ChapterPhase,
  period: ChapterPeriod,
  qft: ChapterQft,
  shor: ChapterShor,
  noise: ChapterNoise,
  'no-cloning': Chapter2,
  entanglement: Chapter3,
  syndrome: Chapter4,
  'phase-errors': Chapter5,
  discretization: Chapter6,
};

function ChapterRoute() {
  const { slug } = useParams();
  const C = slug ? CHAPTER_ROUTES[slug] : undefined;
  if (!C) return <Navigate to="/learn" replace />;
  return <C key={slug} />;
}

function Loading() {
  return (
    <div style={{ padding: 40, color: 'var(--text-muted)' }} role="status">
      Loading…
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route element={<Shell />}>
            <Route index element={<Landing />} />
            <Route path="learn" element={<Library />} />
            <Route path="learn/:slug" element={<ChapterRoute />} />
            <Route path="shor" element={<Navigate to="/learn/shor" replace />} />
            <Route path="qft" element={<Navigate to="/learn/qft" replace />} />
            <Route path="bridge" element={<Bridge />} />
            <Route path="play" element={<Game />} />
            <Route path="play/:level" element={<Game />} />
            <Route path="realtime" element={<RealTime />} />
            <Route path="lab" element={<Lab />} />
            <Route path="leaderboard" element={<Leaderboard />} />
            <Route path="film" element={<Film />} />
            <Route path="honesty" element={<Honesty />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
