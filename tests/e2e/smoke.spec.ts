// Smoke test: every screen loads, a level can be completed, and the lab runs a point.

import { expect, test } from '@playwright/test';
import { makePuzzle } from '../../src/core/game';

const ROUTES = [
  ['/', 'Below Threshold'],
  ['/learn', 'Choose what to learn'],
  ['/learn/superposition', 'Superposition'],
  ['/learn/no-cloning', 'No-cloning'],
  ['/learn/entanglement', 'Entanglement'],
  ['/learn/syndrome', 'Measurement and syndromes'],
  ['/learn/phase-errors', 'Phase errors and interference'],
  ['/learn/discretization', 'Error discretization'],
  ['/bridge', 'From 3 qubits to the surface code'],
  ['/play', 'Clear every glowing check'],
  ['/realtime', 'Can a decoder keep up?'],
  ['/lab', 'Watch the threshold appear'],
  ['/leaderboard', 'Humans vs the decoder'],
  ['/honesty', 'What we simplify'],
  ['/film', 'The film'],
] as const;

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (e) => {
    throw e;
  });
});

for (const [path, text] of ROUTES) {
  test(`loads ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator('main').getByText(text).first()).toBeVisible();
  });
}

test('level 1 can be completed with the keyboard', async ({ page }) => {
  await page.goto('/play');
  const lattice = page.getByRole('application', { name: /Game lattice/ });
  for (let i = 0; i < 3; i++) {
    const p = makePuzzle(1, i);
    const q = p.error.x.findIndex((b) => b === 1);
    const d = p.code.d;
    const [r, c] = [Math.floor(q / d), q % d];
    await lattice.focus();
    // Focus starts on the center qubit (1, 1) of the 3x3 grid; walk to (r, c).
    for (let k = 0; k < 3; k++) await page.keyboard.press('ArrowUp');
    for (let k = 0; k < 3; k++) await page.keyboard.press('ArrowLeft');
    for (let k = 0; k < r; k++) await page.keyboard.press('ArrowDown');
    for (let k = 0; k < c; k++) await page.keyboard.press('ArrowRight');
    await page.keyboard.press('x');
    await expect(page.getByText('All checks dark')).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.getByText(/Qubit saved/)).toBeVisible();
    await page.getByRole('button', { name: i < 2 ? 'Next puzzle' : /Level 2/ }).click();
  }
  await expect(page.getByText('Level').first()).toBeVisible();
  await expect(page.getByText('2/7')).toBeVisible();
});

test('the lab runs a point without errors', async ({ page }) => {
  await page.goto('/lab');
  await page.getByRole('button', { name: 'Run experiment' }).click();
  await expect(page.getByText(/points$/)).toBeVisible();
  await expect(page.getByText(/(Below|Above) threshold:/)).toBeVisible({ timeout: 45_000 });
});

test('real-time mode measures decoders and runs the clock', async ({ page }) => {
  await page.goto('/realtime');
  await expect(page.getByText(/measured [\d.]+ (ns|µs|ms) per round/).first()).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: /Start the clock/ }).click();
  await expect(page.getByText(/Round [1-9]/)).toBeVisible();
});

test('explainer clips load under cross-origin isolation', async ({ page }) => {
  await page.goto('/bridge');
  const video = page.locator('video').first();
  await expect(video).toBeVisible();
  await expect.poll(() => video.evaluate((v) => (v as unknown as { readyState: number }).readyState), { timeout: 15_000 }).toBeGreaterThan(0);
});
