# Below Threshold: technical write-up

**Below Threshold** is an interactive web guide that teaches Shor's algorithm and the quantum Fourier transform, then the quantum error correction needed to run them, ending on the reason it is hard in practice: decoders must keep up with the hardware. Everything runs in the browser (TypeScript, React, Vite, Web Workers). There is no quantum hardware, no accounts and no server.

## 1. What the player does

1. **Quantum basics (Part I).** What a qubit is (X, H, shots, Ry, interference); many qubits at once (four amplitudes for two qubits, an even superposition of every value, measuring one qubit of a product state leaves the other alone, and a register that doubles per qubit); entanglement (a Bell pair, measuring one qubit fixes the other, and spreading one qubit across three for Part III, which shrinks each qubit's own Bloch arrow to length ||α|² − |β|²|).
2. **Shor's algorithm (Part II).** Factoring as period finding (click where aˣ mod N repeats, then the gcd recipe, and the two ways it fails on N = 21: an odd period for a = 4, and a^(r/2) ≡ −1 for a = 5). A phase chapter (H, a phase dial, H again: measurement cannot see the phase, interference can; then eight clocks winding at frequency f, where each qubit only needs its own turn). The quantum Fourier transform, the featured chapter: choose a basis state or a periodic comb, step through the real circuit gate by gate (Hadamards, controlled 1/2ᵏ turns, swaps) and watch amplitudes as clocks, each qubit's Bloch arrow and the output distribution, ending with a "frequency detective" that names a hidden period from samples. Shor end to end for N = 15, 21, 33, 35 in seven steps on exact registers, with a 50-run batch and the exact success probability. A noise chapter runs the gate-level circuit (10 qubits, 36 steps) with random Pauli errors and shows the peaks dissolving, plus why (1 − p)ᴳ makes error correction unavoidable.
3. **Error correction (Part III): four chapters on an exact state-vector simulator** (at most 5 qubits): no-cloning (the CNOT "copy machine" gives 50% fidelity on |+⟩, and measure-then-rebuild gives 25%); syndrome extraction with ancillas; phase errors, which the bit-flip checks cannot see, fixed by re-encoding in the phase-flip code and using the H sandwich; and error discretization (a small Rx(θ) snaps to "no error" with probability cos²(θ/2) or "full flip" with sin²(θ/2), and is corrected to 100% fidelity every time).
4. **The main game.** A rotated surface code (d = 3, 5, 7) with hidden errors, framed as keeping a Shor's algorithm run alive (a progress bar over all 21 puzzles). Only lit checks ("alarms") are visible. Level 1 opens with a guided walkthrough; every level has a plain-language guide, and a coach line reacts to each move (alarms cleared, moved or newly lit). The player applies X, Z or Y corrections until every check is dark, submits, and sees the truth: coral error rings, a "Qubit saved" message or a coral logical-error chain from edge to edge. Then MWPM replays the same seeded puzzle with its matching paths drawn.
5. **Checks that lie.** Phenomenological noise: detection events (changes between rounds) laid out in a time stack. The player labels each pair as a qubit error or a misreported check, then sees the decoder's space-time matching.
6. **Real-time mode.** Rounds arrive on a clock. Each decoder's time per round is measured live in the browser on the chosen settings. A FIFO queue model shows the backlog, and T-gate requests that must wait for decoding stall the computation.
7. **Threshold lab.** Live Monte Carlo experiments in a Web Worker pool, with logical error rate against physical error rate per distance, Wilson bands, a draggable noise marker, an above/below-threshold readout, the suppression factor Λ, and a validation badge.

## 2. Physics model (source: `src/core`)

- **Simulator** (`quantum.ts`): amplitudes in two `Float64Array`s, qubit q = bit q of the basis index, 2×2 gates, CNOT/CZ, projective Z measurement with injectable randomness, reduced-density-matrix Bloch vectors, fidelity.
- **QFT and Shor** (`qft.ts`, `shor.ts`): the textbook QFT circuit (qubit n−1 most significant) on the simulator, checked against an O(N²) exact DFT; Shor at register level (the state after each step written down directly) and at gate level (Hadamards, controlled multiplication by a^(2^j) mod N as a permutation of the output register, then the QFT circuit), which agree exactly without noise. Post-processing uses continued-fraction convergents with denominators below N, tries small multiples of each (up to log₂ N), keeps the smallest r with aʳ ≡ 1, and rejects odd r and trivial square roots.
- **Layout** (`surfaceCode.ts`): data qubits on a d × d grid; plaquettes at the corners, checkerboard types (even = X); top and bottom edges keep X-type weight-2 plaquettes, left and right keep Z-type ones; d² − 1 stabilizers. Logical X is a column, logical Z a row. The layout equals Stim's `rotated_memory_z` up to a transpose plus an X↔Z swap.
- **Errors** (`pauliFrame.ts`): Pauli frames (x and z bit arrays). Checks fire on odd overlap. A logical failure is a residual (error × correction) with zero syndrome (asserted) and odd parity on a logical operator.
- **Noise** (`noise.ts`): bit-flip and depolarizing code capacity; phenomenological noise with d noisy rounds plus a perfect final readout. Everything comes from a seeded xoshiro128** generator, so every puzzle is reproducible (level seeds are `level × 1000 + index`).
- **Decoding graph** (`decodingGraph.ts`): X and Z decoded independently. Nodes are checks per round plus one boundary node; weights are log((1 − p)/p) and log((1 − q)/q), normalized so space edges weigh 1. Cached Dijkstra per source; paths never route through the boundary (both-to-boundary is matched explicitly instead).

## 3. Decoders (`src/core/decoders`)

| Decoder | Method | Role |
|---|---|---|
| Exact (bitmask DP) | Minimum-weight matching over ≤ 16 defects by dynamic programming | Ground truth in tests |
| MWPM | Complete graph with a boundary twin per defect, defect-to-twin and zero-weight twin-to-twin edges; Edmonds' blossom (TypeScript port of van Rantwijk's public-domain `mwmatching.py`) on integer weights | Most accurate |
| Union-find | Delfosse and Nickerson: weighted (smallest-first) half-edge growth, union by size with path compression, peeling on a spanning forest rooted at the boundary | Fast, nearly as accurate |
| Greedy | Repeatedly match the closest pair or defect-to-boundary | Baseline |

All four share one interface, `decode(graph, defects) → { flips, matching, edges, weight, ms }`, so the UI and benchmarks can swap them freely.

## 4. Validation (`tests/`, `validate/`, `docs/validation-report.md`)

- **Unit and property tests (Vitest, 125 tests).** Simulator facts (50/50, Bell length 0, cloning 0.5, measure-and-rebuild 0.25, 200 seeded discretization trials, the Chapter 10 syndrome table, the Chapter 11 phase-error failure and fix). The QFT circuit equals the exact DFT on random states (n = 1 to 7), and without noise the gate-level Shor circuit reproduces the register-level distribution exactly. Layout for d = 3 to 9 (counts, pairwise commutation, logicals). Syndromes (single errors, stabilizers are never failures, logicals always are). Blossom against brute force on 2,000 random graphs. MWPM weight equals the exact DP on every instance with ≤ 16 defects (code capacity, phenomenological, p ≠ q). Every decoder clears the syndrome on 100,000 random instances. MWPM and union-find correct every error of weight ≤ (d − 1)/2. Seeded reproducibility. Game, queue and time-stack logic.
- **PyMatching cross-check (`validate/cross_check.py`).** 10,000 seeded instances per configuration (bit flip d = 3 to 9, depolarizing, phenomenological including p ≠ q), 90,000 decoding problems in total. Our correction weight equals PyMatching's on **100%**. Logical outcomes agree on 100% for non-degenerate weights. With p = q (all weights 1), disagreements of 3.5 to 6% are proven ties: an exact McNemar test gives p = 0.83 and 0.31, so there is no bias.
- **Threshold reproduction (`validate/thresholds.py`).** Up to 4,000 failures or 200,000 trials per point, d up to 13, finite-size scaling fit over d ≥ 7, and bootstrap intervals for the pairwise crossings:

| Noise | Decoder | Ours | Independent reference | Published (approx.) |
|---|---|---|---|---|
| Bit flip | MWPM | **9.94%** | Stim + PyMatching 9.85%; PyMatching on our graph 9.85% | 10.3% |
| Bit flip | Union-find | **9.59%** | | 9.9% |
| Phenomenological (q = p) | MWPM | **2.84%** | PyMatching on an independently built graph 2.85% | 2.9% |
| Phenomenological (q = p) | Union-find | **2.48%** | | 2.6% |
| Depolarizing | MWPM | **14.6%** | | ≈ 15.5% (3/2 × bit flip) |

Pairwise crossings rise with distance (for example 2.71% → 2.85% → 2.88% for phenomenological MWPM), which is the usual finite-size approach toward the asymptotic values. Phenomenological thresholds use the failure probability of the whole d-round memory, as in the published figures; per-round curves cross higher.

## 5. Real-time modeling (`src/core/realtime.ts`, `src/workers/sim.worker.ts`)

Each hardware round takes 1 µs (about what superconducting chips achieve). The decoder spends one round period of work per round on a FIFO queue; a new round arrives needing a service time drawn from the **measured** per-round decode times. Utilization ρ = mean service / period; above 1 the backlog grows without limit. Every 16 rounds a T gate is requested that cannot proceed until its round is decoded.

Measured decode time per round (`npm run bench`, Node 22, phenomenological noise, q = p):

| d, p | MWPM median | Union-find median | Greedy median |
|---|---|---|---|
| 5, 1% | 2.6 µs | 2.7 µs | 0.2 µs |
| 9, 1% | 12 µs | 2.4 µs | 2.2 µs |
| 9, 3% | 104 µs | 4.0 µs | 15 µs |

In plain JavaScript every decoder misses the 1 µs budget at realistic sizes, which is the honest version of the story: production systems use custom decoding hardware. The app's only modeling knob is an explicitly labeled hardware speed-up (×1, ×10, ×100, ×1000). Browser timing uses repeated decodes and cross-origin isolation so that `performance.now()` coarsening does not distort the numbers.

## 6. Interface

Dark "quantum lab at night" theme with a light toggle, and one visual language everywhere: white data qubits, teal Z-checks, violet X-checks, a bright fill plus a dot for lit checks (never color alone), coral error rings with letters, blue corrections, dashed blue decoder paths. One goal line per screen, a "What just happened?" card with "Go deeper", undo/reset, hints, a glossary drawer, and full keyboard control (arrow keys, X/Z/Y, Enter). Tap targets are at least 44 px and the reduced-motion setting is respected. Explainer clips are rendered with Manim from real simulation output. Playwright smoke tests cover every route on desktop and mobile, completing level 1 by keyboard and running the lab and real-time mode.

## 7. The film

A ~15-minute narrated explainer (`/film`, and `docs/media/below-threshold-film.mp4`) in the visual language of 3Blue1Brown and 2swap: Manim with LaTeX (Computer Modern) typesetting, continuous morphs instead of cuts, labels instead of captions, and the narration carrying the explanation. Fourteen chapters in three parts run from a single qubit, many qubits and entanglement, through period finding, the QFT and Shor's algorithm on 21 (and its collapse under noise), to error correction as the wrap-up, ending on the decoder backlog; each is also embedded next to its interactive counterpart in the app. Every object on screen is exported from `src/core` (seeded QState runs, real layouts and syndromes, MWPM matchings and distances, validation curves, measured decode times).

The timing is narration-driven: `media/voiceover/script.py` holds the lines, and every beat lasts as long as its line takes to say. The film is narrated by Team PhASE: 71 recorded lines, imported with `media/voiceover/import_takes.py`. That tool pairs the raw takes with the lines, cleans and levels them, uses offline speech recognition to check that each take says its own line, and aligns its words to the audio. The build cuts the film to those recordings (14:52). It times the captions (WebVTT/SRT) and the on-screen phrases to the real word times, and regenerates the recording sheet (`docs/voiceover-script.md`).

A 3-minute pitch video (`docs/media/below-threshold-pitch.mp4`, 2:52) sits above the film on `/film`. It is a Manim scene with screen recordings of the live app, narrated by the team in four sections, one per member. Each section is also cut as its own clip in `docs/media/pitch-sections/`, and the Film page has a jump button for each one. `media/pitch_build.py` builds it, and its script and recording sheet are in `docs/pitch-video-script.md`.

## 8. What we simplify

Shor's algorithm runs on small numbers (15 to 35): the walkthrough writes the registers down exactly, and the 10-qubit gate-level noise simulation treats each controlled modular multiplication as one exact gate rather than thousands of elementary ones. The game uses code-capacity and phenomenological noise, not circuit-level noise. X and Z are decoded independently (ignoring Y correlations). Real-time mode runs on a slowed clock and assumes a labeled hardware speed-up. Distances are small. Every number shown is computed live or comes from the validation runs in this repo.

## 9. Prior art

Error-correction games exist, notably Decodoku (Wootton, around 2016). Below Threshold adds the quantum basics and Shor's algorithm with the quantum Fourier transform on an exact simulator, a decoder replay, measurement errors in a time stack, the real-time backlog, a validated threshold lab, and a narrated explainer film built from the same simulation code, in one experience. Full references are in [CITATIONS.md](../CITATIONS.md).

## 10. Use of AI tools

This build was produced with Claude Code following `docs/PLAN.md`. Correctness rests on the test suite and the independent cross-checks above, not on trust in generated code. The team should state this, and what they personally verified, if the event rules ask.
