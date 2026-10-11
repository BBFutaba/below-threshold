"""Chapter 4: Shor's algorithm, end to end, factoring 21 with a = 2 on a 7-qubit input register.

From media/data/film/shor.json (scripts/film/shor.ts, register-level exact states from
src/core/shor.ts): f(x) = 2^x mod 21 for x < 128; the measured output value 8 and the comb it
leaves; the exact QFT distribution of that comb; the measured k = 21; and the post-processing
(convergents 0/1, 1/6; r = 6; 2^3 = 8; gcd(7, 21) = 7, gcd(9, 21) = 3). The two measurements are
seeded draws from the exact distributions (seed recorded in the JSON).
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
    FadeIn,
    FadeOut,
    Indicate,
    LaggedStart,
    Line,
    ReplacementTransform,
    RoundedRectangle,
    SurroundingRectangle,
    TransformFromCopy,
    UpdateFromAlphaFunc,
    VGroup,
    Write,
    smooth,
)

from common import AMBER, BG, BLUE, FAINT, GREEN, MUTED, SURFACE2, TEXT, VIOLET
from film import MX, TX, YELLOW, NarratedScene, load
from parity import Cued
from shorkit import Bars, lerp_values

VALUE_COLORS = ["#4EA8FF", "#3DD6C6", "#A68BFF", "#FFB547", "#FF6F61", "#5BD68A"]


def register(n: int, label: str, x: float, y: float, width: float) -> VGroup:
    box = RoundedRectangle(width=width, height=1.05, corner_radius=0.14).set_fill(SURFACE2, opacity=1).set_stroke(FAINT, width=2)
    qs = VGroup(*[Circle(radius=0.13).set_stroke(TEXT, width=2.2).set_fill(BG, opacity=1) for _ in range(n)]).arrange(RIGHT, buff=0.16)
    lab = TX(label, size=26, color=MUTED)
    g = VGroup(box, qs, lab)
    box.move_to([x, y, 0])
    qs.move_to(box.get_center() + UP * 0.17)
    lab.move_to(box.get_center() + DOWN * 0.27)
    g.box, g.qs, g.lab = box, qs, lab
    return g


class ShorScene(Cued, NarratedScene):
    scene_id = "shor"

    def construct(self):
        D = load("film/shor")
        N, a, t, Q, r = D["N"], D["a"], D["t"], D["Q"], D["r"]
        f, v, k = D["f"], D["v"], D["k"]
        post = D["post"]
        assert (v, k, r) == (8, 21, 6) and post["factors"] == [3, 7]
        vals = sorted({x["v"] for x in D["values"]})
        color_of = {val: VALUE_COLORS[i % len(VALUE_COLORS)] for i, val in enumerate([1, 2, 4, 8, 16, 11])}
        self.chapter_card()

        bars = Bars([0.0] * Q, width=11.6, height=1.85, gap=0.12, color=BLUE).move_to([0, -1.9, 0])
        state = {"vals": [0.0] * Q, "vmax": 1.0 / Q}

        def morph(to_vals, to_vmax, colors=None, run_time=1.2, extra=()):
            a0, m0 = list(state["vals"]), state["vmax"]

            def upd(m, al):
                m.set_values(lerp_values(a0, to_vals, al), colors=colors, vmax=m0 + (to_vmax - m0) * al)

            self.play(UpdateFromAlphaFunc(bars, upd), *extra, run_time=run_time, rate_func=smooth)
            state["vals"], state["vmax"] = list(to_vals), to_vmax

        # ------------------------------------------------------------ registers
        with self.cued("registers") as T:
            title = MX(rf"N = {N}", r",\quad", rf"a = {a}", size=46).move_to([0, 3.1, 0])
            inp = register(t, rf"input register: $x = 0 \dots {Q - 1}$", -2.6, 1.8, 4.2)
            out = register(D["m"], rf"output register: ${a}^x \bmod {N}$", 2.9, 1.8, 3.8)
            self.play(Write(title), run_time=1.0)
            self.wait_to(self.cue("Two registers"))
            self.play(FadeIn(inp, shift=0.2 * UP), run_time=0.8)
            self.wait_to(self.cue("the other will hold"))
            self.play(FadeIn(out, shift=0.2 * UP), run_time=0.8)
            self.add(bars)

        # ------------------------------------------------------------ superpose
        with self.cued("superpose") as T:
            hs = VGroup(*[MX("H", size=22, color=VIOLET).move_to(c.get_center()) for c in inp.qs])
            self.play(LaggedStart(*[FadeIn(h, scale=1.6) for h in hs], lag_ratio=0.1), run_time=0.8)
            self.play(FadeOut(hs), *[c.animate.set_fill(VIOLET, opacity=0.6) for c in inp.qs], run_time=0.4)
            morph([1 / Q] * Q, 1 / Q, run_time=1.4)
            xs = VGroup(*[MX(str(x), size=20, color=FAINT).move_to([bars.x_of(x), bars.base[1] - 0.2, 0]) for x in range(0, Q, 16)])
            cap = TX(rf"every $x$ at once, each with chance $1/{Q}$", size=28, color=MUTED).move_to([0, -2.95, 0])
            self.play(FadeIn(xs), FadeIn(cap), run_time=0.6)

        # ------------------------------------------------------------ compute
        with self.cued("compute") as T:
            cols = [color_of[f[x]] for x in range(Q)]
            seqtxt = VGroup(*[MX(str(f[x]), size=28, color=color_of[f[x]]) for x in range(8)] + [MX(r"\dots", size=28, color=MUTED)]).arrange(RIGHT, buff=0.28)
            head = MX(rf"{a}^x \bmod {N}:", size=28, color=MUTED)
            line = VGroup(head, seqtxt).arrange(RIGHT, buff=0.3).move_to([0, -2.95, 0])
            self.play(FadeOut(cap), run_time=0.3)
            morph([1 / Q] * Q, 1 / Q, colors=cols, run_time=1.2, extra=[*[c.animate.set_fill(AMBER, opacity=0.6) for c in out.qs]])
            self.play(FadeIn(line, shift=0.1 * UP), run_time=0.8)
            self.wait_to(self.cue("entangled"))
            ent = TX(r"entangled", size=30, color=YELLOW).move_to([0.25, 1.8, 0])
            link = Line(inp.box.get_right(), out.box.get_left()).set_stroke(YELLOW, width=3)
            self.play(Create(link), FadeIn(ent), run_time=0.8)

        # ------------------------------------------------------------ measure
        with self.cued("measure") as T:
            meas = MX(rf"{v}", size=48, color=color_of[v]).move_to(out.qs.get_center())
            self.wait_to(self.cue("see eight"))
            self.play(FadeOut(out.qs), FadeIn(meas, scale=1.5), FadeOut(link), FadeOut(ent), run_time=0.7)
            teeth = D["comb"]
            comb_vals = [1 / len(teeth) if x in teeth else 0.0 for x in range(Q)]
            self.wait_to(self.cue("Every x that does not give eight vanishes"))
            morph(comb_vals, 1 / len(teeth), colors=[color_of[v]] * Q, run_time=1.4, extra=[FadeOut(line)])
            b = Brace(VGroup(*[bars.rects[teeth[i]] for i in (0, 1)]), UP, buff=0.12, color=YELLOW)
            bl = MX(rf"{teeth[1] - teeth[0]}", size=36, color=YELLOW).next_to(b, UP, buff=0.08)
            ct = TX(rf"teeth at ${teeth[0]}, {teeth[1]}, {teeth[2]}, \dots$: exactly {teeth[1] - teeth[0]} apart", size=28, color=MUTED).move_to([0, -2.95, 0])
            self.wait_to(self.cue("teeth exactly six apart"))
            self.play(Create(b), Write(bl), FadeIn(ct), run_time=0.9)
            self.brace = VGroup(b, bl, ct)

        # ------------------------------------------------------------ transform
        with self.cued("transform") as T:
            qft = D["qft"]
            self.play(FadeOut(self.brace), run_time=0.4)
            qft_lab = TX(r"quantum Fourier transform", size=30, color=VIOLET).move_to([-2.6, 0.75, 0])
            self.play(FadeIn(qft_lab), *[c.animate.set_fill(VIOLET, opacity=0.9) for c in inp.qs], run_time=0.6)
            morph(qft, max(qft), colors=[YELLOW] * Q, run_time=1.8)
            marks = VGroup(*[DashedLine([bars.x_of(j * Q / r), bars.base[1], 0], [bars.x_of(j * Q / r), bars.base[1] + 2.0, 0], dash_length=0.07).set_stroke(AMBER, width=2) for j in range(r)])
            ml = TX(rf"multiples of ${Q}/{r} \approx {Q / r:.1f}$", size=28, color=AMBER).move_to([0, -2.95, 0])
            self.wait_to(self.cue("near multiples"))
            self.play(Create(marks), FadeIn(ml), run_time=0.9)
            self.marks = VGroup(marks, ml, qft_lab)

        # ------------------------------------------------------------ read
        with self.cued("read") as T:
            self.wait_to(self.cue("we get twenty one"))
            hl = SurroundingRectangle(bars.rects[k], buff=0.05, color=TEXT, stroke_width=3)
            kl = MX(rf"k = {k}", size=40).next_to(hl, UP, buff=0.12)
            kin = MX(rf"{k}", size=40).move_to(inp.qs.get_center())
            self.play(Create(hl), Write(kl), FadeOut(inp.qs), FadeIn(kin, scale=1.5), FadeOut(self.marks[1]), run_time=0.9)
            frac = MX(rf"\tfrac{{{k}}}{{{Q}}}", "=", rf"{k / Q:.4f}\ldots", r"\approx", r"\tfrac{1}{6}", size=44).move_to([-1.6, -2.95, 0])
            self.wait_to(self.cue("over one hundred twenty eight"))
            self.play(Write(VGroup(*frac[:3])), run_time=1.0)
            self.wait_to(self.cue("very close to one sixth"))
            self.play(Write(VGroup(*frac[3:])), run_time=0.8)
            cf = TX(r"continued fraction: " + ", ".join(rf"${c['p']}/{c['q']}$" for c in post["convergents"]), size=28, color=MUTED).move_to([3.6, -2.95, 0])
            self.wait_to(self.cue("A continued fraction"))
            self.play(FadeIn(cf, shift=0.1 * UP), run_time=0.8)
            self.wait_to(self.cue("its six is the period"))
            rr = MX(rf"r = {post['r']}", size=48, color=YELLOW).move_to([5.4, 0.7, 0])
            box6 = SurroundingRectangle(frac[4], buff=0.08, color=YELLOW)
            self.play(Create(box6), TransformFromCopy(frac[4], rr), run_time=1.0)
            self.read_group = VGroup(hl, kl, frac, cf, box6, self.marks[0], self.marks[2])
            self.rr = rr

        # ------------------------------------------------------------ factors
        with self.cued("factors") as T:
            half = post["half"]
            self.play(FadeOut(self.read_group), FadeOut(bars), FadeOut(xs), self.rr.animate.move_to([-4.6, -0.2, 0]), run_time=0.8)
            l1 = MX(rf"{a}^{{{post['r'] // 2}}} = {half}", size=56).move_to([0.4, 0.2, 0])
            g1 = MX(rf"\gcd({half} - 1,\, {N}) = {math.gcd(half - 1, N)}", size=50).move_to([-2.7, -1.2, 0])
            g2 = MX(rf"\gcd({half} + 1,\, {N}) = {math.gcd(half + 1, N)}", size=50).move_to([3.0, -1.2, 0])
            res = MX(rf"{N} = {post['factors'][0]} \times {post['factors'][1]}", size=80, color=GREEN).move_to([0.2, -2.7, 0])
            self.wait_to(self.cue("Two to the three"))
            self.play(Write(l1), run_time=0.9)
            self.wait_to(self.cue("Seven and nine"))
            self.play(Write(g1), Write(g2), run_time=1.3)
            self.wait_to(self.cue("Twenty one is three times seven"))
            self.play(Write(res), run_time=1.0)
            self.wait(max(0.1, T - self.now() - 0.7))
            self.play(*[FadeOut(m) for m in self.mobjects], run_time=0.6)


_ = (DOWN, LEFT, RIGHT, Indicate, ReplacementTransform, GREEN, np)
