// Capture screenshots of every screen (desktop and mobile) for review and the README.
// Usage: npm run build && npx tsx scripts/screenshots.ts [outDir]
import { chromium, devices } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'docs/screenshots';
mkdirSync(out, { recursive: true });
const server = spawn('npx', ['vite', 'preview', '--port', '4174', '--strictPort'], { shell: true, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const base = 'http://localhost:4174';
const routes: [string, string, ((p: import('@playwright/test').Page) => Promise<void>)?][] = [
  ['landing', '/'],
  ['library', '/learn'],
  ['ch1', '/learn/superposition', async (p) => { await p.getByRole('button', { name: 'Hadamard: make an equal superposition' }).click(); await p.getByRole('button', { name: 'Run 100 shots' }).click(); }],
  ['ch2', '/learn/no-cloning', async (p) => { await p.getByRole('button', { name: '|+⟩ (50/50)' }).click(); await p.getByRole('button', { name: 'Run the copy machine' }).click(); }],
  ['ch3', '/learn/entanglement'],
  ['ch4', '/learn/syndrome'],
  ['ch5', '/learn/phase-errors'],
  ['ch6', '/learn/discretization', async (p) => { await p.getByRole('button', { name: /Run the checks/ }).click(); }],
  ['bridge', '/bridge', async (p) => { await p.waitForTimeout(5600); }],
  ['game', '/play/5'],
  ['realtime', '/realtime', async (p) => { await p.getByText(/measured [\d.]+ (ns|µs|ms) per round/).first().waitFor({ timeout: 30000 }); await p.getByRole('button', { name: /Start the clock/ }).click(); await p.waitForTimeout(6000); }],
  ['timestack', '/realtime', async (p) => { await p.getByRole('button', { name: '1 · Checks that lie' }).click(); }],
  ['lab', '/lab', async (p) => { await p.getByRole('button', { name: 'Run experiment' }).click(); await p.getByText(/(Below|Above) threshold:/).waitFor({ timeout: 60000 }); await p.waitForTimeout(15000); }],
  ['leaderboard', '/leaderboard'],
  ['honesty', '/honesty'],
  ['film', '/film', async (p) => { await p.locator('video').first().waitFor(); await p.waitForTimeout(800); }],
];
const only = process.env.ONLY?.split(',');
const browser = await chromium.launch();
for (const [kind, ctxOpts] of [['desktop', { viewport: { width: 1360, height: 860 } }], ['mobile', devices['Pixel 7']]] as const) {
  const ctx = await browser.newContext({ ...ctxOpts, colorScheme: 'dark' });
  for (const [name, path, act] of routes) {
    if (only && !only.includes(name)) continue;
    const page = await ctx.newPage();
    await page.goto(base + path);
    await page.waitForTimeout(600);
    if (act) await act(page).catch((e) => console.warn(name, String(e).slice(0, 120)));
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${out}/${name}-${kind}.png`, fullPage: kind === 'mobile' });
    await page.close();
  }
  await ctx.close();
}
await browser.close();
server.kill();
process.exit(0);
