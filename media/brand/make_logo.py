"""Team PhASE logo generator.

The wordmark is set in Latin Modern (the OpenType Computer Modern, GUST Font License),
the same typeface LaTeX uses for the film's math, converted to SVG outlines so the logo
needs no font at runtime. The mark is a phase diagram: a unit circle, the real axis, a
state vector at angle phi and the swept phase angle, in the app's teal-to-violet accent.

Usage:  .venv/Scripts/python media/brand/make_logo.py
Writes: public/brand/team-phase-{dark,light,mark}.svg and media/brand/team-phase-*.svg
"""

from __future__ import annotations

import math
import os
import shutil

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
LM = os.environ.get("LM_FONTS", r"C:\Users\acgnm\AppData\Local\Programs\MiKTeX\fonts\opentype\public\lm")

TEAL = "#3DD6C6"
VIOLET = "#A68BFF"
INK_DARK = "#E8ECF6"  # text on dark backgrounds
INK_LIGHT = "#141828"  # text on light backgrounds


def text_path(font_file: str, text: str, size: float, x: float, y: float, tracking: float = 0.0, kern: dict | None = None) -> tuple[str, float]:
    """SVG path data for `text` with its baseline at (x, y); returns (d, advance)."""
    font = TTFont(font_file)
    gs = font.getGlyphSet()
    cmap = font.getBestCmap()
    upm = font["head"].unitsPerEm
    scale = size / upm
    hmtx = font["hmtx"]
    parts: list[str] = []
    pen_x = x
    prev = None
    for ch in text:
        gname = cmap[ord(ch)]
        if prev and kern and (prev + ch) in kern:
            pen_x += kern[prev + ch] * size
        pen = SVGPathPen(gs)
        # Font units are y-up; SVG is y-down.
        tp = TransformPen(pen, (scale, 0, 0, -scale, pen_x, y))
        gs[gname].draw(tp)
        d = pen.getCommands()
        if d:
            parts.append(d)
        pen_x += hmtx[gname][0] * scale + tracking * size
        prev = ch
    return " ".join(parts), pen_x - x - tracking * size


def mark(cx: float, cy: float, r: float, ink: str, uid: str) -> str:
    """The phase mark: unit circle, real axis, vector at phi, swept angle."""
    phi = math.radians(54)
    tip = (cx + r * math.cos(phi), cy - r * math.sin(phi))
    a = (cx + r, cy)
    sweep = f"M {cx:.2f} {cy:.2f} L {a[0]:.2f} {a[1]:.2f} A {r:.2f} {r:.2f} 0 0 0 {tip[0]:.2f} {tip[1]:.2f} Z"
    ra = r * 0.42
    arc = (
        f"M {cx + ra:.2f} {cy:.2f} A {ra:.2f} {ra:.2f} 0 0 0 "
        f"{cx + ra * math.cos(phi):.2f} {cy - ra * math.sin(phi):.2f}"
    )
    return f"""
  <defs>
    <linearGradient id="g{uid}" x1="0" y1="1" x2="1" y2="0">
      <stop offset="0" stop-color="{TEAL}"/>
      <stop offset="1" stop-color="{VIOLET}"/>
    </linearGradient>
  </defs>
  <path d="{sweep}" fill="url(#g{uid})" fill-opacity="0.28"/>
  <circle cx="{cx:.2f}" cy="{cy:.2f}" r="{r:.2f}" fill="none" stroke="url(#g{uid})" stroke-width="{r * 0.075:.2f}"/>
  <line x1="{cx - r * 1.18:.2f}" y1="{cy:.2f}" x2="{cx + r * 1.18:.2f}" y2="{cy:.2f}" stroke="{ink}" stroke-opacity="0.35" stroke-width="{r * 0.035:.2f}" stroke-linecap="round"/>
  <path d="{arc}" fill="none" stroke="{ink}" stroke-opacity="0.75" stroke-width="{r * 0.04:.2f}"/>
  <line x1="{cx:.2f}" y1="{cy:.2f}" x2="{tip[0]:.2f}" y2="{tip[1]:.2f}" stroke="{ink}" stroke-width="{r * 0.085:.2f}" stroke-linecap="round"/>
  <circle cx="{tip[0]:.2f}" cy="{tip[1]:.2f}" r="{r * 0.12:.2f}" fill="{VIOLET}"/>
  <circle cx="{cx:.2f}" cy="{cy:.2f}" r="{r * 0.07:.2f}" fill="{ink}"/>"""


def lockup(ink: str, uid: str) -> str:
    bold = os.path.join(LM, "lmroman10-bold.otf")
    caps = os.path.join(LM, "lmromancaps10-regular.otf")
    r = 46
    cx, cy = 56, 60
    x0 = 128
    # "PhASE": a little negative tracking reads tighter at display size; pull A under h.
    word, w_word = text_path(bold, "PhASE", 64, x0, 86, tracking=-0.005, kern={"hA": -0.02})
    team, w_team = text_path(caps, "TEAM", 19, x0 + 3, 36, tracking=0.28)
    width = x0 + max(w_word, w_team) + 14
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width:.0f} 120" width="{width:.0f}" height="120" role="img" aria-label="Team PhASE">
  <title>Team PhASE</title>{mark(cx, cy, r, ink, uid)}
  <path d="{team}" fill="{ink}" fill-opacity="0.85"/>
  <path d="{word}" fill="{ink}"/>
</svg>
"""


def wordmark_only(ink: str) -> str:
    """Text outlines alone (no gradient), for the film's animated logo."""
    bold = os.path.join(LM, "lmroman10-bold.otf")
    caps = os.path.join(LM, "lmromancaps10-regular.otf")
    word, w_word = text_path(bold, "PhASE", 64, 0, 86, tracking=-0.005, kern={"hA": -0.02})
    team, w_team = text_path(caps, "TEAM", 19, 3, 36, tracking=0.28)
    width = max(w_word, w_team) + 4
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 18 {width:.0f} 72" width="{width:.0f}" height="72">
  <path d="{team}" fill="{ink}"/>
  <path d="{word}" fill="{ink}"/>
</svg>
"""


def mark_only(ink: str, uid: str) -> str:
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120" role="img" aria-label="Team PhASE mark">
  <title>Team PhASE</title>{mark(60, 60, 46, ink, uid)}
</svg>
"""


def main() -> None:
    out_pub = os.path.join(ROOT, "public", "brand")
    os.makedirs(out_pub, exist_ok=True)
    files = {
        "team-phase-dark.svg": lockup(INK_DARK, "d"),
        "team-phase-light.svg": lockup(INK_LIGHT, "l"),
        "team-phase-mark.svg": mark_only(INK_DARK, "m"),
    }
    for name, svg in [("team-phase-wordmark-dark.svg", wordmark_only(INK_DARK)), ("team-phase-wordmark-light.svg", wordmark_only(INK_LIGHT))]:
        with open(os.path.join(HERE, name), "w", encoding="utf8") as f:
            f.write(svg)
        print("wrote", name)
    for name, svg in files.items():
        for folder in (out_pub, HERE):
            with open(os.path.join(folder, name), "w", encoding="utf8") as f:
                f.write(svg)
        print("wrote", name)
    # Keep a copy of the font license note next to the generated outlines.
    note = os.path.join(HERE, "FONT-LICENSE.md")
    with open(note, "w", encoding="utf8") as f:
        f.write(
            "The Team PhASE wordmark outlines are derived from Latin Modern Roman (lmroman10-bold, lmromancaps10-regular),\n"
            "copyright the GUST e-foundry, distributed under the GUST Font License (an instance of the LaTeX Project Public\n"
            "License), which permits use, modification and redistribution: https://www.gust.org.pl/projects/e-foundry/licenses\n"
        )
    _ = shutil


if __name__ == "__main__":
    main()
