// Record the backup demo video (the judge path) with Playwright.
// Usage: npm run build && npx tsx scripts/record-demo.ts   -> docs/media/demo.webm
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdirSync, renameSync, readdirSync, rmSync } from 'node:fs';
import { makePuzzle } from '../src/core/game';

const server = spawn('npx', ['vite', 'preview', '--port', '4176', '--strictPort'], { shell: true, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const base = 'http://localhost:4176';
mkdirSync('docs/media/.rec', { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: 'docs/media/.rec', size: { width: 1280, height: 720 } } });
const page = await ctx.newPage();
const wait = (ms: number) => page.waitForTimeout(ms);

// 0:00 landing
await page.goto(base + '/');
await wait(7000);
// 0:20 chapter 6
await page.goto(base + '/learn/discretization');
await wait(1500);
const slider = page.getByLabel('Error strength Rx(θ)');
await slider.focus();
for (let i = 0; i < 90; i++) await page.keyboard.press('ArrowRight');
await wait(800);
await page.getByRole('button', { name: /Run the checks/ }).click();
await wait(9000);
// 0:50 game, level 2: solve by moving to the two error qubits
await page.goto(base + '/play/2');
await wait(2500);
const p = makePuzzle(2, 0);
const lat = page.getByRole('application', { name: /Game lattice/ });
await lat.focus();
for (const q of [...p.error.x].map((v, i) => (v ? i : -1)).filter((i) => i >= 0)) {
  for (let k = 0; k < 3; k++) {
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowLeft');
  }
  for (let k = 0; k < Math.floor(q / 3); k++) await page.keyboard.press('ArrowDown');
  for (let k = 0; k < q % 3; k++) await page.keyboard.press('ArrowRight');
  await wait(700);
  await page.keyboard.press('x');
  await wait(1500);
}
await page.keyboard.press('Enter');
await wait(4000);
await page.getByRole('button', { name: 'Watch the decoder' }).click();
await wait(7000);
// 1:30 real-time
await page.goto(base + '/realtime');
await page.getByText(/measured [\d.]+ (ns|µs|ms) per round/).first().waitFor({ timeout: 30000 });
await wait(1500);
await page.getByRole('button', { name: /Start the clock/ }).click();
await wait(4000);
await page.mouse.wheel(0, 400);
await wait(14000);
await page.mouse.wheel(0, -400);
await wait(3000);
// 2:15 lab
await page.goto(base + '/lab');
await wait(1000);
await page.getByRole('button', { name: 'Run experiment' }).click();
await page.getByText(/(Below|Above) threshold:/).waitFor({ timeout: 60000 });
await wait(12000);
const marker = page.getByLabel('Noise level (drag here or on the chart)');
await marker.focus();
for (let i = 0; i < 90; i++) {
  await page.keyboard.press('ArrowRight');
  await wait(60);
}
await wait(4000);
// 2:45 honesty + QR
await page.goto(base + '/honesty');
await wait(5000);
await page.goto(base + '/leaderboard');
await page.getByRole('button', { name: /Event mode/ }).click();
await wait(5000);
await page.close();
await ctx.close();
await browser.close();
server.kill();
const f = readdirSync('docs/media/.rec').find((x) => x.endsWith('.webm'))!;
renameSync(`docs/media/.rec/${f}`, 'docs/media/demo.webm');
rmSync('docs/media/.rec', { recursive: true, force: true });
console.log('wrote docs/media/demo.webm');
process.exit(0);
