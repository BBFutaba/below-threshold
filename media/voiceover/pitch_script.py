"""Narration for the 3-minute pitch video (media/scenes/pitch.py): the single source of truth.

Same format as script.py (the long film). Each beat is one line of voiceover; the scene
re-times itself to the team's recordings in media/voiceover/recordings/pitch/<beat>.wav.
The video must stay under 3:00 (the hackathon's demo limit): at ~155 words per minute
this script is about 2:26 of narration (about 2:40 of video), and media/pitch_build.py
fails loudly if a build goes over. The recording sheet gives each section its time budget.

Beats marked `screen` show a real screen recording of the live app (scripts/record-pitch.ts)
inside a window drawn by the scene; the rest is Manim. `judging` notes which judging
component each beat serves (from docs/PLAN.md, "Likely evaluation components").
"""

from __future__ import annotations

from dataclasses import dataclass

from script import Beat, SceneScript

PITCH = SceneScript(
    "pitch",
    "",
    "Below Threshold in three minutes",
    [
        Beat("logo", "", "Team PhASE mark draws itself, wordmark writes in.", min_seconds=3.0),
        Beat(
            "hook",
            "In 1994, Peter Shor showed that a quantum computer could factor huge numbers, and break the encryption that protects the internet. Thirty years later, no quantum computer has done it at a useful scale. The reason is noise.",
            "N = p x q morphs into a long RSA-sized number and a lock; then a qubit arrow jitters with real seeded drift. [judging: topic difficulty and timeliness]",
        ),
        Beat(
            "product",
            "We are Team PhASE, and Below Threshold is an interactive playground that takes you from a single qubit, through Shor's algorithm, to the error correction that keeps it alive.",
            "Title 'Below Threshold'; three part labels (I quantum basics, II Shor's algorithm, III keeping it alive) appear along a path; the app window grows out of Part I.",
        ),
        Beat(
            "learn",
            "Every chapter runs on an exact quantum simulator, right in your browser. You do not read about superposition: you build it, measure it, and watch interference cancel.",
            "SCREEN learn: Part I chapter 'What is a qubit?' (gates, Bloch sphere, 100 shots, H twice). [judging: teaching and intuitiveness]",
        ),
        Beat(
            "qft",
            "At the heart of Shor's algorithm is the quantum Fourier transform. Step through the real gate circuit, one gate at a time, and watch a repeating pattern turn into sharp peaks.",
            "SCREEN qft: the QFT chapter stepping gates on a periodic input; amplitudes as clocks, output peaks. [judging: technical depth]",
        ),
        Beat(
            "shor",
            "Then factor fifteen end to end: superposition, modular exponentiation, the Fourier transform, continued fractions, and out come the factors, three times five.",
            "SCREEN shor: the Shor chapter run end to end on N = 15.",
        ),
        Beat(
            "noise",
            "Now add noise. On ten simulated qubits, the peaks blur, and the answer is lost. Real qubits fail roughly once in every thousand operations.",
            "SCREEN noise: the noise chapter as the error rate rises and the peaks dissolve.",
            verify="~1e-3 physical error per operation (CITATIONS.md item 13)",
        ),
        Beat(
            "qec",
            "Quantum error correction spreads one qubit across many, and asks them whether they agree, without ever looking at the answer. The lit checks are clues, and a decoder has to work out what went wrong.",
            "Manim: alpha|0>+beta|1> spreads into alpha|000>+beta|111>; morphs into a real d=5 lattice; checks light up; a real MWPM dashed path pairs them.",
        ),
        Beat(
            "game",
            "So you play the decoder. Errors are hidden; only the alarms light up, like real hardware. A guided first level makes it playable with no background, and then a real matching decoder solves the same puzzle.",
            "SCREEN game: a level being cleared, the reveal, then 'Watch the decoder'. [judging: interactivity and design]",
        ),
        Beat(
            "realtime",
            "Here is the twist. A real chip produces these puzzles a million times a second. Our real-time mode measures each decoder live in your browser: exact matching falls behind, the backlog grows, and the computation stalls.",
            "SCREEN realtime: three decoder lanes running; MWPM falling behind, union-find keeping up. [judging: originality]",
        ),
        Beat(
            "lab",
            "In the lab, real Monte Carlo runs let you watch the threshold appear: below it, bigger codes win. And a narrated film walks through every idea.",
            "SCREEN lab: curves streaming in and crossing; a glimpse of the /film page.",
        ),
        Beat(
            "rigor",
            "None of it is faked. Our matching decoder finds the same minimum as PyMatching on all ninety thousand test problems, our code layout matches Stim, our thresholds land on the published values, and close to two hundred automated tests check the physics and the app. We even list exactly what we simplify.",
            "Manim: checklist with the real numbers (100% weight match, 90,000 problems; layout = Stim d=3..11; thresholds 9.94% vs ~10.3%, 2.84% vs ~2.9%; the unit and end-to-end test counts, taken from the test runners). [judging: correctness and rigor, honesty]",
        ),
        Beat(
            "close",
            "Shor's algorithm needs qubits that survive. That takes error correction, and decoders that keep up. Come and play, and keep it below threshold.",
            "Logo, 'Below Threshold', the URL and a QR code to the live site. [judging: completeness, presentation]",
        ),
        Beat("card", "", "End card holds: logo, URL, QR, team names.", min_seconds=3.0),
    ],
)

LIMIT_SECONDS = 180.0


@dataclass
class Section:
    """A run of consecutive beats that one team member reviews and records."""

    slug: str
    title: str
    summary: str
    beats: list[str]


# Four sections, one per team member, in order and covering every beat exactly once.
# media/pitch_build.py cuts the video at these beat boundaries (docs/media/pitch-sections/),
# marks them as chapters in the full video and groups the recording sheet by them.
SECTIONS = [
    Section(
        "problem",
        "The problem",
        "Why Shor's algorithm has not broken encryption yet, and what Below Threshold is.",
        ["logo", "hook", "product"],
    ),
    Section(
        "learn",
        "Learn: from a qubit to Shor's algorithm",
        "Parts I and II of the app, recorded from the live site: a qubit chapter, the QFT, Shor on 15, then noise.",
        ["learn", "qft", "shor", "noise"],
    ),
    Section(
        "play",
        "Play: error correction and the decoder",
        "Part III: the error-correction idea on a real lattice, the decoding game and the real-time mode.",
        ["qec", "game", "realtime"],
    ),
    Section(
        "prove",
        "Prove: the lab, the checks, the close",
        "The threshold lab, how we checked the physics, and the end card with the URL and QR code.",
        ["lab", "rigor", "close", "card"],
    ),
]

_order = [k for s in SECTIONS for k in s.beats]
assert _order == [b.key for b in PITCH.beats], "SECTIONS must cover every pitch beat once, in order"
