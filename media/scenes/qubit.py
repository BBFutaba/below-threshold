"""Chapter 1: arrows, amplitudes and phase.

Every state is read from media/data/film/qubit.json (scripts/film/qubit.ts, QState):
- the superposition Ry(1.1)|0> and its two amplitudes;
- the same state with the |1> amplitude turned through a full circle by P(phi), whose
  probabilities the export checks are unchanged;
- the interference sweep H P(phi) H |0>: the two amplitudes that meet at the second H, and
  P(1) = sin^2(phi/2) read off the state vector;
- three qubits, H on each and qubit q turned by f * 2^q / 8: eight clocks winding f times.
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
    Arrow,
    Create,
    DashedLine,
    FadeIn,
    FadeOut,
    Indicate,
    LaggedStart,
    Line,
    ReplacementTransform,
    UpdateFromAlphaFunc,
    ValueTracker,
    VGroup,
    Write,
    always_redraw,
    smooth,
)

from common import BLUE, CORAL, FAINT, GREEN, MUTED, TEXT
from film import MX, TX, YELLOW, NarratedScene, load
from parity import Cued, Glyph, dim, vec_to
from shorkit import Bars, Clock, phase_color


class QubitScene(Cued, NarratedScene):
    scene_id = "qubit"

    def construct(self):
        D = load("film/qubit")
        th = D["theta"]
        sup = D["superposition"]
        self.chapter_card()

        # ------------------------------------------------------------ arrow
        with self.cued("arrow") as T:
            g = Glyph((0, 1), R=1.55).move_to([-4.0, 0.0, 0])
            k0 = MX(r"|0\rangle", size=44).next_to(g, UP, buff=0.15)
            k1 = MX(r"|1\rangle", size=44).next_to(g, DOWN, buff=0.15)
            self.play(FadeIn(g, scale=0.9), FadeIn(k0), FadeIn(k1), run_time=1.0)
            self.wait_to(self.cue("Straight up means zero"))
            self.play(Indicate(k0, color=BLUE), run_time=0.7)
            self.wait_to(self.cue("straight down means one"))
            self.play(vec_to(g, (0, -1), turn=PI), Indicate(k1, color=BLUE), run_time=0.9)
            self.wait_to(self.cue("anywhere in between"))
            # The real Bloch vector of Ry(theta)|0> in the x-z plane (x right, z up).
            b = sup["bloch"]
            self.play(vec_to(g, (b["x"], b["z"]), turn=-(PI - th)), run_time=1.2, rate_func=smooth)
            blend = MX(r"\alpha", r"|0\rangle", "+", r"\beta", r"|1\rangle", size=52).move_to([2.2, 2.2, 0])
            blend[0].set_color(BLUE)
            blend[3].set_color(BLUE)
            self.wait_to(self.cue("a blend"))
            self.play(Write(blend), run_time=1.2)

        # ------------------------------------------------------------ amplitudes
        with self.cued("amplitudes") as T:
            a0, a1 = sup["amps"]
            R = 0.95
            c0 = Clock(a0["re"], a0["im"], R=R).move_to([0.9, 0.2, 0])
            c1 = Clock(a1["re"], a1["im"], R=R).move_to([3.6, 0.2, 0])
            l0 = MX(r"\alpha", size=40, color=BLUE).next_to(c0, UP, buff=0.18)
            l1 = MX(r"\beta", size=40, color=BLUE).next_to(c1, UP, buff=0.18)
            self.play(FadeIn(c0, scale=0.8), FadeIn(c1, scale=0.8), TransformFromParts(blend, l0, l1), run_time=1.2)
            # Probability bars underneath: |alpha|^2 and |beta|^2 from the state vector.
            bars = Bars([sup["p0"], sup["p1"]], width=3.8, height=1.3, gap=0.45, vmax=1.0).move_to([2.25, -2.15, 0])
            p0l = MX(rf"|\alpha|^2 = {sup['p0']:.2f}", size=34).next_to(bars.rects[0], DOWN, buff=0.22)
            p1l = MX(rf"|\beta|^2 = {sup['p1']:.2f}", size=34).next_to(bars.rects[1], DOWN, buff=0.22)
            p0l.move_to([bars.x_of(0), bars.base[1] - 0.35, 0])
            p1l.move_to([bars.x_of(1), bars.base[1] - 0.35, 0])
            self.wait_to(self.cue("Square them"))
            self.play(FadeIn(bars, shift=0.2 * UP), Write(p0l), Write(p1l), run_time=1.3)
            odds = TX(r"\textit{odds of measuring 0 and 1}", size=28, color=MUTED).next_to(bars, UP, buff=0.12)
            self.play(FadeIn(odds), run_time=0.6)

        # ------------------------------------------------------------ phase
        with self.cued("phase") as T:
            self.play(dim(g, 0.35), dim(VGroup(k0, k1), 0.35), FadeOut(odds), run_time=0.6)
            # "points in a direction": highlight the hands.
            self.wait_to(self.cue("points in a direction"))
            self.play(Indicate(c0.hand, color=YELLOW, scale_factor=1.15), Indicate(c1.hand, color=YELLOW, scale_factor=1.15), run_time=0.9)
            phl = MX(r"\beta \;\to\; \beta\, e^{i\varphi}", size=44).move_to([2.25, 2.35, 0])
            self.wait_to(self.cue("Turn that hand"))
            self.play(Write(phl), run_time=0.8)
            sweep = D["phaseSweep"]
            n = len(sweep) - 1

            def turn(m, a):
                f = a * n
                i = min(int(f), n - 1)
                u = f - i
                s0, s1 = sweep[i]["amps"][1], sweep[i + 1]["amps"][1]
                # Interpolate the angle (both samples have the same size).
                r = math.hypot(s0["re"], s0["im"])
                t0 = math.atan2(s0["im"], s0["re"])
                t1 = math.atan2(s1["im"], s1["re"])
                dt = (t1 - t0 + PI) % (2 * PI) - PI
                ang = t0 + u * dt
                m.set_amp(r * math.cos(ang), r * math.sin(ang))

            same = TX(r"odds unchanged", size=30, color=GREEN).next_to(bars, UP, buff=0.12)
            self.play(UpdateFromAlphaFunc(c1, turn), run_time=max(2.4, T - self.now() - 1.2), rate_func=lambda t: t)
            self.play(FadeIn(same, shift=0.1 * UP), Indicate(bars.rects, color=GREEN, scale_factor=1.03), run_time=0.9)

        # ------------------------------------------------------------ interference
        with self.cued("interference") as T:
            old = VGroup(g, k0, k1, l0, l1, phl, same, p0l, p1l, c0, c1, bars)
            self.play(FadeOut(old), run_time=0.7)
            inter = D["interference"]
            n = len(inter) - 1
            idx = ValueTracker(0.0)

            def at(key):
                f = idx.get_value()
                i = min(int(f), n - 1)
                u = f - i
                a, b2 = inter[i], inter[i + 1]
                if key == "p1":
                    return a["p1"] + u * (b2["p1"] - a["p1"])
                # mid amplitudes: interpolate the angle of the |1> amplitude (both have size 1/sqrt2)
                m0 = a["mid"][0]
                t0 = math.atan2(a["mid"][1]["im"], a["mid"][1]["re"])
                t1 = math.atan2(b2["mid"][1]["im"], b2["mid"][1]["re"])
                dt = (t1 - t0 + PI) % (2 * PI) - PI
                r = math.hypot(a["mid"][1]["re"], a["mid"][1]["im"])
                ang = t0 + u * dt
                return (m0["re"], m0["im"]), (r * math.cos(ang), r * math.sin(ang))

            # Circuit strip: H, P(phi), H.
            wire = Line([-6.2, 2.6, 0], [-1.4, 2.6, 0]).set_stroke(FAINT, width=2)
            boxes = VGroup()
            for x, lab in ((-5.2, "H"), (-3.8, r"P(\varphi)"), (-2.4, "H")):
                box = RoundBox(lab, x, 2.6)
                boxes.add(box)
            k_in = MX(r"|0\rangle", size=36).next_to(wire, LEFT, buff=0.15)
            self.play(Create(wire), FadeIn(boxes), FadeIn(k_in), run_time=0.9)
            # The two amplitudes just before the second H, as clocks.
            R = 0.85
            cA = Clock(1 / math.sqrt(2), 0, R=R, ref=1 / math.sqrt(2)).move_to([-5.0, 0.2, 0])
            cB = Clock(1 / math.sqrt(2), 0, R=R, ref=1 / math.sqrt(2)).move_to([-2.7, 0.2, 0])
            lA = MX(r"\text{path via } |0\rangle", size=28, color=MUTED).next_to(cA, DOWN, buff=0.18)
            lB = MX(r"\text{path via } |1\rangle", size=28, color=MUTED).next_to(cB, DOWN, buff=0.18)
            self.play(FadeIn(cA), FadeIn(cB), FadeIn(lA), FadeIn(lB), run_time=0.8)

            def upd_clocks(m):
                (ar, ai), (br, bi) = at("mid")
                cA.set_amp(ar, ai)
                cB.set_amp(br, bi)

            clocks = VGroup(cA, cB)
            clocks.add_updater(lambda m: upd_clocks(m))

            # Tip-to-tail sum for the |0> output: the second H adds the two hands.
            o = np.array([0.6, 0.2, 0])
            S = 1.55  # screen units per unit amplitude

            def sum_arrows():
                (ar, ai), (br, bi) = at("mid")
                p = o + S * np.array([ar, ai, 0])
                q = p + S * np.array([br, bi, 0])
                g1 = Arrow(o, p, buff=0, stroke_width=6, color=phase_color(ar, ai), max_tip_length_to_length_ratio=0.18)
                g2 = Arrow(p, q, buff=0, stroke_width=6, color=phase_color(br, bi), max_tip_length_to_length_ratio=0.18)
                res = Line(o, q).set_stroke(YELLOW, width=4, opacity=0.9) if np.linalg.norm(q - o) > 1e-3 else Line(o, o + RIGHT * 1e-3).set_stroke(opacity=0)
                return VGroup(res, g1, g2)

            arrows = always_redraw(sum_arrows)
            sum_lab = TX(r"the two hands, added tip to tail: output $|0\rangle$", size=26, color=MUTED).move_to([1.9, -0.75, 0])
            bars = Bars([1.0, 0.0], width=2.6, height=2.6, gap=0.4, vmax=1.0, colors=[BLUE, CORAL]).move_to([5.0, -0.9, 0])
            b0 = MX(r"P(0)", size=30).move_to([bars.x_of(0), bars.base[1] - 0.32, 0])
            b1 = MX(r"P(1)", size=30).move_to([bars.x_of(1), bars.base[1] - 0.32, 0])
            bars.add_updater(lambda m: m.set_values([1 - at("p1"), at("p1")]))
            phi_lab = always_redraw(lambda: MX(rf"\varphi = {math.degrees(inter[min(n, round(idx.get_value()))]['phi']):.0f}^\circ", size=36).move_to([-3.85, 1.65, 0]))
            self.add(clocks, arrows, bars)
            self.play(FadeIn(sum_lab), FadeIn(b0), FadeIn(b1), FadeIn(phi_lab), run_time=0.7)
            self.wait_to(self.cue("hands pointing the same way"))
            self.play(Indicate(arrows, color=GREEN, scale_factor=1.05), run_time=0.8)
            self.wait_to(self.cue("opposite hands cancel") - 1.4)
            self.play(idx.animate.set_value(n), run_time=2.6, rate_func=smooth)
            self.wait_to(self.cue("That is interference"))
            word = TX(r"\textbf{interference}", size=48, color=YELLOW).move_to([1.9, 2.0, 0])
            self.play(Write(word), run_time=0.9)
            self.wait_to(self.cue("an answer you can measure"))
            self.play(Indicate(bars.rects[1], color=CORAL, scale_factor=1.08), run_time=0.9)
            clocks.clear_updaters()
            bars.clear_updaters()
            arrows.clear_updaters()
            phi_lab.clear_updaters()
            self.inter_group = VGroup(wire, boxes, k_in, cA, cB, lA, lB, arrows, sum_lab, bars, b0, b1, phi_lab, word)

        # ------------------------------------------------------------ waves
        with self.cued("waves") as T:
            self.play(FadeOut(self.inter_group), run_time=0.7)
            w1, w2 = D["waves"]
            ref = 1 / math.sqrt(8)
            row = VGroup(*[Clock(a["re"], a["im"], R=0.56, ref=ref) for a in w1["amps"]]).arrange(RIGHT, buff=0.3).move_to([0, 0.4, 0])
            labs = VGroup(*[MX(str(y), size=32, color=MUTED).next_to(c, DOWN, buff=0.2) for y, c in enumerate(row)])
            flab = MX(r"f = 1", size=44).move_to([0, 2.3, 0])
            self.play(LaggedStart(*[FadeIn(c, scale=0.8) for c in row], lag_ratio=0.08), FadeIn(labs), Write(flab), run_time=1.6)
            # Wind from one turn to two: clock y turns by f * y / 8 of a turn as f goes 1 -> 2.
            ft = ValueTracker(1.0)

            def wind(m):
                for y, c in enumerate(m):
                    ang = 2 * PI * ft.get_value() * y / 8
                    c.set_amp(ref * math.cos(ang), ref * math.sin(ang))

            row.add_updater(wind)
            self.wait_to(self.cue("like a wave"))
            self.play(ft.animate.set_value(2.0), run_time=2.0, rate_func=smooth)
            row.clear_updaters()
            for c, a in zip(row, w2["amps"]):
                c.set_amp(a["re"], a["im"])  # land exactly on the exported f = 2 state
            self.play(ReplacementTransform(flab, MX(r"f = 2", size=44).move_to(flab)), run_time=0.5)
            self.wait_to(self.cue("the language of the quantum Fourier transform"))
            qft_t = TX(r"the language of the \textbf{quantum Fourier transform}", size=40).move_to([0, -2.1, 0])
            self.play(Write(qft_t), run_time=1.3)
            self.wait_to(self.cue("the engine of Shor"))
            sub = TX(r"\textit{the engine of Shor's algorithm}", size=32, color=MUTED).next_to(qft_t, DOWN, buff=0.25)
            self.play(FadeIn(sub, shift=0.1 * UP), run_time=0.8)
            self.wait(max(0.1, T - self.now() - 0.7))
            self.play(*[FadeOut(m) for m in self.mobjects], run_time=0.6)


def RoundBox(tex: str, x: float, y: float):
    from manim import RoundedRectangle

    t = MX(tex, size=32)
    w = max(0.62, t.width + 0.32)
    box = RoundedRectangle(width=w, height=0.62, corner_radius=0.1).set_fill("#232A43", opacity=1).set_stroke("#A68BFF", width=2)
    return VGroup(box, t).move_to([x, y, 0])


def TransformFromParts(blend, l0, l1):
    """alpha and beta lift out of 'alpha|0> + beta|1>' to label the two clocks; the rest fades."""
    from manim import AnimationGroup, TransformFromCopy

    return AnimationGroup(TransformFromCopy(blend[0], l0), TransformFromCopy(blend[3], l1), FadeOut(blend))


__all__ = ["QubitScene"]
_ = (DashedLine, LEFT, TEXT, DOWN)
