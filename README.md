# Below Threshold

**Keep a quantum computer alive.** An interactive game that teaches quantum error correction, ending on why real-time decoding is the bottleneck for fault-tolerant quantum computing.

> Live demo: https://bbfutaba.github.io/below-threshold/ (unlisted, `noindex`) · [Technical write-up](docs/writeup.md) · [Validation report](docs/validation-report.md) · [Backup demo video](docs/media/demo.webm)

![The decoder solving a real seeded puzzle](docs/media/decoder.gif)

## What you can do

| | |
|---|---|
| **Learn** | Six one-to-two-minute chapters on an exact state-vector simulator: superposition, no-cloning, entanglement, syndrome extraction, phase errors, error discretization. Open any chapter in any order; each has its own URL (`/learn/entanglement`). |
| **Play** | Protect a logical qubit on a rotated surface code (d = 3, 5, 7). Errors are hidden and only lit checks are visible, like real hardware. Clear them, submit, see what really happened, then watch the decoder play the same seeded puzzle. |
| **Checks that lie** | Measurement errors: label detection-event pairs in a time stack, then see the decoder's space-time matching. |
| **Real-time** | Rounds arrive on a clock; decoder speed is **measured live in your browser**. Slow decoders build a backlog and T gates stall. |
| **Lab** | Live Monte Carlo in Web Workers: watch curves for different distances cross at the threshold, drag the noise level, read off the suppression factor Λ. |
| **Leaderboard** | Humans vs the decoder on identical seeded puzzles; QR event mode; optional shared board. |

## Is it real?

Yes. Every number in the app is computed live or comes from the validation suite in this repo.

- **Correctness.** Our blossom MWPM matches brute force on every instance with up to 16 defects, and matches PyMatching's correction weight on **100%** of 90,000 exported decoding problems. Our layout equals Stim's generated rotated surface code for d = 3 to 11. 106 unit tests, 36 end-to-end checks (desktop and mobile).
- **Thresholds**, reproduced with our own decoders up to d = 13:

| Noise | Decoder | Ours | Stim / PyMatching reference | Published |
|---|---|---|---|---|
| Bit flip | MWPM | 9.94% | 9.85% | ≈ 10.3% |
| Bit flip | Union-find | 9.59% | | ≈ 9.9% |
| With measurement errors | MWPM | 2.84% | 2.85% | ≈ 2.9% |
| With measurement errors | Union-find | 2.48% | | ≈ 2.6% |
| Depolarizing | MWPM | 14.6% | | ≈ 15.5% |

![Threshold crossing, bit-flip noise](validate/plots/bitflip_mwpm.png)

- **What we simplify** (also shown in the app): code-capacity and phenomenological noise, not circuit-level; X and Z decoded separately; a slowed clock and a labeled hardware speed-up in real-time mode; small distances. See [the honesty page](src/ui/screens/Honesty.tsx) and the [write-up](docs/writeup.md).

## Quick start

Requires Node 20+ (and Python 3.11+ for validation).

```bash
npm install
npm run dev            # http://localhost:5173
npm test               # Vitest unit and property tests
npm run build && npm run test:e2e   # Playwright smoke tests (desktop and mobile)
```

Validation suite (Python 3.11):

```bash
python -m venv .venv && .venv/Scripts/pip install -r validate/requirements.txt   # or .venv/bin/pip
npm run export:instances                 # seeded instances -> validate/data/
.venv/Scripts/python validate/cross_check.py    # PyMatching cross-check + Stim layout check
.venv/Scripts/python validate/thresholds.py     # thresholds, plots, docs/validation-report.md (~5 min on 32 threads)
npm run bench                            # decoder timing -> src/data/bench.json
```

Explainer animations are rendered with Manim from real simulation data; see [media/README.md](media/README.md).

## Deploy

- **GitHub Pages (live deployment):** every push to `main` runs `.github/workflows/pages.yml`, which builds with the repo name as base path and deploys to https://bbfutaba.github.io/below-threshold/. Pages cannot set cross-origin-isolation headers; decoder timing still works because each decode is repeated until at least 0.5 ms has elapsed. The page carries a `noindex, nofollow` robots tag.
- **Vercel (alternative):** import the repo; `vercel.json` adds SPA rewrites and cross-origin-isolation headers (microsecond timer resolution for real-time mode).
- **Optional shared leaderboard:** set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (table schema in `src/ui/leaderboardApi.ts`). The app works fully without it.
- **Offline at the venue:** `npm run build && npm run preview`.

## Project structure

```
src/core/          pure physics, no React: rng, quantum, surfaceCode, pauliFrame, noise,
                   decodingGraph, decoders/ (exactSmall, blossom + mwpm, unionFind, greedy),
                   stats, simulate, game, realtime, timeStack, exportInstances
src/workers/       Monte Carlo and live decoder timing (Comlink)
src/ui/            design tokens, shared components (Lattice, BlochSphere, ThresholdChart, ...), screens
tests/core/        Vitest unit and property tests     tests/e2e/   Playwright smoke tests
validate/          Python: cross_check.py, thresholds.py, plots/
media/             Manim scenes and their data export  docs/        write-up, pitch, Q&A, plan, report
```

## Prior art and credits

Error-correction games exist, notably James Wootton's *Decodoku* (around 2016). Below Threshold adds the quantum basics, a decoder replay, measurement errors, the real-time backlog and a validated threshold lab in one experience. The blossom implementation is a TypeScript port of Joris van Rantwijk's public-domain `mwmatching.py`. Validation uses [Stim](https://github.com/quantumlib/Stim) and [PyMatching](https://github.com/oscarhiggott/PyMatching). Full references: [CITATIONS.md](CITATIONS.md).

## License

MIT
