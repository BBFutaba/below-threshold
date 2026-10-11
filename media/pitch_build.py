"""Build the 3-minute pitch video: Manim scene + real app screen recordings + narration.

    .venv/Scripts/python media/pitch_build.py            # preview (480p15)
    .venv/Scripts/python media/pitch_build.py --final    # 1920x1080 @ 30 fps
    .venv/Scripts/python media/pitch_build.py --final --record   # also re-record the app clips
    .venv/Scripts/python media/pitch_build.py --final --no-render  # re-composite / re-mix only
    .venv/Scripts/python media/pitch_build.py --sheet    # only regenerate docs/pitch-video-script.md
    .venv/Scripts/python media/pitch_build.py --split    # only re-cut the sections from the last build

1. scripts/film/pitch.ts exports the scene's data; media/scenes/pitch.py (PitchScene) is
   rendered with narration-driven timing (media/voiceover/pitch_script.py).
2. The scene declares "screen windows" (timings JSON: id, start, end, pixel rect). Real
   recordings of the live app (scripts/record-pitch.ts -> media/build/pitch/clips/<id>.mp4)
   are fitted to each interval (played at 0.85x to 1.6x speed, then held on their last frame), faded
   in and out, and overlaid into the window.
3. Recorded narration (media/voiceover/recordings/pitch/<beat>.wav) is mixed at each beat.
4. The video is cut into the four sections of pitch_script.SECTIONS (one per team member) at
   beat boundaries; the sections are also chapters of the full video.
5. Outputs: docs/media/below-threshold-pitch.{mp4,srt,vtt} (1080p),
   docs/media/pitch-sections/pitch-<n>-<slug>.{mp4,srt} (1080p, subtitles embedded),
   public/media/pitch.{mp4,jpg,vtt} (720p, for the site), docs/pitch-video-script.md.
The hackathon limit is 3:00; the build fails if the video runs longer.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "media"))
sys.path.insert(0, str(ROOT / "media" / "voiceover"))

import film_build as fb  # noqa: E402
from pitch_script import LIMIT_SECONDS, PITCH, SECTIONS  # noqa: E402
from script import words  # noqa: E402

CLIPS = ROOT / "media" / "build" / "pitch" / "clips"
OUT_DOCS = ROOT / "docs" / "media"
OUT_SECTIONS = OUT_DOCS / "pitch-sections"
OUT_PUB = ROOT / "public" / "media"
DATA = ROOT / "media" / "data" / "film" / "pitch.json"
MAX_SPEEDUP = 1.6
MIN_SPEED = 0.85  # a clip a little shorter than its window plays slightly slower rather than freezing
FADE = 0.35


def clip_info(cid: str) -> tuple[Path, float, float]:
    mp4 = CLIPS / f"{cid}.mp4"
    meta = json.loads((CLIPS / f"{cid}.json").read_text(encoding="utf-8"))
    start = float(meta.get("startSec", 0.0))
    length = fb.ffprobe_duration(mp4) - start
    return mp4, start, length


def composite(scene_mp4: Path, timing: dict, audio: Path | None, out: Path) -> None:
    screens = timing.get("screens", [])
    cmd = ["ffmpeg", "-v", "error", "-y", "-i", str(scene_mp4)]
    filt = []
    for i, sc in enumerate(screens):
        mp4, start, length = clip_info(sc["id"])
        cmd += ["-i", str(mp4)]
        D = sc["end"] - sc["start"]
        speed = min(MAX_SPEEDUP, max(MIN_SPEED, length / D))
        hold = max(0.0, D - length / speed) + 0.1
        r = sc["rect"]
        filt.append(
            f"[{i + 1}:v]trim=start={start:.3f},setpts=(PTS-STARTPTS)/{speed:.4f},fps=30,"
            f"scale={r['w']}:{r['h']}:flags=lanczos,tpad=stop_mode=clone:stop_duration={hold:.3f},"
            f"trim=duration={D:.3f},format=yuva420p,"
            f"fade=t=in:st=0:d={FADE}:alpha=1,fade=t=out:st={max(0.0, D - FADE):.3f}:d={FADE}:alpha=1,"
            f"setpts=PTS+{sc['start']:.3f}/TB[c{i}]"
        )
        print(f"  {sc['id']:<9} {sc['start']:6.1f}-{sc['end']:6.1f}s  clip {length:5.1f}s  speed x{speed:.2f}  hold {max(0.0, hold - 0.1):.1f}s")
    prev = "0:v"
    for i, sc in enumerate(screens):
        r = sc["rect"]
        nxt = f"b{i}"
        filt.append(f"[{prev}][c{i}]overlay=x={r['x']}:y={r['y']}:eof_action=pass:enable='between(t,{sc['start']:.3f},{sc['end']:.3f})'[{nxt}]")
        prev = nxt
    filt.append(f"[{prev}]format=yuv420p[vout]")
    if audio:
        cmd += ["-i", str(audio)]
    else:
        cmd += ["-f", "lavfi", "-t", f"{timing['duration']:.3f}", "-i", "anullsrc=r=48000:cl=mono"]
    a_idx = len(screens) + 1
    cmd += ["-filter_complex", ";".join(filt), "-map", "[vout]", "-map", f"{a_idx}:a",
            "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", str(out)]
    fb.run(cmd)


def section_spans(timing: dict, total: float) -> list[dict]:
    """Each section's interval in the full video: from its first beat to the next section's first beat."""
    start = {b["key"]: b["start"] for b in timing["beats"]}
    spans = []
    for i, s in enumerate(SECTIONS):
        a = 0.0 if i == 0 else start[s.beats[0]]
        b = start[SECTIONS[i + 1].beats[0]] if i + 1 < len(SECTIONS) else total
        spans.append({"n": i + 1, "slug": s.slug, "title": s.title, "start": a, "end": b, "file": f"pitch-{i + 1}-{s.slug}"})
    return spans


def probe(path: Path, entries: str, stream: str) -> str:
    out = subprocess.run(["ffprobe", "-v", "error", "-select_streams", stream, "-show_entries", entries, "-of", "csv=p=0", str(path)],
                         capture_output=True, text=True, check=True)
    return out.stdout.strip()


def _ffmeta(text: str) -> str:
    return "".join("\\" + ch if ch in "=;#\\\n" else ch for ch in text)


def add_chapters(mp4: Path, spans: list[dict]) -> None:
    """Mark the sections as chapters of the video (VLC, QuickTime, mpv and most players list them)."""
    meta = fb.BUILD / "pitch-chapters.txt"
    L = [";FFMETADATA1", f"title={_ffmeta(PITCH.title)}", "artist=Team PhASE"]
    for s in spans:
        label = _ffmeta(f"{s['n']}. {s['title']}")
        L += ["[CHAPTER]", "TIMEBASE=1/1000", f"START={round(s['start'] * 1000)}", f"END={round(s['end'] * 1000)}", f"title={label}"]
    meta.write_text("\n".join(L) + "\n", encoding="utf-8")
    tmp = mp4.with_name(mp4.stem + ".chapters.mp4")
    fb.run(["ffmpeg", "-v", "error", "-y", "-i", str(mp4), "-f", "ffmetadata", "-i", str(meta), "-map", "0:v", "-map", "0:a",
            "-map_metadata", "1", "-map_chapters", "1", "-c", "copy", "-movflags", "+faststart", str(tmp)])
    tmp.replace(mp4)


def split_sections(full: Path, spans: list[dict], cs: list[tuple[float, float, str]]) -> None:
    """Cut the full video into one clip per section, each with its own subtitles (embedded and as .srt)."""
    OUT_SECTIONS.mkdir(parents=True, exist_ok=True)
    num, den = probe(full, "stream=r_frame_rate", "v:0").split("/")
    fps = int(num) / int(den)
    keep = {f"{s['file']}{ext}" for s in spans for ext in (".mp4", ".srt")}
    for old in OUT_SECTIONS.iterdir():
        if old.name not in keep:
            old.unlink()
    for s in spans:
        a, b = s["start"], s["end"]
        sub = [(max(a, x) - a, min(b, y) - a, t) for x, y, t in cs if y > a and x < b]
        srt = OUT_SECTIONS / f"{s['file']}.srt"
        fb.write_srt(srt, sub)
        # Cut on exact frame numbers (input seeking can let a boundary frame into both sections).
        f0, f1 = round(a * fps), round(b * fps)
        last = s["n"] == len(spans)
        vf = f"[0:v]trim=start_frame={f0}" + ("" if last else f":end_frame={f1}") + ",setpts=PTS-STARTPTS[v]"
        af = f"[0:a]atrim=start={a:.4f}" + ("" if last else f":end={b:.4f}") + ",asetpts=PTS-STARTPTS[a]"
        title = f"Below Threshold pitch, section {s['n']} of {len(spans)}: {s['title']}"
        fb.run(["ffmpeg", "-v", "error", "-y", "-i", str(full), "-i", str(srt), "-filter_complex", f"{vf};{af}",
                "-map", "[v]", "-map", "[a]", "-map", "1:s", "-map_chapters", "-1", "-metadata", f"title={title}", "-metadata", "artist=Team PhASE",
                "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-c:a", "aac", "-b:a", "160k",
                "-c:s", "mov_text", "-metadata:s:s:0", "language=eng", "-movflags", "+faststart", str(OUT_SECTIONS / f"{s['file']}.mp4")])
        print(f"  section {s['n']} {s['title']:<42} {fmt_mmss(a)}-{fmt_mmss(b)}  ({b - a:4.1f} s)")


def fmt_mmss(t: float) -> str:
    t = round(t, 3)  # beat times carry float noise (115.99999... is 01:56)
    return f"{int(t // 60):02d}:{int(t % 60):02d}"


def gh_anchor(heading: str) -> str:
    """The anchor GitHub gives a Markdown heading."""
    return "".join(ch for ch in heading.lower() if ch.isalnum() or ch in " -_").replace(" ", "-")


def section_heading(i: int) -> str:
    return f"Section {i + 1} · {SECTIONS[i].title}"


# Which sections serve each judging component (docs/PLAN.md, "Likely evaluation components").
JUDGING = [
    ("Topic difficulty and timeliness", [1], "Hook: Shor's algorithm vs today's encryption; noise is why it has not happened"),
    ("Teaching and intuitiveness", [2, 3], "Part I chapter on an exact simulator; guided first game level with live coaching"),
    ("Technical depth", [2, 3, 4], "Gate-level QFT, Shor end to end, blossom matching, live Monte Carlo"),
    ("Correctness and rigor", [4], "Rigor beat: PyMatching (100% of 90,000), Stim layout, thresholds vs published, {tests} automated tests"),
    ("Interactivity and design", [2, 3, 4], "Seven real screen recordings of the live app"),
    ("Originality", [3], "Real-time mode: measured decoder speed, backlog, stalled computation"),
    ("Honesty", [4], "\"We even list exactly what we simplify\""),
    ("Presentation and completeness", [1, 2, 3, 4], "One story in three minutes; live URL and QR code on the end card"),
]


def write_sheet(timing: dict | None, total: float | None = None) -> None:
    by_key = {b["key"]: b for b in (timing["beats"] if timing else [])}
    beat = {b.key: b for b in PITCH.beats}
    total_w = sum(words(b.text) for b in PITCH.beats)
    dur = total or (timing["duration"] if timing else None)
    spans = section_spans(timing, dur) if timing and dur else None
    tests = json.loads(DATA.read_text(encoding="utf-8"))["rigor"]["tests"]["total"] if DATA.exists() else "about 190"
    # Time budget for the takes: the video adds a fixed lead-in and tail to every line plus the
    # silent logo and end card, so the takes must leave room for that; split the slack four ways.
    speech = {b["key"]: b["speech"] for b in timing["beats"]} if timing else {}
    overhead = dur - sum(speech.values()) if timing and dur else None
    share = (LIMIT_SECONDS - dur) / len(SECTIONS) if dur else None
    budget = lambda sec: sum(speech.get(k, 0.0) for k in sec.beats) + share  # noqa: E731
    link = lambda i: f"[{i}](#{gh_anchor(section_heading(i - 1))})"  # noqa: E731
    L = [
        "# Pitch video: script and recording sheet",
        "",
        "The 3-minute video for the hackathon demo, `docs/media/below-threshold-pitch.mp4` (1080p, with subtitles),",
        "also on the site's Film page. Generated by `media/pitch_build.py` from `media/voiceover/pitch_script.py`",
        "(edit the lines there, not here).",
        "",
        f"**{total_w} spoken words**, about {total_w / 2.6 / 60:.1f} min of narration at a relaxed pace;"
        + (f" video length **{int(dur // 60)}:{dur % 60:04.1f}** at the current timings" if dur else "")
        + f" (limit {int(LIMIT_SECONDS // 60)}:00).",
        "",
        "## The four sections: who looks where",
        "",
        "The video is split into four sections, one per team member. Each section has its own clip in",
        "`docs/media/pitch-sections/` (1080p, subtitles built in, and as an `.srt` next to it), and the full video",
        "carries the same four sections as chapters. Take a section: watch its clip, check what is on screen against",
        "the live app, and record its lines. Write your name in the last column.",
        "",
        "| # | Section | In the full video | Lines to record | Words | Takes, at most | Clip | Who |",
        "|---|---|---|---|---|---|---|---|",
    ]
    for i, s in enumerate(SECTIONS):
        sp = spans[i] if spans else None
        rng = f"{fmt_mmss(sp['start'])}–{fmt_mmss(sp['end'])} ({sp['end'] - sp['start']:.0f} s)" if sp else "--"
        lines = ", ".join(f"`{k}`" for k in s.beats if beat[k].text)
        w = sum(words(beat[k].text) for k in s.beats)
        clip = f"pitch-{i + 1}-{s.slug}.mp4"
        cap = f"{budget(s):.0f} s" if overhead is not None else "--"
        L.append(f"| {i + 1} | [{s.title}](#{gh_anchor(section_heading(i))}) | {rng} | {lines} | {w} | {cap} | [{clip}](media/pitch-sections/{clip}) | |")
    L += [
        "",
        "## What it covers (hackathon judging)",
        "",
        "| Judging component | Sections | Where in the video |",
        "|---|---|---|",
        *(f"| {name} | {', '.join(link(i) for i in secs)} | {where.format(tests=tests)} |" for name, secs, where in JUDGING),
        "",
        "## How to record",
        "",
        "Record one file per line into `media/voiceover/recordings/pitch/` (WAV, 48 kHz mono; `.m4a`/`.mp3` also work),",
        "named as below; each section's lines can come from a different voice. Then run",
        "`.venv/Scripts/python media/pitch_build.py --final`: the animation re-times itself to the takes, the app footage",
        "is refitted to each beat, and the sections are re-cut.",
        "",
    ]
    if overhead is not None:
        total_cap = LIMIT_SECONDS - overhead
        L += [
            f"**Timing.** The video runs about {overhead:.0f} s longer than the takes (a breath around every line, plus the",
            f"silent logo and end card), so all takes together must stay under **{int(total_cap // 60)}:{int(total_cap % 60):02d}** for the video to stay under",
            f"{int(LIMIT_SECONDS // 60)}:00; the build stops if it does not. Each section's share is the *Takes, at most* column above (the",
            "current estimate for its lines plus an even split of the spare time). Silence at the start or end of a take",
            "counts, so trim it.",
            "",
        ]
    L += ["Lines marked **verify** quote a published number: check CITATIONS.md first.", ""]
    for i, s in enumerate(SECTIONS):
        sp = spans[i] if spans else None
        clip = f"pitch-{i + 1}-{s.slug}"
        w = sum(words(beat[k].text) for k in s.beats)
        L += [
            f"## {section_heading(i)}",
            "",
            (f"`{fmt_mmss(sp['start'])}–{fmt_mmss(sp['end'])}` in the full video ({sp['end'] - sp['start']:.0f} s) · " if sp else "")
            + f"clip: [`{clip}.mp4`](media/pitch-sections/{clip}.mp4) · subtitles: [`{clip}.srt`](media/pitch-sections/{clip}.srt) · {w} words  ",
            s.summary,
            "",
        ]
        for k in s.beats:
            b, bt = beat[k], by_key.get(k)
            when = (f"{fmt_mmss(bt['speechStart'])} · clip {fmt_mmss(bt['speechStart'] - sp['start'])}" if bt and sp else "--:--")
            if not b.text:
                L += [f"- `{when}` *(silent: {b.visual})*", ""]
                continue
            w = words(b.text)
            L += [
                f"### `pitch/{b.key}` · {when} · {w} words · ~{w / 2.6:.0f} s",
                "",
                f"> {b.text}",
                "",
                f"File: `media/voiceover/recordings/pitch/{b.key}.wav`  ",
                f"On screen: {b.visual}" + (f"  \n**verify:** {b.verify}" if b.verify else ""),
                "",
            ]
    L += ["## Full script (for reading straight through)", ""]
    for i, s in enumerate(SECTIONS):
        L += [f"**{i + 1}. {s.title}**", ""]
        L += [beat[k].text + "\n" for k in s.beats if beat[k].text]
    (ROOT / "docs" / "pitch-video-script.md").write_text("\n".join(L), encoding="utf-8")


def update_manifest(final_len: float, spans: list[dict], narrated: bool | None = None) -> None:
    """Advertise the pitch, and its sections, on the Film page."""
    man_p = OUT_PUB / "manifest.json"
    man = json.loads(man_p.read_text(encoding="utf-8")) if man_p.exists() else {"scenes": [], "film": None}
    old = man.get("pitch") or {}
    man["pitch"] = {
        "mp4": "media/pitch.mp4",
        "poster": "media/pitch.jpg",
        "captions": "media/pitch.vtt",
        "durationSec": round(final_len, 2),
        "narrated": bool(old.get("narrated")) if narrated is None else narrated,
        "sections": [{"n": s["n"], "title": s["title"], "startSec": round(s["start"], 2)} for s in spans],
    }
    man_p.write_text(json.dumps(man, indent=2), encoding="utf-8")


def sectionize(full: Path, timing: dict, narrated: bool | None = None) -> float:
    """Chapters, the per-section clips, the manifest and the sheet, all from the finished full video."""
    final_len = fb.ffprobe_duration(full)
    spans = section_spans(timing, final_len)
    for mp4 in (full, OUT_PUB / "pitch.mp4"):
        if mp4.exists():
            add_chapters(mp4, spans)
    print("cutting sections:")
    split_sections(full, spans, fb.cues(timing))
    update_manifest(final_len, spans, narrated)
    write_sheet(timing, final_len)
    return final_len


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--final", action="store_true")
    ap.add_argument("--record", action="store_true", help="re-record the app clips first")
    ap.add_argument("--no-render", action="store_true")
    ap.add_argument("--sheet", action="store_true", help="only regenerate the recording sheet")
    ap.add_argument("--split", action="store_true", help="only re-cut the sections and chapters from the last build")
    args = ap.parse_args()
    tpath = fb.TIMINGS / "pitch.json"
    full = OUT_DOCS / "below-threshold-pitch.mp4"
    if args.sheet:
        write_sheet(json.loads(tpath.read_text(encoding="utf-8")) if tpath.exists() else None, fb.ffprobe_duration(full) if full.exists() else None)
        print("wrote docs/pitch-video-script.md")
        return 0
    if args.split:
        sectionize(full, json.loads(tpath.read_text(encoding="utf-8")))
        return 0
    shell = os.name == "nt"
    if args.record or not all((CLIPS / f"{c}.mp4").exists() for c in ("learn", "qft", "shor", "noise", "game", "realtime", "lab")):
        fb.run(["npm", "run", "build"], cwd=ROOT, shell=shell)
        fb.run(["npx", "tsx", "scripts/record-pitch.ts"], cwd=ROOT, shell=shell)
    if not args.no_render:
        ts = ROOT / "scripts" / "film" / "pitch.ts"
        if ts.exists():
            fb.run(["npx", "tsx", str(ts.relative_to(ROOT))], cwd=ROOT, shell=shell)
        fb.render_scene("pitch", "pitch.py", "PitchScene", args.final)
        print("rendered pitch")
    scene_mp4 = fb.scene_video("pitch", "pitch.py", "PitchScene", args.final)
    timing = json.loads(tpath.read_text(encoding="utf-8"))
    dur = fb.ffprobe_duration(scene_mp4)
    audio = fb.BUILD / "pitch-narration.wav"
    has_audio = fb.narration_track("pitch", timing, dur, audio)
    OUT_DOCS.mkdir(parents=True, exist_ok=True)
    OUT_PUB.mkdir(parents=True, exist_ok=True)
    print("compositing app footage:")
    composite(scene_mp4, timing, audio if has_audio else None, full)
    fb.run(["ffmpeg", "-v", "error", "-y", "-i", str(full), "-vf", "scale=1280:720:flags=lanczos", "-c:v", "libx264", "-preset", "slow", "-crf", "24",
            "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", str(OUT_PUB / "pitch.mp4")])
    poster_beat = next((b for b in timing["beats"] if b["key"] == "product"), timing["beats"][0])
    fb.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{poster_beat['end'] - 0.8:.2f}", "-i", str(full), "-frames:v", "1", "-vf", "scale=1280:720", "-q:v", "3", str(OUT_PUB / "pitch.jpg")])
    cs = fb.cues(timing)
    fb.write_vtt(OUT_PUB / "pitch.vtt", cs)
    fb.write_vtt(OUT_DOCS / "below-threshold-pitch.vtt", cs)
    fb.write_srt(OUT_DOCS / "below-threshold-pitch.srt", cs)
    final_len = sectionize(full, timing, has_audio)
    over = [b for b in timing["beats"] if b["overrun"] > 0.3]
    for b in over:
        print(f"note: pitch/{b['key']} visuals overrun the line by {b['overrun']:.1f} s")
    print(f"pitch: {int(final_len // 60)}:{final_len % 60:04.1f} -> {full.relative_to(ROOT)} ({full.stat().st_size / 1e6:.1f} MB), narrated={has_audio}")
    if final_len > LIMIT_SECONDS:
        print(f"ERROR: the pitch runs {final_len:.1f} s, over the {LIMIT_SECONDS:.0f} s limit. Tighten the reading or trim a line.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
