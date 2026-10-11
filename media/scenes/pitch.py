"""The 3-minute pitch video: Below Threshold, from one qubit to the decoders that keep it alive.

Narration: media/voiceover/pitch_script.py (14 beats). Seven beats show real screen recordings of
the app (scripts/record-pitch.ts), composited by the build into the window this scene draws
(film.py: screen_window / screen_on / screen_off). Everything else is drawn from real data:

- hook: N = 15 = 3 x 5, then the RSA-2048 challenge modulus (617 digits, checked in
  scripts/film/pitch.ts); the qubit's wobble is the seeded drift of media/data/film/fragile.json.
- product: the Part II icon is the exact QFT of a period-3 comb on 64 values (film/qft.json); the
  Part III icon is the d = 5 code with a real seeded syndrome (media/data/film/matching.json).
- qec: the d = 5 rotated surface code, the lit checks of seed 10060 at p = 8 %, and the matching,
  paths and correction found by the project's MWPM decoder (media/data/film/matching.json).
- rigor: numbers read from validate/data/cross_check.json, src/data/validation.json and README.md
  (exported to media/data/film/pitch.json); the plot is the d = 5, 7, 9 bit-flip sweep in
  media/data/threshold.json.
- close and card: the Team PhASE mark, the live URL and its QR code (qrcode-generator, level M),
  and the team from src/ui/screens/Team.tsx.
"""

from __future__ import annotations

import math

import numpy as np
from manim import (
    DOWN,
    LEFT,
    PI,
    RIGHT,
    UP,
    Arc,
    Arrow,
    Circle,
    Create,
    DashedLine,
    DashedVMobject,
    Dot,
    DrawBorderThenFill,
    Ellipse,
    FadeIn,
    FadeOut,
    GrowArrow,
    GrowFromCenter,
    LaggedStart,
    Line,
    Rectangle,
    ReplacementTransform,
    Rotate,
    RoundedRectangle,
    Sector,
    TracedPath,
    TransformMatchingTex,
    UpdateFromAlphaFunc,
    ValueTracker,
    VGroup,
    VMobject,
    Write,
    always_redraw,
    linear,
    smooth,
    there_and_back,
)

from common import BG, Lattice
from film import (
    AMBER,
    BLUE,
    CORAL,
    FAINT,
    GREEN,
    LEAD_IN,
    MUTED,
    MX,
    TAIL,
    TEAL,
    TEXT,
    TX,
    VIOLET,
    YELLOW,
    NarratedScene,
    load,
    phase_mark,
    script_scene,
    wordmark,
    word_time,
)
from shorkit import Bars, lerp_values

D_COL = {5: "#4A7DF0", 7: "#7CC4FF", 9: "#F4F6FB"}  # as in threshold.py
QR_INK = "#0E1220"
SEP = r"\ \textperiodcentered\ "

# Oblique view of the Bloch sphere: azimuth and elevation of the viewer.
AZ, EL = math.radians(22), math.radians(16)


# --------------------------------------------------------------------------- timing


def _norm(w: str) -> str:
    return "".join(ch for ch in w.lower() if ch.isalnum())


class Cues:
    """Beat-relative clock. `at(phrase)` is when a phrase is spoken (real word times if aligned, else an even pace)."""

    def __init__(self, scene, key: str, T: float):
        self.scene, self.T, self.t0, self.key = scene, T, scene.renderer.time, key
        b = next(b for b in script_scene(scene.scene_id).beats if b.key == key)
        self.tokens = [_norm(w) for w in b.text.replace("—", " ").split() if any(ch.isalnum() for ch in w)]
        self.speech = max(0.5, T - LEAD_IN - TAIL) if b.text else T

    def at(self, phrase: str) -> float:
        ws = [_norm(w) for w in phrase.split()]
        for i in range(len(self.tokens)):
            if self.tokens[i : i + len(ws)] == ws:
                return LEAD_IN + word_time(self.scene.scene_id, self.key, i, self.speech)
        raise KeyError(phrase)

    def now(self) -> float:
        return self.scene.renderer.time - self.t0

    def until(self, t: float):
        w = t - self.now()
        if w > 0.02:
            self.scene.wait(w)

    def left(self) -> float:
        return self.T - self.now()


# --------------------------------------------------------------------------- drawing helpers


def proj(v) -> np.ndarray:
    """A Bloch vector (x, y, z) seen from the oblique viewpoint, in units of the radius."""
    x, y, z = (float(c) for c in v)
    sx = x * math.cos(AZ) + y * math.sin(AZ)
    depth = -x * math.sin(AZ) + y * math.cos(AZ)  # positive = away from the viewer
    sy = z * math.cos(EL) + depth * math.sin(EL)
    return np.array([sx, sy, 0.0])


def unit(v) -> np.ndarray:
    v = np.array(v, dtype=float)
    return v / np.linalg.norm(v)


class Bloch(VGroup):
    """A 2D drawing of the Bloch sphere: silhouette, dashed equator, z axis and the state arrow.

    The arrow follows `self.v` (a unit 3-vector), or `self.path(self.t)` while a path is set.
    """

    def __init__(self, R: float, center, v, **kw):
        super().__init__(**kw)
        c = np.array(center, dtype=float)
        self.ring = Circle(radius=R).set_stroke(MUTED, width=2.4).set_fill(BLUE, opacity=0.05).move_to(c)
        eq = Ellipse(width=2 * R, height=2 * R * math.sin(EL)).set_stroke(FAINT, width=1.6).move_to(c)
        self.eq = DashedVMobject(eq, num_dashes=44)
        self.zax = DashedLine(c + DOWN * R * math.cos(EL), c + UP * R * math.cos(EL), dash_length=0.07).set_stroke(FAINT, width=1.6)
        self.v = unit(v)
        self.path = None
        self.t = ValueTracker(0.0)
        self.grow = ValueTracker(0.0)
        # An invisible diameter: its centre and width give the sphere's centre and radius at any
        # moment (the ring itself is only partial while it is being drawn).
        self.hub = Line(c + LEFT * R, c + RIGHT * R).set_stroke(opacity=0)
        self.arrow = VGroup(Line(c, c + RIGHT * 1e-3).set_stroke(BLUE, width=6), Dot(c, radius=0.08, color=BLUE))
        self.arrow.add_updater(lambda m: self._redraw(m))
        self.add(self.hub, self.ring, self.eq, self.zax, self.arrow)

    def current(self) -> np.ndarray:
        return self.path(self.t.get_value()) if self.path is not None else self.v

    def tip(self) -> np.ndarray:
        c, R = self.hub.get_center(), self.hub.width / 2
        return c + R * max(self.grow.get_value(), 1e-3) * proj(self.current())

    def _redraw(self, m):
        c = self.hub.get_center()
        end = self.tip()
        if np.linalg.norm(end - c) < 1e-3:
            end = c + RIGHT * 1e-3
        m[0].put_start_and_end_on(c, end)
        m[1].move_to(end)
        return m

    def follow(self, pts):
        """Constant-speed path through unit vectors (re-normalized between samples)."""
        pts = [np.array([p["x"], p["y"], p["z"]], dtype=float) for p in pts]
        seg = [np.linalg.norm(pts[i + 1] - pts[i]) for i in range(len(pts) - 1)]
        cum = np.concatenate([[0.0], np.cumsum(seg)])
        total = cum[-1] if cum[-1] > 0 else 1.0

        def f(u: float) -> np.ndarray:
            d = min(max(u, 0.0), 1.0) * total
            i = int(np.clip(np.searchsorted(cum, d) - 1, 0, len(seg) - 1))
            w = 0.0 if seg[i] == 0 else (d - cum[i]) / seg[i]
            return unit(pts[i] + w * (pts[i + 1] - pts[i]))

        self.path = f
        self.t.set_value(0.0)
        return pts[-1]


def lock_icon(h: float = 1.1, color: str = TEXT) -> VGroup:
    """A padlock: body, shackle (raised; `.shackle` drops 0.12 h to close) and keyhole."""
    w = 0.86 * h
    body = RoundedRectangle(width=w, height=0.64 * h, corner_radius=0.09 * h).set_fill(BG, opacity=1).set_stroke(color, width=4)
    r = 0.24 * h
    top = body.get_top()
    leg = 0.2 * h
    lift = 0.12 * h
    left = Line(top + LEFT * r + UP * lift, top + LEFT * r + UP * (leg + lift))
    right = Line(top + RIGHT * r + UP * lift, top + RIGHT * r + UP * (leg + lift))
    arc = Arc(radius=r, start_angle=0, angle=PI, arc_center=top + UP * (leg + lift))
    shackle = VGroup(left, arc, right).set_stroke(color, width=4)
    hole = VGroup(
        Circle(radius=0.065 * h).set_fill(color, opacity=1).set_stroke(width=0).move_to(body.get_center() + UP * 0.05 * h),
        Rectangle(width=0.05 * h, height=0.16 * h).set_fill(color, opacity=1).set_stroke(width=0).move_to(body.get_center() + DOWN * 0.06 * h),
    )
    g = VGroup(shackle, body, hole)
    g.shackle, g.body, g.hole, g.lift = shackle, body, hole, lift
    return g


def check_mark(size: float = 0.34, color: str = GREEN) -> VMobject:
    m = VMobject().set_points_as_corners([np.array([-0.5, 0.02, 0]), np.array([-0.14, -0.36, 0]), np.array([0.5, 0.42, 0])])
    return m.scale(size).set_stroke(color, width=5)


def qr_card(rows: list[str], side: float = 3.5, quiet: int = 4) -> VGroup:
    """Dark modules on a white card with a 4-module quiet zone; runs of dark modules are merged."""
    n = len(rows)
    u = side / (n + 2 * quiet)
    card = RoundedRectangle(width=side, height=side, corner_radius=0.1).set_fill("#FFFFFF", opacity=1).set_stroke(width=0)
    mods = VGroup()
    for r, row in enumerate(rows):
        c = 0
        while c < n:
            if row[c] != "1":
                c += 1
                continue
            c0 = c
            while c < n and row[c] == "1":
                c += 1
            w = (c - c0) * u
            rect = Rectangle(width=w + 0.004, height=u + 0.004).set_fill(QR_INK, opacity=1).set_stroke(width=0)
            rect.move_to([-side / 2 + (quiet + c0) * u + w / 2, side / 2 - (quiet + r + 0.5) * u, 0])
            mods.add(rect)
    g = VGroup(card, mods)
    g.card, g.mods = card, mods
    return g


def pchip(xs, ys):
    """Monotone cubic (Fritsch-Carlson) through the points; returns f(x)."""
    xs, ys = np.asarray(xs, float), np.asarray(ys, float)
    h = np.diff(xs)
    delta = np.diff(ys) / h
    m = np.zeros_like(ys)
    m[0], m[-1] = delta[0], delta[-1]
    for i in range(1, len(xs) - 1):
        if delta[i - 1] * delta[i] <= 0:
            m[i] = 0.0
        else:
            w1, w2 = 2 * h[i] + h[i - 1], h[i] + 2 * h[i - 1]
            m[i] = (w1 + w2) / (w1 / delta[i - 1] + w2 / delta[i])

    def f(x):
        i = int(np.clip(np.searchsorted(xs, x) - 1, 0, len(xs) - 2))
        t = (x - xs[i]) / h[i]
        h00, h10, h01, h11 = 2 * t**3 - 3 * t**2 + 1, t**3 - 2 * t**2 + t, -2 * t**3 + 3 * t**2, t**3 - t**2
        return h00 * ys[i] + h10 * h[i] * m[i] + h01 * ys[i + 1] + h11 * h[i] * m[i + 1]

    return f


def pct(x: float, nd: int = 2) -> str:
    return f"{100 * x:.{nd}f}"


def pub(x: float) -> str:
    return f"{100 * x:g}"


def grouped(n: int) -> str:
    return f"{n:,}".replace(",", "{,}")


# --------------------------------------------------------------------------- the scene


class PitchScene(NarratedScene):
    scene_id = "pitch"

    def construct(self):
        self.P = load("film/pitch")
        self.M = load("film/matching")
        self.F = load("film/fragile")
        self.Q = load("film/qft")
        self.TH = load("threshold")
        self.ref = self.screen_window("").frame  # the window's fixed geometry (never added)

        self.logo_beat()
        self.hook_beat()
        self.product_beat()
        self.screens_part_one()
        self.qec_beat()
        self.screens_part_two()
        self.rigor_beat()
        self.close_beats()

    # ------------------------------------------------------------------ window helpers
    def wlabel(self, s: str) -> VGroup:
        t = TX(s, size=30, color=MUTED)
        return t.next_to(self.ref, UP, buff=0.14).align_to(self.ref, LEFT).shift(RIGHT * 0.1)

    def wnote(self, mob):
        """An annotation in the strip above the window, right-aligned with its edge."""
        return mob.next_to(self.ref, UP, buff=0.14).align_to(self.ref, RIGHT).shift(LEFT * 0.1)

    def seed_frame(self, around, pad: float = 0.25):
        """A transparent rounded rectangle around `around`, to grow into the window frame."""
        r = RoundedRectangle(width=around.width + 2 * pad, height=around.height + 2 * pad, corner_radius=0.16)
        return r.move_to(around).set_fill(BG, opacity=0).set_stroke(MUTED, width=2.0, opacity=0.9)

    def swap_label(self, new: str, extra=(), run_time: float = 0.6):
        lab = self.wlabel(new)
        self.play(FadeOut(self.win_label, shift=0.12 * UP), FadeIn(lab, shift=0.12 * UP), *extra, run_time=run_time)
        self.win_label = lab

    def note_in(self, mob, cu: Cues, at: float, run_time: float = 0.6):
        cu.until(at)
        self.wnote(mob)
        self.play(FadeIn(mob, shift=0.1 * DOWN), run_time=min(run_time, max(0.2, cu.left() - 0.1)))
        return mob

    def window_out(self, cu: Cues, clip: str, extra=()):
        """Footage off, then the window folds away before the beat ends."""
        # The compositor fades the footage out over the 0.35 s before screen_off, so the
        # window can fold away right after it.
        cu.until(cu.T - 0.75)
        self.screen_off(clip)
        self.play(FadeOut(VGroup(self.win_frame, self.win_label), scale=0.97), *[FadeOut(m) for m in extra], run_time=0.55)
        self.win_frame = self.win_label = None

    # ------------------------------------------------------------------ logo
    def logo_beat(self):
        with self.beat("logo") as T:
            r = 1.05
            mark = phase_mark(r=r).shift(2.35 * LEFT)
            word = wordmark(height=1.55).next_to(mark, RIGHT, buff=0.55)
            VGroup(mark, word).move_to([0, 0.1, 0])
            c = mark.get_center()
            phi = ValueTracker(0.0)
            sweep = always_redraw(
                lambda: Sector(radius=r, angle=max(phi.get_value(), 1e-3), start_angle=0, arc_center=c)
                .set_fill(color=[TEAL, VIOLET], opacity=0.28)
                .set_stroke(width=0)
            )
            vec = mark.vector.copy().rotate(-mark.phi, about_point=c)
            tip = mark.tip.copy().rotate(-mark.phi, about_point=c)
            k = min(1.0, (T - 0.25) / 2.75)
            self.play(Create(mark.circle), GrowFromCenter(mark.axis), FadeIn(mark.origin), run_time=0.7 * k)
            self.add(sweep)
            self.play(FadeIn(vec), FadeIn(tip), run_time=0.2 * k)
            self.play(
                phi.animate.set_value(mark.phi),
                Rotate(vec, mark.phi, about_point=c),
                Rotate(tip, mark.phi, about_point=c),
                Create(mark.arc),
                rate_func=smooth,
                run_time=0.8 * k,
            )
            sweep.clear_updaters()
            self.play(DrawBorderThenFill(word, lag_ratio=0.08), run_time=1.0 * k)
            self.logo = VGroup(mark.circle, mark.axis, mark.origin, mark.arc, sweep, vec, tip, word)

    # ------------------------------------------------------------------ hook
    def hook_beat(self):
        with self.beat("hook") as T:
            cu = Cues(self, "hook", T)
            self.play(FadeOut(self.logo, shift=0.25 * UP), run_time=0.45)
            eq = MX("N", "=", "p", r"\times", "q", size=84)
            self.play(Write(eq), run_time=0.9)

            # "could factor": a number a classical computer factors at a glance.
            cu.until(cu.at("could factor") - 0.1)
            eq15 = MX("15", "=", "3", r"\times", "5", size=84)
            self.play(*[ReplacementTransform(a, b) for a, b in zip(eq, eq15)], run_time=0.9)

            # "huge numbers": the RSA-2048 challenge modulus, all 617 digits.
            rsa = self.P["rsa2048"]
            digits = rsa["digits"]
            per = 62
            rows = [digits[i : i + per] for i in range(0, len(digits), per)]
            block = VGroup(*[MX(r, size=33, color=TEXT) for r in rows]).arrange(DOWN, buff=0.14, aligned_edge=LEFT)
            if block.width > 11.6:
                block.scale_to_fit_width(11.6)
            block.move_to([0, 0.7, 0])
            name = TX(r"RSA-2048", size=30, color=MUTED).next_to(block, UP, buff=0.3).align_to(block, LEFT)
            count = TX(rf"{rsa['decimalDigits']} digits", size=28, color=FAINT).next_to(block, UP, buff=0.3).align_to(block, RIGHT)
            cu.until(cu.at("huge numbers") - 0.15)
            self.play(FadeOut(eq15, shift=0.4 * DOWN, scale=0.8), run_time=0.4)
            self.play(
                LaggedStart(*[FadeIn(row, shift=0.15 * DOWN) for row in block], lag_ratio=0.12),
                FadeIn(name, shift=0.1 * DOWN),
                FadeIn(count, shift=0.1 * DOWN),
                run_time=1.0,
            )

            # "break the encryption that protects the internet": the lock it guards.
            lock = lock_icon(h=1.05).move_to([0, -2.45, 0])
            cu.until(cu.at("break the encryption") - 0.1)
            self.play(Create(lock.shackle), DrawBorderThenFill(lock.body), FadeIn(lock.hole), run_time=0.8)
            cu.until(cu.at("protects the internet"))
            self.play(lock.shackle.animate.shift(DOWN * lock.lift), run_time=0.35, rate_func=smooth)

            # "Thirty years later ... The reason is noise": a real qubit, drifting.
            cu.until(cu.at("thirty years later") - 0.1)
            th = self.F["start"]["theta"]
            v0 = (math.sin(th), 0.0, math.cos(th))
            g = Bloch(R=1.7, center=[0, -0.15, 0], v=v0)
            k0 = MX(r"|0\rangle", size=40, color=MUTED).next_to(g.ring, UP, buff=0.14)
            k1 = MX(r"|1\rangle", size=40, color=MUTED).next_to(g.ring, DOWN, buff=0.14)
            self.play(FadeOut(VGroup(block, name, count, lock), shift=0.3 * UP), run_time=0.7)
            self.add(g)
            self.play(Create(g.ring), Create(g.eq), FadeIn(g.zax), FadeIn(k0), FadeIn(k1), run_time=0.8)
            self.play(g.grow.animate.set_value(1.0), run_time=0.5, rate_func=smooth)
            cu.until(cu.at("no quantum computer") + 0.2)
            g.follow(self.F["drift"])
            trail = TracedPath(lambda: g.tip(), stroke_color=CORAL, stroke_width=3.2, stroke_opacity=[0.0, 0.9], dissipating_time=None)
            trail.set_z_index(1)
            g.arrow.set_z_index(2)
            self.add(trail)
            self.play(g.t.animate.set_value(1.0), run_time=max(1.0, cu.left() - 0.05), rate_func=linear)
            trail.clear_updaters()
            g.v = unit([self.F["drift"][-1][k] for k in "xyz"])
            g.path = None
            self.glyph, self.kets, self.trail = g, VGroup(k0, k1), trail

    # ------------------------------------------------------------------ product
    def product_beat(self):
        with self.beat("product") as T:
            cu = Cues(self, "product", T)
            g = self.glyph
            Y = -0.35
            X = (-4.6, 0.0, 4.6)
            # The drifting qubit becomes Part I's icon.
            target_R = 0.72
            self.play(FadeOut(self.trail), FadeOut(self.kets), run_time=0.35)
            self.play(g.animate.scale(target_R / (g.hub.width / 2)).move_to([X[0], Y, 0]), run_time=0.8)
            logo_mark = phase_mark(r=0.36)
            logo_word = wordmark(height=0.52)
            logo = VGroup(logo_mark, logo_word).arrange(RIGHT, buff=0.26).move_to([0, 3.25, 0])
            cu.until(cu.at("team phase") - 0.25)
            self.play(FadeIn(logo, shift=0.12 * DOWN), run_time=0.7)
            title = TX(r"Below Threshold", size=88).move_to([0, 2.0, 0])
            cu.until(cu.at("below threshold is") - 0.1)
            self.play(Write(title), run_time=1.2)

            def part_label(num: str, name: str, x: float) -> VGroup:
                g_ = VGroup(TX(rf"\textsc{{part {num}}}", size=28, color=MUTED), TX(name, size=34)).arrange(DOWN, buff=0.12)
                return g_.move_to([x, -1.95, 0])

            lab1 = part_label("i", "Quantum basics", X[0])
            lab2 = part_label("ii", r"Shor's algorithm", X[1])
            lab3 = part_label("iii", "Keeping it alive", X[2])

            cu.until(cu.at("from a single qubit"))
            self.play(FadeIn(lab1, shift=0.1 * UP), run_time=0.6)

            # Part II: the exact QFT of a period-3 comb on 64 values: 22 equal teeth -> three peaks.
            comb = self.Q["blur"]
            vin, vout = list(comb["input"]), list(comb["output"])
            vmax = max(max(vin), max(vout))  # one probability scale for both
            bars = Bars(vin, width=2.4, height=1.3, gap=0.25, color=BLUE, vmax=vmax)
            bars.shift(np.array([X[1], Y - 0.65, 0]) - bars.base)
            a1 = Arrow([X[0] + 1.05, Y, 0], [X[1] - 1.45, Y, 0], buff=0, stroke_width=3, color=FAINT, max_tip_length_to_length_ratio=0.1)
            a2 = Arrow([X[1] + 1.45, Y, 0], [X[2] - 1.25, Y, 0], buff=0, stroke_width=3, color=FAINT, max_tip_length_to_length_ratio=0.1)
            cu.until(cu.at("through shor's algorithm") - 0.2)
            self.play(GrowArrow(a1), FadeIn(bars), FadeIn(lab2, shift=0.1 * UP), run_time=0.6)
            self.play(UpdateFromAlphaFunc(bars, lambda m, a: m.set_values(lerp_values(vin, vout, smooth(a)), vmax=vmax)), run_time=0.8)

            # Part III: the d = 5 code with a real syndrome.
            lat = Lattice(self.M["layout"], s=0.34, center=np.array([X[2], Y, 0]))
            cu.until(cu.at("to the error correction") - 0.2)
            self.play(GrowArrow(a2), FadeIn(lat), FadeIn(lab3, shift=0.1 * UP), run_time=0.7)
            cu.until(cu.at("keeps it alive") - 0.35)
            self.play(*lat.fire(self.M["success"]["lit"], on=True), run_time=0.45)

            # The app window grows out of Part I.
            cu.until(cu.T - 1.3)
            self.play(FadeOut(VGroup(logo, title, a1, a2, bars, lat, lab2, lab3), shift=0.1 * UP), run_time=0.45)
            win = self.screen_window("")
            frame = win.frame
            seed = self.seed_frame(g, pad=0.3)
            lab = self.wlabel(rf"Part I{SEP}What is a qubit?")
            g.arrow.clear_updaters()
            self.play(ReplacementTransform(seed, frame), FadeOut(lab1, shift=0.1 * DOWN), FadeIn(lab, shift=0.1 * DOWN), FadeOut(g), run_time=0.75)
            self.win_frame, self.win_label = frame, lab

    # ------------------------------------------------------------------ learn, qft, shor, noise
    def screens_part_one(self):
        with self.beat("learn") as T:
            cu = Cues(self, "learn", T)
            self.screen_on("learn")
            hh = MX(r"H\,H\,|0\rangle", "=", r"|0\rangle", size=40)
            self.note_in(hh, cu, cu.at("watch interference cancel") - 0.5)

        with self.beat("qft") as T:
            cu = Cues(self, "qft", T)
            self.screen_off("learn")
            self.screen_on("qft")
            self.swap_label(rf"Part II{SEP}The quantum Fourier transform", extra=[FadeOut(hh, shift=0.12 * UP)])
            f = MX(r"|x\rangle \;\mapsto\; N^{-1/2} \textstyle\sum_{k} e^{2\pi i\, xk/N}\,|k\rangle", size=38)
            self.note_in(f, cu, cu.at("quantum fourier transform") - 0.2)

        with self.beat("shor") as T:
            cu = Cues(self, "shor", T)
            self.screen_off("qft")
            self.screen_on("shor")
            self.swap_label(rf"Part II{SEP}Shor's algorithm, end to end", extra=[FadeOut(f, shift=0.12 * UP)])
            fac = MX("15", "=", "3", r"\times", "5", size=42)
            fac[2].set_color(GREEN)
            fac[4].set_color(GREEN)
            self.note_in(fac, cu, cu.at("three times five") - 0.3)

        with self.beat("noise") as T:
            cu = Cues(self, "noise", T)
            self.screen_off("shor")
            self.screen_on("noise")
            self.swap_label(rf"Part II{SEP}Noise ruins the answer", extra=[FadeOut(fac, shift=0.12 * UP)])
            rate = MX(r"p \approx 10^{-3}", r"\ \ \text{per operation}", size=38, color=AMBER)
            rate[1].set_color(MUTED)
            self.note_in(rate, cu, cu.at("real qubits fail") - 0.2)
            self.window_out(cu, "noise", extra=[rate])

    # ------------------------------------------------------------------ qec
    def qec_beat(self):
        with self.beat("qec") as T:
            cu = Cues(self, "qec", T)
            M = self.M
            ok = M["success"]

            def state(k0: str, k1: str, size: float) -> MX:
                m = MX(r"\alpha", k0, "+", r"\beta", k1, size=size)
                m[0].set_color(BLUE)
                m[3].set_color(BLUE)
                return m

            one = state(r"|0\rangle", r"|1\rangle", 72).move_to([0, 0.2, 0])
            self.play(Write(one), run_time=0.9)
            cu.until(cu.at("spreads one qubit") - 0.1)
            three = state(r"|000\rangle", r"|111\rangle", 72).move_to([0, 0.2, 0])
            self.play(*[ReplacementTransform(a, b) for a, b in zip(one, three)], run_time=0.9)

            # "across many": the real d = 5 code, 25 qubits.
            lat = Lattice(M["layout"], s=1.0, center=np.array([0, -0.5, 0]))
            logical = state(r"|0_L\rangle", r"|1_L\rangle", 52).move_to([0, 3.35, 0])
            c = lat.center_pt
            order = sorted(range(lat.lay["n"]), key=lambda q: np.linalg.norm(lat.qpos(q) - c))
            cu.until(cu.at("across many") - 0.3)
            self.play(*[ReplacementTransform(a, b) for a, b in zip(three, logical)], run_time=0.65)
            self.add(lat.dots)
            self.play(LaggedStart(*[FadeIn(lat.qubits[q], scale=0.4) for q in order], lag_ratio=0.05), run_time=0.9)

            # "asks them whether they agree": the checks, each a parity of its qubits.
            cu.until(cu.at("and asks them") - 0.1)
            torder = sorted(range(len(lat.stabs)), key=lambda i: np.linalg.norm(lat.anchor[i] - c))
            self.play(LaggedStart(*[FadeIn(lat.tiles[i], scale=0.85) for i in torder], lag_ratio=0.04), run_time=1.0)
            self.remove(*lat.tiles, *lat.qubits, lat.dots)
            self.add(lat)
            probe = 9  # a Z check in the middle (unlit in this instance)
            ring = lat.tiles[probe].copy().set_fill(opacity=0).set_stroke(YELLOW, width=4, opacity=1).set_z_index(5)
            zzzz = MX(r"Z\,Z\,Z\,Z", "=", "+1", size=40, color=TEAL)
            zzzz.next_to(lat, RIGHT, buff=0.45).set_y(lat.anchor[probe][1])
            cu.until(cu.at("whether they agree") - 0.1)
            self.play(Create(ring), FadeIn(zzzz, shift=0.15 * LEFT), run_time=0.7)

            # "without ever looking at the answer": the amplitudes stay untouched.
            cu.until(cu.at("without ever looking") + 0.1)
            self.play(*[logical[i].animate(rate_func=there_and_back).scale(1.25) for i in (0, 3)], run_time=0.9)

            # "The lit checks are clues": a real seeded syndrome.
            cu.until(cu.at("the lit checks") - 0.1)
            self.play(FadeOut(ring), FadeOut(zzzz), *lat.fire(ok["lit"], on=True), run_time=0.7)

            # "a decoder has to work out what went wrong": the real MWPM matching and its correction.
            cu.until(cu.at("a decoder") - 0.1)
            paths = [lat.dashed_path(m, color=BLUE, width=5) for m in ok["matching"]]
            self.play(LaggedStart(*[Create(p) for p in paths], lag_ratio=0.35), run_time=1.3)
            cu.until(cu.at("what went wrong") - 0.3)
            self.play(*[lat.correct_anim(q) for q in ok["correction"]], run_time=0.6)

            # The lattice becomes the game.
            cu.until(cu.T - 1.2)
            self.play(FadeOut(logical, shift=0.2 * UP), run_time=0.35)
            win = self.screen_window("")
            frame = win.frame
            body = VGroup(lat, *paths)
            seed = self.seed_frame(body, pad=0.15)
            lab = self.wlabel(rf"Part III{SEP}The decoding game")
            self.play(
                ReplacementTransform(seed, frame),
                FadeOut(body),
                FadeIn(lab, shift=0.1 * DOWN),
                run_time=0.75,
            )
            self.win_frame, self.win_label = frame, lab

    # ------------------------------------------------------------------ game, realtime, lab
    def screens_part_two(self):
        with self.beat("game"):
            self.screen_on("game")  # the footage carries this beat; the window was drawn at the end of qec

        with self.beat("realtime") as T:
            cu = Cues(self, "realtime", T)
            self.screen_off("game")
            self.screen_on("realtime")
            self.swap_label("Real-time mode")
            rate = MX(r"\sim 10^{6}", r"\ \ \text{rounds per second}", size=38, color=AMBER)
            rate[1].set_color(MUTED)
            self.note_in(rate, cu, cu.at("a million times") - 0.2)

        with self.beat("lab") as T:
            cu = Cues(self, "lab", T)
            self.screen_off("realtime")
            self.screen_on("lab")
            self.swap_label(rf"Threshold lab{SEP}and the film", extra=[FadeOut(rate, shift=0.12 * UP)])
            law = MX(r"p < p_{\mathrm{th}} \;\Rightarrow\; p_L(d{+}2) < p_L(d)", size=38)
            self.note_in(law, cu, cu.at("below it") - 0.2)
            self.window_out(cu, "lab", extra=[law])

    # ------------------------------------------------------------------ rigor
    def rigor_beat(self):
        with self.beat("rigor") as T:
            cu = Cues(self, "rigor", T)
            R = self.P["rigor"]
            X_CHECK, X_MAIN = -6.15, -5.7

            def row(main, note, y):
                main.move_to([0, y, 0]).align_to([X_MAIN, 0, 0], LEFT)
                note.next_to(main, DOWN, buff=0.14).align_to(main, LEFT)
                chk = check_mark().move_to([X_CHECK, main.get_y(), 0])
                return VGroup(chk, main, note)

            def show(r, run_time=0.9):
                chk, main, note = r
                self.play(Create(chk), Write(main), FadeIn(note, shift=0.08 * UP), run_time=run_time)

            cc = R["crossCheck"]
            r1 = row(
                MX(rf"{grouped(cc['agree'])}\,/\,{grouped(cc['problems'])}", size=42),
                TX("same matching weight as PyMatching", size=28, color=MUTED),
                2.85,
            )
            ds = R["layout"]["distances"]
            r2 = row(
                MX(r"\text{layout} = \text{Stim}", size=42),
                TX(rf"rotated surface code, $d = {', '.join(str(d) for d in ds)}$", size=28, color=MUTED),
                1.6,
            )
            bf, ph = R["thresholds"]
            r3 = row(
                MX(rf"p_{{\mathrm{{th}}}} = {pct(bf['estimate'])}\%", rf"\ \ \text{{vs}}\ \approx {pub(bf['published'])}\%", size=42),
                TX("bit-flip noise; published value", size=28, color=MUTED),
                0.35,
            )
            r4 = row(
                MX(rf"p_{{\mathrm{{th}}}} = {pct(ph['estimate'])}\%", rf"\ \ \text{{vs}}\ \approx {pub(ph['published'])}\%", size=42),
                TX("with measurement errors; published value", size=28, color=MUTED),
                -0.9,
            )
            tt = R["tests"]
            sum_a = MX(str(tt["unit"]), "+", str(tt["e2e"]), size=42)
            sum_b = MX(str(tt["unit"]), "+", str(tt["e2e"]), "=", str(tt["total"]), size=42)
            r5 = row(sum_b, TX(r"automated tests: unit $+$ end-to-end", size=28, color=MUTED), -2.15)
            sum_a.align_to(sum_b, LEFT).set_y(sum_b.get_y())
            honest = TX(r"\textit{and a page that lists exactly what we simplify}", size=30, color=TEXT)
            honest.move_to([0, -3.4, 0]).align_to([X_MAIN, 0, 0], LEFT)

            # The bit-flip threshold, measured: d = 5, 7, 9 (media/data/threshold.json).
            px0, px1, py0, py1 = 1.05, 5.45, -2.35, 2.55
            p_lo, p_hi = 0.04, 0.16
            l_lo, l_hi = math.log10(0.003), math.log10(0.45)

            def c2p(p, pl):
                return np.array([px0 + (p - p_lo) / (p_hi - p_lo) * (px1 - px0), py0 + (math.log10(pl) - l_lo) / (l_hi - l_lo) * (py1 - py0), 0])

            axes = VGroup(
                Line([px0, py0, 0], [px1, py0, 0]).set_stroke(MUTED, width=2),
                Line([px0, py0, 0], [px0, py1, 0]).set_stroke(MUTED, width=2),
            )
            ticks = VGroup()
            for p in (0.05, 0.10, 0.15):
                x = c2p(p, 0.01)[0]
                ticks.add(Line([x, py0, 0], [x, py0 - 0.09, 0]).set_stroke(MUTED, width=2))
                ticks.add(MX(rf"{round(100 * p)}\%", size=30, color=MUTED).next_to([x, py0 - 0.09, 0], DOWN, buff=0.1))
            for e in (-2, -1):
                y = c2p(p_lo, 10**e)[1]
                ticks.add(Line([px0, y, 0], [px0 - 0.09, y, 0]).set_stroke(MUTED, width=2))
                ticks.add(MX(rf"10^{{{e}}}", size=30, color=MUTED).next_to([px0 - 0.09, y, 0], LEFT, buff=0.1))
            xl = MX("p", size=38, color=MUTED).next_to([px1, py0, 0], UP, buff=0.12).shift(LEFT * 0.1)
            yl = MX("p_L", size=38, color=MUTED).next_to([px0, py1, 0], RIGHT, buff=0.15)
            curves, dlabs = VGroup(), VGroup()
            for d in (5, 7, 9):
                pts = self.TH["curves"][str(d)]
                xs = [q["p"] for q in pts]
                f = pchip(xs, [math.log10(q["pL"]) for q in pts])
                samp = np.linspace(xs[0], xs[-1], 90)
                cur = VMobject().set_points_smoothly([c2p(p, 10 ** f(p)) for p in samp]).set_stroke(D_COL[d], width=3.6)
                curves.add(cur)
                dlabs.add(MX(rf"d = {d}", size=36, color=D_COL[d]).next_to(c2p(xs[-1], pts[-1]["pL"]), RIGHT, buff=0.14))
            # At the right end the curves sit close together (d = 9 on top): spread the labels downward.
            for i in (1, 0):
                above = dlabs[i + 1]
                if dlabs[i].get_y() > above.get_y() - 0.4:
                    dlabs[i].set_y(above.get_y() - 0.4)
            pth = bf["estimate"]
            xline = DashedLine(c2p(pth, 10**l_lo), c2p(pth, 10**l_hi) + DOWN * 0.35, dash_length=0.09).set_stroke(YELLOW, width=2.6)
            xlab = MX(rf"{pct(pth)}\%", size=36, color=YELLOW).next_to(xline, UP, buff=0.08)
            plot = VGroup(axes, ticks, xl, yl)

            # "None of it is faked": the measured curves draw themselves first.
            cu.until(0.15)
            self.play(Create(axes), FadeIn(ticks), FadeIn(xl), FadeIn(yl), run_time=0.6)
            self.play(LaggedStart(*[Create(c) for c in curves], lag_ratio=0.25), FadeIn(dlabs), run_time=1.2)
            cu.until(cu.at("our matching decoder") - 0.15)
            show(r1)
            cu.until(cu.at("our code layout") - 0.15)
            show(r2)
            cu.until(cu.at("our thresholds") - 0.15)
            chk, main, note = r3
            self.play(Create(chk), Write(main), FadeIn(note, shift=0.08 * UP), Create(xline), FadeIn(xlab, shift=0.1 * DOWN), run_time=0.9)
            cu.until(cu.at("published values") - 0.1)
            show(r4, run_time=0.8)
            cu.until(cu.at("close to two hundred") - 0.3)
            self.play(Create(r5[0]), Write(sum_a), FadeIn(r5[2], shift=0.08 * UP), run_time=0.8)
            cu.until(cu.at("two hundred") - 0.1)
            self.play(TransformMatchingTex(sum_a, sum_b), run_time=0.7)
            cu.until(cu.at("we even list") - 0.1)
            self.play(FadeIn(honest, shift=0.1 * UP), run_time=0.7)
            self.rigor_all = VGroup(r1, r2, r3, r4, r5, honest, plot, curves, dlabs, xline, xlab)

    # ------------------------------------------------------------------ close and card
    def close_beats(self):
        P = self.P
        r = 0.62
        mark = phase_mark(r=r)
        word = wordmark(height=0.92)
        logo_row = VGroup(mark, word).arrange(RIGHT, buff=0.42)
        logo_row.move_to([0, 2.35, 0]).align_to([-6.0, 0, 0], LEFT)
        title = TX(r"Below Threshold", size=92).move_to([0, 0.75, 0]).align_to([-6.05, 0, 0], LEFT)
        url = TX(r"\texttt{" + P["url"].replace("_", r"\_") + "}", size=32, color=MUTED)
        url.next_to(title, DOWN, buff=0.4).align_to(title, LEFT).shift(RIGHT * 0.05)
        qr = qr_card(P["qr"]["rows"], side=3.6).move_to([4.25, 0.55, 0])
        scan = TX(r"scan to play", size=28, color=MUTED).next_to(qr, DOWN, buff=0.22)
        names = TX(SEP.join(P["team"]), size=30, color=MUTED).move_to([0, -2.75, 0]).align_to(title, LEFT).shift(RIGHT * 0.05)

        with self.beat("close") as T:
            cu = Cues(self, "close", T)
            c = mark.circle.get_center()
            th = self.F["start"]["theta"]
            v0 = (math.sin(th), 0.0, math.cos(th))
            g = Bloch(R=1.5, center=[0, -0.1, 0], v=v0)
            k0 = MX(r"|0\rangle", size=40, color=MUTED).next_to(g.ring, UP, buff=0.14)
            k1 = MX(r"|1\rangle", size=40, color=MUTED).next_to(g.ring, DOWN, buff=0.14)
            self.play(FadeOut(self.rigor_all, shift=0.2 * UP), run_time=0.5)
            # "qubits that survive": the qubit from the opening, this time holding still.
            self.add(g.hub, g.ring, g.eq, g.zax, g.arrow)
            self.play(Create(g.ring), Create(g.eq), FadeIn(g.zax), FadeIn(k0), FadeIn(k1), run_time=0.7)
            self.play(g.grow.animate.set_value(1.0), run_time=0.5, rate_func=smooth)

            # "That takes error correction ...": the qubit becomes the Team PhASE mark.
            cu.until(cu.at("that takes error correction") - 0.2)
            g.arrow.clear_updaters()
            pv = proj(g.v)
            a0 = math.atan2(pv[1], pv[0])
            end0 = c + r * np.array([math.cos(a0), math.sin(a0), 0])
            vec = Line(c, end0, stroke_width=7 * r, color=TEXT)
            dot = mark.tip.copy().move_to(end0)
            self.play(
                ReplacementTransform(g.ring, mark.circle),
                FadeOut(g.zax, target_position=c, scale=r / 1.5),
                FadeOut(g.eq, target_position=c, scale=r / 1.5),
                FadeOut(VGroup(k0, k1)),
                ReplacementTransform(g.arrow[0], vec),
                ReplacementTransform(g.arrow[1], dot),
                run_time=1.0,
            )
            self.play(GrowFromCenter(mark.axis), FadeIn(mark.origin), run_time=0.3)
            phi = ValueTracker(a0)
            sweep = always_redraw(
                lambda: Sector(radius=r, angle=max(phi.get_value(), 1e-3), start_angle=0, arc_center=c)
                .set_fill(color=[TEAL, VIOLET], opacity=0.28)
                .set_stroke(width=0)
            )
            self.add(sweep)
            self.bring_to_front(vec, dot, mark.origin)
            self.play(
                phi.animate.set_value(mark.phi),
                Rotate(vec, mark.phi - a0, about_point=c),
                Rotate(dot, mark.phi - a0, about_point=c),
                Create(mark.arc),
                run_time=0.7,
                rate_func=smooth,
            )
            sweep.clear_updaters()
            self.play(DrawBorderThenFill(word, lag_ratio=0.08), run_time=0.8)
            cu.until(cu.at("and decoders") - 0.2)
            self.play(Write(title), run_time=1.0)
            cu.until(cu.at("come and play") - 0.5)
            self.play(FadeIn(url, shift=0.1 * UP), FadeIn(qr.card, scale=0.92), run_time=0.5)
            self.play(LaggedStart(*[FadeIn(m) for m in qr.mods], lag_ratio=0.004), FadeIn(scan), run_time=0.8)

        with self.beat("card") as T:
            self.play(FadeIn(names, shift=0.1 * UP), run_time=0.8)
