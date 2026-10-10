# Below Threshold: Build Plan

This file is the build specification the project was executed from (the original PDF, extracted to text below so it can be read in the repo). The first section records how the build followed it and where we deliberately deviated.

## Build log and adjustments

All twelve phases (0 to 11) were executed in order, committing after each one. The validation gate (Phase 4) passed before any interface work was merged.

| Area | Plan said | What we did, and why |
|---|---|---|
| Chapter 5, Part B | Apply H to each data qubit before and after the Chapter 4 checks on the bit-flip-encoded state. | That measures X-type parities that are **not** stabilizers of the bit-flip code, so it disturbs the stored state (unit test: `Chapter 5: H-sandwiched checks on the bit-flip encoding disturb the state`). Part B therefore re-encodes into the phase-flip code (α\|+++⟩ + β\|−−−⟩) first, then uses the H sandwich, and the app says so. |
| Cross-check pass rule | Logical outcomes agree with PyMatching on at least 99.9% of instances. | Kept for every configuration with non-degenerate weights (100% agreement, including p ≠ q phenomenological noise). With p = q every phenomenological edge weighs 1 and many syndromes have several minimum-weight corrections in different logical classes; there both decoders return exactly the same minimum weight, so disagreements are proven ties. For those we require 100% weight agreement plus an exact McNemar test showing no bias (p = 0.83 and 0.31). |
| Phenomenological threshold metric | Report the logical error rate per round. | The published 2.9% (MWPM) and 2.6% (union-find) are crossings of the failure probability of a whole d-round memory. Per-round rates cross higher because bigger codes also run more rounds. Thresholds are computed from the per-shot rate; per-round rates are still reported. |
| Threshold estimate | Crossing of consecutive-distance curves. | Finite-size scaling fit (Wang, Harrington and Preskill) over d ≥ 7, with every pairwise crossing and the all-distance fit reported next to it. The smallest distance carries the largest finite-size corrections (union-find's d = 5 curve does not cross d = 7 in range at all). |
| Level 2 lives | Losing a puzzle costs a life. | Two errors at d = 3 exceed what the code can always fix, so even perfect play sometimes fails. No life is lost when the decoder also fails on the same seeded puzzle; the card explains why. |
| Real-time speed modeling | Scale browser decode time by one displayed factor. | Decode times are measured live in the browser (each decode repeated until 0.5 ms has elapsed, because browsers coarsen `performance.now()`), and the site is served cross-origin isolated for microsecond timer resolution. The only knob is an explicitly labeled "hardware speed-up" (×1 = browser as measured, no assumption). At ×1 every decoder is slower than a 1 µs hardware round, and the app says so. |
| Depolarizing threshold | Not in the validation table. | Added (published ≈ 15.5% = 10.3% × 3/2 when X and Z are decoded independently); ours 14.6%. |
| Bloch sphere | Three.js or SVG projection. | Lightweight SVG projection (draggable, keyboard-rotatable), no 3D library. |
| Visualizations | Not specified. | Explainer clips rendered with Manim from real simulation output (see `media/README.md`). |
| Explainer film (added after the plan) | Not in the plan. | A narrated ~7-minute film in the style of 3Blue1Brown and 2swap (Manim + LaTeX), cut to a voiceover script the team records; each chapter is embedded next to its interactive version. See `media/README.md`. |
| Team branding (added after the plan) | Not in the plan. | Team PhASE logo: Latin Modern wordmark (matching the film's LaTeX) and a phase-diagram mark, in the app footer, landing page, README and film. |
| Routing | Direct chapter URLs. | `BrowserRouter` with `/learn/<slug>`; `vercel.json` rewrites and a `404.html` copy make deep links work on Vercel and GitHub Pages. |

## Original plan (text extracted from the PDF; tables are flattened)

Summary
We are building Below Threshold, an interactive web game that teaches quantum error
correction, entered in the Quantum Unlocked track. One-line pitch: the first interactive
tool that teaches why real-time decoding is the bottleneck for fault-tolerant quantum
computing.
The player journey has five parts:
1. Six short quantum chapters (real state-vector simulation): superposition, no-cloning,
entanglement, measurement and syndrome extraction, phase errors and interference,
and error discretization. Each chapter is a 1 to 2 minute hands-on puzzle.
2. The main game: players protect a logical qubit on a surface-code lattice. Errors are
hidden; only flagged checks are visible, exactly like real hardware. Then a real decoder
plays the same puzzle and usually wins.
3. Realistic noise: the checks themselves can lie (measurement errors), so decoding
happens across space and time.
4. Real-time decoding mode (our novelty hook): syndrome data arrives on a clock. If the
decoder is slower than the clock, a backlog builds and the computer stalls.
5. Threshold lab and leaderboard: live Monte Carlo simulations show bigger codes
winning below the threshold, and a live leaderboard compares humans against the
decoder at the event.
Why this wins against strong grad-school teams:
It sits exactly on the track's first listed topic (error correction) and its judging focus
(making a hard topic intuitive).
The physics is exact and validated against Stim and PyMatching, the tools researchers
actually use, so expert judges cannot catch shortcuts.
It is genuinely fun to play, and the real-time decoding angle is rarely taught anywhere.
It runs in the browser with no quantum hardware or accounts, so nothing can break on
stage.
Deliverables: a deployed web app, a public GitHub repo with tests, a Python validation
suite, a README and technical write-up, a 3-minute pitch script, and a judge Q&A prep
sheet. This document is written so a builder using Claude Code can execute it phase by
phase (see Build instructions).

Track analysis and strategy
Quantum Unlocked is our best track because it rewards teaching quality and correctness,
which is where a polished, validated project beats raw research depth.
Competition: grad-school teams
Expect expert judges. Any physics shortcut or overclaim will be caught, so every
number in the app must be computed live or come from our validation suite.
Do not try to out-research PhD students. Win on clarity, interactivity, polish, and
verified correctness.
Error correction may be duplicated. Other teams may build syndrome visualizers. Our
differentiators are the full arc (quantum basics, play, lose, watch the decoder win, see
the threshold), measurement-error noise, the real-time decoding backlog mode, and
the live human-vs-decoder leaderboard.
Track What it asks Main trap Fit for us
Quantum
Unlocked
A hard, timely topic
(error correction, fault
tolerance, networking,
algorithms) taught
through an interactive
demo that makes it
intuitive
Shallow visualizers
that look nice but
teach nothing
Exact match: error
correction is the first
listed topic
Quantum
Impact
Public dataset, strong
classical baseline,
quantum subroutine
with a measurable
difference
Honest results at
hackathon scale show
little or no quantum
advantage; most
teams do QAOA
portfolio optimization
Weak: hardest to win
honestly, needs
hardware accounts
Quantum
Playground
Creative piece where
superposition,
interference,
entanglement or
measurement is
essential
Games where the
quantum part is only
randomness
Partial: our lattice
game tracks errors
classically, so we do
not enter here

Prior art to acknowledge honestly: error correction games exist (for example
Decodoku, around 2016). We cite it in the README and explain what we add.
Winning formula
1. Judges play it within the first 30 seconds of the demo.
2. One clear lesson per screen, ending with the threshold and backlog payoffs.
3. Visible rigor: a validation page with our thresholds matching published values, with
error bars.
4. Visible honesty: a short panel listing what the demo simplifies.
5. A team that can answer deep questions (see Judge Q&A prep).
Product vision and player journey
The player should leave able to explain, in their own words, why quantum computers need
error correction, how it works, and why decoder speed matters. Everything in the app
serves that one story: quantum information is fragile, entanglement protects it, decoders
repair it, and speed decides whether it survives.
The journey
1. Landing screen. A live, softly animated lattice in the background, the title, one
sentence ("Keep a quantum computer alive"), and two buttons: Start the story (full
journey) and Jump to the game (for judges in a hurry), plus a third option, Pick a
concept, which opens the Concept Library.
2. Chapters 1 to 6. Each is one screen, one goal, about 1 to 2 minutes. Nothing is locked:
players open any chapter directly from the Concept Library based on what they want
to learn, or follow a suggested path.
3. Bridge screen. "You just protected one qubit with 3. Real machines use hundreds." The
3-qubit code visually morphs into the surface code lattice.
4. Main game levels. Short puzzles of rising difficulty, with lives and a score.
5. The twist. After the player struggles, the decoder plays the same puzzle instantly. The
message: computers can do this, but can they do it fast enough?
6. Real-time mode. The clock starts. The player, then each decoder, tries to keep up.
7. Threshold lab. The noise slider and live chart deliver the payoff: below the threshold,
bigger codes win.

8. Leaderboard and share. Score entry, human-vs-decoder stats, and a link to the repo
and write-up.
Session lengths
Judge path (3 minutes): Jump to the game, play one level, trigger the decoder, open
real-time mode, drag the lab slider.
Full path (12 to 15 minutes): All chapters, levels 1 to 6, real-time mode, lab.
Progress is saved in local storage so players can leave and return.
Design principles
One idea per screen. If a screen needs two paragraphs, split it.
Do first, explain after. Players act, see a result, then read a one-sentence explanation
of what happened.
Never fake. Every outcome comes from the real simulation.
Same visual language everywhere. A qubit, a check, and an error look identical in the
chapters, the game, and the lab.
UI and UX design system
The look is a calm, premium "quantum lab at night": dark, uncluttered, with a few glowing
accents that always carry meaning. A first-time player must understand every screen
within 5 seconds.
Visual style
Theme: dark by default (deep navy-charcoal background, around #0E1220), with a light
theme toggle. Flat surfaces, subtle 1px borders, generous spacing, rounded corners of
12px on cards.
Typography: Inter (or similar sans) for interface text, a monospace (JetBrains Mono or
IBM Plex Mono) for kets like |0 ⟩  and numbers. Body text at least 16px; never below 12px.
Motion: 150 to 300ms eased transitions. Checks pulse briefly when they fire;
corrections draw as a short animated path. Respect the reduced-motion setting by
replacing animation with instant state changes.
Sound: optional, off by default. Soft tick for a check firing, chime for success, low tone
for a logical error.

One visual language (used everywhere)
Never rely on color alone: fired checks also show a dot, errors show a letter, and
corrections show an icon. Run all colors through a color-blindness simulator before demo
day.
Layout
Desktop: left area is the main canvas (lattice or circuit); right panel holds the goal,
controls, and the "What just happened?" card. Top bar shows chapter progress, score,
and lives.
Mobile: canvas on top, controls in a bottom sheet. All tap targets at least 44px. The
lattice scales to fit the screen width.
Maximum two primary actions per screen; the main one is visually dominant.
Element Look Meaning
Data qubit White-outlined circle Stores the protected
information
Z-check (detects bit
flips)
Square tile, teal tint Fires when an odd number of
bit flips touch it
X-check (detects phase
flips)
Square tile, violet tint Fires when an odd number of
phase flips touch it
Fired check Same tile, bright fill plus a dot
icon
"Something is wrong near
here"
Hidden error (revealed
after a round)
Coral ring; letter X, Z, or Y
inside
Where the noise actually
struck
Player correction Blue fill on the qubit What the player applied
Decoder correction Dashed blue path between
checks
What the decoder applied
Logical error Whole lattice flashes coral,
banner "Logical error"
The protected information was
corrupted

Making it easy to play
Goal line: every screen opens with one sentence, such as "Clear every glowing check
without corrupting the qubit."
First-time hints: a ghost hand animation shows the first tap; it disappears after the
first action.
Undo and reset are always visible. Mistakes should feel cheap.
Hint button: highlights one pair of fired checks that likely share an error; using it costs
points but never blocks progress.
"What just happened?" card: after every key action, a 1 to 2 sentence explanation in
plain words, with an optional "Go deeper" expander for the physics.
Tooltips: hover or long-press any element to see what it is.
Glossary drawer: short definitions of qubit, superposition, entanglement, syndrome,
decoder, threshold, logical qubit.
Playtest rule: before demo day, three people with no quantum background play the full
path while the team watches silently. Any spot where someone hesitates for more than
5 seconds gets redesigned.
Accessibility
WCAG AA contrast, full keyboard control (arrow keys move a focus ring over qubits; X,
Z, Y keys apply corrections; Enter submits), screen-reader labels on all controls, and no
information conveyed by color alone.
The six quantum chapters
Each chapter runs on an exact state-vector simulator (at most 5 qubits), so every
probability, collapse and fidelity shown is real. Each chapter has a learning goal, a hands-
on task, a success condition, and a one-line "aha" message. Qubit labels print qubit 0 first,
so |100 ⟩  means qubit 0 is 1.
Concept Library (choose any chapter)
Players choose what to learn. Every chapter is self-contained and can be played in any
order, at any time, with no locks.
Library screen: a grid of six concept cards (two columns on mobile, three on desktop).
Each card shows the concept name, the question it answers (for example "Why can't
we back up a qubit?"), an estimated time (1 to 2 minutes), a difficulty tag (Beginner or

Intermediate), and a completion badge once finished.
Filter and search: tags such as Basics, Entanglement, Measurement, Errors. Typing
"phase" or "copy" finds the right chapter.
Soft suggestions, never locks: a card may say "Helpful first: Superposition". Tapping
the chapter anyway always works.
30-second primer: when a player opens a chapter out of order, a dismissible card
recaps only the ideas that chapter relies on, with a link to the full chapter. For example,
Chapter 4 recaps entanglement and the 3-qubit encoding in two sentences and one
picture.
Self-contained setup: each chapter prepares its own starting state (for example,
Chapter 4 starts with the encoded state already built, with a button to watch how it
was built), so no chapter depends on earlier progress.
Suggested paths: shown at the top of the library as optional shortcuts:
Full story: 1, 2, 3, 4, 5, 6, then the game.
Fast track (5 minutes): 1, 4, 6, then the game.
Why QEC is hard: 2, 5, 6.
How checks work: 3, 4, 5.
Navigation: inside any chapter, a top bar shows "Back to library" and "Next suggested";
the player can jump anywhere at any time.
Direct links: each chapter has its own URL (for example /learn/entanglement,
/learn/no-cloning), so judges can be sent straight to a concept and links can be shared.
Progress: completed chapters are saved in local storage; a "Reset progress" option
lives in settings.
Game and lab access: the main game, real-time mode and lab are also always open
from the library and the top navigation; the chapters are recommended but never
required.
The chapter numbers below are only a suggested reading order, not a requirement.
Shared chapter interface
State panel: a Bloch sphere per qubit (drag to rotate), amplitude bars for each basis
state (bar height is probability, bar color hue is phase), and a shots histogram.
Circuit strip: a simple left-to-right circuit that grows as the player applies gates; tap a
gate to undo back to that point.
Gate palette: only the gates that chapter needs (keeps it simple).

Measure buttons: "Measure once" (collapses the state, shown with an animation) and
"Run 100 shots" (fills the histogram from fresh copies of the state).
Chapter 1: Superposition
Goal: understand that a qubit can hold 0 and 1 at once, and that measurement gives
one random answer.
Tasks: (1) turn |0 ⟩  into |1 ⟩  using X; (2) make a 50/50 state with H and run 100 shots; (3)
use the Ry slider to hit a 75/25 target; (4) interference puzzle: apply H twice and see
the state return to |0 ⟩  every time, because the two paths to |1 ⟩  cancel.
Under the hood: gates X, H, Z, Ry( θ ); measurement probability = squared amplitude.
Success: all four tasks complete.
Aha: "A qubit isn't secretly 0 or 1. Its amplitudes can even cancel out, which is
interference."
Chapter 2: No-cloning
Goal: see why we cannot protect a qubit by backing it up.
Task: a "copy machine" (a CNOT from the input qubit onto a blank qubit). The player
feeds it |0 ⟩ , then |1 ⟩  (both copy perfectly), then |+ ⟩  (the 50/50 state).
Result shown: the output is not two copies of |+ ⟩  but an entangled pair. A fidelity
meter reads 50% against the ideal |+ ⟩ |+ ⟩ . A second attempt, "measure, then rebuild
two copies", scores only 25% on average.
Under the hood: fidelity = | ⟨ ideal|actual ⟩ |². CNOT on |+ ⟩ |0 ⟩  gives (|00 ⟩  + |11 ⟩ )/√2, whose
overlap with |++ ⟩  is exactly 1/2.
Aha: "No machine can copy an unknown quantum state. That's a law of physics, called
the no-cloning theorem. Classical backups won't work."
Chapter 3: Entanglement
Goal: spread one qubit's information across three qubits so no single qubit holds it.
Tasks: (1) build a Bell pair with H then CNOT and run 100 shots: results are always 00 or
11, never mixed; (2) encode an arbitrary state α |0 ⟩  + β |1 ⟩  into α |000 ⟩  + β |111 ⟩  with two
CNOTs.
Result shown: each qubit's own Bloch arrow shrinks toward the center of the sphere.
Individually, the qubits look random; the information lives only in their correlations.

Under the hood: single-qubit Bloch vector from the reduced density matrix; its length
drops below 1 when the qubit is entangled. For α  = β  the length is exactly 0.
Aha: "Entanglement lets us store one qubit in the relationships between many, which is
how we protect it without copying."
Chapter 4: Measurement and syndrome extraction
Goal: learn to detect an error without destroying the stored information.
Setup: data qubits 0 to 2 hold α |000 ⟩  + β |111 ⟩ ; helper (ancilla) qubits 3 and 4 start at |0 ⟩ .
Task part A (the wrong way): measure data qubit 0 directly. The superposition
collapses and the fidelity meter drops; the information is gone.
Task part B (the right way): the game secretly applies an X error to one random data
qubit (or none). The player runs the check circuit: CNOTs from qubits 0 and 1 into
ancilla 3 (asks "do 0 and 1 agree?") and from qubits 1 and 2 into ancilla 4 ("do 1 and 2
agree?"). Measuring the ancillas gives a two-bit syndrome. The player then applies X to
the qubit they think flipped.
Syndrome table: (0,0) no error; (1,0) qubit 0; (1,1) qubit 1; (0,1) qubit 2.
Result shown: fidelity returns to exactly 100%, and α  and β  were never revealed.
Aha: "We asked 'do these qubits agree?' instead of 'what are they?'. That's a stabilizer
measurement, the core of all quantum error correction."
Chapter 5: Phase errors and interference
Goal: discover a second kind of error that the bit-flip code cannot see.
Task part A: encode with α  ≠ β  (for example a 70/30 state with a relative phase visible
on the amplitude bars), let the game apply a hidden Z error, and run the Chapter 4
checks. The syndrome reads (0,0), "all clear", yet the fidelity meter has dropped. The
error is invisible.
Task part B: apply H to each data qubit before and after the checks (the "H sandwich").
Interference turns the phase flip into a bit flip the checks can see. The player now
detects and fixes Z errors, using the phase-flip version of the code.
Under the hood: H maps Z errors to X errors; the phase-flip code stores the state in
the |+++ ⟩  / |−−− ⟩  basis.
Aha: "Quantum errors come in two kinds, bit flips and phase flips. Real codes need
checks for both, which is why the surface code has two types of checks." This leads
straight into the teal and violet checks of the main game.

Chapter 6: Error discretization
Goal: understand why error correction works at all when real errors are small,
continuous drifts.
Setup: the encoded 3-qubit state plus 2 ancillas, as in Chapter 4.
Task: the player drags an "error strength" slider that applies a small rotation Rx( θ ) to
one data qubit, a partial flip rather than a full one. Then they run the checks 200 times.
Result shown: the histogram has only two bars: "no error" (probability cos²( θ /2)) and
"full flip on that qubit" (probability sin²( θ /2)). Nothing in between. After correction, the
fidelity is exactly 100% every single time. A live readout compares the measured
frequency with the formula.
Aha: "Measuring the checks snaps a continuous error into a discrete one we know how
to fix. Without this quantum effect, error correction would be impossible."
Note: this exact behavior is already covered by an automated test (see Testing and
validation).
After the chapters
A bridge animation morphs the 3-qubit code into a distance-3 surface code: "The
repetition code catches one kind of error. The surface code catches both, on a 2D grid
that real chips can build."
Main game
The player protects one logical qubit on a rotated surface code (the layout Google and
others use). Errors are hidden; only fired checks are visible. The player applies corrections
until every check is dark, then the round is revealed.
Core loop
1. Noise strikes. The simulation samples random errors at the level's error rate. At least
one check must fire (resample otherwise).
2. Player reads the syndrome. Fired checks glow. Hidden errors are not shown.
3. Player corrects. Tap a data qubit to open a small radial menu: X (fixes bit flips, affects
teal checks), Z (fixes phase flips, affects violet checks), Y (both). In bit-flip-only levels
a single tap applies X directly. Checks update live after every tap.
4. Submit. Enabled once all checks are dark. If any check still glows, the button explains
why instead of submitting.

5. Reveal. Hidden errors appear as coral rings, the player's corrections in blue. The game
multiplies them together and checks the result against the logical operators:
Success: the leftover is a harmless stabilizer loop. "Qubit saved."
Logical error: the leftover stretches across the lattice. The lattice flashes coral, the
error chain is highlighted end to end, and the player loses a life. The card explains:
"Your fix plus the noise formed a chain from one edge to the other. That flips the
stored information."
6. Decoder replay. A "Watch the decoder" button shows the decoder solving the same
instance, drawing its matching paths as dashed lines, and reports its result and decode
time.
Levels
Scoring
+100 for a saved qubit, plus a bonus of 50 minus 10 per correction beyond the minimum
the decoder used (floor 0).
Time bonus on the boss level.
Level Distance Errors Noise New idea taught
1 3 Exactly 1 X
error
Fixed One flip lights two checks (or
one at an edge)
2 3 Exactly 2 X
errors
Fixed Pairs of lit checks, and errors at
boundaries
3 3 Random X
errors
p = 5% Shortest explanation is usually
right
4 5 X and Z errors p = 4% Two check types, two
independent puzzles
5 5 X, Y and Z
errors
p = 6% Y errors light both types
6 7 X, Y and Z
errors
p = 6% Bigger code tolerates more
errors
7
(boss)
7 Depolarizing
noise
p = 8%, 45-
second timer
Time pressure, which leads into
real-time mode

Hints cost 25 points.
Three lives per run; a lost life resets the current level, not the run.
Every instance is generated from a seed, so the leaderboard can compare humans and
decoders on identical puzzles.
The twist moment
After level 3 (or on the first logical error), a short scene plays: the decoder solves 1,000
level-3 puzzles in under a second with its success rate shown, compared with the player's.
The card reads: "Machines decode better than us. But real quantum computers produce
these puzzles a million times per second. Can a decoder keep up?" A button leads to real-
time mode.
Realistic noise and real-time decoding
This is our novelty hook: almost no teaching tool shows that decoders must keep pace
with the hardware, and that falling behind stalls the whole computer.
Part 1: Checks that lie (measurement errors)
Model: phenomenological noise. Each round, every data qubit suffers an error with
probability p, and every check result is reported wrong with probability q (default q =
p).
Key idea for players: because a check can lie, we repeat the checks every round and
look for changes. A detection event is a check whose result differs from the previous
round.
Visual: a "time stack" view. The current round's lattice is in front; previous rounds fade
behind it like layers (or a scrolling strip of mini-lattices on mobile). A data error shows
as a detection pair in the same round; a measurement error shows as a detection pair
in the same check across two consecutive rounds.
Mini-puzzle: the player sees 4 rounds of detection events and must label each pair as
"qubit error" or "check error", then the decoder shows its space-time matching.
Final round: the last round's data qubits are measured directly (perfect readout),
which closes the time stack, as in real memory experiments.

Part 2: Real-time mode
The clock: syndrome rounds arrive on a fixed beat (displayed at a human-visible speed,
with a label noting that real superconducting chips run about one round per
microsecond).
The backlog meter: a queue of undecoded rounds. Each round adds one block; the
decoder removes blocks as it finishes them. If the decoder is slower than the clock, the
queue grows without limit.
Logical operations that must wait: periodically a "T gate" request arrives. Some
operations in a real algorithm cannot proceed until the decoder has caught up (they
need the corrected result to choose the next step). Each request shows a waiting
timer. With a backlog, waits grow round after round, and the computation visibly stalls.
Three ways to play:
1. You are the decoder: the player corrects rounds by hand while the clock ticks. They
will fall behind quickly, which is the point.
2. Pick a decoder: greedy (fast, less accurate), union-find (fast, accurate), or exact
matching (most accurate, slowest). The player watches backlog and logical error
rate side by side.
3. Tune the machine: sliders for code distance, physical error rate, and decoder speed.
The player hunts for settings that are both accurate and fast enough.
Honest speed modeling: decoding time per round is measured from our actual
decoder in the browser (performance.now), then scaled by one clearly displayed
factor to map browser speed onto the displayed clock. The scaling is shown in the
honesty panel.
Aha: "Error correction isn't only about accuracy. A decoder that is right but too slow
still stops the computer. That's why companies build custom decoding hardware."
Background for the team (cite in the write-up)
The backlog problem is discussed in Terhal's review of quantum error correction for
quantum memories (Reviews of Modern Physics, 2015). Recent hardware experiments,
including Google's below-threshold surface code results (2024), emphasized real-time
decoding. Before demo day, the team should read the relevant sections and confirm the
exact claims and numbers they quote.

Threshold lab and leaderboard
The lab is the scientific payoff: players run real Monte Carlo experiments and watch the
threshold emerge, the same effect behind recent below-threshold hardware results.
Threshold lab
Controls: noise model (bit-flip only, depolarizing, or phenomenological with
measurement errors), decoder (greedy, union-find, exact matching), code distances (3,
5, 7, 9 as toggles), error-rate range, and a "Run" button.
The chart: logical error rate (log scale) against physical error rate, one line per distance,
with 95% confidence bands (Wilson interval). Points stream in as simulations finish.
The moment: a big noise slider with a vertical marker on the chart. A readout says
either "Above threshold: bigger codes make things worse" or "Below threshold: bigger
codes make things better", and shows the suppression factor (how much the logical
error rate drops each time the distance grows by 2).
Context line: "In 2024, Google showed this on real hardware, with error rates falling by
roughly half per step in distance." The team must verify this wording against the paper
before demo day.
Performance: simulations run in a Web Worker so the interface never freezes. Adaptive
sampling: each point runs until 100 logical failures or 20,000 trials, whichever comes
first.
Validation badge: a small panel shows our estimated threshold for the selected model
and decoder next to the published value, with a link to the validation report.
Leaderboard
What it records: player name (optional, defaults to an anonymous animal name), score,
levels cleared, and the human success rate on seeded puzzles.
Human vs decoder stat: because every puzzle is seeded, we can show "Humans at this
event solved 61% of level-3 puzzles; the decoder solved 94% of the same puzzles"
(example numbers; real ones come from live data).
Storage: works offline with local storage. For the live event, an optional tiny backend
(for example a free Supabase table) collects scores from all devices. The app must
work fine if the backend is down.
Event mode: a QR code on the demo screen lets judges and attendees play on their
phones; the leaderboard updates on the main screen.

Privacy: no emails or personal data; names are optional and filtered for profanity.
Physics and algorithm specification
This section is the source of truth for correctness. The builder should implement exactly
this, and the tests in the next sections check it.
1. State-vector simulator (chapters)
Amplitudes stored as two Float64Arrays (real and imaginary), length 2^n, n at most 10
(chapters use at most 5).
Convention: qubit q is bit q of the basis index; labels print qubit 0 first.
Operations: apply any 2x2 complex matrix to one qubit; gates X, Y, Z, H, S, Rx( θ ), Ry( θ );
CNOT and CZ; projective Z measurement with collapse and renormalization; reset.
Readouts: probability of 1 on a qubit; single-qubit Bloch vector from the reduced
density matrix (length below 1 means entangled); fidelity | ⟨ψ | φ⟩ |² between two states;
list of nonzero terms for display.
Measurements accept an injectable random function so tests are deterministic.
A first draft of this module (quantum.js) and its tests were already written in our chat
and can be used as the starting point.
2. Rotated surface code layout (distance d, odd)
Data qubits: d × d grid at positions (r, c), r and c from 0 to d−1.
Plaquettes: at corner positions (r, c), r and c from 0 to d. Plaquette (r, c) touches the
data qubits (r−1, c−1), (r−1, c), (r, c−1), (r, c) that exist.
Types: checkerboard by (r + c) parity, for example even = X-type, odd = Z-type.
Which plaquettes exist: all interior ones (r and c from 1 to d−1, weight 4). On the top
and bottom edges keep only X-type weight-2 plaquettes; on the left and right edges
keep only Z-type weight-2 plaquettes. Corners are never used.
Count check: there must be exactly d² − 1 stabilizers, half X-type and half Z-type.
Logical operators (with this boundary choice): logical X is X on every qubit of one
column (top to bottom); logical Z is Z on every qubit of one row. Tests must confirm
these commute with every stabilizer and anticommute with each other. If they fail,
swap rows and columns; the tests decide.
Cross-check the layout against Stim's generated rotated surface code circuits during
validation.

3. Errors and syndromes
Errors are tracked as a Pauli frame: two bit arrays per data qubit, x[i] and z[i]. Y means
both set.
A Z-type check fires if an odd number of qubits on its support have x set. An X-type
check fires if an odd number have z set.
Applying a correction XORs into the same arrays.
Logical failure test after correction: the residual (error times correction) must have
zero syndrome (assert this; a nonzero syndrome is a bug). Then the round failed if the
residual's x bits have odd parity on the logical Z row, or its z bits have odd parity on the
logical X column.
4. Noise models
All randomness comes from a seeded generator (for example mulberry32 or
xoshiro128**), so any instance can be replayed exactly.
5. Decoding graph
X errors and Z errors are decoded independently (standard for these models; under
depolarizing noise this ignores Y correlations, which we note in the honesty panel).
For X errors: nodes are Z-type checks plus one virtual boundary node. Each data qubit
is an edge between the two Z-checks it touches, or between its single Z-check and the
boundary.
For measurement errors: copy the check nodes for each round and add time edges
between the same check in consecutive rounds.
Model Per round Used in
Bit-flip code capacity X on each data qubit with
probability p; perfect checks
Levels 1 to 3, lab
Depolarizing code
capacity
X, Y or Z each with probability
p/3; perfect checks
Levels 4 to 7, lab
Phenomenological Data noise as above, plus each
check result flipped with
probability q; d rounds then a
perfect final readout
Measurement-error and real-
time modes, lab

Edge weight = log((1 − p) / p) for space edges and log((1 − q) / q) for time edges; with
equal rates all weights are 1.
Detection events: the fired checks (code capacity) or the changes between
consecutive rounds (phenomenological).
6. Decoders
Exact small decoder (for tests): brute-force minimum-weight matching using bitmask
dynamic programming over defects, each defect matched to another defect or to the
boundary. Only used when there are at most 16 defects.
Minimum-weight perfect matching (MWPM): compute shortest-path distances
between defects (and from each defect to the boundary) on the decoding graph. Build
the standard complete graph: each defect, a boundary twin per defect, defect-to-
defect edges, defect-to-own-twin edges, and zero-weight twin-to-twin edges. Solve
with Edmonds' blossom algorithm (port a well-known open-source implementation,
such as the public mwmatching code, and credit it). Convert matched pairs into
corrections along shortest paths.
Union-find decoder (Delfosse and Nickerson, 2021): grow all odd clusters by half-
edges each step, merge touching clusters with union-find (path compression, union by
size), and stop when every cluster is even or touches the boundary. Then apply the
peeling decoder (Delfosse and Zémor) on a spanning forest of each cluster to produce
the correction. Near-linear running time.
Greedy decoder (baseline): repeatedly match the closest remaining pair, or a defect
with the boundary if that is closer.
All decoders share one interface: input = decoding graph plus detection events, output
= list of data-qubit flips and time spent.
7. Statistics
Logical error rate with a 95% Wilson confidence interval.
Threshold estimate: where the curves for consecutive distances cross, found by
interpolating in log scale. Report the crossing range across distance pairs.
For phenomenological noise, report the logical error rate per round.
The Wilson interval for k failures in n trials, with z = 1.96:
\frac{\hat p + \frac{z^2}{2n} \pm z\sqrt{\frac{\hat p(1-\hat p)}{n} + 
\frac{z^2}{4n^2}}}{1 + \frac{z^2}{n}}, \qquad \hat p = \frac{k}{n}

Architecture and tech stack
The app is a static web app (no server required) built with TypeScript, React and Vite,
with all physics in framework-free TypeScript modules that are tested independently of
the interface.
We switched from the earlier "plain JavaScript, no build step" idea because the builder will
run Claude Code, which can install, build and test. TypeScript catches bugs earlier and
reads better on a resume.
Stack
Layer Choice Why
Language TypeScript (strict mode) Type safety for the physics code
UI React 18 + Vite Fast to build, widely known
State Zustand Simple global state (progress,
settings, score)
Styling CSS variables + CSS modules Full control of the design system,
dark and light themes
Lattice and
circuits
SVG rendered by React Crisp at any size, easy hit-testing
Bloch sphere Three.js (via react-three-fiber) or
a lightweight SVG projection
Draggable 3D sphere
Charts Hand-rolled SVG with d3-scale Log axes, confidence bands, full
styling control
Heavy simulation Web Worker (via Comlink) Lab and decoder races never
freeze the interface
Unit tests Vitest Fast, works with Vite
End-to-end smoke
test
Playwright Confirms each screen loads and
is playable
Validation Python 3.11: stim, pymatching,
numpy, matplotlib, pytest
Research-standard cross-checks

File structure
below-threshold/
  package.json, tsconfig.json, vite.config.ts
  README.md, LICENSE (MIT), CITATIONS.md
  docs/
    writeup.md            technical write-up
    pitch.md              3-minute script
    qa-prep.md            judge Q&A
    validation-report.md  generated thresholds and plots
  src/
    core/                 pure physics, no React
      rng.ts              seeded random generator
      quantum.ts          state-vector simulator
      surfaceCode.ts      layout, stabilizers, logicals
      pauliFrame.ts       errors, syndromes, residual check
      noise.ts            the three noise models
      decodingGraph.ts    graph construction, shortest paths
      decoders/
        exactSmall.ts     bitmask DP (tests only)
        mwpm.ts           blossom-based matching
        unionFind.ts      union-find + peeling
        greedy.ts         baseline
        index.ts          shared Decoder interface
      stats.ts            Wilson interval, threshold crossing
      exportInstances.ts  JSON export for Python cross-checks
    workers/
      sim.worker.ts       Monte Carlo and decoder timing
    ui/
      theme/              tokens.css, light and dark themes
      components/         Button, Card, GoalLine, HintButton,
                          WhatHappenedCard, Tooltip, Glossary,
                          ProgressBar, BlochSphere, AmplitudeBars,
                          Histogram, CircuitStrip, Lattice,
Layer Choice Why
Hosting Vercel or GitHub Pages Free static hosting, deploys from
GitHub
Leaderboard
(optional)
Supabase free tier Shared scores at the event; app
works without it

TimeStack, BacklogMeter, ThresholdChart
      screens/
        Landing.tsx
        chapters/Chapter1..Chapter6.tsx, Bridge.tsx
        Game.tsx
        RealTime.tsx
        Lab.tsx
        Leaderboard.tsx
        Honesty.tsx
    store/                Zustand stores
    App.tsx, main.tsx
  tests/
    core/*.test.ts        unit and property tests
    e2e/smoke.spec.ts
  validate/
    requirements.txt
    cross_check.py        compare our decoders with PyMatching
    thresholds.py         reproduce published thresholds
    plots/
Core module interfaces
// surfaceCode.ts
interface SurfaceCode {
  d: number;
  dataQubits: { r: number; c: number }[];
  stabilizers: { type: 'X' | 'Z'; support: number[]; pos: { r: number; c: 
number } }[];
  logicalX: number[];   // data qubit indices
  logicalZ: number[];
}
function makeRotatedSurfaceCode(d: number): SurfaceCode;
// pauliFrame.ts
interface PauliFrame { x: Uint8Array; z: Uint8Array }
function syndrome(code: SurfaceCode, f: PauliFrame): Uint8Array; // one bit 
per stabilizer
function isLogicalFailure(code: SurfaceCode, error: PauliFrame, correction: 
PauliFrame): boolean;
// noise.ts
type NoiseModel =

| { kind: 'bitflip'; p: number }
  | { kind: 'depolarizing'; p: number }
  | { kind: 'phenomenological'; p: number; q: number; rounds: number };
function sampleNoise(code: SurfaceCode, m: NoiseModel, rng: Rng): 
NoiseSample;
// decoders/index.ts
interface DecodeResult { flips: number[]; matching: [number, number][]; ms: 
number }
interface Decoder { name: string; decode(g: DecodingGraph, defects: 
number[]): DecodeResult }
The UI only calls these interfaces, so decoders can be swapped or benchmarked without
touching screens.
Testing and validation
No interface work starts until the core tests and the PyMatching cross-check pass.
Validation is what earns trust from expert judges.
Unit and property tests (Vitest)
Quantum simulator: H gives 50/50; Bell state qubits have Bloch length 0; cloning |+ ⟩ 
gives fidelity 0.5; measuring renormalizes correctly; the Chapter 6 discretization test
(a small rotation error is always fully corrected after the checks, 200 random trials).
Surface code layout (d = 3, 5, 7, 9): exactly d² − 1 stabilizers; every pair of stabilizers
commutes (even overlap between X-type and Z-type supports); logical X and logical Z
commute with all stabilizers and anticommute with each other.
Syndromes: a single X error fires 1 or 2 Z-checks and no X-checks; applying any
stabilizer as an error gives zero syndrome and is never a logical failure; applying a
logical operator gives zero syndrome and is always a logical failure.
Decoders: every correction clears the syndrome (100,000 random instances); MWPM
total weight equals the exact bitmask decoder on all instances with 16 or fewer
defects; any single error is always corrected at every distance; at distance d, any error
of weight up to (d − 1)/2 is always corrected by MWPM.
Reproducibility: the same seed gives the same instance and the same decoder output.

Cross-check against PyMatching
1. The app exports 10,000 seeded instances per configuration as JSON: the check matrix,
the detection events, and our decoder's corrections.
2. validate/cross_check.py loads them, decodes with PyMatching using the same check
matrix and weights, and compares.
3. Pass criteria: our MWPM matches PyMatching's correction weight on 100% of
instances (ties may give different but equally short corrections, so compare weights
and logical outcomes, not exact flips); logical outcomes agree on at least 99.9%.
Threshold reproduction
The published values below are approximate figures from the literature; the team must
confirm each one against its source and record the citation in CITATIONS.md.
validate/thresholds.py runs our decoders (through exported data, or a Node runner)
and PyMatching on Stim-generated or our own samples, then writes plots and
docs/validation-report.md.
The report includes the plots, the crossing estimates with confidence ranges, run
settings, and the machine and date used.
Performance benchmarks
Median and 99th-percentile decode time per round for each decoder at d = 3, 5, 7, 9, 11
and p = 1%, 3%, 5%.
These numbers feed real-time mode and appear in the write-up.
Noise model Decoder Published threshold
(approx.)
Our acceptance
band
Bit-flip code capacity MWPM about 10.3% 9.5% to 11%
Bit-flip code capacity Union-
find
about 9.9% 9.0% to 10.5%
Phenomenological (q =
p)
MWPM about 2.9% 2.5% to 3.3%
Phenomenological (q =
p)
Union-
find
about 2.6% 2.2% to 3.0%

Interface checks
Playwright smoke test: every screen loads, a level can be completed, and the lab runs
one point without errors.
Manual playtest with three non-experts (see the UI section).
Build instructions for Claude Code
Build in 12 phases, in order, committing after each. Never start interface work before
Phase 4 passes. Save this document in the repo as docs/PLAN.md so Claude Code can
read it.
Kickoff prompt (paste into Claude Code)
Read docs/PLAN.md fully. It is the specification for "Below Threshold",
an interactive quantum error correction game for a hackathon.
Build it phase by phase exactly as described in "Build instructions".
Rules:
- Follow the "Physics and algorithm specification" exactly.
- Write tests first for every core module; do not move to the next phase
  until all tests for the current phase pass.
- Never fake or hardcode simulation results. Every number shown in the UI
  must come from the live simulation or the validation outputs.
- Keep physics in src/core with no React imports.
- Follow the "UI and UX design system" for every screen.
- Commit after each phase with a clear message.
- At the end of each phase, summarize what was built, test results,
  and anything uncertain.
Start with Phase 0.
Phases
1. Phase 0, setup: Vite + React + TypeScript (strict), Vitest, ESLint, Prettier, Playwright,
GitHub Actions running tests on every push. Done when: an empty app builds and the
CI passes.
2. Phase 1, quantum simulator: quantum.ts plus tests. Done when: all simulator tests
pass, including discretization.
3. Phase 2, surface code core: rng, surfaceCode, pauliFrame, noise. Done when: layout,
commutation, logical and syndrome tests pass for d = 3 to 9.

4. Phase 3, decoders: decoding graph, exact small decoder, MWPM, union-find, greedy.
Done when: all decoder tests pass on 100,000 random instances.
5. Phase 4, validation gate: JSON export, cross_check.py, thresholds.py, validation
report. Done when: the PyMatching cross-check passes and thresholds fall in the
acceptance bands. If not, stop and fix before anything else.
6. Phase 5, design system and app shell: theme tokens, shared components, navigation,
progress saving, landing screen. Done when: every component renders in both themes
and on a 375px-wide mobile screen.
7. Phase 6, chapters 1 to 6 and the bridge: Done when: the Concept Library works, every
chapter opens directly from the library and from its own URL in any order, each is
completable on its own with its primer, its aha card appears, and a non-expert can
finish it without help.
8. Phase 7, main game: levels 1 to 7, scoring, reveal, decoder replay, twist scene. Done
when: all levels are playable with mouse, touch and keyboard.
9. Phase 8, measurement errors and real-time mode: time stack, backlog meter, T-gate
waits, three play modes, measured decoder timing. Done when: a slow decoder visibly
builds a backlog and a fast one does not.
10. Phase 9, threshold lab and leaderboard: worker-based Monte Carlo, live chart, noise
slider, suppression-factor readout, validation badge, local leaderboard, optional
Supabase and QR event mode. Done when: the lab reproduces the crossing visibly
within about 30 seconds on a laptop.
11. Phase 10, polish: animations, sound toggle, accessibility pass, performance (60 frames
per second on the lattice at d = 7), honesty panel, playtests, fixes.
12. Phase 11, ship: README (with GIFs), write-up, pitch, Q&A sheet, deploy, and a
recorded 2-minute backup demo video in case the venue Wi-Fi fails.
Priority if time runs short
Cut from the bottom of this list first: Supabase and QR event mode, sound, the
depolarizing level 5, the greedy decoder in the lab, the union-find decoder (keep MWPM),
real-time play mode 3. Never cut: tests, the validation gate, chapters 4 and 6, the main
game, real-time mode with a decoder, the threshold lab.
Open question for the team
The hackathon length decides the time per phase. With about 24 hours, aim to finish
Phase 4 by hour 8, Phase 7 by hour 16, and Phase 11 by hour 22, leaving 2 hours of buffer.

Demo script and 3-minute pitch
The demo gets a judge playing within 30 seconds and ends on the real-time decoding
payoff. One person speaks, one person drives the laptop, and a third hands a phone or
tablet to a judge.
Time On screen What we say
0:00 to
0:20
Landing screen, lattice animating "Quantum computers make an error
roughly every thousand operations. Useful
algorithms need billions. Error correction is
the only way across that gap, and almost
nobody understands how it works. We
built a game that fixes that."
0:20 to
0:50
Chapter 6 histogram "First, the strangest fact: a small,
continuous error, once we measure our
checks, snaps into either nothing or a full
flip. Two bars, nothing in between, and we
fix it perfectly every time. That's real
quantum simulation, and it's why error
correction works at all."
0:50 to
1:30
Main game, level 2, judge plays "Now you try. You can't see the errors, only
these glowing checks, just like real
hardware. Clear them without corrupting
the qubit." Judge plays. Then: "Watch the
decoder." It solves the puzzle instantly.
1:30 to
2:15
Real-time mode "Here's the twist. Real chips produce these
puzzles about a million times per second.
Watch what happens when the decoder is
too slow." Backlog grows, T-gate requests
stall. "The computer stops. Accuracy isn't
enough. Speed is the real bottleneck, and
that's an active problem in industry today."

Delivery tips
Rehearse the full run at least five times with a timer.
Pre-load every screen in separate browser tabs and keep the backup video ready.
If a judge asks a question mid-demo, answer briefly and continue; save deep answers
for Q&A.
Close by naming one concrete takeaway: "Error correction works, but only if decoders
keep up."
Note: the opening line's error rate is a rough, commonly cited ballpark for today's best
hardware; check a current source and adjust before demo day.
Judge Q&A prep
Every team member should be able to answer these in their own words. Practice by
quizzing each other; never read answers aloud.
Time On screen What we say
2:15 to
2:45
Threshold lab, drag slider "And here's the prize: below a critical noise
level, bigger codes win. These curves are
live simulations, and our thresholds match
published values, validated against Stim
and PyMatching, the tools researchers
use."
2:45 to
3:00
Validation and honesty panels,
QR code
"Every number here is real and checked,
and we list exactly what we simplify. Scan
the code to play, and see if you can beat
the decoder on our leaderboard."

Likely question Strong answer
Is the main game really quantum? The chapters run an exact quantum state-
vector simulation. The lattice game tracks
Pauli errors classically, which is exact for this
noise: the Gottesman-Knill theorem says
stabilizer circuits with Pauli noise can be
simulated efficiently on a classical computer.
Stim, Google's research simulator, uses the
same principle.
Why can't you just copy the qubit? The no-cloning theorem. Chapter 2 shows
the copy circuit produces an entangled pair
instead, with 50% fidelity.
How do you detect errors without
destroying the state?
Stabilizer measurements ask whether qubits
agree, via an ancilla, without measuring their
values. The encoded information stays
hidden.
Why two types of checks? Quantum errors include bit flips and phase
flips. Z-type checks catch bit flips, X-type
checks catch phase flips; together they
handle any single-qubit error.
How does matching decoding work? Each fired check is an endpoint of an error
chain. MWPM finds the pairing of endpoints,
or endpoint to boundary, with the shortest
total chain, which is the most likely
explanation under independent noise.
Why also union-find? It is nearly as accurate as matching but runs
in nearly linear time, which matters for real-
time decoding. Our benchmarks show the
speed difference.
What is the threshold? The physical error rate below which making
the code bigger reduces logical errors.
Above it, bigger codes add more ways to fail
than they fix.

Likely question Strong answer
Why is your threshold about 10%, when
hardware papers say about 1%?
Different noise models. 10% is for perfect
checks; about 3% with measurement errors;
around 1% for full circuit-level noise, which
includes faulty gates. Our lab shows the first
two and explains the third.
How did you validate it? Our matching decoder agrees with
PyMatching on every exported instance, and
our thresholds match published values
within our acceptance bands. The validation
report is in the repo.
What is the backlog problem? If syndrome data arrives faster than the
decoder processes it, the queue grows
without limit. Operations that depend on
decoded results, like those needed for T
gates, must wait, so the computation slows
to a halt.
What do you simplify? No circuit-level noise in the game, X and Z
decoded independently (ignoring Y
correlations), scaled timing in real-time
mode, and small distances. All listed in the
honesty panel.
How is this different from existing QEC
games?
Earlier games like Decodoku focused on
puzzles. We connect the quantum basics,
playable decoding, measurement errors,
real-time backlog, and a validated threshold
lab in one experience.
What would you do next? Circuit-level noise via Stim in the browser,
correlated decoding, lattice surgery for
logical gates, and a classroom mode with
progress tracking.
Did you use AI tools? Answer honestly and specifically: which
parts were AI-assisted, and how the team
verified correctness (tests and the
PyMatching cross-check). Check the
hackathon's rules on AI use beforehand.

Concepts to study before the event
Pauli operators, stabilizers, and why they commute.
The 3-qubit repetition code (bit-flip and phase-flip versions).
The rotated surface code layout, logical operators, and code distance.
Minimum-weight perfect matching and the union-find decoder at a conceptual level.
Threshold theorem basics and the difference between code-capacity,
phenomenological, and circuit-level noise.
Google's 2024 below-threshold surface code experiment: what it showed and why it
mattered.
Risks, honesty, shipping and checklist
The biggest risk is not the code but the team: expert judges will test whether you
understand what you built.
Risks and fallbacks
Risk Fallback
Team can't answer deep questions Study the Q&A section; each member owns two
topics and can explain them on a whiteboard
Blossom MWPM port is buggy Exact bitmask decoder for small instances plus
union-find; PyMatching remains the reference in
validation
Thresholds miss the acceptance bands Check layout and logical tests first, then weights
and boundary handling; report honest numbers
rather than tuning to match
Running out of time Follow the cut list in the build instructions
Lab too slow on the demo laptop Pre-computed results from the validation run,
clearly labeled as such, plus the live slider at small
distances
Wi-Fi fails at the venue Run locally (npm run preview) and keep the
backup video

Honesty panel text (in the app)
"What we simplify: the main game uses code-capacity and phenomenological noise, not
full circuit-level noise. Bit-flip and phase-flip errors are decoded separately. Real-time
mode runs on a slowed-down clock, scaled from our measured browser decode times.
Distances are small compared with future machines. Everything shown is computed live
or comes from our validation runs, documented in the repo."
Deployment
1. Push to a public GitHub repo with an MIT license.
2. Connect the repo to Vercel (or enable GitHub Pages with the Vite static build).
3. Confirm the live URL works on a phone and a laptop, in both themes.
4. Put the live link, a GIF, and the validation plot at the top of the README.
Resume bullet
Built "Below Threshold", an interactive quantum error correction game ([award] at
[hackathon]); implemented minimum-weight matching and union-find surface-code
decoders in TypeScript, validated against Stim and PyMatching and reproducing
published code-capacity and phenomenological thresholds, with a real-time
decoding mode demonstrating the decoder backlog problem.
Only claim what the team actually built and verified.
Final checklist
Risk Fallback
Another team also does error
correction
Lead the demo with real-time decoding and the
human-vs-decoder leaderboard
Confirm the hackathon length, rules on AI tools, and judging criteria
Phases 0 to 4 complete, validation gate passed
Chapters 1 to 6 playable and playtested by three non-experts
Main game levels 1 to 7 complete
Real-time mode shows backlog with a slow decoder

Appendix A: Starter code
This is the quantum simulator and its tests, written earlier in our chat. In Phase 1, Claude
Code should convert it to TypeScript as src/core/quantum.ts and
tests/core/quantum.test.ts, keeping the behavior identical. It has not been run yet;
running the tests is the first check.
quantum.js
// Exact state-vector simulator for small systems.
// Convention: qubit q is bit q of the basis index.
// Labels print qubit 0 first, e.g. "|100>" means qubit 0 is 1.
const R = Math.SQRT1_2;
export const Gates = {
  I: [1,0, 0,0, 0,0, 1,0],
  X: [0,0, 1,0, 1,0, 0,0],
  Y: [0,0, 0,-1, 0,1, 0,0],
  Z: [1,0, 0,0, 0,0, -1,0],
  H: [R,0, R,0, R,0, -R,0],
  S: [1,0, 0,0, 0,0, 0,1],
  Rx: (t) => { const c = Math.cos(t/2), s = Math.sin(t/2); return [c,0, 0,-s, 
0,-s, c,0]; },
  Ry: (t) => { const c = Math.cos(t/2), s = Math.sin(t/2); return [c,0, -s,0, 
s,0, c,0]; },
};
export class QState {
Threshold lab reproduces the crossing live
Honesty panel and validation badge in the app
Citations verified in CITATIONS.md (Terhal 2015, Delfosse and Nickerson 2021, Google
2024, Stim, PyMatching, Decodoku)
README, write-up, pitch and Q&A sheet in docs/
Deployed live URL tested on phone and laptop
Backup video recorded
Pitch rehearsed five times with a timer
Every team member can explain stabilizers, matching, threshold and backlog

constructor(n) {
    if (n > 14) throw new Error('Too many qubits for exact simulation');
    this.n = n;
    this.N = 1 << n;
    this.re = new Float64Array(this.N);
    this.im = new Float64Array(this.N);
    this.re[0] = 1;
  }
  clone() {
    const s = new QState(this.n);
    s.re.set(this.re);
    s.im.set(this.im);
    return s;
  }
  // Apply a 2x2 complex matrix [a b; c d], given as
  // [ar,ai, br,bi, cr,ci, dr,di], to qubit q.
  apply(q, m) {
    const [ar,ai,br,bi,cr,ci,dr,di] = m;
    const bit = 1 << q, re = this.re, im = this.im;
    for (let i = 0; i < this.N; i++) {
      if (i & bit) continue;
      const j = i | bit;
      const xr = re[i], xi = im[i], yr = re[j], yi = im[j];
      re[i] = ar*xr - ai*xi + br*yr - bi*yi;
      im[i] = ar*xi + ai*xr + br*yi + bi*yr;
      re[j] = cr*xr - ci*xi + dr*yr - di*yi;
      im[j] = cr*xi + ci*xr + dr*yi + di*yr;
    }
    return this;
  }
  h(q)  { return this.apply(q, Gates.H); }
  x(q)  { return this.apply(q, Gates.X); }
  y(q)  { return this.apply(q, Gates.Y); }
  z(q)  { return this.apply(q, Gates.Z); }
  s(q)  { return this.apply(q, Gates.S); }
  rx(q, t) { return this.apply(q, Gates.Rx(t)); }
  ry(q, t) { return this.apply(q, Gates.Ry(t)); }
  cnot(c, t) {
    const cb = 1 << c, tb = 1 << t, re = this.re, im = this.im;

for (let i = 0; i < this.N; i++) {
      if ((i & cb) && !(i & tb)) {
        const j = i | tb;
        let tmp = re[i]; re[i] = re[j]; re[j] = tmp;
        tmp = im[i]; im[i] = im[j]; im[j] = tmp;
      }
    }
    return this;
  }
  cz(a, b) {
    const mask = (1 << a) | (1 << b);
    for (let i = 0; i < this.N; i++) {
      if ((i & mask) === mask) { this.re[i] = -this.re[i]; this.im[i] = -
this.im[i]; }
    }
    return this;
  }
  prob1(q) {
    const bit = 1 << q;
    let p = 0;
    for (let i = 0; i < this.N; i++) {
      if (i & bit) p += this.re[i] ** 2 + this.im[i] ** 2;
    }
    return Math.min(1, Math.max(0, p));
  }
  // Projective Z-basis measurement with collapse.
  measure(q, rand = Math.random) {
    const p1 = this.prob1(q);
    let outcome = rand() < p1 ? 1 : 0;
    let keep = outcome ? p1 : 1 - p1;
    if (keep < 1e-12) { outcome ^= 1; keep = 1 - keep; }
    const norm = 1 / Math.sqrt(keep), bit = 1 << q;
    for (let i = 0; i < this.N; i++) {
      if (((i & bit) ? 1 : 0) === outcome) {
        this.re[i] *= norm; this.im[i] *= norm;
      } else {
        this.re[i] = 0; this.im[i] = 0;
      }
    }
    return outcome;

}
  reset(q, rand = Math.random) {
    if (this.measure(q, rand)) this.x(q);
    return this;
  }
  // Bloch vector of one qubit (from its reduced density matrix).
  // length < 1 means the qubit is entangled with the others.
  bloch(q) {
    const bit = 1 << q;
    let r00 = 0, r11 = 0, r01re = 0, r01im = 0;
    for (let i = 0; i < this.N; i++) {
      if (i & bit) continue;
      const j = i | bit;
      const ar = this.re[i], ai = this.im[i], br = this.re[j], bi = 
this.im[j];
      r00 += ar*ar + ai*ai;
      r11 += br*br + bi*bi;
      r01re += ar*br + ai*bi;
      r01im += ai*br - ar*bi;
    }
    const x = 2 * r01re, y = -2 * r01im, z = r00 - r11;
    return { x, y, z, length: Math.sqrt(x*x + y*y + z*z) };
  }
  // |<this|other>|^2
  fidelity(other) {
    let sr = 0, si = 0;
    for (let i = 0; i < this.N; i++) {
      sr += this.re[i]*other.re[i] + this.im[i]*other.im[i];
      si += this.re[i]*other.im[i] - this.im[i]*other.re[i];
    }
    return sr*sr + si*si;
  }
  label(i) {
    let s = '';
    for (let q = 0; q < this.n; q++) s += (i >> q) & 1;
    return `|${s}>`;
  }
  // Nonzero terms, for displaying the state.

terms(eps = 1e-9) {
    const out = [];
    for (let i = 0; i < this.N; i++) {
      const p = this.re[i] ** 2 + this.im[i] ** 2;
      if (p > eps) out.push({ index: i, label: this.label(i), re: this.re[i], 
im: this.im[i], p });
    }
    return out;
  }
}
quantum.test.js
import { QState } from '../js/quantum.js';
let failed = 0;
const near = (a, b, msg, tol = 1e-9) => {
  const ok = Math.abs(a - b) < tol;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${msg}: got ${a.toFixed(4)}, expected 
${b.toFixed(4)}`);
};
// 1. Superposition: H|0> gives a 50/50 state.
const plus = new QState(1).h(0);
near(plus.prob1(0), 0.5, 'Superposition probability');
near(plus.bloch(0).x, 1, 'Plus state points along +x');
// 2. Entanglement: Bell state; each qubit alone has a zero-length Bloch 
vector.
const bell = new QState(2).h(0).cnot(0, 1);
near(bell.bloch(0).length, 0, 'Bell state qubit is maximally entangled');
// 3. No-cloning: the "copy" circuit fails on |+>.
const attempt = new QState(2).h(0).cnot(0, 1);
const ideal = new QState(2).h(0).h(1);
near(attempt.fidelity(ideal), 0.5, 'Cloning |+> fails (fidelity 0.5)');
// 4. Error discretization: small rotation error on a 3-qubit
//    repetition code collapses to "no error" or "full flip".
let fixedOk = true;
for (let trial = 0; trial < 200; trial++) {

const s = new QState(5);                  // qubits 0-2 data, 3-4 ancillas
  s.ry(0, 1.1);                             // arbitrary logical state
  const target = s.clone().cnot(0, 1).cnot(0, 2);
  s.cnot(0, 1).cnot(0, 2);                  // encode
  s.rx(1, 0.4);                             // small continuous error
  s.cnot(0, 3).cnot(1, 3);                  // ancilla 3 = parity(q0, q1)
  s.cnot(1, 4).cnot(2, 4);                  // ancilla 4 = parity(q1, q2)
  const a = s.measure(3), b = s.measure(4);
  if (a && !b) s.x(0);
  if (a && b) s.x(1);
  if (!a && b) s.x(2);
  if (a) s.x(3);                            // reset ancillas to |0>
  if (b) s.x(4);
  if (s.fidelity(target) < 1 - 1e-9) fixedOk = false;
}
console.log(`${fixedOk ? 'PASS' : 'FAIL'} Small error is discretized and 
fully corrected`);
if (!fixedOk) failed++;
console.log(failed ? `\n${failed} test(s) failed` : '\nAll tests passed');
process.exit(failed ? 1 : 0);
Appendix B: Glossary
Term Plain meaning
Qubit The basic unit of quantum information; can be in a
superposition of 0 and 1
Superposition A state holding amplitudes for 0 and 1 at once;
measurement picks one
Interference Amplitudes adding up or canceling, changing
outcome probabilities
Entanglement Correlations between qubits that no description of
the individual qubits can capture
No-cloning theorem No process can copy an unknown quantum state
Pauli X, Z, Y Bit flip, phase flip, and both together; the basic
error types

Appendix C: References to verify
The team must open each source, confirm the exact claims and numbers quoted in the
app and pitch, and record full citations in CITATIONS.md.
B. M. Terhal, "Quantum error correction for quantum memories", Reviews of Modern
Physics (2015): surface code basics and the decoder backlog discussion.
Term Plain meaning
Stabilizer A multi-qubit check (product of Paulis) the
protected state always passes
Syndrome The pattern of check results; fired checks signal
nearby errors
Ancilla A helper qubit used to measure a check without
disturbing the data
Logical qubit One protected qubit stored across many physical
qubits
Code distance d The smallest number of physical errors that can
silently corrupt the logical qubit
Decoder The algorithm that infers the most likely errors
from the syndrome
MWPM Minimum-weight perfect matching, a decoder that
pairs fired checks by shortest total path
Union-find decoder A near-linear-time decoder that grows and merges
clusters around fired checks
Threshold The physical error rate below which bigger codes
reduce logical errors
Suppression factor How much the logical error rate drops when the
distance increases by 2
Backlog problem Syndrome data arriving faster than the decoder
can process it, so the queue grows
T gate A gate needed for universal quantum computing
whose correct use depends on decoded results

N. Delfosse and N. H. Nickerson, "Almost-linear time decoding algorithm for topological
codes", Quantum (2021): the union-find decoder and its thresholds.
N. Delfosse and G. Zémor, work on linear-time maximum-likelihood decoding of
erasures (the peeling decoder).
E. Dennis, A. Kitaev, A. Landahl, J. Preskill, "Topological quantum memory" (2002):
matching decoders and thresholds for the surface code.
A. G. Fowler and colleagues, "Surface codes: Towards practical large-scale quantum
computation", Physical Review A (2012).
Google Quantum AI, below-threshold surface code memory experiment (2024).
C. Gidney, "Stim: a fast stabilizer circuit simulator", Quantum (2021).
O. Higgott and C. Gidney, PyMatching and sparse blossom (2022 and 2023).
J. Wootton, Decodoku (citizen-science QEC games, around 2016).
D. Gottesman, the Gottesman-Knill theorem (stabilizer simulation).
Evaluation components and additional details
The hackathon's official rubric was not available when this plan was written. The criteria
below are inferred from the Quantum Unlocked track description and typical hackathon
judging; replace them with the official rubric as soon as the team has it.
Likely evaluation components and how we score on each
Component What judges look for How Below Threshold
delivers
Evidence to show
Topic difficulty
and timeliness
A hard, current topic
from the track list
Quantum error
correction, fault
tolerance, and real-
time decoding
Track description;
Google 2024 context
Teaching and
intuitiveness
A non-expert
understands the
idea after using it
Six hands-on chapters,
one idea per screen,
"What just
happened?" cards
Playtest notes from
three non-experts

Self-assessment before submission
The team scores each component from 1 to 5 the night before submission. Anything below
4 gets fixed first, starting with correctness, teaching, and presentation.
Component What judges look for How Below Threshold
delivers
Evidence to show
Technical depth Real algorithms, not
a mockup
State-vector simulator,
rotated surface code,
MWPM and union-find
decoders, Monte Carlo
lab
Repo structure,
decoder code,
benchmarks
Correctness and
rigor
Physics that
survives expert
questioning
Tests, PyMatching
cross-check,
thresholds within
acceptance bands
Validation report and
plots
Interactivity and
design
Polished, engaging,
easy to use
Playable game, live
chart, consistent
visual language, mobile
support
Live demo with a
judge playing
Originality Something judges
have not seen
before
Real-time backlog
mode, measurement-
error time stack,
human-vs-decoder
leaderboard
Demo of real-time
mode; comparison
with prior games
Presentation Clear story told
within the time limit
3-minute script ending
on the threshold and
backlog payoffs
Rehearsed pitch
Completeness A working, deployed
product
Live URL, public repo,
README, write-up
Links on the final
slide
Honesty Clear about limits Honesty panel listing
simplifications
Panel in the app
Topic and timeliness: 1 to 5
Teaching and intuitiveness: 1 to 5
Technical depth: 1 to 5

Additional details
Team roles (suggested for a team of three or four):
Builder: runs Claude Code, reviews every phase, owns the repo and deployment.
Physics lead: checks the specification, runs the validation scripts, verifies citations,
owns the hardest Q&A answers.
Design and playtest lead: owns the UI system, runs playtests, records the backup
video.
Presenter: owns the pitch, rehearses with the timer, manages the demo devices.
Submission package:
Live URL and public GitHub repository (MIT license).
README with a GIF, the live link, setup steps, and the validation plot.
docs/: write-up, pitch, Q&A sheet, validation report, this plan.
A 2-minute demo video.
A short list of what was AI-assisted and how it was verified, if the rules ask for it.
Assumptions in this plan:
The hackathon allows AI coding tools; confirm before starting.
About 24 hours of build time; adjust the phase timing if different.
Judges have access to a laptop or phone with a modern browser.
Published threshold values in the validation table are approximate and must be
confirmed against their sources.
Things to confirm on day one:
Correctness and rigor: 1 to 5
Interactivity and design: 1 to 5
Originality: 1 to 5
Presentation: 1 to 5
Completeness: 1 to 5
Official rubric and weights
Rules on AI tools and pre-written code (Appendix A was written before the event;
check whether that is allowed or must be rewritten during the event)
Submission format and deadline (time zone)

Technical defaults (use unless the team decides otherwise):
Browsers: latest Chrome, Safari, Firefox, Edge; mobile Safari and Chrome.
Performance targets: first load under 3 seconds; lattice at 60 frames per second at d =
7; lab point at d = 7 in under 5 seconds.
Node.js 20 or later, Python 3.11 or later.
Default seeds: level puzzles use seed = level number × 1000 + puzzle index, so results
can be reproduced and shared.
After the hackathon:
Keep the repo public and add the award, if any, to the README.
Write a short blog post or LinkedIn post with the demo GIF and validation plot.
Update the resume bullet with the real result, claiming only what was built and
verified.
Demo length and format (live, video, or both)
Team size limits and track registration