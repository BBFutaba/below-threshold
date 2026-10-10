"""Chapter 5: noise ruins the answer.

From media/data/film/noise.json (scripts/film/noise.ts): the gate-level circuit for N = 15,
a = 7 on 10 qubits (36 steps), run 200 times at error rates 0, 0.1%, 1% and 5% per qubit per
step with noisyShor (seeded). The histograms are the real counts and the "on a peak" numbers
the real fractions. The final beat turns one qubit into the real d = 5 surface-code layout.
"""

from __future__ import annotations

import math

import numpy as np
from manim import (
    DOWN,
    LEFT,
    RIGHT,
    UP,
    Brace,
    Circle,
    Create,
    DashedLine,
    Dot,
    FadeIn,
    FadeOut,
    GrowFromCenter,
    Indicate,
    Line,
    Rectangle,
    ReplacementTransform,
    UpdateFromAlphaFunc,
    ValueTracker,
    VGroup,
    Write,
    always_redraw,
    smooth,
)

from common import AMBER, BG, BLUE, CORAL, FAINT, GREEN, Lattice, MUTED, TEXT
from film import MX, TX, YELLOW, NarratedScene, load
from parity import Cued
from shorkit import Bars, lerp_values


class NoiseScene(Cued, NarratedScene):
    scene_id = "noise"

    def construct(self):
        D = load("film/noise")
        runs = D["runs"]
        Q = D["Q"]
        assert [r_["p"] for r_ in runs] == [0, 0.001, 0.01, 0.05] and runs[0]["peak"] == 1
        self.chapter_card()

        bars = Bars([0.0] * Q, width=8.6, height=2.6, gap=0.2, color=YELLOW).move_to([-1.6, -1.2, 0])
        vmax = max(max(r_["counts"]) for r_ in runs)
        state = {"vals": [0.0] * Q}
        peak = ValueTracker(0.0)

        def morph(counts, run_time=1.2):
            a0 = list(state["vals"])

            def upd(m, al):
                m.set_values(lerp_values(a0, counts, al), vmax=vmax)

            return UpdateFromAlphaFunc(bars, upd, run_time=run_time, rate_func=smooth), counts

        # Meter: fraction of runs that landed on a peak.
        mx, my0, mh = 5.0, -1.2, 2.6
        track = Rectangle(width=0.6, height=mh).set_stroke(FAINT, width=2).set_fill(BG, opacity=1).move_to([mx, my0 + mh / 2, 0])
        fill = always_redraw(lambda: Rectangle(width=0.6, height=max(1e-3, mh * peak.get_value())).set_stroke(width=0).set_fill(GREEN if peak.get_value() > 0.5 else (AMBER if peak.get_value() > 0.2 else CORAL), opacity=0.9).move_to([mx, my0 + mh * peak.get_value() / 2, 0]))
        chance = DashedLine([mx - 0.45, my0 + mh * D["chance"], 0], [mx + 0.45, my0 + mh * D["chance"], 0], dash_length=0.06).set_stroke(CORAL, width=2.5)
        chance_l = TX(r"pure chance", size=22, color=CORAL).next_to(chance, RIGHT, buff=0.12)
        pct_l = always_redraw(lambda: MX(rf"{100 * peak.get_value():.0f}\%", size=40).next_to(track, UP, buff=0.15))
        meter_l = TX(r"runs on a peak", size=26, color=MUTED).next_to(track, DOWN, buff=0.2)

        # ------------------------------------------------------------ perfect
        with self.cued("perfect") as T:
            title = TX(rf"factoring {D['N']} on {D['qubits']} simulated qubits, {D['steps']} steps", size=32, color=MUTED).move_to([0, 3.0, 0])
            self.play(FadeIn(title), run_time=0.7)
            self.add(bars)
            xs = VGroup(*[MX(str(x), size=22, color=FAINT).move_to([bars.x_of(x), bars.base[1] - 0.22, 0]) for x in range(0, Q, 16)])
            self.wait_to(self.cue("That was a perfect machine"))
            an, c = morph(runs[0]["counts"], 1.3)
            self.play(an, FadeIn(xs), run_time=1.3)
            state["vals"] = c
            plab = MX(r"p = 0", size=40).move_to([-1.6, 1.9, 0])
            self.play(FadeIn(track), FadeIn(meter_l), FadeIn(chance), FadeIn(chance_l), Write(plab), run_time=0.8)
            self.add(fill, pct_l)
            self.play(peak.animate.set_value(runs[0]["peak"]), run_time=0.8)
            self.wait_to(self.cue("a small chance of a random error"))
            err = TX(r"after every step, each qubit: random $X$, $Y$ or $Z$ with probability $p$", size=28, color=CORAL).move_to([0, 2.45, 0])
            self.play(FadeIn(err, shift=0.1 * DOWN), run_time=0.8)

        # ------------------------------------------------------------ blur
        with self.cued("blur") as T:
            labels = {1: r"p = 0.1\%", 2: r"p = 1\%", 3: r"p = 5\%"}
            cues = {1: "one error in a thousand", 2: "one in a hundred", 3: "five in a hundred"}
            for i in (1, 2, 3):
                self.wait_to(self.cue(cues[i]))
                an, c = morph(runs[i]["counts"], 1.2)
                new = MX(labels[i], size=40).move_to(plab)
                self.play(an, ReplacementTransform(plab, new), peak.animate.set_value(runs[i]["peak"]), run_time=1.2)
                plab = new
                state["vals"] = c
            self.wait_to(self.cue("random number generator"))
            rng_l = TX(r"a random number generator", size=34, color=CORAL).move_to([-1.6, 1.25, 0])
            self.play(Write(rng_l), Indicate(chance, color=CORAL), run_time=1.0)
            self.blur_group = VGroup(bars, xs, title, err, plab, rng_l, track, chance, chance_l, meter_l)

        # ------------------------------------------------------------ scale
        with self.cued("scale") as T:
            fill.clear_updaters()
            pct_l.clear_updaters()
            self.play(FadeOut(self.blur_group), FadeOut(fill), FadeOut(pct_l), run_time=0.7)
            # A log scale of error per operation, 10^-1 (left) to 10^-13 (right).
            x0, x1, y = -5.6, 5.6, -0.4
            axis = Line([x0, y, 0], [x1, y, 0]).set_stroke(FAINT, width=3)

            def xp(e):
                return x0 + (e - 1) / 12 * (x1 - x0)

            ticks = VGroup()
            for e in range(1, 14, 2):
                ticks.add(Line([xp(e), y - 0.1, 0], [xp(e), y + 0.1, 0]).set_stroke(FAINT, width=2))
                ticks.add(MX(rf"10^{{-{e}}}", size=28, color=MUTED).move_to([xp(e), y - 0.45, 0]))
            head = TX(r"errors per operation", size=30, color=MUTED).move_to([0, y - 1.1, 0])
            self.play(Create(axis), FadeIn(ticks), FadeIn(head), run_time=1.0)
            big = TX(r"breaking RSA: about a million qubits, running for days", size=32).move_to([0, 2.6, 0])
            self.wait_to(self.cue("Breaking real encryption"))
            self.play(FadeIn(big, shift=0.1 * DOWN), run_time=0.8)
            need = Dot([xp(12), y, 0], radius=0.14, color=GREEN)
            need_l = TX(r"needed: about $10^{-12}$", size=30, color=GREEN).next_to(need, UP, buff=0.3)
            self.wait_to(self.cue("about once in a trillion"))
            self.play(GrowFromCenter(need), FadeIn(need_l), run_time=0.8)
            now = Dot([xp(3), y, 0], radius=0.14, color=CORAL)
            now_l = TX(r"best qubits today: about $10^{-3}$", size=30, color=CORAL).next_to(now, UP, buff=0.3)
            self.wait_to(self.cue("The best qubits today"))
            self.play(GrowFromCenter(now), FadeIn(now_l), run_time=0.8)
            gap = Brace(Line([xp(3), y, 0], [xp(12), y, 0]), DOWN, buff=0.75, color=YELLOW)
            gap_l = TX(r"a billion times too noisy", size=32, color=YELLOW).next_to(gap, DOWN, buff=0.12)
            self.play(FadeOut(head), Create(gap), FadeIn(gap_l), run_time=1.0)
            self.scale_group = VGroup(axis, ticks, big, need, need_l, gap, gap_l, now_l)
            self.now_dot = now

        # ------------------------------------------------------------ bridge
        with self.cued("bridge") as T:
            self.play(FadeOut(self.scale_group), self.now_dot.animate.move_to([0, 0.2, 0]).scale(1.4), run_time=0.9)
            one = Circle(radius=0.22).set_stroke(TEXT, width=3).set_fill(BG, opacity=1).move_to([0, 0.2, 0])
            self.play(ReplacementTransform(self.now_dot, one), run_time=0.5)
            lat = Lattice(D["layout"], s=0.78, center=np.array([0, 0.2, 0]))
            self.wait_to(self.cue("we build better ones out of many imperfect ones"))
            self.play(ReplacementTransform(one, lat.qubits[lat.lay["n"] // 2]), FadeIn(lat.tiles), FadeIn(VGroup(*[q for i, q in enumerate(lat.qubits) if i != lat.lay["n"] // 2]), scale=0.4), run_time=1.6)
            qec = TX(r"\textbf{quantum error correction}", size=50, color=YELLOW).move_to([0, -3.0, 0])
            self.wait_to(self.cue("That is quantum error correction"))
            self.play(Write(qec), run_time=1.2)
            self.wait(max(0.1, T - self.now() - 0.7))
            self.play(*[FadeOut(m) for m in self.mobjects], run_time=0.6)


_ = (BLUE, DOWN, LEFT, RIGHT, UP, math, Indicate)
