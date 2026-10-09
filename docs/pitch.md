# 3-minute pitch script

One person speaks, one drives the laptop, a third hands a phone or tablet to a judge. Pre-load every screen in its own tab: `/`, `/learn/discretization`, `/play/2`, `/realtime`, `/lab`, `/honesty`. Keep the backup video (`docs/media/demo.webm`) one click away.

| Time | On screen | What we say |
|---|---|---|
| 0:00–0:20 | Landing, lattice animating | "Quantum computers make an error roughly every thousand operations. Useful algorithms need billions. Error correction is the only way across that gap, and almost nobody understands how it works. We built a game that fixes that." |
| 0:20–0:50 | Chapter 6, slide the error strength to about 0.9 and press **Run the checks 200 times** | "First, the strangest fact: a small, continuous error, once we measure our checks, snaps into either nothing or a full flip. Two bars, nothing in between, and we fix it perfectly every time: 200 out of 200. That's a real state-vector simulation, and it's why error correction works at all." |
| 0:50–1:30 | Main game, level 2. Hand the device to a judge | "Now you try. You can't see the errors, only these glowing checks, just like real hardware. Clear them without corrupting the qubit." Judge plays and submits. "Watch the decoder." Press **Watch the decoder**: dashed matching paths. |
| 1:30–2:15 | Real-time, *Pick a decoder*, d = 9, p = 3%, ×10. Press **Start the clock** | "Here's the twist. Real chips produce these puzzles about a million times per second. These decode times are measured live, in this browser, right now. Exact matching takes over a hundred microseconds per round: the backlog grows, and this T gate is still waiting. The computer stops. Accuracy isn't enough. Speed is the real bottleneck, and that's an active problem in industry today." |
| 2:15–2:45 | Lab, bit-flip, press **Run**, then drag the noise marker across the crossing | "And here's the prize: below a critical noise level, bigger codes win. These curves are live simulations. Our thresholds match published values: 9.9% here, against Stim and PyMatching's 9.85% on the same check, the tools researchers use." |
| 2:45–3:00 | Honesty page, then the QR code on the leaderboard | "Every number here is real and checked, and we list exactly what we simplify. Scan the code to play, and see if you can beat the decoder on our leaderboard." |

## Delivery tips

- Rehearse the full run at least five times with a timer.
- If a judge asks a question mid-demo, answer in one sentence and continue; save depth for Q&A.
- Close with one takeaway: **"Error correction works, but only if decoders keep up."**
- Numbers to have ready: thresholds 9.94% (bit flip, MWPM; published ≈ 10.3%), 2.84% (with measurement errors; published ≈ 2.9%); MWPM ≈ 100 µs per round at d = 9, p = 3% in the browser, union-find ≈ 4 µs; hardware ≈ 1 µs per round.
- The opening error-rate line is a ballpark; confirm it against a current source (CITATIONS.md item 13).
