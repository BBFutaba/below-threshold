"""Import a folder of raw voiceover takes as narration recordings, for the film or the pitch.

    .venv/Scripts/python media/voiceover/import_takes.py media/voiceover/recordings/explanation
    .venv/Scripts/python media/voiceover/import_takes.py media/voiceover/recordings/pitch --video pitch
    .venv/Scripts/python media/voiceover/import_takes.py <folder> --dry-run   # only show the pairing

Takes are paired, in the order of the numbers in their file names (retakes may skip numbers;
"Track 1_017_1" sorts by 1, then 17, then 1), with the spoken lines in recording-sheet order
(docs/voiceover-script.md, docs/pitch-video-script.md). A folder with "section <n>" subfolders
pairs each subfolder with that section of the pitch (pitch_script.SECTIONS), so sections can be
recorded in any order and by different people. The counts must match. Each take is prepared for
the mix and written as media/voiceover/recordings/<scene>/<beat>.flac:

  - 70 Hz high-pass (rumble) and light spectral noise reduction at the take's measured room tone;
  - trimmed to the speech, keeping 0.12 s before the first word and 0.3 s after the last, with
    short fades (the build times each beat to the file, so leftover silence would delay the voice);
  - gentle 3:1 compression, then normalized to -16 LUFS with peaks limited to -1.5 dBFS;
  - 48 kHz mono, 16-bit FLAC.

On Windows, the built-in offline speech recognizer (asr.ps1) then
  1. checks every take says its own line: its transcript must match that line better than any
     other line of the film, or the import stops and lists the mismatches;
  2. aligns the line's words to the audio, written as <beat>.words.json; the scenes use these
     real word times to land visuals on phrases (scenes/film.py, word_time). Without it they
     assume an even reading pace.
A summary of every take goes to media/voiceover/recordings/takes.json (the pitch's to
recordings/pitch/takes.json).
"""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import shutil
import subprocess
import sys
import tempfile
from collections import Counter
from difflib import SequenceMatcher
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT / "media"))
sys.path.insert(0, str(HERE))

import film_build as fb  # noqa: E402
from pitch_script import PITCH, SECTIONS  # noqa: E402
from script import SCRIPT  # noqa: E402

REC = HERE / "recordings"
SR = 48000
PAD_BEFORE, PAD_AFTER = 0.12, 0.30
TARGET_LUFS = -16.0


# --------------------------------------------------------------------------- pairing


def spoken_lines(video: str = "film") -> list[tuple[str, str, str]]:
    """(scene, beat, text) for every spoken line of the film or the pitch, in recording-sheet order."""
    if video == "pitch":
        return [("pitch", b.key, b.text) for b in PITCH.beats if b.text]
    by_id = {s.id: s for s in SCRIPT}
    return [(sid, b.key, b.text) for sid, *_ in fb.SCENES for b in by_id[sid].beats if b.text]


def take_number(p: Path) -> tuple[int, ...]:
    """Sort key: every number in the file name, in order ("Track 1_017_1" -> (1, 17, 1))."""
    nums = tuple(int(n) for n in re.findall(r"\d+", p.stem))
    if not nums:
        raise SystemExit(f"{p.name}: no take number in the file name")
    return nums


def audio_files(folder: Path) -> list[Path]:
    return sorted((p for p in folder.iterdir() if p.is_file() and p.suffix.lower() in fb.AUDIO_EXT), key=take_number)


def pair_takes(folder: Path, video: str) -> list[tuple[Path, tuple[str, str, str]]]:
    """Pair the takes with the lines: one flat folder in order, or (pitch) one subfolder per section."""
    lines = spoken_lines(video)
    sub = {int(m.group(1)): d for d in folder.iterdir() if d.is_dir() and (m := re.fullmatch(r"section\s*(\d+)", d.name, re.I))}
    groups: list[tuple[list[Path], list[tuple[str, str, str]], str]] = []
    if sub:
        if video != "pitch":
            raise SystemExit("section subfolders are for the pitch: add --video pitch")
        by_key = {key: (sid, key, text) for sid, key, text in lines}
        for n, sec in enumerate(SECTIONS, 1):
            if n not in sub:
                raise SystemExit(f"no folder for section {n} ({sec.title}) in {folder}")
            groups.append((audio_files(sub[n]), [by_key[k] for k in sec.beats if k in by_key], sub[n].name))
    else:
        groups.append((audio_files(folder), lines, folder.name))
    pairs = []
    for takes, want, where in groups:
        nums = [take_number(p) for p in takes]
        dups = sorted({p.name for p, n in zip(takes, nums) if nums.count(n) > 1})
        if dups:
            raise SystemExit(f"{where}: several takes share a number, so their order is ambiguous: {', '.join(dups)}")
        if len(takes) != len(want):
            raise SystemExit(f"{where}: {len(takes)} takes for {len(want)} lines ({', '.join(k for _, k, _ in want)}); they must match one to one")
        pairs += list(zip(takes, want))
    return pairs


# --------------------------------------------------------------------------- audio


def ff(args: list[str], **kw) -> subprocess.CompletedProcess:
    return subprocess.run(["ffmpeg", "-v", "error", "-y", *args], check=True, capture_output=True, **kw)


def load(path: Path, af: str = "anull") -> np.ndarray:
    raw = ff(["-i", str(path), "-af", af, "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"]).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def frame_db(x: np.ndarray, win: float = 0.03, hop: float = 0.01) -> np.ndarray:
    w, h = int(win * SR), int(hop * SR)
    n = 1 + max(0, (len(x) - w) // h)
    idx = np.arange(w)[None, :] + h * np.arange(n)[:, None]
    return 10 * np.log10(np.mean(x[idx] ** 2, axis=1) + 1e-12)


def speech_span(db: np.ndarray) -> tuple[float, float, float]:
    """First and last speech (seconds) and the room-tone level, from the frame levels."""
    floor = np.percentile(db, 10)
    above = db[db > floor + 12]
    loud = np.percentile(above, 90) if len(above) else np.percentile(db, 90)  # the speech level, however short the speech
    active = db > max(floor + 12, loud - 26)
    runs, i = [], 0
    while i < len(active):
        if active[i]:
            j = i
            while j < len(active) and active[j]:
                j += 1
            if j - i >= 5:  # at least 50 ms: a click or a lip smack is not speech
                runs.append((i, j))
            i = j
        else:
            i += 1
    if not runs:
        raise ValueError("no speech found")
    # Speech is a run that is long (150 ms+) or loud (within 12 dB of the speech level). A short,
    # quiet burst cut off from it by a pause (a lip smack, a mouse click) is left out of the trim;
    # a soft sound right next to the speech (within 0.25 s) is kept with it.
    core = [r for r in runs if r[1] - r[0] >= 15 or db[r[0] : r[1]].max() >= loud - 12]
    first, last = (core[0], core[-1]) if core else (runs[0], runs[-1])
    for r in reversed([r for r in runs if r[1] <= first[0]]):
        if first[0] - r[1] > 25:
            break
        first = r
    for r in [r for r in runs if r[0] >= last[1]]:
        if r[0] - last[1] > 25:
            break
        last = r
    return first[0] * 0.01, last[1] * 0.01 + 0.02, float(floor)


def ebur128(path: Path) -> tuple[float, float]:
    """Integrated loudness (LUFS) and sample peak (dBFS)."""
    e = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af", "ebur128=peak=sample", "-f", "null", "-"], capture_output=True, text=True).stderr
    lufs = float(re.findall(r"I:\s+(-?[\d.]+) LUFS", e)[-1])
    peak = float(re.findall(r"Peak:\s+(-?[\d.inf]+) dBFS", e)[-1])
    return lufs, peak


def prepare(src: Path, dst: Path, tmp: Path) -> dict:
    raw_db = frame_db(load(src))
    nf = int(np.clip(round(np.percentile(raw_db, 10)), -80, -20))
    x = load(src, f"highpass=f=70:poles=2,afftdn=nr=10:nf={nf}:tn=1")
    t0, t1, _ = speech_span(frame_db(x))
    a, b = max(0.0, t0 - PAD_BEFORE), min(len(x) / SR, t1 + PAD_AFTER)
    y = x[int(a * SR) : int(b * SR)].astype(np.float32)
    # Fade out over the silence after the last word only (a take stopped right after speaking has little).
    fi, fo = int(0.03 * SR), int(np.clip(b - t1, 0.02, 0.12) * SR)
    y[:fi] *= np.sin(np.linspace(0, np.pi / 2, fi)) ** 2
    y[-fo:] *= np.cos(np.linspace(0, np.pi / 2, fo)) ** 2
    trimmed, comp = tmp / "trimmed.f32", tmp / "comp.wav"
    y.tofile(trimmed)
    ff(["-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", str(trimmed), "-af", "acompressor=threshold=-28dB:ratio=3:attack=8:release=120:knee=4", "-c:a", "pcm_f32le", str(comp)])
    lufs, _ = ebur128(comp)
    gain = TARGET_LUFS - lufs
    dst.parent.mkdir(parents=True, exist_ok=True)
    ff(["-i", str(comp), "-af", f"volume={gain:.2f}dB,alimiter=limit=-1.5dB:level=0:latency=1,aresample={SR}:dither_method=triangular",
        "-ar", str(SR), "-ac", "1", "-c:a", "flac", "-sample_fmt", "s16", str(dst)])
    out_lufs, out_peak = ebur128(dst)
    return {"trim": [round(a, 3), round(b, 3)], "noiseFloorDb": nf, "gainDb": round(gain, 2), "lufs": out_lufs, "peakDb": out_peak,
            "seconds": round(fb.ffprobe_duration(dst), 3), "speech": [round(t0 - a, 3), round(t1 - a, 3)]}


# --------------------------------------------------------------------------- recognition


ONES = "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split()
TENS = "_ _ twenty thirty forty fifty sixty seventy eighty ninety".split()


def number_words(n: int) -> list[str]:
    if n < 20:
        return [ONES[n]]
    if n < 100:
        return [TENS[n // 10]] + ([ONES[n % 10]] if n % 10 else [])
    if n < 1000:
        return [ONES[n // 100], "hundred"] + (number_words(n % 100) if n % 100 else [])
    if n < 1_000_000:
        return number_words(n // 1000) + ["thousand"] + (number_words(n % 1000) if n % 1000 else [])
    return [str(n)]


def norm_tokens(word: str) -> list[str]:
    """A spoken or recognized word as comparable tokens: lower case, digits spelled out."""
    out = []
    for part in re.findall(r"[A-Za-z]+|\d+", word.replace("'", "")):
        out += number_words(int(part)) if part.isdigit() else [part.lower()]
    return out


def line_tokens(text: str) -> list[str]:
    """The line's words, indexed exactly as script.words() and the scenes' cues count them."""
    return [w for w in text.replace("—", " ").split() if any(ch.isalnum() for ch in w)]


def run_asr(wavs: list[Path], tmp: Path) -> list[dict]:
    lst, out = tmp / "asr-list.txt", tmp / "asr.json"
    lst.write_text("\n".join(str(p) for p in wavs), encoding="utf-8-sig")
    subprocess.run(["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(HERE / "asr.ps1"), "-List", str(lst), "-Out", str(out)], check=True)
    data = json.loads(out.read_text(encoding="utf-8-sig"))
    data = data if isinstance(data, list) else [data]
    if len(data) != len(wavs):
        raise RuntimeError(f"speech recognition returned {len(data)} results for {len(wavs)} takes")
    return data


def similarity_table(transcripts: list[str], lines: list[str]) -> list[list[float]]:
    """TF-IDF cosine similarity of every transcript to every line."""
    toks = [[t for w in s.split() for t in norm_tokens(w)] for s in lines]
    df = Counter(w for t in toks for w in set(t))
    idf = {w: math.log((len(lines) + 1) / (c + 0.5)) for w, c in df.items()}

    def vec(ts):
        c = Counter(ts)
        return {w: n * idf.get(w, math.log(len(lines) + 1)) for w, n in c.items()}

    def cos(u, v):
        num = sum(x * v.get(w, 0.0) for w, x in u.items())
        den = math.sqrt(sum(x * x for x in u.values()) * sum(x * x for x in v.values()))
        return num / den if den else 0.0

    L = [vec(t) for t in toks]
    return [[cos(vec([t for w in s.split() for t in norm_tokens(w)]), l) for l in L] for s in transcripts]


def align(text: str, words: list[dict], t_lo: float, t_hi: float) -> tuple[list[float], int]:
    """Start time of every word of the line: recognized words anchor it, the rest is interpolated by length."""
    toks = line_tokens(text)
    sub = [(t, i) for i, w in enumerate(toks) for t in norm_tokens(w)]
    rec = []
    for w in words:
        parts = norm_tokens(w["w"])
        for j, p in enumerate(parts):
            rec.append((p, w["s"] + w["d"] * j / len(parts)))
    sm = SequenceMatcher(None, [s for s, _ in sub], [r for r, _ in rec], autojunk=False)
    blocks = [m for m in sm.get_matching_blocks() if m.size]
    weight = [len("".join(norm_tokens(w))) + 2 for w in toks]  # letters, plus a little for the gap

    def interpolate(anchors: dict[int, float]) -> tuple[list[float], int]:
        # Fixed points: the anchors, the first word at the start of speech (unless anchored), and
        # the end of the last word at the end of speech. Anchors that would run backwards are dropped.
        pts = sorted((i, min(max(t, t_lo), t_hi)) for i, t in anchors.items())
        if not pts or pts[0][0] != 0:
            pts.insert(0, (0, t_lo))
        pts.append((len(toks), t_hi))
        mono = [pts[0]]
        for p in pts[1:]:
            if p[1] >= mono[-1][1]:
                mono.append(p)
        starts = [0.0] * len(toks)
        for (ia, ta), (ib, tb) in zip(mono, mono[1:]):
            span = sum(weight[ia:ib]) or 1
            for i in range(ia, ib):
                starts[i] = ta + (tb - ta) * sum(weight[ia:i]) / span
        return starts, sum(1 for i, _ in mono if i in anchors)

    # 1. Runs of two or more matching words anchor the word that starts each line word.
    anchors: dict[int, float] = {}
    for a, b, size in (m for m in blocks if m.size >= 2):
        for k in range(size):
            ti = sub[a + k][1]
            if (a + k == 0 or sub[a + k - 1][1] != ti) and ti not in anchors:
                anchors[ti] = rec[b + k][1]
    # 2. A lone matching word can pair with the wrong occurrence of a repeated word, or with a
    #    misheard one: trust it only if it is long, appears once in the line and once in what was
    #    heard, and lands within 0.6 s of where the run anchors put it.
    estimate, _ = interpolate(anchors)
    n_sub, n_rec = Counter(s for s, _ in sub), Counter(r for r, _ in rec)
    for a, b, size in (m for m in blocks if m.size == 1):
        tok, ti = sub[a][0], sub[a][1]
        first = a == 0 or sub[a - 1][1] != ti
        if first and ti not in anchors and len(tok) >= 4 and n_sub[tok] == 1 and n_rec[tok] == 1 and abs(rec[b][1] - estimate[ti]) <= 0.6:
            anchors[ti] = rec[b][1]
    starts, kept = interpolate(anchors)
    return [round(s, 3) for s in starts], kept


# --------------------------------------------------------------------------- main


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("folder", type=Path)
    ap.add_argument("--video", choices=["film", "pitch"], default="film", help="which script the takes are for")
    ap.add_argument("--dry-run", action="store_true", help="only print the pairing")
    args = ap.parse_args()
    pairs = pair_takes(args.folder, args.video)
    takes, lines = [p for p, _ in pairs], [line for _, line in pairs]
    ahead = fb.AUDIO_EXT[: fb.AUDIO_EXT.index(".flac")]  # extensions the build would pick before .flac
    for p, (sid, key, _) in zip(takes, lines):
        print(f"  {p.parent.name + '/' + p.name:<34} -> {sid}/{key}")
        clash = [q for ext in ahead if (q := REC / sid / f"{key}{ext}").exists()]
        if clash:
            print(f"    {clash[0]} exists and would take precedence over the import; remove it first.")
            return 1
    if args.dry_run:
        return 0

    report = []
    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td)
        stage = tmp / "stage"  # nothing replaces the recordings until every check has passed
        for n, (p, (sid, key, text)) in enumerate(zip(takes, lines), 1):
            info = prepare(p, stage / sid / f"{key}.flac", tmp)
            report.append({"take": p.name, "line": f"{sid}/{key}", **info})
            print(f"[{n:2d}/{len(lines)}] {sid}/{key:<14} {info['seconds']:5.2f} s  trim {info['trim'][0]:.2f}-{info['trim'][1]:.2f}  gain {info['gainDb']:+.1f} dB  -> {info['lufs']:.1f} LUFS, peak {info['peakDb']:.1f} dBFS")

        if os.name != "nt":
            print("not on Windows: skipped the content check and word alignment (scenes will assume an even pace)")
        else:
            wavs = []
            for (sid, key, _) in lines:
                w = tmp / f"{sid}-{key}.wav"
                ff(["-i", str(stage / sid / f"{key}.flac"), "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", str(w)])
                wavs.append(w)
            print("recognizing the takes (Windows speech recognition)...")
            asr = run_asr(wavs, tmp)
            # Compare with every line of the same video (the order of `lines` may differ from the script's).
            sims = similarity_table([a["text"] for a in asr], [t for *_, t in lines])
            bad = []
            for i, (r, a, (sid, key, text)) in enumerate(zip(report, asr, lines)):
                best = max(range(len(lines)), key=lambda j: sims[i][j])
                other = max(s for j, s in enumerate(sims[i]) if j != i)
                r["asr"] = {"text": a["text"], "match": round(sims[i][i], 3), "bestOther": round(other, 3)}
                if best != i:
                    bad.append(f"  {r['take']} was paired with {sid}/{key} but sounds like {lines[best][0]}/{lines[best][1]}")
                ts = [w["s"] for w in a["words"]]
                if any(t1 < t0 - 0.05 for t0, t1 in zip(ts, ts[1:])) or any(t > r["seconds"] + 0.2 for t in ts):
                    print(f"  warning: {sid}/{key}: recognized word times run backwards or past the end; check asr.ps1")
                starts, anchors = align(text, a["words"], r["speech"][0], r["speech"][1])
                r["aligned"] = f"{anchors}/{len(starts)} words anchored"
                # The alignment names the exact audio it belongs to; the build ignores it for any other file.
                words_json = {"text": text, "audio": f"{key}.flac", "seconds": r["seconds"], "starts": starts, "anchored": anchors,
                              "source": "Windows speech recognition, interpolated by word length"}
                (stage / sid / f"{key}.words.json").write_text(json.dumps(words_json, indent=1), encoding="utf-8")
            if bad:
                print("These takes do not match their lines; nothing was imported:\n" + "\n".join(bad))
                return 1
            worst = min(report, key=lambda r: r["asr"]["match"] - r["asr"]["bestOther"])
            print(f"every take matches its own line best (closest call: {worst['line']}, {worst['asr']['match']:.2f} vs {worst['asr']['bestOther']:.2f})")
        for (sid, key, _) in lines:
            (REC / sid).mkdir(parents=True, exist_ok=True)
            shutil.move(stage / sid / f"{key}.flac", REC / sid / f"{key}.flac")  # the temp dir may be on another drive
            staged = stage / sid / f"{key}.words.json"
            if staged.exists():
                shutil.move(staged, REC / sid / f"{key}.words.json")
            else:
                (REC / sid / f"{key}.words.json").unlink(missing_ok=True)  # an old alignment would not fit the new take
    report_path = REC / "pitch" / "takes.json" if args.video == "pitch" else REC / "takes.json"
    report_path.write_text(json.dumps(report, indent=1), encoding="utf-8")
    total = sum(r["seconds"] for r in report)
    print(f"imported {len(report)} takes, {total / 60:.1f} min of narration -> {REC.relative_to(ROOT)}/<scene>/<beat>.flac")
    return 0


if __name__ == "__main__":
    sys.exit(main())
