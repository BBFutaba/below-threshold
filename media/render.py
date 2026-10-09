"""Render every explainer scene and publish the web/README assets.

Run from the project root, after `npx tsx scripts/manim-data.ts`:

    .venv/Scripts/python media/render.py              # all scenes
    .venv/Scripts/python media/render.py decoder      # one scene (still rewrites the manifest)
    .venv/Scripts/python media/render.py --no-render  # only re-encode from media/build

Outputs: public/media/<id>.mp4 / .webm / .jpg, docs/media/<id>.gif (decoder, threshold),
public/media/manifest.json. Manim's own files go to media/build/ (gitignored).
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PY = sys.executable

SCENES = [
    {
        "id": "bridge",
        "file": "bridge.py",
        "cls": "BridgeScene",
        "title": "From a row to a grid",
        "caption": "The 3-qubit repetition code catches only bit flips; grown into a distance-3 surface code, teal and violet checks catch bit and phase flips on a 2D grid.",
        "poster": 13.6,
        "gif": False,
    },
    {
        "id": "decoder",
        "file": "decoder.py",
        "cls": "DecoderScene",
        "title": "How a decoder thinks",
        "caption": "A real d = 5 bit-flip instance: checks fire, exact matching (MWPM) pairs them, the corrections and the hidden errors close a harmless loop; a second seed shows a logical error.",
        "poster": 19.5,
        "gif": True,
    },
    {
        "id": "discretization",
        "file": "discretization.py",
        "cls": "DiscretizationScene",
        "title": "Why errors are digital",
        "caption": "A small Rx(0.9) drift measured 200 times by the parity checks gives exactly two outcomes, no error or a full flip, at the cos²(θ/2) and sin²(θ/2) rates.",
        "poster": 20.5,
        "gif": False,
    },
    {
        "id": "threshold",
        "file": "threshold.py",
        "cls": "ThresholdScene",
        "title": "The threshold",
        "caption": "Logical error rate against physical error rate for d = 5, 7, 9 from real Monte Carlo runs: below the crossing bigger codes make things better, above it worse.",
        "poster": 9.5,
        "gif": True,
    },
    {
        "id": "backlog",
        "file": "backlog.py",
        "cls": "BacklogScene",
        "title": "The real-time bottleneck",
        "caption": "Rounds arrive every 1 µs; with measured decode times both the MWPM and the union-find queues grow, and only the 1 µs-per-round requirement keeps the queue flat.",
        "poster": 16.0,
        "gif": False,
    },
]


def run(cmd: list[str]) -> None:
    print("  $", " ".join(str(c) for c in cmd), flush=True)
    subprocess.run([str(c) for c in cmd], cwd=ROOT, check=True)


def duration(path: Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        capture_output=True, text=True, check=True,
    )
    return float(out.stdout.strip())


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    render = "--no-render" not in sys.argv
    pub = ROOT / "public" / "media"
    docs = ROOT / "docs" / "media"
    pub.mkdir(parents=True, exist_ok=True)
    docs.mkdir(parents=True, exist_ok=True)

    for sc in SCENES:
        if args and sc["id"] not in args:
            continue
        print(f"[{sc['id']}]", flush=True)
        src = ROOT / "media" / "build" / "videos" / sc["file"][:-3] / "720p30" / f"{sc['cls']}.mp4"
        if render:
            run([PY, "-m", "manim", "render", "-r", "1280,720", "--fps", "30", "--media_dir", "media/build",
                 "--disable_caching", "--progress_bar", "none", f"media/scenes/{sc['file']}", sc["cls"]])
        mp4 = pub / f"{sc['id']}.mp4"
        webm = pub / f"{sc['id']}.webm"
        jpg = pub / f"{sc['id']}.jpg"
        run(["ffmpeg", "-v", "error", "-y", "-i", src, "-an", "-c:v", "libx264", "-preset", "slow", "-tune", "animation",
             "-crf", "28", "-pix_fmt", "yuv420p", "-movflags", "+faststart", mp4])
        run(["ffmpeg", "-v", "error", "-y", "-i", src, "-an", "-c:v", "libvpx-vp9", "-crf", "38", "-b:v", "0",
             "-row-mt", "1", "-deadline", "good", "-cpu-used", "2", "-pix_fmt", "yuv420p", webm])
        run(["ffmpeg", "-v", "error", "-y", "-ss", str(sc["poster"]), "-i", src, "-frames:v", "1", "-q:v", "3", jpg])
        if sc["gif"]:
            gif = docs / f"{sc['id']}.gif"
            vf = ("fps=12,scale=640:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];"
                  "[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle")
            run(["ffmpeg", "-v", "error", "-y", "-i", src, "-vf", vf, "-loop", "0", gif])

    manifest = []
    for sc in SCENES:
        mp4 = pub / f"{sc['id']}.mp4"
        if not mp4.exists():
            continue
        manifest.append({
            "id": sc["id"],
            "title": sc["title"],
            "caption": sc["caption"],
            "mp4": f"media/{sc['id']}.mp4",
            "webm": f"media/{sc['id']}.webm",
            "poster": f"media/{sc['id']}.jpg",
            "durationSec": round(duration(mp4), 1),
        })
    (pub / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print("wrote public/media/manifest.json")
    for f in sorted(list(pub.glob("*")) + list(docs.glob("*.gif"))):
        print(f"  {f.relative_to(ROOT)}  {f.stat().st_size / 1e6:.2f} MB")


if __name__ == "__main__":
    main()
