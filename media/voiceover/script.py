"""Narration for the Below Threshold explainer film: the single source of truth.

Each scene is a list of beats. A beat is one line of voiceover plus the visuals that play
under it. Scene timing comes from here: every beat lasts at least as long as its line
takes to say (from your recording if it exists, otherwise estimated at ~2.6 words/s),
so the film is always cut to the narration.

Edit a line here, re-run `python media/film_build.py`, and the scene re-times itself,
the captions update, and docs/voiceover-script.md is regenerated.

`visual` is a stage direction for whoever builds or edits the scene; it is not spoken.
Lines marked `verify` quote a published number that the team should check against the
source in CITATIONS.md before recording.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class Beat:
    key: str
    text: str  # spoken line; "" for a silent beat
    visual: str = ""
    min_seconds: float = 0.0  # floor for silent or animation-heavy beats
    verify: str = ""


@dataclass
class SceneScript:
    id: str
    chapter: str
    title: str
    beats: list[Beat] = field(default_factory=list)
    part: str = ""  # "Part II · Shor's algorithm"; shown on the chapter card and in the /film menu


SCRIPT: list[SceneScript] = [
    SceneScript(
        "intro",
        "",
        "Below Threshold",
        [
            Beat("logo", "", "Team PhASE mark draws itself: circle, axis, the phase vector sweeps to its angle, wordmark writes in.", min_seconds=3.6),
            Beat(
                "title",
                "A quantum computer could crack the codes that keep the internet's secrets. This is the story of how: Shor's algorithm, the quantum Fourier transform at its heart, and the race to keep fragile qubits alive long enough to run it.",
                "Title 'Below Threshold' in Computer Modern; a faint d=7 lattice breathes behind it with real syndromes.",
            ),
        ],
    ),
    SceneScript(
        "qubit",
        "Chapter 1",
        "What is a qubit?",
        [
            Beat(
                "arrow",
                "This arrow is a qubit. Straight up means zero, straight down means one, and anywhere in between is a superposition: a blend of both at once.",
                "2D Bloch glyph: the arrow at |0>, flips to |1>, then settles at a real superposition angle; kets labelled.",
            ),
            Beat(
                "amplitudes",
                "The blend is described by two amplitudes, one for zero and one for one. Square them, and you get the odds of measuring each.",
                "Two amplitude clocks (disk size = amplitude) beside two probability bars; numbers from QState.",
            ),
            Beat(
                "phase",
                "But an amplitude is more than a size. It also points in a direction, its phase, like the hand of a clock. Turn that hand, and the odds of a measurement do not change at all.",
                "The |1> clock hand turns a full circle (real P(phi) states); the probability bars stay exactly level.",
            ),
            Beat(
                "interference",
                "Phase matters when amplitudes meet. A Hadamard gate adds them up: hands pointing the same way reinforce, opposite hands cancel. That is interference, and it turns a hidden phase into an answer you can measure.",
                "H P(phi) H: as phi sweeps 0 to pi the hands add as arrows tip to tail; P(1) = sin^2(phi/2) bar rises to 1 (QState sweep).",
            ),
        ],
        part="Part I · Quantum basics",
    ),
    SceneScript(
        "entangle",
        "Chapter 2",
        "Many qubits, and entanglement",
        [
            Beat(
                "two",
                "One qubit holds two amplitudes. Two qubits are not just two separate arrows: the pair has four possibilities, zero zero, zero one, one zero and one one, and an amplitude for each.",
                "Two Bloch glyphs, then four amplitude clocks for |00>, |10>, |01>, |11> (qubit 0 first) with all the amplitude on |00>.",
            ),
            Beat(
                "grow",
                "Every qubit you add doubles that list. Ten qubits hold over a thousand amplitudes. Three hundred hold more than there are atoms in the universe. A register of qubits can hold every number at once.",
                "A grid of squares doubles from 2 to 1024 as qubits are added; '300 qubits: about 10^90 amplitudes' written.",
            ),
            Beat(
                "bell",
                "Now the strange part. A Hadamard, then a CNOT, leaves amplitude only on zero zero and one one. Measure the pair a hundred times: each qubit alone is a coin flip, but the two always agree.",
                "Circuit H then CNOT; the four clocks update (QState); 100 seeded shots fill only 00 and 11.",
            ),
            Beat(
                "shared",
                "This pair cannot be split into two separate arrows. Each qubit's own arrow shrinks to nothing, because the information lives only in the correlation. That is entanglement, and both Shor's algorithm and error correction depend on it.",
                "Both Bloch arrows shrink to the real reduced-state length 0; 'entanglement' written.",
            ),
            Beat(
                "waves",
                "Line up a few qubits, and their clocks can wind around together, like a wave. Waves of phase are the language of the quantum Fourier transform, the engine of Shor's algorithm.",
                "Eight clocks (3 qubits) wind once, then twice: real states H^3 then per-qubit phase turns.",
            ),
        ],
        part="Part I · Quantum basics",
    ),
    SceneScript(
        "period",
        "Chapter 3",
        "Factoring is a hunt for rhythm",
        [
            Beat(
                "rsa",
                "Multiplying two primes is easy. Undoing the multiplication is not. RSA, the encryption that protects much of the internet, is built on that gap.",
                "Two real 50-digit primes multiply instantly into a 100-digit product (seeded Miller-Rabin, BigInt); the reverse arrow gets a question mark.",
            ),
            Beat(
                "powers",
                "Shor's idea starts with something simple. Pick a number a, and take its powers, keeping only the remainder after dividing by N. For N equals fifteen and a equals seven: one, seven, four, thirteen, and then one again.",
                "Dots of 7^x mod 15 appear one by one on a plot; the values are written along the bottom.",
            ),
            Beat(
                "period",
                "The pattern repeats, forever, every four steps. Call that the period, r.",
                "Alternating bands every 4 steps; r = 4 written.",
            ),
            Beat(
                "recipe",
                "Once you know r, the factors fall out. Seven to the power two is forty nine, which leaves four. Four minus one is three, four plus one is five, and fifteen is three times five.",
                "7^2 = 49 = 4 (mod 15); gcd(3, 15) = 3, gcd(5, 15) = 5; 15 = 3 x 5.",
            ),
            Beat(
                "hard",
                "For a number hundreds of digits long, the period can be hundreds of digits long too. No computer could ever walk that far. A quantum computer does not walk. It listens for the rhythm.",
                "The plot's x axis zooms out until the dots blur into a band; the period label grows to a long digit string.",
            ),
        ],
        part="Part II · Shor's algorithm",
    ),
    SceneScript(
        "qft",
        "Chapter 4",
        "The quantum Fourier transform",
        [
            Beat(
                "listen",
                "Listening for a rhythm is what the Fourier transform does. Feed it a signal that repeats, and it answers with a sharp spike at the repetition rate.",
                "A comb signal (every 4th of 16) becomes four spikes; computed with the project's exact DFT.",
            ),
            Beat(
                "clocks",
                "The quantum version works on amplitudes. Give it a single number x, and it returns every value at once, with value y's clock turned x times y over N. The clocks wind around x times, a wave whose speed encodes x.",
                "QFT|1> then QFT|3> on 3 qubits: eight clocks wind once, then three times (QState after the real circuit).",
            ),
            Beat(
                "circuit",
                "And it is astonishingly cheap. A Hadamard on each qubit, then smaller and smaller controlled turns: a half, a quarter, an eighth. Each qubit becomes one clock hand, spinning at its own speed.",
                "The 3-qubit QFT circuit; a playhead steps gate by gate on |5>; three per-qubit clock hands land at 5/8, 2·5/8, 4·5/8 of a turn (real Bloch vectors).",
            ),
            Beat(
                "comb",
                "Now feed it a rhythm: equal amplitude on every fourth value. Each output adds up one clock hand from every tooth of the comb. Where the hands agree, they add up. Everywhere else they cancel.",
                "16-value comb with r = 4; for output 4 the four hands align and add tip to tail; for output 1 they form a closed square and cancel.",
            ),
            Beat(
                "peaks",
                "Four sharp peaks, at multiples of sixteen over four. Their spacing gives away the period. When the period does not divide evenly, the peaks blur, but they still point the way.",
                "The comb morphs into four peaks; then a period-3 comb on 64 values gives blurred peaks near multiples of 64/3.",
            ),
        ],
        part="Part II · Shor's algorithm",
    ),
    SceneScript(
        "shor",
        "Chapter 5",
        "Shor's algorithm, end to end",
        [
            Beat(
                "registers",
                "Here is the whole algorithm, simulated exactly, factoring twenty one. Two registers: one counts x, the other will hold two to the x, mod twenty one.",
                "Two labelled registers: 7 input qubits (x = 0..127), 5 output qubits.",
            ),
            Beat(
                "superpose",
                "Hadamards put every x, from zero to one hundred twenty seven, into superposition at once.",
                "128 equal bars rise together.",
            ),
            Beat(
                "compute",
                "One big circuit computes two to the x, mod twenty one, for all of them in parallel. Each x is now entangled with its value.",
                "Bars take the colour of their value 2^x mod 21; the six colours repeat every 6.",
            ),
            Beat(
                "measure",
                "We measure the output register and see eight. Every x that does not give eight vanishes. What survives is a comb, with teeth exactly six apart.",
                "Seeded measurement gives 8 (data asserts it); other bars fall away; teeth at 3, 9, 15, ...",
            ),
            Beat(
                "transform",
                "The quantum Fourier transform turns that comb into peaks near multiples of one hundred twenty eight over six.",
                "Comb morphs into the exact QFT distribution; dashed lines at multiples of 128/6.",
            ),
            Beat(
                "read",
                "Measure, and we get twenty one. Twenty one over one hundred twenty eight is very close to one sixth. A continued fraction finds that fraction, and its six is the period.",
                "Seeded measurement gives k = 21; 21/128 = 0.164; convergents 0, 1/6, ...; 1/6 highlighted.",
            ),
            Beat(
                "factors",
                "Two to the three is eight. Seven and nine each share a factor with twenty one: seven, and three. Twenty one is three times seven.",
                "2^3 = 8; gcd(7, 21) = 7, gcd(9, 21) = 3; 21 = 3 x 7.",
            ),
        ],
        part="Part II · Shor's algorithm",
    ),
    SceneScript(
        "noise",
        "Chapter 6",
        "Noise ruins the answer",
        [
            Beat(
                "perfect",
                "That was a perfect machine. Real qubits make mistakes. So let every qubit, after every step, have a small chance of a random error, and run the circuit for fifteen two hundred times.",
                "Gate-level N = 15 circuit on 10 qubits: 200 seeded runs with no noise land only on the four peaks.",
            ),
            Beat(
                "blur",
                "At one error in a thousand, most runs still land on a peak. At one in a hundred, most of them miss. At five in a hundred, the peaks are gone, and the quantum computer has become a random number generator.",
                "Histograms at p = 0.1%, 1%, 5% (real runs); an 'on a peak' counter falls toward the pure-chance line.",
            ),
            Beat(
                "scale",
                "And this circuit was tiny. Breaking real encryption takes around a million qubits running for days. To finish without a single error, each operation could fail only about once in a trillion. The best qubits today fail about once in a thousand.",
                "A log scale from 10^-1 to 10^-13: today's ~10^-3 marker, the ~10^-12 requirement, the gap highlighted.",
                verify="Gidney 2025 (arXiv:2505.15917): RSA-2048 with under a million noisy qubits in under a week, assuming 0.1% gate error",
            ),
            Beat(
                "bridge",
                "No physical qubit is that good. So we build better ones out of many imperfect ones. That is quantum error correction, and it is the rest of this story.",
                "One qubit glyph splits into a real d = 5 surface-code layout.",
            ),
        ],
        part="Part II · Shor's algorithm",
    ),
    SceneScript(
        "fragile",
        "Chapter 7",
        "A fragile kind of information",
        [
            Beat(
                "arrow",
                "Back to our arrow. Up is zero, down is one, and Shor's algorithm lives in between, in the amplitudes and their phases, on every qubit, for the whole computation.",
                "Bloch sphere in 3D, slowly rotating camera. Arrow at |0>, then |1>, then sweeps to an equator superposition; ket labels in LaTeX.",
            ),
            Beat(
                "drift",
                "The trouble is that the arrow never holds still. Stray fields, heat, a control pulse meant for a neighbor: each one nudges it a little, and the nudges add up.",
                "Real seeded random walk of small rotations (exported from QState); a faint trail shows the accumulated drift.",
            ),
            Beat(
                "backup",
                "On an ordinary computer we would fight this with backups. Copy the bit three times and take a vote. For qubits, that move is forbidden.",
                "Classical bit 0 copied into 000, majority vote; then a qubit arrow tries the same and a red cross appears.",
            ),
            Beat(
                "clone",
                "Try to copy an unknown state with the obvious circuit, and you do not get two copies. You get two qubits tangled together, and their overlap with the copies you wanted is exactly one half.",
                "CNOT circuit; |+>|0> becomes (|00>+|11>)/sqrt2 via TransformMatchingTex; both Bloch arrows shrink to zero length; fidelity = 1/2 written.",
            ),
            Beat(
                "nocloning",
                "This is the no-cloning theorem. Whatever protects a qubit, it cannot be a backup.",
                "The phrase 'no-cloning theorem' is written; everything else dims.",
            ),
        ],
        part="Part III · Keeping it alive",
    ),
    SceneScript(
        "parity",
        "Chapter 8",
        "Ask a different question",
        [
            Beat(
                "spread",
                "Here is the trick. Instead of copying the state, we spread it out. Two CNOT gates turn alpha zero plus beta one into alpha zero zero zero, plus beta one one one.",
                "alpha|0>+beta|1> morphs term by term into alpha|000>+beta|111> as two CNOT wires draw.",
            ),
            Beat(
                "shrink",
                "Look at any one of these qubits on its own, and its arrow has shrunk toward the center. The information is not in any single qubit anymore. It lives in how they relate.",
                "Three small Bloch spheres; each arrow shrinks to the real reduced-state length |alpha^2 - beta^2|.",
            ),
            Beat(
                "question",
                "Now suppose noise flips one of them. We cannot simply look, because measuring would destroy alpha and beta. So we ask a gentler question: do these two agree?",
                "One qubit flips (coral X). A question mark hovers over pairs (q0,q1) and (q1,q2).",
            ),
            Beat(
                "syndrome",
                "A helper qubit collects the parity of each pair. Two checks give two bits, the syndrome, and the syndrome points straight at the culprit.",
                "Two ancillas fill with parity bits; the 2-bit syndrome lands in the real syndrome table and highlights the row for the flipped qubit.",
            ),
            Beat(
                "restore",
                "Flip it back, and the state is restored perfectly, without our ever learning alpha or beta. That is a stabilizer measurement, the heart of every quantum error correcting code.",
                "Correction applied; fidelity meter snaps to 1; 'stabilizer measurement' written in LaTeX.",
            ),
        ],
        part="Part III · Keeping it alive",
    ),
    SceneScript(
        "digital",
        "Chapter 9",
        "Why errors become digital",
        [
            Beat(
                "drift",
                "But real errors are not clean flips. They are tiny rotations, a sliver of a turn at a time. How can a code built for flips fix a drift?",
                "One encoded qubit's arrow tilts by a small angle theta; theta labelled.",
            ),
            Beat(
                "runs",
                "Let us rotate one qubit by a small angle, run the checks, and see what happens. Then do it again. Two hundred times.",
                "Run grid fills in run by run from real data (200 seeded QState runs).",
            ),
            Beat(
                "two",
                "Only two things ever happen. Most of the time the checks report nothing, and the drift is simply gone. Now and then they report a full flip, which we know how to undo.",
                "Histogram grows into exactly two bars; the other syndromes stay at zero.",
            ),
            Beat(
                "formula",
                "The odds are cosine squared and sine squared of theta over two, right on the formula. Measuring the checks forces the error to make up its mind. A continuous problem becomes a discrete one, and that is why quantum error correction can work at all.",
                "cos^2(theta/2) and sin^2(theta/2) written beside the bars; dashed formula lines meet the measured bars.",
            ),
        ],
        part="Part III · Keeping it alive",
    ),
    SceneScript(
        "surface",
        "Chapter 10",
        "Two kinds of error, one grid",
        [
            Beat(
                "phase",
                "There is a second kind of error, though. A phase flip leaves every bit where it was, and only changes the sign between them. Our parity checks cannot see it at all.",
                "alpha|000> + beta|111> becomes alpha|000> - beta|111>; the plus sign flips to minus in coral; checks stay dark.",
            ),
            Beat(
                "grid",
                "The fix is to also check in a rotated basis, where phase flips look like bit flips. Do both, everywhere, on a two dimensional grid, and you get the surface code.",
                "The repetition row morphs into the middle row of a real d=5 rotated surface code; teal and violet plaquettes grow in.",
            ),
            Beat(
                "legend",
                "White circles are data qubits. Teal squares check for bit flips. Violet squares check for phase flips. Each check touches four neighbors, or two along the edge.",
                "Indicate a qubit, a teal tile, a violet tile, a boundary half-disc, in turn.",
            ),
            Beat(
                "chain",
                "Flip one qubit and the checks beside it light up. Flip a whole chain, and only its two ends light up. Everything in between cancels in pairs.",
                "Real syndromes: single X error lights two teal checks; extend to a chain; interior checks turn back off, only the endpoints stay lit.",
            ),
            Beat(
                "logical",
                "And that is the catch. A chain from one edge to the other lights up nothing at all, yet it flips the stored information. The shortest such chain has length d, the distance of the code.",
                "Chain grows to a full column (real logical X); every check dark; the column glows coral; 'd = 5' written.",
            ),
        ],
        part="Part III · Keeping it alive",
    ),
    SceneScript(
        "matching",
        "Chapter 11",
        "Decoding is a matching problem",
        [
            Beat(
                "puzzle",
                "So here is the puzzle a quantum computer faces, over and over. Noise strikes somewhere we cannot see. All we get are the lit checks.",
                "Real seeded d=5 instance: hidden errors are not drawn; lit checks appear with a soft pulse.",
            ),
            Beat(
                "ends",
                "Each lit check is the end of some error chain. To explain them, we have to pair them up, or send them off to the boundary.",
                "Faint candidate chains flicker between pairs of lit checks and toward the edges.",
            ),
            Beat(
                "graph",
                "Strip away the qubits and keep only what matters. Checks become points, and the cost of joining two is the number of errors it would take.",
                "2swap-style: the lattice dissolves, lit checks drift into a weighted complete graph with edge weights as distances; the boundary becomes one node.",
            ),
            Beat(
                "mwpm",
                "Short chains are far more likely than long ones, so the best guess is the pairing with the smallest total length. That is minimum weight perfect matching, and Edmonds' blossom algorithm finds it efficiently.",
                "Edges of the real MWPM matching brighten one by one; total weight shown as a sum in LaTeX.",
            ),
            Beat(
                "saved",
                "Fold the graph back onto the grid and apply the corrections. Together with the hidden errors, they close into harmless loops. The qubit is saved.",
                "Graph folds back onto the lattice; dashed paths, blue corrections, then the true errors appear as coral rings; residual loop outlined in green.",
            ),
            Beat(
                "failure",
                "But not always. Push the noise higher, and the most likely explanation can be wrong. The fix and the errors join into a chain across the grid, and the information is lost.",
                "Second real seed (logical failure): residual chain spans top to bottom in coral.",
            ),
        ],
        part="Part III · Keeping it alive",
    ),
    SceneScript(
        "spacetime",
        "Chapter 12",
        "When the checks lie",
        [
            Beat(
                "lie",
                "Real hardware adds one more wrinkle. The checks themselves are noisy. Sometimes a check simply reports the wrong answer.",
                "A teal check blinks on then off with no error nearby; a small 'lie' marker.",
            ),
            Beat(
                "stack",
                "So we measure every check again and again, and stack the rounds into a block of space and time. What we look for is change: a check whose answer differs from the round before.",
                "Camera tilts into 3D; rounds stack upward as translucent layers; detection events appear as glowing points.",
            ),
            Beat(
                "pairs",
                "A real qubit error shows up as a pair in the same round. A check that lied shows up as the same check, in two consecutive rounds.",
                "Highlight one horizontal pair (same layer) and one vertical pair (same check, adjacent layers) from the real instance.",
            ),
            Beat(
                "match3d",
                "Decoding becomes matching in three dimensions, through space and through time. Same algorithm, bigger graph.",
                "Camera orbits; the real MWPM space-time matching draws through the block.",
            ),
        ],
        part="Part III · Keeping it alive",
    ),
    SceneScript(
        "threshold",
        "Chapter 13",
        "Below threshold",
        [
            Beat(
                "question",
                "Here is the question that decides everything. If we build a bigger code, do we get fewer errors, or more?",
                "d=5 lattice grows to d=7, then d=9, side by side.",
            ),
            Beat(
                "tradeoff",
                "More qubits means more places for noise to strike. But a bigger code also needs a longer chain to fail. Which effect wins depends on how noisy each qubit is.",
                "Left: more coral sparks on the bigger lattice. Right: a longer red chain needed to cross it.",
            ),
            Beat(
                "curves",
                "Each point on these curves is thousands of simulated memories, every one decoded. Above a critical noise level, the bigger codes do worse. Below it, every step up in size suppresses errors further.",
                "Log-scale axes draw; real validation curves for d=5,7,9 grow left to right; a vertical noise marker sweeps.",
            ),
            Beat(
                "value",
                "That crossing is the threshold. For this simple noise it sits near ten percent. With checks that lie, near three. For full circuits with faulty gates, closer to one.",
                "Crossing point circled; 'p_th ~ 10%' written; then smaller labels '3%' and '1%' slide in for the other noise models.",
            ),
            Beat(
                "lambda",
                "Below it, each increase of the distance by two divides the error rate by a factor called lambda. In 2024, Google's Willow chip measured lambda of about two: the first convincing quantum memory below threshold.",
                "Lambda = eps_d / eps_{d+2} written; arrows between curves at a fixed p; small note 'Google Quantum AI, 2024'.",
                verify="Lambda = 2.14 +/- 0.02 in Google Quantum AI, Nature 638 (2025), arXiv:2408.13687",
            ),
        ],
        part="Part III · Keeping it alive",
    ),
    SceneScript(
        "realtime",
        "Chapter 14",
        "A race against the clock",
        [
            Beat(
                "time",
                "There is one more constraint, and it is the one this project is about: time.",
                "A clock face ticks once; the lattice pulses in time with it.",
            ),
            Beat(
                "rate",
                "A superconducting chip produces a fresh round of syndrome data about once every microsecond. The decoder has to keep up.",
                "Rounds arrive as blocks on a conveyor at 1 per microsecond (slow motion, labelled).",
                verify="~1 us cycle time, e.g. Google Quantum AI 2024 (1.1 us)",
            ),
            Beat(
                "measured",
                "Exact matching, on an ordinary processor, takes about a hundred microseconds per round at distance nine. Union-find, a faster decoder, takes about four. Both are too slow for the clock.",
                "Two lanes with the measured per-round times from src/data/bench.json; both queues start to grow, MWPM much faster.",
            ),
            Beat(
                "stall",
                "When the decoder falls behind, unprocessed rounds pile up. Some logical operations, like the T gate, must wait for the decoder before they can continue. The backlog grows, and the computer stalls.",
                "Queue grows; a T-gate token waits with a growing timer; the conveyor jams.",
            ),
            Beat(
                "moral",
                "So error correction is not only a question of accuracy. A decoder that is right, but too slow, still stops the computer. That is why real machines need custom decoding hardware, fast enough to keep pace with the qubits.",
                "Third lane labelled 'the requirement: under 1 us per round' stays flat; the moral is written in LaTeX.",
            ),
        ],
        part="Part III · Keeping it alive",
    ),
    SceneScript(
        "outro",
        "",
        "Keep it below threshold",
        [
            Beat(
                "takeaway",
                "Shor's algorithm can break today's encryption, but only on qubits kept below threshold, with decoders that keep up. Try it yourself: factor fifteen, play the game, race the decoder, and watch the threshold appear.",
                "The film's objects return in miniature: Bloch arrow, lattice, curves, backlog; then fade.",
            ),
            Beat("logo", "", "Team PhASE logo, 'Below Threshold', and the site URL.", min_seconds=4.5),
        ],
    ),
]


def scene(sid: str) -> SceneScript:
    for s in SCRIPT:
        if s.id == sid:
            return s
    if sid == "pitch":
        from pitch_script import PITCH  # the 3-minute pitch video has its own script module

        return PITCH
    raise KeyError(sid)


def words(text: str) -> int:
    return len([w for w in text.replace("—", " ").split() if any(ch.isalnum() for ch in w)])
