# Explainer animations

Five short Manim (Community Edition 0.22) clips that the game embeds through
`src/ui/components/MediaClip.tsx`. Each one is drawn from the project's own simulation
code. No lattice, syndrome, error, correction, frequency or timing in these videos is
typed in by hand.

- `scripts/manim-data.ts` runs the TypeScript core (`src/core`) and writes the exact data
  every scene needs to `media/data/*.json`.
- `media/scenes/*.py` read that JSON and draw it. `media/scenes/common.py` holds the shared
  look: palette, type and the Willow-style lattice.
- `media/render.py` renders the scenes, encodes them for the web and writes the manifest.

## Regenerate

From the project root (Windows paths shown, as used in this repo):

```sh
# 1. Export the data from the real simulation code (the threshold sweep takes about a minute)
npx tsx scripts/manim-data.ts
#    Faster: reuse the cached runPoint sweep, re-read validation.json and bench.json
npx tsx scripts/manim-data.ts --skip-threshold

# 2. Render all scenes at 1280x720, 30 fps, then encode MP4, WebM, poster and GIF, and write the manifest
.venv/Scripts/python media/render.py
#    One scene only:            .venv/Scripts/python media/render.py decoder
#    Re-encode without Manim:   .venv/Scripts/python media/render.py --no-render
```

Under the hood, step 2 runs this for each scene:

```sh
.venv/Scripts/python -m manim render -r 1280,720 --fps 30 --media_dir media/build --disable_caching media/scenes/decoder.py DecoderScene
ffmpeg -i media/build/videos/decoder/720p30/DecoderScene.mp4 -an -c:v libx264 -preset slow -tune animation -crf 28 -pix_fmt yuv420p -movflags +faststart public/media/decoder.mp4
ffmpeg -i media/build/videos/decoder/720p30/DecoderScene.mp4 -an -c:v libvpx-vp9 -crf 38 -b:v 0 -row-mt 1 -deadline good -cpu-used 2 -pix_fmt yuv420p public/media/decoder.webm
ffmpeg -ss 19.5 -i media/build/videos/decoder/720p30/DecoderScene.mp4 -frames:v 1 -q:v 3 public/media/decoder.jpg
# decoder and threshold only: README GIF, 640 px wide, 12 fps, palettegen/paletteuse
ffmpeg -i media/build/videos/decoder/720p30/DecoderScene.mp4 -vf "fps=12,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle" docs/media/decoder.gif
```

Requirements: the project venv (`.venv`, Python 3.11 with manim 0.22) and ffmpeg 6 with
libx264 and libvpx-vp9. There is no LaTeX: all text is Manim `Text` with Unicode
(|0⟩, θ, µs). Inter is not installed on the render machine, so the clips use
Segoe UI Variable, which is in the app's fallback stack. `media/build/` is gitignored.

## Outputs

| File | What |
|---|---|
| `public/media/<id>.mp4` | H.264, yuv420p, faststart, CRF 28, no audio |
| `public/media/<id>.webm` | VP9, CRF 38, `-b:v 0`, no audio |
| `public/media/<id>.jpg` | 1280x720 poster, the most informative frame |
| `public/media/manifest.json` | `[{ id, title, caption, mp4, webm, poster, durationSec }]` |
| `docs/media/decoder.gif`, `docs/media/threshold.gif` | README GIFs, 640 px, 12 fps |

## Scenes and the data each one uses

### 1. `bridge`: from a row to a grid (`bridge.py`, `BridgeScene`, about 20 s)

The 3-qubit repetition code (three data qubits, two teal ZZ checks) catches an X error and
misses a Z error. Its row becomes the middle row of the distance-3 rotated surface code:
the two checks unfold into the two Z plaquettes that contain those qubit pairs. Then the
other qubits, teal Z-checks and violet X-checks appear. An X on the same qubit fires teal
checks and a Z fires violet checks. Finally the grid grows to distance 7 on a chip outline.

Data, `media/data/bridge.json`:
- Layouts from `makeRotatedSurfaceCode(3)` and `makeRotatedSurfaceCode(7)`.
- Fired checks from `syndrome()` in `src/core/pauliFrame.ts`. For the repetition code this
  runs on its two weight-2 Z checks: X on qubit 1 fires check 1, Z on qubit 2 fires nothing.
  For the surface code, X on data qubit 3 fires checks 1 and 4, and Z on data qubit 4
  fires checks 2 and 5.
- The repetition check to plaquette mapping is computed: the Z stabilizers whose support
  holds each neighbouring pair of the middle row.

### 2. `decoder`: how a decoder thinks (`decoder.py`, `DecoderScene`, about 29 s)

A d = 5 bit-flip instance. Noise strikes and stays hidden, three checks fire, MWPM draws
its matching paths in the order it returns them (one pair, one match to the edge). The
qubits on the paths turn blue and the checks go quiet. The real errors are revealed as
coral rings, and error times correction closes one plaquette's loop, so the qubit is
saved. A short coda uses a second seed where the leftover chain crosses the grid: the
lattice flashes coral and shows "Logical error".

Data, `media/data/decoder.json`:
- `sampleNoise(makeRotatedSurfaceCode(5), { kind: 'bitflip', p: 0.08 }, makeRng(seed))`
  and `decodeSample(..., DECODERS.mwpm)`. Bit-flip noise only needs the X-error graph from
  `graphsFor`.
- Success: **seed 111**. Errors on qubits 8, 9, 24, fired Z-checks 9, 11, 21. The matching
  is 9 to 11 (through check 16, flipping qubits 13 and 14) and 21 to the boundary (qubit 24).
  The correction is {13, 14, 24}. The residual {8, 9, 13, 14} equals X stabilizer 10, found
  by a GF(2) solve, and `logicalOutcome` gives no failure.
- Failure: **seed 59**. Errors on qubits 7, 19, 24, correction {1, 13}. The residual
  {1, 7, 13, 19, 24} runs from the top edge to the bottom edge: `logicalOutcome` gives xFlip.
- Seeds were found by scanning from seed 1. Success is the first instance with 3 to 5
  errors, 2 or 3 matched pairs including both a pair match and a boundary match, a path
  of at least two edges, and a residual equal to one weight-4 plaquette. The coda is the
  first logical failure with 3 errors and at most 2 pairs. The per-pair paths come
  from `pathEdges`, and the script checks that they reproduce the decoder's flips exactly.

### 3. `discretization`: why errors are digital, chapter 6 (`discretization.py`, `DiscretizationScene`, about 22 s)

Qubit 1 of the 3-qubit code drifts by Rx(θ), θ = 0.9 rad. The two parity checks are
measured 200 times. Every run lands on one of two outcomes, "no error" or "full flip on
qubit 1". A strip shows each run in order, a histogram fills, and the counts are compared
with cos²(θ/2) and sin²(θ/2).

Data, `media/data/discretization.json`: 200 runs of `QState` (`src/core/quantum.ts`) with
5 qubits (3 data and 2 ancillas). Each run starts from |000⟩, applies `rx(0, 0.9)`, CNOTs
into the ancillas for Z1Z2 and Z2Z3, then `measure()` with **makeRng(6006)**. The results
are 168 no error (84%) and 32 flips (16%), against 81.1% and 18.9% from both the state
vector and the formula. The other two syndromes came up 0 times. After each run the state
has fidelity 1.000 with either |000⟩ or X₁|000⟩. The dial shows `bloch(0)` before and after
measurement.

### 4. `threshold`: the threshold (`threshold.py`, `ThresholdScene`, about 21 s)

Logical error rate (log scale) against physical error rate for d = 5, 7, 9, bit-flip noise
and MWPM, with 95% bands. The crossing is marked. A noise marker sweeps from 5% to 14% and
back, and the readout flips between "Below threshold: bigger codes make things better"
and "Above threshold: bigger codes make things worse". The readout shows the measured
values at the nearest measured p, and its verdict comes from comparing d = 9 with d = 5
there.

Data, `media/data/threshold.json`:
- p from 8% to 12%: the validation runs in `src/data/validation.json` (`curves.bitflip.mwpm`,
  until 4000 failures or 400k trials per point).
- p = 4 to 7% and 13 to 16%: our own `runPoint()` sweep (`src/core/simulate.ts`, bitflip,
  mwpm, until 1500 failures or 300k trials). Seed `7000000 + 1000·d + index`. It is cached
  in `runPointCurves`.
- The crossing comes from `crossings()` in `src/core/stats.ts` on the merged curves:
  d = 5 and d = 9 cross at 9.6%. The "full fit" line on screen is the bit-flip MWPM verdict
  in validation.json: 9.9% from a finite-size fit over d = 5 to 13, against about 10.3%
  published.

### 5. `backlog`: the real-time bottleneck (`backlog.py`, `BacklogScene`, about 17 s)

A chip clock produces one syndrome round per µs. Each round becomes a block that joins a
FIFO queue in front of a decoder. The queue follows the exact rule: round k arrives at
t = k µs, and its decoding starts at max(k, end of round k−1) and takes the measured time
per round. Each lane shows its backlog and how long a T gate requested now would wait.
The time scaling is on screen: "slow motion: 1 µs of chip time = 0.4 s".

Data, `media/data/backlog.json`, copied from `src/data/bench.json` (`scripts/bench.ts`):
median decode time per round at d = 9, p = 3%, phenomenological noise with q = p and
d rounds, measured in JavaScript on a Ryzen 9 9950X. The current numbers:
- MWPM: **103.5 µs per round**. After 30 µs it has not finished round 1, the backlog is 30,
  and a T gate would wait 3.1 ms.
- Union-find: **4.0 µs per round**. It is 26× faster but still over 1 µs: backlog 23,
  T gate wait 92 µs.
- The third lane is the requirement, labelled "Keeping pace: ≤ 1 µs per round: the
  requirement". It is not a measured decoder, and its queue stays flat.

Note: none of the measured JavaScript decoders is under 1 µs per round at d = 9, so the
video does not show union-find keeping up. That matches the app's own real-time screen,
which says that in browser JavaScript every decoder is slower than a chip's 1 µs round.
If `bench.json` ever has a decoder under 1 µs per round, rerun the two commands and its
lane stays flat, because the queue rule is the same.

## Visual language

The colors are the app tokens from `src/ui/theme/tokens.css`:

| Element | Look |
|---|---|
| Background, surface, border | `#0E1220`, `#151A2C`, `#262D45` |
| Text, muted text | `#E8ECF6`, `#9AA3BF` |
| Data qubit | white-outlined circle |
| Z-check | teal `#3DD6C6` tile at 0.18 fill |
| X-check | violet `#A68BFF` tile at 0.18 fill |
| Weight-2 boundary checks | half-disks outside the edge |
| Fired check | 0.85 fill plus a center dot |
| Hidden error | coral `#FF6F61` ring with the Pauli letter |
| Correction | blue `#4EA8FF` fill |
| Decoder matching | dashed blue path |
| Success | green `#5BD68A` |
| Backlog, warning | amber `#FFB547` |

The threshold curves use a single-hue ramp (`#6F7BA8`, `#A9B6E0`, `#F2F5FF`) with direct
labels and a legend, so no semantic accent is reused for "distance". Captions stay at
10 words or fewer, with one idea per shot.
