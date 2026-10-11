// Screen recordings of the live app for the 3-minute pitch video (media/pitch_build.py).
//
// Uses Chrome's own screencast (Page.startScreencast) at 1920x1080 (a 1280x720 desktop
// layout at device scale 1.5) for crisp text, then turns the timestamped frames into
// constant-30-fps clips: media/build/pitch/clips/<id>.mp4 (+ <id>.json with the moment the
// choreography starts, after page load).
//
// Usage: npm run build && npx tsx scripts/record-pitch.ts [clip ...]

import { chromium, type CDPSession, type Page } from '@playwright/test';
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { makePuzzle } from '../src/core/game';

const OUT = 'media/build/pitch/clips';
const PRIMERS = ['superposition', 'multi-qubit', 'entanglement', 'period', 'phase', 'qft', 'shor', 'noise', 'no-cloning', 'syndrome', 'phase-errors', 'discretization'];
const SPLIT = 'main [class*="_split_"]';
const PORT = 4177;
const base = `http://localhost:${PORT}`;

type Shot = (p: Page) => Promise<void>;

const wait = (p: Page, ms: number) => p.waitForTimeout(ms);

// In-page code is passed as strings: tsx wraps real functions in a `__name` helper that
// does not exist inside the browser.
async function smoothScroll(p: Page, y: number, ms = 700) {
  await p.evaluate(`new Promise((res) => {
    const y0 = window.scrollY, t0 = performance.now();
    const step = (t) => {
      const u = Math.min(1, (t - t0) / ${ms});
      const e = 0.5 - 0.5 * Math.cos(Math.PI * u);
      window.scrollTo(0, y0 + (${y} - y0) * e);
      if (u < 1) requestAnimationFrame(step); else res(null);
    };
    requestAnimationFrame(step);
  })`);
}

async function scrollTo(p: Page, selector: string, offset = 90) {
  const y = (await p.evaluate(
    `(() => { const el = document.querySelector(${JSON.stringify(selector)}); return el ? el.getBoundingClientRect().top + window.scrollY - ${offset} : 0; })()`,
  )) as number;
  await smoothScroll(p, Math.max(0, y));
}

const CLIPS: Record<string, { path: string; shot: Shot }> = {
  learn: {
    path: '/learn/superposition',
    shot: async (p) => {
      await scrollTo(p, SPLIT, 70);
      await wait(p, 900);
      await p.getByRole('button', { name: 'Hadamard: make an equal superposition' }).click();
      await wait(p, 1600);
      await p.getByRole('button', { name: /Run 100 shots/ }).click();
      await wait(p, 2600);
      await p.getByRole('button', { name: 'Hadamard: make an equal superposition' }).click();
      await wait(p, 1400);
      await p.getByRole('button', { name: /Run 100 shots/ }).click();
      await wait(p, 4000);
    },
  },
  qft: {
    path: '/learn/qft',
    shot: async (p) => {
      await wait(p, 600);
      await scrollTo(p, SPLIT, 70);
      await wait(p, 500);
      await p.getByRole('button', { name: 'A repeating pattern' }).first().click().catch(() => undefined);
      await wait(p, 900);
      await p.getByRole('button', { name: 'Run all gates' }).click();
      await wait(p, 6000);
      // Bring the output (clocks and peaks) into view while the circuit finishes.
      await smoothScroll(p, (await p.evaluate('window.scrollY')) as number + 330, 1400);
      await wait(p, 6500);
    },
  },
  shor: {
    path: '/learn/shor',
    shot: async (p) => {
      await scrollTo(p, SPLIT, 70);
      await wait(p, 800);
      for (let i = 0; i < 7; i++) {
        const btn = p.getByRole('button', { name: /^(Start ▶|Next: .*▶)$/ });
        if (!(await btn.count())) break;
        await btn.first().click();
        await wait(p, 1750);
      }
      await wait(p, 2500);
    },
  },
  noise: {
    path: '/learn/noise',
    shot: async (p) => {
      await scrollTo(p, SPLIT, 70);
      await wait(p, 700);
      const run = p.getByRole('button', { name: /^Run \d+ shots$/ });
      await run.click();
      await p.getByRole('button', { name: /^Run \d+ shots$/ }).waitFor();
      await wait(p, 1500);
      // Turn the noise up in steps and run again each time: the peaks blur away.
      const slider = p.getByLabel('Error rate per qubit per step');
      for (const steps of [4, 6]) {
        await slider.focus();
        for (let i = 0; i < steps; i++) {
          await p.keyboard.press('ArrowRight');
          await wait(p, 120);
        }
        await p.getByRole('button', { name: /^Run \d+ shots$/ }).click();
        await p.getByRole('button', { name: /^Run \d+ shots$/ }).waitFor({ timeout: 30000 });
        await wait(p, 1800);
      }
      await wait(p, 1500);
    },
  },
  game: {
    path: '/play',
    shot: async (p) => {
      await wait(p, 900);
      for (let i = 0; i < 3; i++) {
        await p.getByRole('button', { name: 'Next', exact: true }).click();
        await wait(p, 1300);
      }
      await p.getByRole('button', { name: 'Got it, let me play' }).click();
      await wait(p, 1000);
      // Solve the seeded first puzzle with the keyboard (the focus ring shows the moves).
      const puz = makePuzzle(1, 0);
      const q = puz.error.x.findIndex((b) => b === 1);
      const d = puz.code.d;
      const lattice = p.getByRole('application', { name: /Game lattice/ });
      await lattice.focus();
      for (let k = 0; k < d; k++) await p.keyboard.press('ArrowUp');
      for (let k = 0; k < d; k++) await p.keyboard.press('ArrowLeft');
      await wait(p, 400);
      for (let k = 0; k < Math.floor(q / d); k++) {
        await p.keyboard.press('ArrowDown');
        await wait(p, 250);
      }
      for (let k = 0; k < q % d; k++) {
        await p.keyboard.press('ArrowRight');
        await wait(p, 250);
      }
      await wait(p, 500);
      await p.keyboard.press('x');
      await wait(p, 1500);
      await p.keyboard.press('Enter');
      await wait(p, 2200);
      await p.getByRole('button', { name: 'Watch the decoder' }).click();
      await wait(p, 4000);
    },
  },
  realtime: {
    path: '/realtime',
    shot: async (p) => {
      await p.getByText(/measured [\d.]+ (ns|µs|ms) per round/).first().waitFor({ timeout: 40000 });
      await scrollTo(p, SPLIT, 70);
      await wait(p, 700);
      await p.getByRole('button', { name: /Start the clock/ }).click();
      await wait(p, 15000);
    },
  },
  lab: {
    path: '/lab',
    shot: async (p) => {
      await scrollTo(p, SPLIT, 70);
      await wait(p, 600);
      await p.getByRole('button', { name: 'Run experiment' }).click();
      await p.getByText(/(Below|Above) threshold:/).waitFor({ timeout: 60000 });
      await wait(p, 6500);
      await p.goto(base + '/film');
      await p.locator('video').first().waitFor();
      await wait(p, 4500);
    },
  },
};

async function record(name: string, browser: import('@playwright/test').Browser) {
  const clip = CLIPS[name];
  const dir = `${OUT}/${name}-frames`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, colorScheme: 'dark' });
  const page = await ctx.newPage();
  // Mark the 30-second primers as seen so chapters open straight onto their interactive part.
  await page.goto(base + '/');
  await page.evaluate(`localStorage.setItem('below-threshold', JSON.stringify({ state: { theme: 'dark', seenPrimers: ${JSON.stringify(PRIMERS)} }, version: 1 }))`);
  await page.goto(base + clip.path);
  await page.waitForLoadState('networkidle').catch(() => undefined);
  await wait(page, 700);
  // Chrome's screencast ignores the device scale, so capture device-pixel screenshots
  // (1920x1080) in a loop alongside the choreography instead.
  const cdp: CDPSession = await ctx.newCDPSession(page);
  const frames: { t: number; file: string }[] = [];
  let capturing = true;
  const loop = (async () => {
    while (capturing) {
      const t = Date.now() / 1000;
      const m = (await cdp.send('Page.getLayoutMetrics')) as { cssVisualViewport: { pageX: number; pageY: number } };
      const clip = { x: m.cssVisualViewport.pageX, y: m.cssVisualViewport.pageY, width: 1280, height: 720, scale: 1.5 };
      const r = (await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 90, optimizeForSpeed: true, clip })) as { data: string };
      const file = `${dir}/${String(frames.length).padStart(5, '0')}.jpg`;
      writeFileSync(file, Buffer.from(r.data, 'base64'));
      frames.push({ t, file });
    }
  })();
  await wait(page, 200);
  const tStart = Date.now() / 1000;
  await clip.shot(page);
  const tEnd = Date.now() / 1000;
  capturing = false;
  await loop;
  await ctx.close();
  if (frames.length < 2) throw new Error(`${name}: no frames captured`);
  // Concat list with real per-frame durations -> constant 30 fps.
  const lines: string[] = [];
  for (let i = 0; i < frames.length; i++) {
    const next = i + 1 < frames.length ? frames[i + 1].t : Math.max(tEnd, frames[i].t + 0.04);
    lines.push(`file '${frames[i].file.split('/').pop()}'`, `duration ${Math.max(0.001, next - frames[i].t).toFixed(4)}`);
  }
  lines.push(`file '${frames[frames.length - 1].file.split('/').pop()}'`);
  writeFileSync(`${dir}/list.txt`, lines.join('\n'));
  const r = spawnSync(
    'ffmpeg',
    ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', 'list.txt', '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-crf', '14', '-preset', 'slow', `../${name}.mp4`],
    { cwd: dir, stdio: 'inherit' },
  );
  if (r.status !== 0) throw new Error(`${name}: ffmpeg failed`);
  const first = frames[0].t;
  writeFileSync(`${OUT}/${name}.json`, JSON.stringify({ id: name, frames: frames.length, startSec: Math.max(0, tStart - first), durationSec: tEnd - first }, null, 1));
  console.log(`${name}: ${frames.length} frames, ${(tEnd - first).toFixed(1)} s`);
}

const want = process.argv.slice(2);
const names = want.length ? want : Object.keys(CLIPS);
mkdirSync(OUT, { recursive: true });
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { shell: true, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 2500));
const browser = await chromium.launch();
try {
  for (const n of names) {
    if (!CLIPS[n]) throw new Error(`unknown clip ${n}`);
    await record(n, browser);
  }
} finally {
  await browser.close();
  server.kill();
}
process.exit(0);
