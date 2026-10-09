"""Shared look for the Below Threshold explainer videos.

Colors, type and the lattice drawing match the app (src/ui/theme/tokens.css).
Every lattice, syndrome and correction is read from media/data/*.json, which
scripts/manim-data.ts exports from the project's own simulation code.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from manim import (
    DOWN,
    LEFT,
    ORIGIN,
    PI,
    RIGHT,
    UP,
    AnimationGroup,
    Circle,
    DashedVMobject,
    Dot,
    FadeIn,
    FadeOut,
    Rectangle,
    RoundedRectangle,
    Sector,
    Text,
    VGroup,
    VMobject,
    smooth,
)

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "media" / "data"


def load(name: str) -> dict:
    return json.loads((DATA / f"{name}.json").read_text(encoding="utf-8"))


# ------------------------------------------------------------------ palette
BG = "#0E1220"
BG2 = "#0B0F1B"
SURFACE = "#151A2C"
SURFACE2 = "#1B2136"
SURFACE3 = "#232A43"
BORDER = "#262D45"
BORDER_STRONG = "#353D5C"
TEXT = "#E8ECF6"
MUTED = "#9AA3BF"
FAINT = "#6C7594"
TEAL = "#3DD6C6"  # Z-check: detects bit flips
VIOLET = "#A68BFF"  # X-check: detects phase flips
CORAL = "#FF6F61"  # hidden error, logical error
BLUE = "#4EA8FF"  # corrections
GREEN = "#5BD68A"  # success
AMBER = "#FFB547"  # warnings, backlog
QSTROKE = "#F4F6FB"

TILE_FILL = 0.18
TILE_FIRE = 0.85

FONT_DISPLAY = "Segoe UI Variable Display"
FONT_TEXT = "Segoe UI Variable Text"

# Text is rendered at 2x and scaled down: Pango kerning is cleaner at larger sizes.
_OVERSAMPLE = 2.0


def T(s: str, size: float = 28, color: str = TEXT, weight: str = "NORMAL", font: str = FONT_TEXT, **kw) -> Text:
    t = Text(s, font=font, font_size=size * _OVERSAMPLE, color=color, weight=weight, **kw)
    t.scale(1 / _OVERSAMPLE)
    return t


def H(s: str, size: float = 34, color: str = TEXT, weight: str = "SEMIBOLD", **kw) -> Text:
    return T(s, size=size, color=color, weight=weight, font=FONT_DISPLAY, **kw)


def pill(mob, pad_x=0.32, pad_y=0.16, fill=SURFACE, stroke=BORDER, radius=None, opacity=0.94, stroke_width=1.5):
    w = mob.width + 2 * pad_x
    h = mob.height + 2 * pad_y
    r = radius if radius is not None else min(h / 2, 0.24)
    box = RoundedRectangle(width=w, height=h, corner_radius=r)
    box.set_fill(fill, opacity=opacity).set_stroke(stroke, width=stroke_width)
    box.move_to(mob.get_center())
    return VGroup(box, mob)


def setup(scene):
    scene.camera.background_color = BG


class Captions:
    """Bottom-center caption pill with calm cross-fades."""

    def __init__(self, scene, y: float = -3.3, size: float = 31):
        self.scene = scene
        self.y = y
        self.size = size
        self.current = None

    def make(self, s: str, color: str = TEXT):
        t = H(s, size=self.size, color=color, weight="MEDIUM")
        p = pill(t, pad_x=0.38, pad_y=0.17)
        p.move_to([0, self.y, 0])
        return p

    def swap(self, s: str, color: str = TEXT):
        """Animations that replace the caption, to play alongside other motion."""
        new = self.make(s, color)
        anims = [FadeIn(new, shift=0.12 * UP)]
        if self.current is not None:
            anims.append(FadeOut(self.current, shift=0.12 * UP))
        self.current = new
        return anims

    def show(self, s: str, color: str = TEXT, run_time: float = 0.6):
        new = self.make(s, color)
        anims = [FadeIn(new, shift=0.12 * UP)]
        if self.current is not None:
            anims.append(FadeOut(self.current, shift=0.12 * UP))
        self.scene.play(*anims, run_time=run_time)
        self.current = new
        return new

    def hide(self, run_time: float = 0.5):
        if self.current is not None:
            self.scene.play(FadeOut(self.current), run_time=run_time)
            self.current = None


def eyebrow(s: str, x: float = -6.55, y: float = 3.55):
    t = T(s, size=22, color=MUTED, weight="SEMIBOLD")
    t.move_to([x, y, 0], aligned_edge=LEFT)
    return t


def footnote(s: str, x: float = 6.55, y: float = -3.85, size: float = 20):
    t = T(s, size=size, color=FAINT)
    t.move_to([x, y, 0], aligned_edge=RIGHT)
    return t


# ------------------------------------------------------------------ lattice


class Lattice(VGroup):
    """Rotated surface code drawn Willow-style.

    Data qubits sit at the vertices; each check is a tile on the corner between
    them. Weight-2 boundary checks are half-disks outside the grid edge.
    `lay` is the layout exported by scripts/manim-data.ts (from makeRotatedSurfaceCode).
    """

    def __init__(self, lay: dict, s: float = 1.0, center=ORIGIN, inset: float = 0.035, q_radius: float = 0.16, **kw):
        super().__init__(**kw)
        self.lay = lay
        self.d = lay["d"]
        self.s = s
        self.center_pt = np.array(center, dtype=float)
        self.stabs = lay["stabilizers"]
        off = (self.d - 1) / 2
        self.off = off

        self.tiles = VGroup()
        self.dots = VGroup()
        self.anchor = []  # path anchor per stabilizer
        for st in self.stabs:
            color = TEAL if st["type"] == "Z" else VIOLET
            r, c = st["pos"]["r"], st["pos"]["c"]
            corner = self.rc(r - 0.5, c - 0.5)
            if st["weight"] == 4:
                tile = RoundedRectangle(width=s - 2 * inset * s, height=s - 2 * inset * s, corner_radius=0.07 * s)
                tile.move_to(corner)
                dot_at = corner
            else:
                q0, q1 = st["support"]
                mid = (self.qpos(q0) + self.qpos(q1)) / 2
                start = {"top": 0, "bottom": PI, "left": PI / 2, "right": -PI / 2}[st["edge"]]
                out = {"top": UP, "bottom": DOWN, "left": LEFT, "right": RIGHT}[st["edge"]]
                R = s / 2 - inset * s
                tile = Sector(radius=R, angle=PI, start_angle=start, arc_center=mid + out * inset * s * 0.6)
                dot_at = mid + out * (4 * R / (3 * PI) + inset * s * 0.6)
            tile.set_fill(color, opacity=TILE_FILL).set_stroke(color, width=1.6, opacity=0.55)
            self.tiles.add(tile)
            dot = Dot(dot_at, radius=0.075 * s, color=BG).set_fill(BG, opacity=1).set_stroke(BG, width=0)
            dot.set_opacity(0)
            self.dots.add(dot)
            self.anchor.append(np.array(dot_at))

        self.qubits = VGroup()
        for i in range(lay["n"]):
            c = Circle(radius=q_radius * s).move_to(self.qpos(i))
            c.set_fill(BG, opacity=1).set_stroke(QSTROKE, width=2.6 * s ** 0.5)
            self.qubits.add(c)

        # Layering is by z_index so overlays added later (paths, rings) sort correctly.
        self.tiles.set_z_index(0)
        self.dots.set_z_index(1)
        self.qubits.set_z_index(3)
        self.add(self.tiles, self.dots, self.qubits)
        self.fired = set()

    # geometry --------------------------------------------------------
    def rc(self, r: float, c: float):
        return self.center_pt + np.array([(c - self.off) * self.s, -(r - self.off) * self.s, 0.0])

    def qpos(self, q: int):
        dq = self.lay["dataQubits"][q]
        return self.rc(dq["r"], dq["c"])

    def bounds_rect(self, pad=0.62):
        tl = self.rc(-pad, -pad)
        br = self.rc(self.d - 1 + pad, self.d - 1 + pad)
        return tl, br

    # checks ------------------------------------------------------------
    def fire(self, idxs, on=True):
        anims = []
        for i in idxs:
            tile, dot = self.tiles[i], self.dots[i]
            if on:
                self.fired.add(i)
                anims.append(tile.animate.set_fill(opacity=TILE_FIRE).set_stroke(opacity=1.0))
                anims.append(dot.animate.set_opacity(1))
            else:
                self.fired.discard(i)
                anims.append(tile.animate.set_fill(opacity=TILE_FILL).set_stroke(opacity=0.55))
                anims.append(dot.animate.set_opacity(0))
        return anims

    def set_fired_now(self, idxs, on=True):
        for i in idxs:
            if on:
                self.tiles[i].set_fill(opacity=TILE_FIRE).set_stroke(opacity=1.0)
                self.dots[i].set_opacity(1)
            else:
                self.tiles[i].set_fill(opacity=TILE_FILL).set_stroke(opacity=0.55)
                self.dots[i].set_opacity(0)

    # qubit marks ---------------------------------------------------------
    def error_mark(self, q: int, pauli: str = "X", on_blue: bool = False):
        ring = Circle(radius=0.31 * self.s).move_to(self.qpos(q))
        ring.set_stroke(CORAL, width=3.6).set_fill(opacity=0)
        letter = T(pauli, size=24 * self.s, color=BG if on_blue else CORAL, weight="BOLD", font=FONT_DISPLAY)
        letter.move_to(self.qpos(q))
        return VGroup(ring, letter).set_z_index(4)

    def correct_anim(self, q: int):
        return self.qubits[q].animate.set_fill(BLUE, opacity=1)

    # decoder paths -------------------------------------------------------
    def path_points(self, m: dict):
        """Polyline for one matched pair: check -> qubit -> check ... (or to the boundary)."""
        pts = []
        nodes, qs = m["nodes"], m["qubits"]
        for k, node in enumerate(nodes):
            if node >= 0:
                pts.append(self.anchor[node])
            else:
                # Virtual boundary: the point across the last qubit from the previous check.
                prev = nodes[k - 1]
                st = self.stabs[prev]
                corner = self.rc(st["pos"]["r"] - 0.5, st["pos"]["c"] - 0.5)
                qp = self.qpos(qs[k - 1])
                pts.append(2 * qp - corner)
            if k < len(qs):
                pts.append(self.qpos(qs[k]))
        return pts

    def dashed_path(self, m: dict, color=BLUE, width=5.0):
        pts = self.path_points(m)
        base = VMobject().set_points_as_corners([np.array(p) for p in pts])
        length = sum(np.linalg.norm(np.array(pts[i + 1]) - np.array(pts[i])) for i in range(len(pts) - 1))
        dashed = DashedVMobject(base, num_dashes=max(4, int(length / (0.16 * self.s))), dashed_ratio=0.58)
        dashed.set_stroke(color, width=width)
        group = VGroup(dashed)
        if m.get("toBoundary"):
            end = pts[-1]
            prev = pts[-2]
            v = (np.array(end) - np.array(prev))
            v = v / np.linalg.norm(v)
            perp = np.array([-v[1], v[0], 0])
            tick = VMobject().set_points_as_corners([end - perp * 0.16 * self.s, end + perp * 0.16 * self.s])
            tick.set_stroke(color, width=width)
            group.add(tick)
        return group.set_z_index(2)
