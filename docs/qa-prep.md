# Judge Q&A prep

Every team member should be able to answer these in their own words. Practice by quizzing each other; never read answers aloud. Numbers come from `docs/validation-report.md` and `src/data/bench.json`.

| Likely question | Strong answer |
|---|---|
| Is the main game really quantum? | The chapters run an exact state-vector simulation. The lattice game tracks Pauli errors classically, which is exact for this noise: the Gottesman-Knill theorem says stabilizer circuits with Pauli noise can be simulated efficiently on a classical computer. Stim, Google's research simulator, uses the same principle. |
| Why can't you just copy the qubit? | The no-cloning theorem. Chapter 2 shows the copy circuit produces an entangled pair instead, with 50% fidelity; measuring then rebuilding scores 25%. |
| How do you detect errors without destroying the state? | Stabilizer measurements ask whether qubits agree, via an ancilla, without measuring their values. The encoded α and β stay hidden (Chapter 4). |
| Why two types of checks? | Quantum errors include bit flips and phase flips. Z-type checks catch bit flips, X-type checks catch phase flips; together they handle any single-qubit error (Y lights both). Chapter 5 shows a phase flip that the bit-flip checks cannot see. |
| How does matching decoding work? | Each lit check is an endpoint of an error chain. MWPM finds the pairing of endpoints, or endpoint to boundary, with the shortest total chain, which is the most likely explanation under independent noise. We implemented Edmonds' blossom algorithm (a port of van Rantwijk's public-domain code) and verified it against brute force and PyMatching. |
| Why also union-find? | It is nearly as accurate (our threshold 9.6% vs 9.9% for MWPM on bit flips) but runs in almost linear time. Measured in the browser at d = 9, p = 3%: union-find about 4 µs per round, MWPM about 100 µs. |
| What is the threshold? | The physical error rate below which making the code bigger reduces logical errors. Above it, bigger codes add more ways to fail than they fix. |
| Why is your threshold about 10%, when hardware papers say about 1%? | Different noise models. About 10% is for perfect checks; about 3% with measurement errors; around 1% for full circuit-level noise, which includes faulty gates. Our lab shows the first two and the honesty panel explains the third. |
| Your 9.94% is below the published 10.3%. Why? | The published value is asymptotic (large codes, toric code). At our distances (5 to 13, planar code) the pairwise crossings rise with size: 9.2%, 9.96%, 9.68%, 10.03%. Stim + PyMatching on the same setup gives 9.85%, so it is finite-size behavior, not a bug. |
| How did you validate it? | Our matching decoder returns exactly the brute-force minimum weight on every instance with up to 16 defects, and the same total weight as PyMatching on 100% of 90,000 exported decoding problems. Our layout equals Stim's for d = 3 to 11. All five thresholds land inside the acceptance bands. The report is in the repo. |
| Your logical outcomes disagree with PyMatching on 6% of the phenomenological instances? | Only when p = q, where every edge weighs 1 and many syndromes have several equally short corrections in different logical classes. Both decoders return the same minimum weight on every instance, so those are proven ties; a paired McNemar test shows our tie-breaking is not biased (p = 0.83, 0.31). With unequal weights, agreement is 100%. |
| What is the backlog problem? | If syndrome data arrives faster than the decoder processes it, the queue grows without limit. Operations that depend on decoded results, like the corrections needed around T gates, must wait, so the computation slows to a halt (Terhal 2015). |
| Is the speed comparison fair? | Decode times are measured live in the browser with `performance.now()` (cross-origin isolated, repeated to beat timer coarsening). The only assumption is a labeled hardware speed-up factor; at ×1 every decoder is slower than a real 1 µs round, which is the honest point: real systems use custom hardware decoders. |
| What do you simplify? | No circuit-level noise in the game, X and Z decoded independently (ignoring Y correlations), scaled timing in real-time mode, and small distances. All listed on the honesty page. |
| How is this different from existing QEC games? | Earlier games like Decodoku focused on puzzles. We connect the quantum basics, playable decoding with a decoder replay, measurement errors in a time stack, the real-time backlog, and a validated threshold lab in one experience. |
| What would you do next? | Circuit-level noise via Stim compiled to the browser, correlated decoding, lattice surgery for logical gates, and a classroom mode with progress tracking. |
| Did you use AI tools? | Answer honestly and specifically: which parts were AI-assisted, and how the team verified correctness (unit tests, the brute-force and PyMatching cross-checks, threshold reproduction). Check the hackathon's rules on AI use beforehand. |

## Concepts to study before the event

- Pauli operators, stabilizers, and why they commute.
- The 3-qubit repetition code (bit-flip and phase-flip versions).
- The rotated surface code layout, logical operators, and code distance.
- Minimum-weight perfect matching and the union-find decoder at a conceptual level.
- Threshold theorem basics and the difference between code-capacity, phenomenological and circuit-level noise.
- Google's 2024 below-threshold surface-code experiment: what it showed and why it mattered.
