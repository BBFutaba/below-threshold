# The Below Threshold film

A narrated explainer in the style of 3Blue1Brown and 2swap, built with [Manim Community](https://www.manim.community/) 0.22 and LaTeX. It runs about 15 minutes in sixteen scenes, in three parts: quantum basics (a qubit, many qubits, entanglement), Shor's algorithm and the quantum Fourier transform, then quantum error correction as the wrap-up. Each scene is also a standalone clip embedded in the app, and the whole film plays on the site's `/film` page.

**Never faked.** Every lattice, syndrome, error, matching, curve and decoder timing comes from the project's own simulation code (`src/core`). It is exported by `scripts/film/<scene>.ts` to `media/data/film/<scene>.json`, or comes from the validation and benchmark data in `media/data/` and `src/data/`.

## Scenes

| # | Scene (`media/scenes/`) | Chapter | Real data |
|---|---|---|---|
| 0 | `intro.py` | Logo sting and title | d = 7 code, seeded depolarizing syndromes |
| | | **Part I · Quantum basics** | |
| 1 | `qubit.py` | What is a qubit? | QState: Ry(1.1)\|0⟩, a P(φ) sweep (odds unchanged), H P(φ) H interference |
| 2 | `entangle.py` | Many qubits, and entanglement | QState: four amplitudes of two qubits through H and CNOT, 100 seeded Bell-pair shots, Bloch lengths 1 → 0, eight-clock waves |
| | | **Part II · Shor's algorithm** | |
| 3 | `period.py` | Factoring is a hunt for rhythm | Two seeded 50-digit primes (Miller-Rabin), 7ˣ mod 15 and its recipe, 2ˣ mod 3127 (period 1508) |
| 4 | `qft.py` | The quantum Fourier transform | Exact DFT of a comb, QFT\|1⟩ and \|3⟩, the 3-qubit circuit gate by gate on \|5⟩ (Bloch vectors), phasor sums, period-4 and period-3 combs |
| 5 | `shor.py` | Shor's algorithm, end to end | N = 21, a = 2, t = 7: exact registers, seeded measurements 8 and 21, continued fraction, gcd |
| 6 | `noise.py` | Noise ruins the answer | Gate-level N = 15 circuit on 10 qubits, 200 seeded runs at p = 0, 0.1%, 1%, 5% |
| | | **Part III · Keeping it alive** | |
| 7 | `fragile.py` | A fragile kind of information | QState drift (seed 1001), CNOT copy of \|+⟩: fidelity 1/2, Bloch length 0 |
| 8 | `parity.py` | Ask a different question | 3-qubit code with ancillas: syndromes, fidelity |
| 9 | `digital.py` | Why errors become digital | 200 seeded QState runs of an Rx(0.9) error |
| 10 | `surface.py` | Two kinds of error, one grid | d = 5 layout, real syndromes, logical operator |
| 11 | `matching.py` | Decoding is a matching problem | d = 5 bit-flip instances (seeds 111 and 59), MWPM matching and distances |
| 12 | `spacetime.py` | When the checks lie | Phenomenological instance and its space-time matching |
| 13 | `threshold.py` | Below threshold | Validation curves (d = 5, 7, 9) and our Λ |
| 14 | `realtime.py` | A race against the clock | Measured decode times (`src/data/bench.json`), FIFO backlog model |
| 15 | `outro.py` | Keep it below threshold | Callbacks, Team PhASE logo |

Shared code: `scenes/film.py` holds the narration timing, LaTeX helpers, the chapter cards (part, chapter number, title) and the animated Team PhASE mark. `scenes/common.py` holds the palette and the real-layout `Lattice`. `scenes/shorkit.py` holds the amplitude `Clock` (drawn like the app's phase clocks) and a morphing bar chart for the Part II scenes.

## Narration drives the timing

The script lives in [`media/voiceover/script.py`](voiceover/script.py), one beat per line of voiceover. Scenes play their visuals inside `with self.beat("key") as T:`. Each beat lasts at least as long as its line takes to say: the recording's length if a recording exists, otherwise an estimate at about 155 words per minute. The film is therefore always cut to the voice. Every render writes `media/build/timings/<scene>.json`, which feeds the captions, the audio mix and the recording sheet.

The film is narrated by the team: one take per line in `media/voiceover/recordings/<scene>/<beat>.flac`. To re-record, follow [`docs/voiceover-script.md`](../docs/voiceover-script.md) (generated, with timestamps and file names) and put one file per line in `media/voiceover/recordings/<scene>/<beat>.wav`, then rebuild.

Or record every line in order into one folder and import it:

```bash
.venv/Scripts/python media/voiceover/import_takes.py media/voiceover/recordings/explanation
```

`voiceover/import_takes.py` pairs the takes (ordered by the number at the end of the file name; retakes may skip numbers) with the lines in sheet order, and refuses if the counts differ. It cleans each take up for the mix: a 70 Hz high-pass, light noise reduction at the take's measured room tone, a trim to the speech, gentle compression, and normalization to -16 LUFS. On Windows it then runs the built-in offline speech recognizer (`voiceover/asr.ps1`). If any take matches another line better than its own, the import stops and nothing is replaced. The recognizer also aligns each line's words to the audio (`<beat>.words.json`, tied to that exact file and its length). Scenes place visuals on phrases with `film.word_time`, which uses those real word times instead of assuming an even reading pace. If a line is edited after it was recorded, or its take is replaced by hand (say a new `<beat>.wav`), its alignment is ignored and that line falls back to the even pace. `recordings/takes.json` records which raw take became which line, with its trim, gain and recognition score. The raw takes folder is gitignored.

## Build

From the project root, with the Python 3.11 venv that has Manim, and Node for the data exports.

On macOS without Homebrew, a self-contained setup that needs no admin password: [micromamba](https://github.com/mamba-org/micromamba-releases) for `micromamba create -p .venv -c conda-forge python=3.11 manim ffmpeg`, and [TinyTeX](https://yihui.org/tinytex/) (`sh install-bin-unix.sh --no-path`, then `tlmgr install standalone preview doublestroke setspace rsfs relsize ragged2e fundus-calligra microtype wasysym physics dvisvgm jknapltx wasy cm-super babel-english gnu-freefont mathastext cbfonts-fd lm`). Put `~/Library/TinyTeX/bin/universal-darwin` and `.venv/bin` on `PATH` and use `.venv/bin/python` below. On-screen labels use Segoe UI Variable on Windows; elsewhere `scenes/common.py` falls back to Inter (the app's font) if its TTFs are in `media/fonts/` (from the [Inter release](https://github.com/rsms/inter/releases), gitignored).

```bash
.venv/Scripts/python media/film_build.py            # preview (480p15), all scenes, in parallel
.venv/Scripts/python media/film_build.py --final    # 1920x1080 at 30 fps
.venv/Scripts/python media/film_build.py --final matching surface   # just some scenes
.venv/Scripts/python media/film_build.py --final --no-render       # re-mix audio and re-encode only
.venv/Scripts/python media/film_build.py --sheet    # only regenerate docs/voiceover-script.md
```

Outputs:
- `public/media/<scene>.{mp4,webm,jpg,vtt}`: 720p clips with captions, used in the app.
- `public/media/film.{mp4,jpg,vtt}`: the full film in 720p, for `/film`.
- `docs/media/below-threshold-film.{mp4,vtt,srt}`: the full film in 1080p, with subtitles.
- `docs/media/{matching,threshold}.gif`: excerpts for the README.
- `public/media/manifest.json`: scene list with film start times (the `/film` chapter menu).

To hear pacing before the real recording, `.venv/Scripts/python media/voiceover/draft_tts.py` synthesizes a draft voice with Windows' offline speech engine into `media/voiceover/draft/` (gitignored). `NARRATION=draft` makes the build use it.

## Brand

`media/brand/make_logo.py` generates the Team PhASE logo: the wordmark is Latin Modern (GUST Font License, see `brand/FONT-LICENSE.md`) converted to outlines, and the mark is a phase diagram. It writes `public/brand/team-phase-{dark,light,mark}.svg` and the wordmark-only SVGs the film animates.

## Notes on data choices

- Where a scene shows *one* random draw meant to illustrate an average (the "noise sparks" on growing lattices in Chapter 7), the seed is chosen by a recorded typicality rule (counts within 35% of n·p and increasing with d) so a single draw does not suggest the opposite of the average; the rule and seeds are in `media/data/film/threshold.json`. Every other instance is a fixed seed decoded as-is, including the failure in Chapter 5.
- Decode times in Chapter 8 are the benchmark medians (no per-round jitter); queues follow the exact FIFO rule of `src/core/realtime.ts`.
- Willow's Λ ≈ 2.14 is quoted as a citation only (circuit-level noise on hardware); the on-screen Λ values (1.96, 1.75 at p = 4%) are ours, for bit-flip noise.

## The 3-minute pitch video

`docs/media/below-threshold-pitch.mp4` (also on the site's Film page) is the hackathon demo: a 3b1b-style Manim scene (`scenes/pitch.py`, script in `voiceover/pitch_script.py`) with real screen recordings of the live app composited into its windows.

```bash
.venv/Scripts/python media/pitch_build.py --final            # render, composite, mix narration, captions
.venv/Scripts/python media/pitch_build.py --final --record   # also re-record the app (scripts/record-pitch.ts)
.venv/Scripts/python media/pitch_build.py --split            # only re-cut the four sections from the last build
```

The scene marks where footage goes with `screen_window()` / `screen_on(id)` / `screen_off(id)` (`scenes/film.py`). `scripts/record-pitch.ts` records each clip from a production build at 1920x1080 by capturing device-scale screenshots. The build fits each clip to its window, speeding it up by at most 1.6x or holding the last frame, and fades it in and out. It fails if the video runs over 3:00.

The video is split into four sections, one per team member (`SECTIONS` in `voiceover/pitch_script.py`): the build cuts it at those beat boundaries into `docs/media/pitch-sections/pitch-<n>-<slug>.mp4` (exact frames, subtitles embedded and as `.srt`), marks the same sections as chapters in the full video, and lists them as jump buttons on the Film page. The recording sheet, grouped by section, and the full script are in [`docs/pitch-video-script.md`](../docs/pitch-video-script.md).
