"""Outro: the film's objects return in miniature, gather, and become the Team PhASE mark.

Miniatures use the same data as their chapters: the Bloch arrow at the fragile chapter's
starting angle (media/data/film/fragile.json), the d = 5 lattice with one real seeded
bit-flip syndrome and the real d = 5, 7, 9 threshold curves (media/data/film/threshold.json),
and a backlog of rounds queued in front of a decoder.
"""

from __future__ import annotations

import math

import numpy as np
from manim import (
    DOWN,
    LEFT,
    ORIGIN,
    RIGHT,
    UP,
    Arrow,
    Circle,
    Create,
    DashedVMobject,
    DrawBorderThenFill,
    Ellipse,
    FadeIn,
    GrowFromCenter,
    LaggedStart,
    Line,
    ReplacementTransform,
    Rotate,
    RoundedRectangle,
    Sector,
    Square,
    ValueTracker,
    VGroup,
    VMobject,
    Write,
    always_redraw,
    smooth,
)

from common import BG, Lattice
from film import (
    AMBER,
    BLUE,
    FAINT,
    LEAD_IN,
    MUTED,
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
)

D_COL = {5: "#4A7DF0", 7: "#7CC4FF", 9: "#F4F6FB"}
URL = "https://bbfutaba.github.io/below-threshold/"


def _norm(w: str) -> str:
    return "".join(ch for ch in w.lower() if ch.isalnum())


class Cues:
    """Beat-relative clock. `at(phrase)` estimates when a phrase is spoken (uniform pace)."""

    def __init__(self, scene, key: str, T: float):
        self.scene, self.T, self.t0 = scene, T, scene.renderer.time
        b = next(b for b in script_scene(scene.scene_id).beats if b.key == key)
        self.tokens = [_norm(w) for w in b.text.replace("—", " ").split() if any(ch.isalnum() for ch in w)]
        self.speech = max(0.5, T - LEAD_IN - TAIL) if b.text else T

    def at(self, phrase: str) -> float:
        ws = [_norm(w) for w in phrase.split()]
        for i in range(len(self.tokens)):
            if self.tokens[i : i + len(ws)] == ws:
                return LEAD_IN + self.speech * i / len(self.tokens)
        raise KeyError(phrase)

    def now(self) -> float:
        return self.scene.renderer.time - self.t0

    def until(self, t: float):
        w = t - self.now()
        if w > 0.02:
            self.scene.wait(w)

    def left(self) -> float:
        return self.T - self.now()


class OutroScene(NarratedScene):
    scene_id = "outro"

    def construct(self):
        th = load("film/threshold")
        theta = load("film/fragile")["start"]["theta"]
        self.chapter_card()  # no card for the outro

        Y = 0.1
        XS = (-5.15, -1.72, 1.72, 5.15)

        # --- Bloch arrow (2D projection of the fragile chapter's sphere).
        R = 1.0
        bc = np.array([XS[0], Y, 0])
        ball = Circle(radius=R).set_stroke(MUTED, width=2.4).move_to(bc)
        eq = DashedVMobject(Ellipse(width=2 * R, height=0.62 * R).set_stroke(FAINT, width=1.6), num_dashes=30).move_to(bc)
        zax = Line(bc + DOWN * R * 1.12, bc + UP * R * 1.12, stroke_width=1.6, color=FAINT)
        tip = ValueTracker(0.0)
        arrow = always_redraw(
            lambda: Arrow(
                bc,
                bc + R * np.array([math.sin(tip.get_value()), math.cos(tip.get_value()), 0]),
                buff=0,
                stroke_width=5,
                color=BLUE,
                max_tip_length_to_length_ratio=0.2,
            )
        )
        bloch = VGroup(ball, eq, zax)

        # --- d = 5 lattice with a real syndrome.
        lat = Lattice(th["layouts"]["5"], s=0.44, center=np.array([XS[1], Y, 0]))
        draw = th["sparks"]["draws"]["5"][0]

        # --- threshold curves (real data), miniature axes without labels.
        W, H = 2.5, 1.9
        o = np.array([XS[2] - W / 2, Y - H / 2, 0])

        def c2p(p, pl):
            return o + np.array([(p - 0.035) / (0.165 - 0.035) * W, (math.log10(pl) + 2.6) / 2.6 * H, 0])

        axes = VGroup(Line(o, o + RIGHT * W, stroke_width=2, color=MUTED), Line(o, o + UP * H, stroke_width=2, color=MUTED))
        curves = VGroup()
        for d in (5, 7, 9):
            pts = [c2p(c["p"], c["pL"]) for c in th["curves"]["byD"][str(d)]]
            curves.add(VMobject().set_points_smoothly(pts).set_stroke(D_COL[d], width=3.4))

        # --- backlog: rounds queued in front of a decoder.
        bx = np.array([XS[3], Y, 0])
        box = RoundedRectangle(width=0.9, height=0.62, corner_radius=0.1).set_fill(BG, opacity=1).set_stroke(BLUE, width=2.4)
        box.move_to(bx + RIGHT * 0.78).set_z_index(3)
        q = VGroup(*[Square(side_length=0.22).set_fill(AMBER, opacity=0.5).set_stroke(AMBER, width=1.2) for _ in range(6)])
        q.arrange(LEFT, buff=0.06).next_to(box, LEFT, buff=0.08)
        lane = Line(q.get_left() + LEFT * 0.25, box.get_left(), stroke_width=2, color=FAINT).set_z_index(-1)

        with self.beat("takeaway") as T:
            cu = Cues(self, "takeaway", T)
            k = min(1.0, T / 9.9)
            # They return one by one, each doing its one thing.
            self.play(Create(ball), Create(eq), FadeIn(zax), run_time=0.7 * k)
            self.add(arrow)
            self.play(tip.animate.set_value(theta), FadeIn(lat, shift=0.15 * UP), run_time=0.9 * k, rate_func=smooth)
            self.play(
                *lat.fire(draw["syndrome"], on=True),
                Create(axes),
                LaggedStart(*[Create(c) for c in curves], lag_ratio=0.15),
                run_time=1.0 * k,
            )
            self.play(Create(lane), FadeIn(box), LaggedStart(*[FadeIn(b, shift=0.3 * RIGHT) for b in q], lag_ratio=0.2), run_time=0.9 * k)
            arrow.clear_updaters()
            # "play the game": the lattice lifts; "race the decoder": the queue drains;
            # "watch the threshold appear": the crossing lights up.
            cu.until(cu.at("play the game") - 0.1)
            self.play(lat.animate.scale(1.12), run_time=0.45 * k, rate_func=smooth)
            self.play(lat.animate.scale(1 / 1.12), run_time=0.45 * k)
            cu.until(cu.at("race the decoder") - 0.1)
            self.play(LaggedStart(*[b.animate.move_to(box).set_opacity(0) for b in reversed(q)], lag_ratio=0.25), run_time=1.0 * k)
            cu.until(cu.at("watch the threshold") - 0.1)
            xc = c2p(0.0965, 0.112)
            ring = Circle(radius=0.2, color=YELLOW, stroke_width=3).move_to(xc)
            self.play(Create(ring), run_time=0.6 * k)
            # Gather: everything drifts in and fades; the Bloch circle and arrow stay for the mark.
            cu.until(cu.T - 1.35)
            rest = VGroup(lat, axes, curves, ring, box, lane, q, eq, zax)
            self.play(
                *[m.animate.move_to(ORIGIN + 0.55 * (m.get_center() - ORIGIN)).scale(0.6).set_opacity(0) for m in rest],
                run_time=1.25,
                rate_func=smooth,
            )
            self.remove(rest)

        with self.beat("logo") as T:
            r = 0.8
            mark = phase_mark(r=r)
            word = wordmark(height=1.15)
            row = VGroup(mark, word).arrange(RIGHT, buff=0.5).move_to([0, 1.3, 0])
            c = mark.circle.get_center()
            # The Bloch circle and arrow become the mark's circle and phase vector.
            a0 = math.pi / 2 - theta  # the arrow's angle from the real axis
            vec = Line(c, c + r * np.array([math.cos(a0), math.sin(a0), 0]), stroke_width=7 * r, color=TEXT)
            dot = mark.tip.copy().move_to(c + r * np.array([math.cos(a0), math.sin(a0), 0]))
            self.play(
                ReplacementTransform(ball, mark.circle),
                ReplacementTransform(arrow, vec),
                GrowFromCenter(mark.axis),
                FadeIn(mark.origin),
                run_time=1.1,
            )
            self.play(FadeIn(dot, scale=0.4), run_time=0.2)
            phi = ValueTracker(a0)
            sweep = always_redraw(
                lambda: Sector(radius=r, angle=max(phi.get_value(), 1e-3), start_angle=0, arc_center=c).set_fill(color=[TEAL, VIOLET], opacity=0.28).set_stroke(width=0)
            )
            self.add(sweep)
            self.play(
                phi.animate.set_value(mark.phi),
                Rotate(vec, mark.phi - a0, about_point=c),
                Rotate(dot, mark.phi - a0, about_point=c),
                Create(mark.arc),
                run_time=0.8,
                rate_func=smooth,
            )
            sweep.clear_updaters()
            self.play(DrawBorderThenFill(word, lag_ratio=0.08), run_time=1.0)
            title = TX(r"Below Threshold", size=72).move_to([0, -0.45, 0])
            url = TX(r"\texttt{" + URL.replace("_", r"\_") + "}", size=30, color=MUTED).next_to(title, DOWN, buff=0.42)
            self.play(Write(title), FadeIn(url, shift=0.1 * UP), run_time=1.0)
