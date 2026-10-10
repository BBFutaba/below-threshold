"""Chapter 2: many qubits, and entanglement.

From media/data/film/entangle.json (scripts/film/entangle.ts, QState): two qubits' four
amplitudes at |00>, after H on qubit 0 and after the CNOT; 100 seeded shots of the Bell pair
(only 00 and 11 appear); each qubit's Bloch length (1, then 0 for the Bell pair); and the
eight-clock waves of three qubits.
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
    Brace,
    Circle,
    Create,
    Dot,
    FadeIn,
    FadeOut,
    Indicate,
    LaggedStart,
    Line,
    ReplacementTransform,
    RoundedRectangle,
    Square,
    UpdateFromAlphaFunc,
    ValueTracker,
    VGroup,
    Write,
    smooth,
)

from common import BLUE, CORAL, FAINT, GREEN, MUTED, SURFACE3, TEXT, VIOLET
from film import MX, TX, YELLOW, NarratedScene, load
from parity import Cued, Glyph, vec_to
from shorkit import Bars, Clock


def box(label: str, x: float, y: float) -> VGroup:
    t = MX(label, size=30)
    b = RoundedRectangle(width=max(0.62, t.width + 0.3), height=0.6, corner_radius=0.1).set_fill(SURFACE3, opacity=1).set_stroke(VIOLET, width=2)
    return VGroup(b, t).move_to([x, y, 0])


class EntangleScene(Cued, NarratedScene):
    scene_id = "entangle"

    def construct(self):
        D = load("film/entangle")
        labels = D["labels"]
        st = D["stages"]
        self.chapter_card()

        # ------------------------------------------------------------ two
        with self.cued("two") as T:
            g0 = Glyph((0, 1), R=0.85).move_to([-5.0, 0.9, 0])
            g1 = Glyph((0, 1), R=0.85).move_to([-2.9, 0.9, 0])
            n0 = MX("q_0", size=34, color=MUTED).next_to(g0, DOWN, buff=0.2)
            n1 = MX("q_1", size=34, color=MUTED).next_to(g1, DOWN, buff=0.2)
            self.play(FadeIn(g0, scale=0.9), FadeIn(g1, scale=0.9), FadeIn(n0), FadeIn(n1), run_time=1.0)
            self.wait_to(self.cue("the pair has four possibilities"))
            clocks = VGroup(*[Clock(a["re"], a["im"], R=0.55, ref=1.0) for a in st[0]["amps"]]).arrange(RIGHT, buff=0.45).move_to([2.6, 0.9, 0])
            klabs = VGroup(*[MX(labels[i].replace("⟩", r"\rangle"), size=36).next_to(c, DOWN, buff=0.2) for i, c in enumerate(clocks)])
            br = Brace(VGroup(clocks, klabs), UP, buff=0.2, color=YELLOW)
            brl = TX(r"the pair: four amplitudes", size=30, color=YELLOW).next_to(br, UP, buff=0.12)
            words = ["zero zero", "zero one", "one zero", "one one"]
            order = [0, 2, 1, 3]  # spoken order 00, 01, 10, 11; labels list qubit 0 first
            self.play(FadeIn(clocks[order[0]], scale=0.8), FadeIn(klabs[order[0]]), run_time=0.5)
            for k in (1, 2, 3):
                self.wait_to(self.cue(words[k]))
                self.play(FadeIn(clocks[order[k]], scale=0.8), FadeIn(klabs[order[k]]), run_time=0.4)
            self.wait_to(self.cue("an amplitude for each"))
            self.play(Create(br), FadeIn(brl), run_time=0.8)
            note = TX(r"labels list qubit 0 first", size=24, color=FAINT).next_to(klabs, DOWN, buff=0.2)
            self.play(FadeIn(note), run_time=0.5)

        # ------------------------------------------------------------ grow
        with self.cued("grow") as T:
            self.play(FadeOut(VGroup(br, brl, note)), VGroup(g0, g1, n0, n1, clocks, klabs).animate.set_opacity(0.0), run_time=0.7)
            self.remove(g0, g1, n0, n1, clocks, klabs)
            counter = MX(r"n = 1", r"\qquad", r"2^n = 2", size=46).move_to([0, 2.95, 0])
            self.play(Write(counter), run_time=0.7)
            side = 4.1
            prev = None
            growth = D["growth"]
            per = max(0.35, (self.cue("Three hundred") - self.now()) / len(growth))
            for g in growth:
                n, m = g["n"], g["amplitudes"]
                cols = int(math.ceil(math.sqrt(m)))
                rows = int(math.ceil(m / cols))
                cell = side / max(cols, rows)
                sq = VGroup(*[Square(side_length=cell * 0.82).set_stroke(width=0).set_fill(BLUE, opacity=0.85) for _ in range(m)])
                for i, q in enumerate(sq):
                    q.move_to([(i % cols - (cols - 1) / 2) * cell, -0.5 - (i // cols - (rows - 1) / 2) * cell, 0])
                new_counter = MX(rf"n = {n}", r"\qquad", rf"2^n = {m:,}".replace(",", "{,}"), size=46).move_to(counter)
                anims = [ReplacementTransform(counter, new_counter)]
                anims.append(ReplacementTransform(prev, sq) if prev is not None else FadeIn(sq))
                self.play(*anims, run_time=per * 0.7)
                self.wait(per * 0.3)
                counter, prev = new_counter, sq
            self.wait_to(self.cue("Three hundred"))
            big = MX(r"300 \text{ qubits: } 2^{300} \approx 10^{90}", r"\;>\;", r"10^{80} \text{ atoms}", size=44, color=YELLOW).move_to([0, -3.05, 0])
            self.play(Write(big), run_time=1.2)
            self.wait_to(self.cue("A register of qubits"))
            reg = TX(r"a register holds every number $0 \dots 2^n - 1$ at once", size=32).move_to([0, 2.3, 0])
            self.play(FadeIn(reg, shift=0.1 * DOWN), run_time=0.8)
            self.grow_group = VGroup(counter, prev, big, reg)

        # ------------------------------------------------------------ bell
        with self.cued("bell") as T:
            self.play(FadeOut(self.grow_group), run_time=0.6)
            n0 = MX(r"q_0\;|0\rangle", size=32, color=MUTED).move_to([-5.2, 1.6, 0])
            n1 = MX(r"q_1\;|0\rangle", size=32, color=MUTED).move_to([-5.2, -0.6, 0])
            w0 = Line([-4.4, 1.6, 0], [-1.6, 1.6, 0]).set_stroke(FAINT, width=2)
            w1 = Line([-4.4, -0.6, 0], [-1.6, -0.6, 0]).set_stroke(FAINT, width=2)
            hbox = box("H", -3.7, 1.6)
            cx = -2.5
            ctrl = Dot([cx, 1.6, 0], radius=0.09, color=VIOLET)
            stem = Line([cx, 1.6, 0], [cx, -0.6, 0]).set_stroke(VIOLET, width=2.5)
            targ = VGroup(Circle(radius=0.22).set_stroke(VIOLET, width=2.5).move_to([cx, -0.6, 0]), Line([cx - 0.22, -0.6, 0], [cx + 0.22, -0.6, 0]).set_stroke(VIOLET, width=2.5), Line([cx, -0.82, 0], [cx, -0.38, 0]).set_stroke(VIOLET, width=2.5))
            clocks = VGroup(*[Clock(a["re"], a["im"], R=0.48, ref=1.0) for a in st[0]["amps"]]).arrange(RIGHT, buff=0.38).move_to([2.6, 1.7, 0])
            klabs = VGroup(*[MX(labels[i].replace("⟩", r"\rangle"), size=30).next_to(c, DOWN, buff=0.15) for i, c in enumerate(clocks)])
            self.play(FadeIn(VGroup(n0, n1, w0, w1)), FadeIn(clocks), FadeIn(klabs), run_time=0.8)

            def to_stage(k):
                return [UpdateFromAlphaFunc(c, lambda m, a, i=i: m.set_amp(*lerp_amp(st[k - 1]["amps"][i], st[k]["amps"][i], a))) for i, c in enumerate(clocks)]

            self.wait_to(self.cue("A Hadamard"))
            self.play(FadeIn(hbox), *to_stage(1), run_time=0.9)
            self.wait_to(self.cue("then a CNOT"))
            self.play(Create(stem), FadeIn(ctrl), Create(targ), *to_stage(2), run_time=0.9)
            self.wait_to(self.cue("Measure the pair a hundred times"))
            shots = D["shots"]
            bars = Bars([0, 0, 0, 0], width=4.4, height=1.6, gap=0.35, vmax=max(shots), colors=[GREEN, FAINT, FAINT, GREEN]).move_to([2.6, -1.5, 0])
            blabs = VGroup(*[MX(labels[i].replace("⟩", r"\rangle"), size=26, color=MUTED).move_to([bars.x_of(i), bars.base[1] - 0.25, 0]) for i in range(4)])
            nums = VGroup(*[MX(str(shots[i]), size=28).move_to([bars.x_of(i), bars.base[1] + 1.6 * shots[i] / max(shots) + 0.25, 0]) for i in range(4)])
            self.add(bars)
            self.play(UpdateFromAlphaFunc(bars, lambda m, a: m.set_values([v * a for v in shots])), FadeIn(blabs), run_time=1.4, rate_func=smooth)
            self.play(FadeIn(nums), run_time=0.5)
            self.wait_to(self.cue("the two always agree"))
            agree = TX(r"each alone: 50/50 $\cdot$ together: always equal", size=28, color=GREEN).next_to(bars, DOWN, buff=0.55)
            self.play(FadeIn(agree), run_time=0.7)
            self.bell_group = VGroup(hbox, ctrl, stem, targ, w0, w1, n0, n1, clocks, klabs, bars, blabs, nums, agree)

        # ------------------------------------------------------------ shared
        with self.cued("shared") as T:
            self.play(FadeOut(self.bell_group), run_time=0.6)
            # Each qubit's real Bloch vector (x right, z up) just before the CNOT, then after it.
            v0, v1 = st[1]["vectors"]
            g0 = Glyph((v0["x"], v0["z"]), R=1.1).move_to([-1.8, 0.6, 0])
            g1 = Glyph((v1["x"], v1["z"]), R=1.1).move_to([1.8, 0.6, 0])
            n0 = MX("q_0", size=34, color=MUTED).next_to(g0, DOWN, buff=0.2)
            n1 = MX("q_1", size=34, color=MUTED).next_to(g1, DOWN, buff=0.2)
            before = TX(r"before the CNOT: each qubit has its own arrow", size=28, color=MUTED).move_to([0, -1.5, 0])
            self.play(FadeIn(VGroup(g0, g1, n0, n1)), FadeIn(before), run_time=0.8)
            self.wait_to(self.cue("Each qubit's own arrow shrinks to nothing"))
            a0, a1 = st[2]["vectors"]
            assert max(st[2]["bloch"]) < 1e-9
            zero = TX(r"after: each qubit alone has arrow length $0$", size=28, color=MUTED).move_to(before)
            self.play(vec_to(g0, (a0["x"], a0["z"])), vec_to(g1, (a1["x"], a1["z"])), ReplacementTransform(before, zero), run_time=1.6, rate_func=smooth)
            self.wait_to(self.cue("That is entanglement"))
            word = TX(r"\textbf{entanglement}", size=60, color=YELLOW).move_to([0, 2.6, 0])
            self.play(Write(word), run_time=1.1)
            self.wait_to(self.cue("both Shor's algorithm and error correction"))
            sub = TX(r"\textit{used by Shor's algorithm and by error correction}", size=30, color=MUTED).move_to([0, -2.35, 0])
            self.play(FadeIn(sub, shift=0.1 * UP), run_time=0.7)
            self.wait(max(0.1, T - self.now() - 0.6))
            self.play(*[FadeOut(m) for m in self.mobjects], run_time=0.6)

        # ------------------------------------------------------------ waves
        with self.cued("waves") as T:
            w1, w2 = D["waves"]
            ref = 1 / math.sqrt(8)
            row = VGroup(*[Clock(a["re"], a["im"], R=0.56, ref=ref) for a in w1["amps"]]).arrange(RIGHT, buff=0.3).move_to([0, 0.4, 0])
            labs = VGroup(*[MX(str(y), size=32, color=MUTED).next_to(c, DOWN, buff=0.2) for y, c in enumerate(row)])
            flab = MX(r"f = 1", size=44).move_to([0, 2.3, 0])
            self.play(LaggedStart(*[FadeIn(c, scale=0.8) for c in row], lag_ratio=0.08), FadeIn(labs), Write(flab), run_time=1.6)
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
                c.set_amp(a["re"], a["im"])
            self.play(ReplacementTransform(flab, MX(r"f = 2", size=44).move_to(flab)), run_time=0.5)
            self.wait_to(self.cue("the language of the quantum Fourier transform"))
            qft_t = TX(r"the language of the \textbf{quantum Fourier transform}", size=40).move_to([0, -2.1, 0])
            self.play(Write(qft_t), run_time=1.3)
            self.wait_to(self.cue("the engine of Shor"))
            sub = TX(r"\textit{the engine of Shor's algorithm}", size=32, color=MUTED).next_to(qft_t, DOWN, buff=0.25)
            self.play(FadeIn(sub, shift=0.1 * UP), run_time=0.8)
            self.wait(max(0.1, T - self.now() - 0.7))
            self.play(*[FadeOut(m) for m in self.mobjects], run_time=0.6)


def lerp_amp(a: dict, b: dict, t: float) -> tuple[float, float]:
    return a["re"] + (b["re"] - a["re"]) * t, a["im"] + (b["im"] - a["im"]) * t


_ = (CORAL, TEXT, Indicate, np)
