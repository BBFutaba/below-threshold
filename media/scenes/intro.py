"""Intro: the Team PhASE mark draws itself, then the title over a breathing lattice.

The background lattice is a real d = 7 rotated surface code; every lit check is a real
syndrome of seeded depolarizing noise (media/data/film/intro.json, scripts/film/intro.ts).
"""

from __future__ import annotations

import numpy as np
from manim import (
    DOWN,
    UP,
    AnimationGroup,
    Create,
    DrawBorderThenFill,
    FadeIn,
    FadeOut,
    GrowFromCenter,
    Rotate,
    Sector,
    ValueTracker,
    VGroup,
    Write,
    always_redraw,
    smooth,
)

from manim import Rectangle

from common import BG, Lattice, TEAL, VIOLET
from film import MUTED, NarratedScene, TX, load, phase_mark, wordmark


class IntroScene(NarratedScene):
    scene_id = "intro"

    def construct(self):
        data = load("film/intro")
        with self.beat("logo") as T:
            mark = phase_mark(r=1.05).shift(2.35 * np.array([-1, 0, 0]))
            word = wordmark(height=1.55).next_to(mark, np.array([1, 0, 0]), buff=0.55)
            VGroup(mark, word).move_to([0, 0.1, 0])
            c = mark.get_center()
            phi = ValueTracker(0.0)
            r = 1.05
            sweep = always_redraw(
                lambda: Sector(radius=r, angle=max(phi.get_value(), 1e-3), start_angle=0, arc_center=c)
                .set_fill(color=[TEAL, VIOLET], opacity=0.28)
                .set_stroke(width=0)
            )
            vec = mark.vector.copy().rotate(-mark.phi, about_point=c)
            tip = mark.tip.copy().rotate(-mark.phi, about_point=c)
            self.play(Create(mark.circle), GrowFromCenter(mark.axis), FadeIn(mark.origin), run_time=1.0)
            self.add(sweep)
            self.play(FadeIn(vec), FadeIn(tip), run_time=0.25)
            self.play(
                phi.animate.set_value(mark.phi),
                Rotate(vec, mark.phi, about_point=c),
                Rotate(tip, mark.phi, about_point=c),
                Create(mark.arc),
                rate_func=smooth,
                run_time=1.0,
            )
            sweep.clear_updaters()  # freeze it so it scales and moves with the logo
            self.play(DrawBorderThenFill(word, run_time=1.3, lag_ratio=0.08))
            logo = VGroup(mark.circle, mark.axis, mark.origin, mark.arc, sweep, vec, tip, word)

        with self.beat("title") as T:
            lat = Lattice(data["layout"], s=0.92)
            lat.set_z_index(-5)
            # A translucent veil keeps the lattice in the background even when checks fire.
            veil = Rectangle(width=16, height=10).set_fill(BG, opacity=1).set_stroke(width=0).set_z_index(10)
            title = TX(r"Below Threshold", size=96)
            sub = TX(r"\textit{factoring with a quantum computer, and keeping it alive}", size=36, color=MUTED).next_to(title, DOWN, buff=0.35)
            self.add(lat, veil)
            title.set_z_index(20)
            sub.set_z_index(20)
            logo.set_z_index(20)
            self.play(
                AnimationGroup(logo.animate.scale(0.32).to_corner(UP + np.array([-1, 0, 0]), buff=0.45)),
                veil.animate.set_fill(opacity=0.72),
                run_time=1.2,
            )
            self.play(Write(title), FadeIn(sub, shift=0.15 * UP), run_time=1.6)
            frames = data["frames"]
            per = max(0.55, (T - 3.4) / len(frames))
            prev: list[int] = []
            for f in frames:
                anims = lat.fire([i for i in prev if i not in f], on=False) + lat.fire([i for i in f if i not in prev], on=True)
                if anims:
                    self.play(*anims, run_time=per * 0.45)
                self.wait(per * 0.55)
                prev = f
            self.play(FadeOut(VGroup(lat, title, sub, logo)), veil.animate.set_fill(opacity=1), run_time=0.6)
