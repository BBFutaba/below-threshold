// Global app state: progress, settings and the local leaderboard. Persisted to local
// storage so players can leave and come back.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type Theme = 'dark' | 'light';
export type Motion = 'system' | 'full' | 'reduced';

export interface PuzzleRecord {
  level: number;
  seed: number;
  humanSaved: boolean;
  decoderSaved: boolean;
}

export interface ScoreEntry {
  name: string;
  score: number;
  levels: number;
  humanRate: number;
  date: string;
}

interface AppState {
  theme: Theme;
  motion: Motion;
  sound: boolean;
  playerName: string;
  completedChapters: string[];
  seenPrimers: string[];
  levelsCleared: number[];
  bestScore: number;
  puzzles: PuzzleRecord[];
  scores: ScoreEntry[];
  seenTwist: boolean;
  /** The guided "how to play" walkthrough on level 1 has been finished or skipped. */
  seenGameIntro: boolean;
  setTheme: (t: Theme) => void;
  setMotion: (m: Motion) => void;
  setSound: (s: boolean) => void;
  setPlayerName: (n: string) => void;
  completeChapter: (slug: string) => void;
  dismissPrimer: (slug: string) => void;
  clearLevel: (level: number) => void;
  recordPuzzle: (r: PuzzleRecord) => void;
  addScore: (e: ScoreEntry) => void;
  setSeenTwist: () => void;
  setSeenGameIntro: (v: boolean) => void;
  resetProgress: () => void;
}

const initial = {
  theme: 'dark' as Theme,
  motion: 'system' as Motion,
  sound: false,
  playerName: '',
  completedChapters: [] as string[],
  seenPrimers: [] as string[],
  levelsCleared: [] as number[],
  bestScore: 0,
  puzzles: [] as PuzzleRecord[],
  scores: [] as ScoreEntry[],
  seenTwist: false,
  seenGameIntro: false,
};

export const useApp = create<AppState>()(
  persist(
    (set) => ({
      ...initial,
      setTheme: (theme) => set({ theme }),
      setMotion: (motion) => set({ motion }),
      setSound: (sound) => set({ sound }),
      setPlayerName: (playerName) => set({ playerName: playerName.slice(0, 24) }),
      completeChapter: (slug) =>
        set((s) => (s.completedChapters.includes(slug) ? s : { completedChapters: [...s.completedChapters, slug] })),
      dismissPrimer: (slug) => set((s) => ({ seenPrimers: [...new Set([...s.seenPrimers, slug])] })),
      clearLevel: (level) => set((s) => ({ levelsCleared: [...new Set([...s.levelsCleared, level])].sort() })),
      recordPuzzle: (r) =>
        set((s) => ({
          puzzles: [...s.puzzles.filter((p) => !(p.seed === r.seed && p.level === r.level)), r].slice(-500),
        })),
      addScore: (e) =>
        set((s) => ({
          scores: [...s.scores, e].sort((a, b) => b.score - a.score).slice(0, 50),
          bestScore: Math.max(s.bestScore, e.score),
        })),
      setSeenTwist: () => set({ seenTwist: true }),
      setSeenGameIntro: (seenGameIntro) => set({ seenGameIntro }),
      resetProgress: () =>
        set({
          completedChapters: [],
          seenPrimers: [],
          levelsCleared: [],
          bestScore: 0,
          puzzles: [],
          seenTwist: false,
          seenGameIntro: false,
        }),
    }),
    {
      name: 'below-threshold',
      version: 1,
      storage: createJSONStorage(() => {
        try {
          const k = '__bt_probe__';
          window.localStorage.setItem(k, '1');
          window.localStorage.removeItem(k);
          return window.localStorage;
        } catch {
          // Private mode or blocked storage: fall back to memory so the app still works.
          const mem = new Map<string, string>();
          return {
            getItem: (k: string) => mem.get(k) ?? null,
            setItem: (k: string, v: string) => void mem.set(k, v),
            removeItem: (k: string) => void mem.delete(k),
          };
        }
      }),
    },
  ),
);
