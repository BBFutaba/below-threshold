"""Build the Below Threshold explainer film and its web clips.

    .venv/Scripts/python media/film_build.py                  # preview quality (480p15), all scenes
    .venv/Scripts/python media/film_build.py --final          # 1920x1080 @ 30 fps
    .venv/Scripts/python media/film_build.py --final matching # one scene (film still re-stitched)
    .venv/Scripts/python media/film_build.py --no-render      # re-encode/re-mux only (e.g. after recording)
    .venv/Scripts/python media/film_build.py --sheet          # only regenerate docs/voiceover-script.md

Steps: run scripts/film/<scene>.ts data exports, render scenes in parallel, write WebVTT
captions from the beat timings, mux recorded narration (media/voiceover/recordings/<scene>/<beat>.wav)
at each beat's start, encode web clips, stitch the full film, write the manifest and the
recording sheet. Set NARRATION=draft to use the synthetic draft voice instead.

Outputs
  public/media/<scene>.{mp4,webm,jpg,vtt}     720p clips embedded in the app
  public/media/film.{mp4,vtt}, film.jpg       720p film for the app's /film page
  docs/media/below-threshold-film.{mp4,srt,vtt}  1080p film
  public/media/manifest.json
  docs/voiceover-script.md
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCENES_DIR = ROOT / "media" / "scenes"
BUILD = ROOT / "media" / "build"
TIMINGS = BUILD / "timings"
PUB = ROOT / "public" / "media"
DOCS_MEDIA = ROOT / "docs" / "media"
VO = ROOT / "media" / "voiceover"
PY = sys.executable

sys.path.insert(0, str(VO))
from script import SCRIPT, words  # noqa: E402

# id, file, class, poster beat (frame taken near the end of that beat)
SCENES = [
    ("intro", "intro.py", "IntroScene", "title"),
    ("fragile", "fragile.py", "FragileScene", "arrow"),
    ("parity", "parity.py", "ParityScene", "syndrome"),
    ("digital", "digital.py", "DigitalScene", "formula"),
    ("surface", "surface.py", "SurfaceScene", "chain"),
    ("matching", "matching.py", "MatchingScene", "saved"),
    ("spacetime", "spacetime.py", "SpacetimeScene", "match3d"),
    ("threshold", "threshold.py", "ThresholdScene", "value"),
    ("realtime", "realtime.py", "RealtimeScene", "stall"),
    ("outro", "outro.py", "OutroScene", "logo"),
]
GIFS = {"matching": "saved", "threshold": "curves"}
AUDIO_EXT = (".wav", ".m4a", ".mp3", ".flac", ".ogg")


def run(cmd: list[str], **kw) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, check=True, **kw)


def ffprobe_duration(p: Path) -> float:
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)], capture_output=True, text=True, check=True)
    return float(out.stdout.strip())


# --------------------------------------------------------------------------- render


def quality_args(final: bool) -> tuple[list[str], str]:
    if final:
        return ["-r", "1920,1080", "--fps", "30"], "1080p30"
    return ["-ql"], "480p15"


def render_scene(sid: str, file: str, cls: str, final: bool) -> Path:
    qargs, qdir = quality_args(final)
    log = BUILD / f"render-{sid}.log"
    BUILD.mkdir(parents=True, exist_ok=True)
    with open(log, "w", encoding="utf-8") as f:
        subprocess.run(
            [PY, "-m", "manim", "render", *qargs, "--media_dir", str(BUILD), "--disable_caching", file, cls],
            cwd=SCENES_DIR,
            stdout=f,
            stderr=subprocess.STDOUT,
            check=False,
        )
    mp4 = BUILD / "videos" / Path(file).stem / qdir / f"{cls}.mp4"
    if not mp4.exists():
        tail = log.read_text(encoding="utf-8", errors="replace")[-3000:]
        raise RuntimeError(f"render of {sid} failed; log tail:\n{tail}")
    return mp4


def scene_video(sid: str, file: str, cls: str, final: bool) -> Path:
    _, qdir = quality_args(final)
    return BUILD / "videos" / Path(file).stem / qdir / f"{cls}.mp4"


# --------------------------------------------------------------------------- captions


def fmt_ts(t: float, sep: str = ".") -> str:
    h = int(t // 3600)
    m = int((t % 3600) // 60)
    s = t % 60
    return f"{h:02d}:{m:02d}:{s:06.3f}".replace(".", sep)


def split_line(text: str) -> list[str]:
    """Sentence-level cues, further split at commas when long (keeps cues to ~2 lines)."""
    sentences = re.split(r"(?<=[.!?:])\s+", text.strip())
    out: list[str] = []
    for s in sentences:
        if len(s) <= 90:
            out.append(s)
            continue
        parts = re.split(r"(?<=,)\s+", s)
        cur = ""
        for p in parts:
            if cur and len(cur) + len(p) + 1 > 90:
                out.append(cur)
                cur = p
            else:
                cur = f"{cur} {p}".strip()
        if cur:
            out.append(cur)
    return [o for o in out if o]


def cues(timing: dict, offset: float = 0.0) -> list[tuple[float, float, str]]:
    out = []
    for b in timing["beats"]:
        if not b["text"] or b["speech"] <= 0:
            continue
        chunks = split_line(b["text"])
        total_w = sum(max(1, words(c)) for c in chunks)
        t = b["speechStart"]
        for c in chunks:
            dur = b["speech"] * max(1, words(c)) / total_w
            out.append((offset + t, offset + t + dur, c))
            t += dur
    return out


def write_vtt(path: Path, cs: list[tuple[float, float, str]]) -> None:
    lines = ["WEBVTT", ""]
    for i, (a, b, t) in enumerate(cs, 1):
        lines += [str(i), f"{fmt_ts(a)} --> {fmt_ts(b)}", t, ""]
    path.write_text("\n".join(lines), encoding="utf-8")


def write_srt(path: Path, cs: list[tuple[float, float, str]]) -> None:
    lines = []
    for i, (a, b, t) in enumerate(cs, 1):
        lines += [str(i), f"{fmt_ts(a, ',')} --> {fmt_ts(b, ',')}", t, ""]
    path.write_text("\n".join(lines), encoding="utf-8")


# --------------------------------------------------------------------------- audio


def recording(sid: str, key: str) -> Path | None:
    mode = os.environ.get("NARRATION", "auto")
    if mode == "estimate":
        return None
    folder = VO / ("draft" if mode == "draft" else "recordings") / sid
    for ext in AUDIO_EXT:
        p = folder / f"{key}{ext}"
        if p.exists():
            return p
    return None


def narration_track(sid: str, timing: dict, duration: float, out: Path) -> bool:
    """Mix every recorded line at its beat's speech start. Returns False if nothing is recorded."""
    clips = [(b, recording(sid, b["key"])) for b in timing["beats"] if b["text"]]
    clips = [(b, p) for b, p in clips if p is not None]
    if not clips:
        return False
    # A recording longer than its beat would talk over the next line: the scene was
    # rendered with older timings and must be re-rendered (not just re-mixed).
    for b, p in clips:
        slot = b["end"] - b["speechStart"]
        length = ffprobe_duration(p)
        if length > slot + 0.05:
            print(f"warning: {sid}/{b['key']} recording is {length:.1f} s but its beat leaves {slot:.1f} s; re-render this scene (drop --no-render)")
    cmd = ["ffmpeg", "-v", "error", "-y"]
    for _, p in clips:
        cmd += ["-i", str(p)]
    filt = []
    for i, (b, _) in enumerate(clips):
        ms = int(round(b["speechStart"] * 1000))
        filt.append(f"[{i}:a]aformat=sample_rates=48000:channel_layouts=mono,adelay={ms}:all=1[a{i}]")
    mix = "".join(f"[a{i}]" for i in range(len(clips)))
    filt.append(f"{mix}amix=inputs={len(clips)}:normalize=0:dropout_transition=0,apad,atrim=0:{duration:.3f},loudnorm=I=-16:TP=-1.5:LRA=11[out]")
    cmd += ["-filter_complex", ";".join(filt), "-map", "[out]", "-ar", "48000", "-ac", "1", str(out)]
    run(cmd)
    return True


# --------------------------------------------------------------------------- encode


def encode_clip(src: Path, audio: Path | None, sid: str, poster_t: float) -> None:
    PUB.mkdir(parents=True, exist_ok=True)
    a_in = ["-i", str(audio)] if audio else []
    a_map = ["-map", "0:v", "-map", "1:a"] if audio else ["-map", "0:v"]
    vf = "scale=1280:720:flags=lanczos"
    run(["ffmpeg", "-v", "error", "-y", "-i", str(src), *a_in, *a_map, "-vf", vf, "-c:v", "libx264", "-preset", "slow", "-crf", "24", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
         *(["-c:a", "aac", "-b:a", "128k", "-shortest"] if audio else ["-an"]), str(PUB / f"{sid}.mp4")])
    run(["ffmpeg", "-v", "error", "-y", "-i", str(src), *a_in, *a_map, "-vf", vf, "-c:v", "libvpx-vp9", "-crf", "36", "-b:v", "0", "-row-mt", "1",
         *(["-c:a", "libopus", "-b:a", "96k", "-shortest"] if audio else ["-an"]), str(PUB / f"{sid}.webm")])
    run(["ffmpeg", "-v", "error", "-y", "-ss", f"{poster_t:.2f}", "-i", str(src), "-frames:v", "1", "-vf", vf, "-q:v", "3", str(PUB / f"{sid}.jpg")])


def make_gif(src: Path, sid: str, start: float, length: float) -> None:
    DOCS_MEDIA.mkdir(parents=True, exist_ok=True)
    pal = BUILD / f"{sid}-palette.png"
    vf = "fps=12,scale=640:-1:flags=lanczos"
    run(["ffmpeg", "-v", "error", "-y", "-ss", f"{start:.2f}", "-t", f"{length:.2f}", "-i", str(src), "-vf", f"{vf},palettegen=stats_mode=diff", str(pal)])
    run(["ffmpeg", "-v", "error", "-y", "-ss", f"{start:.2f}", "-t", f"{length:.2f}", "-i", str(src), "-i", str(pal), "-lavfi", f"{vf} [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=4", str(DOCS_MEDIA / f"{sid}.gif")])


def stitch_film(parts: list[tuple[str, Path, Path | None, float]], out_1080: Path, out_720: Path) -> None:
    """Concatenate scenes (each given a silent track if unrecorded) into the film."""
    cmd = ["ffmpeg", "-v", "error", "-y"]
    filt = []
    for i, (sid, v, a, dur) in enumerate(parts):
        cmd += ["-i", str(v)]
        if a:
            cmd += ["-i", str(a)]
        else:
            cmd += ["-f", "lavfi", "-t", f"{dur:.3f}", "-i", "anullsrc=r=48000:cl=mono"]
    n = len(parts)
    for i in range(n):
        filt.append(f"[{2 * i}:v]scale=1920:1080:flags=lanczos,fps=30,format=yuv420p,setsar=1[v{i}]")
        filt.append(f"[{2 * i + 1}:a]aformat=sample_rates=48000:channel_layouts=mono[a{i}]")
    filt.append("".join(f"[v{i}][a{i}]" for i in range(n)) + f"concat=n={n}:v=1:a=1[v][a]")
    run(cmd + ["-filter_complex", ";".join(filt), "-map", "[v]", "-map", "[a]", "-c:v", "libx264", "-preset", "slow", "-crf", "22", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", str(out_1080)])
    run(["ffmpeg", "-v", "error", "-y", "-i", str(out_1080), "-vf", "scale=1280:720:flags=lanczos", "-c:v", "libx264", "-preset", "slow", "-crf", "26", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", str(out_720)])


# --------------------------------------------------------------------------- recording sheet


def write_sheet(timings: dict[str, dict], film_offsets: dict[str, float]) -> None:
    by_id = {s.id: s for s in SCRIPT}
    L = [
        "# Voiceover script and recording sheet",
        "",
        "Generated by `media/film_build.py` from `media/voiceover/script.py` (edit the lines there, not here).",
        "",
        "## How to record",
        "",
        "1. Record **one file per line** below, named exactly as shown, into `media/voiceover/recordings/<scene>/`.",
        "   WAV (48 kHz, mono, 24-bit) is best; `.m4a`, `.mp3` and `.flac` also work. Leave about 0.3 s of room tone at each end.",
        "2. Read at a relaxed explainer pace (about 150 words per minute). Lines may run longer or shorter than the estimate:",
        "   the build re-times each beat to the real recording, so the picture always waits for the voice.",
        "3. Rebuild: `.venv/Scripts/python media/film_build.py --final` (re-renders with the new timings, mixes the narration",
        "   in, regenerates the captions, the web clips and the full film). `--no-render` only re-mixes; use it only when the",
        "   scenes were already rendered with these recordings (the build warns if a line would overrun its beat).",
        "4. Lines marked **verify** quote a published number; check it against CITATIONS.md before recording.",
        "",
        "Tips: one take per line keeps retakes cheap; keep the mic distance constant; record in a quiet, soft room; avoid",
        "reading the stage directions (they are context only). Pronunciation: *ancilla* an-SILL-uh; *Edmonds* ED-munds;",
        "*lambda* LAM-duh; *qubit* CUE-bit; *alpha, beta* as the Greek letters.",
        "",
    ]
    total = 0.0
    total_words = 0
    rows = []
    for sid, *_ in SCENES:
        sc = by_id[sid]
        tm = timings.get(sid)
        off = film_offsets.get(sid)
        head = f"## {sc.chapter + ': ' if sc.chapter else ''}{sc.title} (`{sid}`)"
        L += [head, ""]
        if tm and off is not None:
            L += [f"Starts at **{fmt_ts(off)[3:8]}** in the film; scene length {tm['duration']:.1f} s.", ""]
        by_key = {b["key"]: b for b in (tm["beats"] if tm else [])}
        for b in sc.beats:
            if not b.text:
                L += [f"- *(silent: {b.visual})*", ""]
                continue
            w = words(b.text)
            total_words += w
            bt = by_key.get(b.key)
            when = f"{fmt_ts((off or 0) + bt['speechStart'])[3:8]}" if bt and off is not None else "--:--"
            rec = recording(sid, b.key)
            status = "recorded" if rec else "to record"
            L += [
                f"### `{sid}/{b.key}` · film {when} · {w} words · ~{w / 2.6:.0f} s · {status}",
                "",
                f"> {b.text}",
                "",
                f"File: `media/voiceover/recordings/{sid}/{b.key}.wav`  ",
                f"On screen: {b.visual}" + (f"  \n**verify:** {b.verify}" if b.verify else ""),
                "",
            ]
        if tm:
            total += tm["duration"]
    L.insert(4, f"Total: {total_words} spoken words, about {total_words / 2.6 / 60:.1f} minutes of narration; film length {total / 60:.1f} minutes at the current timings.")
    L.insert(5, "")
    (ROOT / "docs" / "voiceover-script.md").write_text("\n".join(L), encoding="utf-8")
    _ = rows


# --------------------------------------------------------------------------- main


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("scenes", nargs="*")
    ap.add_argument("--final", action="store_true")
    ap.add_argument("--no-render", action="store_true")
    ap.add_argument("--no-data", action="store_true")
    ap.add_argument("--sheet", action="store_true")
    ap.add_argument("--jobs", type=int, default=max(2, min(8, (os.cpu_count() or 4) // 3)))
    args = ap.parse_args()
    chosen = [s for s in SCENES if not args.scenes or s[0] in args.scenes]
    unknown = set(args.scenes) - {s[0] for s in SCENES}
    if unknown:
        print("unknown scenes:", ", ".join(sorted(unknown)))
        return 2

    def load_timings() -> dict[str, dict]:
        out = {}
        for sid, *_ in SCENES:
            p = TIMINGS / f"{sid}.json"
            if p.exists():
                out[sid] = json.loads(p.read_text(encoding="utf-8"))
        return out

    if args.sheet:
        tms = load_timings()
        offs, t = {}, 0.0
        for sid, *_ in SCENES:
            if sid in tms:
                offs[sid] = t
                t += tms[sid]["duration"]
        write_sheet(tms, offs)
        print("wrote docs/voiceover-script.md")
        return 0

    if not args.no_render:
        if not args.no_data:
            for sid, *_ in chosen:
                ts = ROOT / "scripts" / "film" / f"{sid}.ts"
                if ts.exists():
                    run(["npx", "tsx", str(ts.relative_to(ROOT))], cwd=ROOT, shell=os.name == "nt")
        with ThreadPoolExecutor(max_workers=args.jobs) as ex:
            futs = {sid: ex.submit(render_scene, sid, f, c, args.final) for sid, f, c, _ in chosen}
            errors = []
            for sid, fu in futs.items():
                try:
                    fu.result()
                    print(f"rendered {sid}")
                except Exception as e:  # report every failure, not just the first
                    errors.append(f"{sid}: {e}")
            if errors:
                print("\n\n".join(errors))
                return 1

    timings = load_timings()
    parts = []
    offsets: dict[str, float] = {}
    t = 0.0
    manifest = {"scenes": [], "film": None}
    by_id = {s.id: s for s in SCRIPT}
    for sid, f, c, poster_beat in SCENES:
        v = scene_video(sid, f, c, args.final)
        if not v.exists() or sid not in timings:
            print(f"skip {sid}: not rendered at this quality")
            continue
        tm = timings[sid]
        dur = ffprobe_duration(v)
        offsets[sid] = t
        audio = BUILD / f"{sid}-narration.wav"
        has_audio = narration_track(sid, tm, dur, audio)
        if sid in [s[0] for s in chosen] or args.no_render:
            pb = next((b for b in tm["beats"] if b["key"] == poster_beat), tm["beats"][-1])
            encode_clip(v, audio if has_audio else None, sid, max(0.0, min(dur - 0.1, pb["end"] - 0.6)))
            write_vtt(PUB / f"{sid}.vtt", cues(tm))
            if sid in GIFS:
                gb = next(b for b in tm["beats"] if b["key"] == GIFS[sid])
                make_gif(v, sid, gb["start"], min(9.0, gb["end"] - gb["start"]))
        parts.append((sid, v, audio if has_audio else None, dur))
        sc = by_id[sid]
        manifest["scenes"].append(
            {
                "id": sid,
                "chapter": sc.chapter,
                "title": sc.title,
                "durationSec": round(dur, 2),
                "filmStartSec": round(t, 2),
                "mp4": f"media/{sid}.mp4",
                "webm": f"media/{sid}.webm",
                "poster": f"media/{sid}.jpg",
                "captions": f"media/{sid}.vtt",
                "narrated": has_audio,
            }
        )
        t += dur

    if len(parts) == len(SCENES):
        DOCS_MEDIA.mkdir(parents=True, exist_ok=True)
        film_1080 = DOCS_MEDIA / "below-threshold-film.mp4"
        stitch_film(parts, film_1080, PUB / "film.mp4")
        all_cues = []
        for sid, *_ in SCENES:
            all_cues += cues(timings[sid], offsets[sid])
        write_vtt(PUB / "film.vtt", all_cues)
        write_vtt(DOCS_MEDIA / "below-threshold-film.vtt", all_cues)
        write_srt(DOCS_MEDIA / "below-threshold-film.srt", all_cues)
        run(["ffmpeg", "-v", "error", "-y", "-ss", f"{offsets['intro'] + 9.5:.2f}", "-i", str(film_1080), "-frames:v", "1", "-vf", "scale=1280:720", "-q:v", "3", str(PUB / "film.jpg")])
        manifest["film"] = {
            "mp4": "media/film.mp4",
            "poster": "media/film.jpg",
            "captions": "media/film.vtt",
            "durationSec": round(t, 2),
            "narrated": any(p[2] for p in parts),
        }
        print(f"film: {t / 60:.1f} min -> {film_1080.relative_to(ROOT)} ({film_1080.stat().st_size / 1e6:.1f} MB)")
    else:
        print(f"film not stitched: {len(parts)}/{len(SCENES)} scenes available at this quality")

    PUB.mkdir(parents=True, exist_ok=True)
    (PUB / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    write_sheet(timings, offsets)
    over = [(sid, b["key"], b["overrun"]) for sid, tm in timings.items() for b in tm["beats"] if b["overrun"] > 0.3]
    for sid, key, o in over:
        print(f"note: {sid}/{key} visuals overrun the line by {o:.1f} s")
    _ = shutil
    return 0


if __name__ == "__main__":
    sys.exit(main())
