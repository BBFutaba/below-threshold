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


SCRIPT: list[SceneScript] = [
    SceneScript(
        "intro",
        "",
        "Below Threshold",
        [
            Beat("logo", "", "Team PhASE mark draws itself: circle, axis, the phase vector sweeps to its angle, wordmark writes in.", min_seconds=3.6),
            Beat(
                "title",
                "Quantum computers are fragile. This is the story of how we keep them alive, and the race against the clock that decides whether we can.",
                "Title 'Below Threshold' in Computer Modern; a faint d=7 lattice breathes behind it with real syndromes.",
            ),
        ],
    ),
    SceneScript(
        "fragile",
        "Chapter 1",
        "A fragile kind of information",
        [
            Beat(
                "arrow",
                "This arrow is a qubit. Pointing straight up, it means zero. Straight down, one. But it can point anywhere in between, and that in-between is where quantum computers get their power.",
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
    ),
    SceneScript(
        "parity",
        "Chapter 2",
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
    ),
    SceneScript(
        "digital",
        "Chapter 3",
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
    ),
    SceneScript(
        "surface",
        "Chapter 4",
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
    ),
    SceneScript(
        "matching",
        "Chapter 5",
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
    ),
    SceneScript(
        "spacetime",
        "Chapter 6",
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
    ),
    SceneScript(
        "threshold",
        "Chapter 7",
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
    ),
    SceneScript(
        "realtime",
        "Chapter 8",
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
    ),
    SceneScript(
        "outro",
        "",
        "Keep it below threshold",
        [
            Beat(
                "takeaway",
                "Error correction works, but only if the decoder keeps up. Try it yourself: play the game, race the decoder, and watch the threshold appear.",
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
    raise KeyError(sid)


def words(text: str) -> int:
    return len([w for w in text.replace("—", " ").split() if any(ch.isalnum() for ch in w)])
