// Optional shared leaderboard (e.g. a free Supabase table) for the live event. The app
// works fully offline with local storage; this only adds scores from other devices.
//
// Configure with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. Expected table:
//   create table scores (id bigint generated always as identity primary key,
//     name text not null, score int not null, levels int not null,
//     human_rate real not null, created_at timestamptz default now());
// with row-level security allowing anonymous insert and select.

import type { ScoreEntry } from '../store/app';

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const sharedEnabled = !!(URL && KEY);

const headers = () => ({ apikey: KEY!, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' });

export async function fetchShared(): Promise<ScoreEntry[]> {
  if (!sharedEnabled) return [];
  const r = await fetch(`${URL}/rest/v1/scores?select=name,score,levels,human_rate,created_at&order=score.desc&limit=25`, {
    headers: headers(),
    signal: AbortSignal.timeout?.(4000),
  });
  if (!r.ok) throw new Error(`leaderboard ${r.status}`);
  const rows = (await r.json()) as { name: string; score: number; levels: number; human_rate: number; created_at: string }[];
  return rows.map((x) => ({ name: cleanName(x.name), score: x.score, levels: x.levels, humanRate: x.human_rate, date: x.created_at }));
}

export async function postShared(e: ScoreEntry): Promise<void> {
  if (!sharedEnabled) return;
  await fetch(`${URL}/rest/v1/scores`, {
    method: 'POST',
    headers: { ...headers(), Prefer: 'return=minimal' },
    body: JSON.stringify({ name: cleanName(e.name), score: e.score, levels: e.levels, human_rate: e.humanRate }),
    signal: AbortSignal.timeout?.(4000),
  });
}

// A small profanity filter for optional display names. No personal data is collected.
const BAD = ['fuck', 'shit', 'cunt', 'bitch', 'nigg', 'fag', 'dick', 'cock', 'pussy', 'asshole', 'bastard', 'slut', 'whore', 'rape', 'nazi'];

export function cleanName(raw: string): string {
  const name = raw.replace(/[^\p{L}\p{N} _.-]/gu, '').trim().slice(0, 24);
  const low = name.toLowerCase().replace(/[^a-z]/g, '');
  if (!name || BAD.some((b) => low.includes(b))) return 'Anonymous Axolotl';
  return name;
}
