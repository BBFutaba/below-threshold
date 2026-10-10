"""Chapter 2: factoring is a hunt for rhythm.

From media/data/film/period.json (scripts/film/period.ts):
- two real 50-digit primes (seeded Miller-Rabin search) and their 100-digit product;
- 7^x mod 15 for x = 0..12, its period r = 4, and the recipe 7^2 = 4, gcd(3, 15) = 3,
  gcd(5, 15) = 5 (computed with shor.ts);
- 2^x mod 3127 (= 53 x 59) for x < 3200, whose period is 1508.
"""

from __future__ import annotations

import numpy as np
from manim import (
    DOWN,
    LEFT,
    RIGHT,
    UP,
    Arrow,
    Brace,
    Create,
    Dot,
    FadeIn,
    FadeOut,
    Indicate,
    LaggedStart,
    Line,
    Rectangle,
    ReplacementTransform,
    TransformFromCopy,
    VGroup,
    Write,
)

from common import AMBER, BLUE, CORAL, FAINT, GREEN, MUTED, TEAL, TEXT, VIOLET
from film import MX, TX, YELLOW, NarratedScene, load
from parity import Cued, dim


def digits_block(s: str, per_line: int = 25, size: float = 30, color: str = TEXT) -> VGroup:
    lines = [s[i : i + per_line] for i in range(0, len(s), per_line)]
    g = VGroup(*[TX(r"\texttt{" + ln + "}", size=size, color=color) for ln in lines]).arrange(DOWN, buff=0.08, aligned_edge=LEFT)
    return g


class Plot(VGroup):
    """Axes for a^x mod N with dots; x from 0 to xmax, y from 0 to N."""

    def __init__(self, xmax: int, N: int, W: float = 10.5, H: float = 3.6, origin=(-5.4, -1.9), **kw):
        super().__init__(**kw)
        self.xmax, self.N, self.W, self.H = xmax, N, W, H
        self.o = np.array([origin[0], origin[1], 0.0])
        self.xax = Line(self.o, self.o + RIGHT * W).set_stroke(FAINT, width=2)
        self.yax = Line(self.o, self.o + UP * H).set_stroke(FAINT, width=2)
        self.add(self.xax, self.yax)

    def p(self, x: float, y: float) -> np.ndarray:
        return self.o + np.array([x / self.xmax * self.W, y / self.N * self.H, 0.0])


class PeriodScene(Cued, NarratedScene):
    scene_id = "period"

    def construct(self):
        D = load("film/period")
        N, a, seq, r = D["N"], D["a"], D["seq"], D["r"]
        assert seq[r] == 1 and all(v != 1 for v in seq[1:r])
        self.chapter_card()

        # ------------------------------------------------------------ rsa
        with self.cued("rsa") as T:
            p = digits_block(D["primes"]["p"], size=30)
            q = digits_block(D["primes"]["q"], size=30)
            times = MX(r"\times", size=48)
            top = VGroup(p, times, q).arrange(RIGHT, buff=0.35).move_to([0, 2.3, 0])
            prod = digits_block(D["primes"]["product"], per_line=34, size=30).move_to([0, -0.9, 0])
            easy = Arrow(top.get_bottom() + DOWN * 0.1, prod.get_top() + UP * 0.1, buff=0.05, color=GREEN, stroke_width=6).shift(LEFT * 1.4)
            easy_l = TX(r"easy: a fraction of a second", size=28, color=GREEN).next_to(easy, LEFT, buff=0.2)
            self.play(FadeIn(p, shift=0.2 * RIGHT), FadeIn(q, shift=0.2 * LEFT), Write(times), run_time=1.2)
            self.play(Create(easy), FadeIn(easy_l), run_time=0.7)
            self.play(LaggedStart(*[Write(ln) for ln in prod], lag_ratio=0.25), run_time=1.2)
            self.wait_to(self.cue("Undoing the multiplication"))
            hard = Arrow(prod.get_top() + UP * 0.1, top.get_bottom() + DOWN * 0.1, buff=0.05, color=CORAL, stroke_width=6).shift(RIGHT * 1.4)
            hard_l = TX(r"hard: no known fast method", size=28, color=CORAL).next_to(hard, RIGHT, buff=0.2)
            qm = MX("?", size=60, color=CORAL).next_to(hard, RIGHT, buff=0.1).shift(UP * 0.55)
            self.play(Create(hard), FadeIn(hard_l), run_time=0.8)
            self.play(FadeIn(qm, scale=1.4), run_time=0.4)
            self.wait_to(self.cue("RSA"))
            rsa = TX(r"\textbf{RSA}: security rests on this gap", size=36, color=YELLOW).move_to([0, -2.8, 0])
            self.play(Write(rsa), run_time=1.0)
            note = TX(r"\textit{two real 50-digit primes; the product has 100 digits (RSA uses about 600)}", size=22, color=FAINT).to_corner(DOWN + RIGHT, buff=0.3)
            self.play(FadeIn(note), run_time=0.5)
            self.rsa_group = VGroup(top, prod, easy, easy_l, hard, hard_l, qm, rsa, note)

        # ------------------------------------------------------------ powers
        with self.cued("powers") as T:
            self.play(FadeOut(self.rsa_group), run_time=0.7)
            xmax = len(seq) - 1
            plot = Plot(xmax, N - 1)
            ylab = VGroup(
                MX("1", size=28, color=MUTED).next_to(plot.p(0, 1), LEFT, buff=0.15),
                MX(str(N - 1), size=28, color=MUTED).next_to(plot.p(0, N - 1), LEFT, buff=0.15),
            )
            one = Line(plot.p(0, 1), plot.p(xmax, 1)).set_stroke(GREEN, width=1.5, opacity=0.6)
            title = MX(rf"{a}^x \bmod {N}", size=46).move_to([3.4, 2.85, 0])
            self.play(Create(plot), FadeIn(ylab), Create(one), run_time=1.0)
            self.wait_to(self.cue("take its powers"))
            self.play(Write(title), run_time=0.9)
            dots, labs, xs = VGroup(), VGroup(), VGroup()
            for x, v in enumerate(seq):
                dots.add(Dot(plot.p(x, v), radius=0.09, color=GREEN if v == 1 else BLUE))
                labs.add(MX(str(v), size=30, color=GREEN if v == 1 else TEXT).move_to([plot.p(x, 0)[0], -2.55, 0]))
                xs.add(MX(str(x), size=22, color=FAINT).move_to([plot.p(x, 0)[0], -2.05, 0]))
            xlab = MX("x", size=28, color=MUTED).next_to(xs, RIGHT, buff=0.25)
            self.play(FadeIn(xs), FadeIn(xlab), run_time=0.5)
            # "one, seven, four, thirteen, and then one again": the first five, on their words.
            words = ["one, seven", "seven, four", "four, thirteen", "thirteen, and then", "one again"]
            for x in range(5):
                self.wait_to(self.cue(words[x]) + (0.25 if x == 0 else 0))
                self.play(FadeIn(dots[x], scale=1.6), FadeIn(labs[x], shift=0.1 * UP), run_time=0.35)
            path = VGroup(*[Line(dots[i].get_center(), dots[i + 1].get_center()).set_stroke(FAINT, width=1.5) for i in range(len(seq) - 1)]).set_z_index(-1)
            self.play(
                LaggedStart(*[FadeIn(dots[x], scale=1.6) for x in range(5, len(seq))], lag_ratio=0.25),
                LaggedStart(*[FadeIn(labs[x]) for x in range(5, len(seq))], lag_ratio=0.25),
                Create(path),
                run_time=1.1,
            )
            self.plot, self.dots, self.labs = plot, dots, labs

        # ------------------------------------------------------------ period
        with self.cued("period") as T:
            bands = VGroup()
            for k in range(xmax // r):
                x0, x1 = plot.p(k * r, 0)[0], plot.p((k + 1) * r, 0)[0]
                band = Rectangle(width=x1 - x0, height=plot.H).set_stroke(width=0).set_fill(VIOLET if k % 2 == 0 else TEAL, opacity=0.12)
                band.move_to([(x0 + x1) / 2, plot.o[1] + plot.H / 2, 0]).set_z_index(-2)
                bands.add(band)
            self.play(LaggedStart(*[FadeIn(b) for b in bands], lag_ratio=0.3), run_time=1.2)
            brace = Brace(VGroup(Dot(plot.p(0, N - 1)), Dot(plot.p(r, N - 1))), UP, buff=0.12, color=YELLOW)
            rlab = MX(rf"r = {r}", size=48, color=YELLOW).next_to(brace, UP, buff=0.1)
            self.wait_to(self.cue("Call that the period"))
            self.play(Create(brace), Write(rlab), run_time=1.0)
            self.period_group = VGroup(bands, brace, rlab)

        # ------------------------------------------------------------ recipe
        with self.cued("recipe") as T:
            keep = VGroup(rlab)
            self.play(FadeOut(VGroup(plot, self.dots, self.labs, bands, brace, title, ylab, one, xs, xlab, path)), rlab.animate.move_to([-4.6, 2.6, 0]), run_time=0.9)
            h = D["half"]
            g1, g2 = D["gcds"]
            l1 = MX(rf"{a}^{{{r}}} \equiv 1 \pmod{{{N}}}", size=46).move_to([0.6, 2.6, 0])
            l2 = MX(rf"{a}^{{{r // 2}}}", "=", rf"{a ** (r // 2)}", r"\equiv", rf"{h}", rf"\pmod{{{N}}}", size=50).move_to([0.6, 1.3, 0])
            l3 = MX(rf"\gcd({h} - 1,\, {N}) = {g1}", size=50).move_to([-2.2, -0.1, 0])
            l4 = MX(rf"\gcd({h} + 1,\, {N}) = {g2}", size=50).move_to([3.0, -0.1, 0])
            l5 = MX(rf"{N} = {g1} \times {g2}", size=72, color=GREEN).move_to([0.4, -2.0, 0])
            self.play(Write(l1), run_time=1.0)
            self.wait_to(self.cue("Seven to the power two"))
            self.play(Write(VGroup(*l2[:3])), run_time=1.0)
            self.wait_to(self.cue("which leaves four"))
            self.play(Write(VGroup(*l2[3:])), run_time=0.9)
            l2[4].set_color(YELLOW)
            self.wait_to(self.cue("Four minus one"))
            self.play(TransformFromCopy(l2[4], l3), run_time=1.0)
            self.wait_to(self.cue("four plus one"))
            self.play(TransformFromCopy(l2[4], l4), run_time=1.0)
            self.wait_to(self.cue("fifteen is three times five"))
            self.play(Write(l5), run_time=1.0)
            self.recipe_group = VGroup(keep, l1, l2, l3, l4, l5)

        # ------------------------------------------------------------ hard
        with self.cued("hard") as T:
            self.play(FadeOut(self.recipe_group), run_time=0.7)
            big = D["big"]
            bseq, br, bN = big["seq"], big["r"], big["N"]
            xmax2 = len(bseq) - 1
            plot2 = Plot(xmax2, bN - 1, origin=(-5.4, -2.2))
            pts = [plot2.p(x, v) for x, v in enumerate(bseq)]
            cloud = VGroup(*[Dot(p_, radius=0.012, color=BLUE) for p_ in pts])
            ttl = MX(rf"{big['a']}^x \bmod {bN}", r"\qquad", rf"({bN} = 53 \times 59)", size=40).move_to([-1.2, 2.85, 0])
            ttl[2].set_color(MUTED)
            self.play(Create(plot2), Write(ttl), run_time=1.0)
            self.play(FadeIn(cloud, lag_ratio=0.0005), run_time=2.2)
            b0, b1 = plot2.p(0, bN - 1), plot2.p(br, bN - 1)
            brace = Brace(VGroup(Dot(b0), Dot(b1)), UP, buff=0.1, color=YELLOW)
            rl = MX(rf"r = {br}", size=44, color=YELLOW).next_to(brace, UP, buff=0.08)
            band = Rectangle(width=b1[0] - b0[0], height=plot2.H).set_stroke(width=0).set_fill(VIOLET, opacity=0.12).move_to([(b0[0] + b1[0]) / 2, plot2.o[1] + plot2.H / 2, 0]).set_z_index(-2)
            self.play(FadeIn(band), Create(brace), Write(rl), run_time=1.1)
            self.wait_to(self.cue("hundreds of digits long too"))
            note = TX(r"a four-digit $N$ already has a four-digit period; for RSA, $r$ can run to hundreds of digits", size=28, color=MUTED).move_to([0, -2.85, 0])
            self.play(FadeIn(note, shift=0.1 * UP), run_time=0.8)
            self.wait_to(self.cue("A quantum computer does not walk"))
            self.play(dim(VGroup(plot2, cloud, brace, rl, ttl, note), 0.2), FadeOut(band), run_time=0.7)
            listen = TX(r"It \textbf{listens} for the rhythm.", size=56, color=YELLOW).move_to([0, 0.2, 0])
            self.play(Write(listen), run_time=1.2)
            self.wait(max(0.1, T - self.now() - 0.7))
            self.play(*[FadeOut(m) for m in self.mobjects], run_time=0.6)


_ = (AMBER, DOWN, Indicate, ReplacementTransform)
