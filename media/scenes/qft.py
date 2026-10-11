"""Chapter 3: the quantum Fourier transform.

From media/data/film/qft.json (scripts/film/qft.ts, using src/core/qft.ts and QState):
- the classical DFT of a comb that repeats every 4 of 16 samples (the "listen" analogy);
- QFT|1> and QFT|3> on three qubits: eight clocks winding once and three times;
- the 3-qubit circuit run gate by gate on |5>, with each qubit's Bloch vector after each gate
  (each ends on the equator: q0 at 5/8, q1 at 1/4, q2 at 1/2 of a turn);
- the period-4 comb (teeth at 1, 5, 9, 13): the four phasors behind outputs 4 and 1, which
  the export checks sum to the circuit's own amplitudes; and its QFT, four equal peaks;
- a period-3 comb on 64 values and its blurred QFT.
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
    Circle,
    Create,
    DashedLine,
    Dot,
    FadeIn,
    FadeOut,
    Indicate,
    LaggedStart,
    Line,
    ReplacementTransform,
    RoundedRectangle,
    SurroundingRectangle,
    UpdateFromAlphaFunc,
    ValueTracker,
    VGroup,
    Write,
    smooth,
)

from common import AMBER, BG, BLUE, CORAL, FAINT, GREEN, MUTED, SURFACE3, TEXT, VIOLET
from film import MX, TX, YELLOW, NarratedScene, load
from parity import Cued, dim
from shorkit import Bars, Clock, phase_color


def gate_box(label: str, x: float, y: float, w: float = 0.62) -> VGroup:
    t = MX(label, size=30)
    box = RoundedRectangle(width=max(w, t.width + 0.25), height=0.6, corner_radius=0.1).set_fill(SURFACE3, opacity=1).set_stroke(VIOLET, width=2)
    return VGroup(box, t).move_to([x, y, 0])


class QftScene(Cued, NarratedScene):
    scene_id = "qft"

    def construct(self):
        D = load("film/qft")
        self.chapter_card()

        # ------------------------------------------------------------ listen
        with self.cued("listen") as T:
            sig = D["listen"]["signal"]
            spec = D["listen"]["spectrum"]
            left = Bars(sig, width=5.0, height=1.8, gap=0.3, color=TEXT).move_to([-3.4, -0.4, 0])
            right = Bars(spec, width=5.0, height=1.8, gap=0.3, color=YELLOW).move_to([3.4, -0.4, 0])
            lt = TX(r"a signal that repeats every 4", size=30, color=MUTED).next_to(left, DOWN, buff=0.35)
            rt = TX(r"its Fourier transform: spikes", size=30, color=MUTED).next_to(right, DOWN, buff=0.35)
            arrow = Arrow([-0.6, 0.3, 0], [0.6, 0.3, 0], buff=0, color=FAINT, stroke_width=5)
            ft = TX(r"Fourier", size=26, color=FAINT).next_to(arrow, UP, buff=0.1)
            self.play(FadeIn(left, shift=0.2 * UP), FadeIn(lt), run_time=1.0)
            self.wait_to(self.cue("Feed it a signal"))
            self.play(Indicate(VGroup(*[left.rects[i] for i in range(0, 16, 4)]), color=YELLOW, scale_factor=1.1), run_time=0.9)
            self.wait_to(self.cue("answers with a sharp spike"))
            self.play(Create(arrow), FadeIn(ft), run_time=0.6)
            self.play(FadeIn(right, shift=0.2 * UP), FadeIn(rt), run_time=1.0)
            self.listen_group = VGroup(left, right, lt, rt, arrow, ft)

        # ------------------------------------------------------------ clocks
        with self.cued("clocks") as T:
            self.play(FadeOut(self.listen_group), run_time=0.6)
            c1, c3 = D["clocks"]
            ref = 1 / math.sqrt(8)
            row = VGroup(*[Clock(a["re"], a["im"], R=0.55, ref=ref) for a in c1["amps"]]).arrange(RIGHT, buff=0.3).move_to([0, -0.3, 0])
            labs = VGroup(*[MX(str(y), size=30, color=MUTED).next_to(c, DOWN, buff=0.2) for y, c in enumerate(row)])
            formula = MX(r"|x\rangle", r"\;\longmapsto\;", r"\tfrac{1}{\sqrt{N}}\sum_{y} e^{2\pi i\, x y / N}\,|y\rangle", size=46).move_to([0, 2.35, 0])
            self.wait_to(self.cue("Give it a single number x"))
            self.play(Write(formula), run_time=1.4)
            xlab = MX(r"x = 1", size=40, color=YELLOW).move_to([0, 1.3, 0])
            self.wait_to(self.cue("it returns every value at once"))
            self.play(LaggedStart(*[FadeIn(c, scale=0.8) for c in row], lag_ratio=0.08), FadeIn(labs), FadeIn(xlab), run_time=1.4)
            self.wait_to(self.cue("x times y over N"))
            self.play(Indicate(formula[2], color=YELLOW, scale_factor=1.06), run_time=0.9)
            self.wait_to(self.cue("The clocks wind around x times"))
            xt = ValueTracker(1.0)

            def wind(m):
                for y, c in enumerate(m):
                    ang = 2 * PI * xt.get_value() * y / 8
                    c.set_amp(ref * math.cos(ang), ref * math.sin(ang))

            row.add_updater(wind)
            self.play(xt.animate.set_value(3.0), ReplacementTransform(xlab, MX(r"x = 3", size=40, color=YELLOW).move_to(xlab)), run_time=2.0, rate_func=smooth)
            row.clear_updaters()
            for c, a in zip(row, c3["amps"]):
                c.set_amp(a["re"], a["im"])
            self.clock_group = VGroup(row, labs, formula, *[m for m in self.mobjects if isinstance(m, type(formula)) and m is not formula])

        # ------------------------------------------------------------ circuit
        with self.cued("circuit") as T:
            self.play(*[FadeOut(m) for m in self.mobjects], run_time=0.6)
            C = D["circuit"]
            gates, steps = C["gates"], C["steps"]
            n = C["n"]
            ys = {2: 1.6, 1: 0.4, 0: -0.8}
            x0, dx = -4.3, 0.92
            wires = VGroup(*[Line([-5.8, ys[q], 0], [x0 + dx * len(gates) + 0.2, ys[q], 0]).set_stroke(FAINT, width=2) for q in range(n)])
            names = VGroup(*[MX(rf"q_{q}", size=34).move_to([-6.25, ys[q], 0]) for q in range(n)])
            ins = VGroup(*[MX(rf"|{(C['x'] >> q) & 1}\rangle", size=30, color=MUTED).move_to([-5.45, ys[q] + 0.32, 0]) for q in range(n)])
            boxes = VGroup()
            for i, g in enumerate(gates):
                x = x0 + dx * (i + 0.5)
                if g["g"] == "H":
                    boxes.add(gate_box("H", x, ys[g["q"]]))
                elif g["g"] == "CP":
                    ctrl = Dot([x, ys[g["c"]], 0], radius=0.08, color=VIOLET)
                    link = Line([x, ys[g["c"]], 0], [x, ys[g["t"]], 0]).set_stroke(VIOLET, width=2.2)
                    box = gate_box(rf"\tfrac{{1}}{{{2 ** g['k']}}}", x, ys[g["t"]], w=0.7)
                    boxes.add(VGroup(link, ctrl, box))
                else:
                    a_, b_ = g["a"], g["b"]
                    xs = VGroup(Line([x, ys[a_], 0], [x, ys[b_], 0]).set_stroke(VIOLET, width=2.2))
                    for q in (a_, b_):
                        xs.add(Line([x - 0.13, ys[q] - 0.13, 0], [x + 0.13, ys[q] + 0.13, 0]).set_stroke(VIOLET, width=3))
                        xs.add(Line([x - 0.13, ys[q] + 0.13, 0], [x + 0.13, ys[q] - 0.13, 0]).set_stroke(VIOLET, width=3))
                    boxes.add(xs)
            input_lab = MX(r"\text{input } |5\rangle = |101\rangle", size=32, color=MUTED).move_to([-3.2, 2.7, 0])
            self.play(Create(wires), FadeIn(names), FadeIn(ins), FadeIn(input_lab), run_time=0.9)
            self.play(LaggedStart(*[FadeIn(b, shift=0.1 * DOWN) for b in boxes], lag_ratio=0.1), run_time=1.2)
            # One clock per qubit: its Bloch vector seen from the north pole (x right, y up).
            qx = 4.6
            Rq = 0.48
            qclocks = {}
            for q in range(n):
                ring = Circle(radius=Rq).set_stroke(FAINT, width=2).set_fill(BG, opacity=1).move_to([qx, ys[q], 0])
                tick = Line([qx + Rq, ys[q], 0], [qx + Rq + 0.08, ys[q], 0]).set_stroke(FAINT, width=2)
                hand = Line([qx, ys[q], 0], [qx + 1e-3, ys[q], 0]).set_stroke(BLUE, width=5)
                tip = Dot([qx, ys[q], 0], radius=0.05, color=BLUE)
                lab = MX(rf"q_{q}", size=28, color=MUTED).next_to(ring, RIGHT, buff=0.18)
                qclocks[q] = (ring, tick, hand, tip, lab)
            qgroup = VGroup(*[VGroup(*qclocks[q]) for q in range(n)])
            head = TX(r"each qubit's clock", size=26, color=MUTED).move_to([qx + 0.25, 2.55, 0])
            self.play(FadeIn(qgroup), FadeIn(head), run_time=0.7)

            def set_hands(k: int):
                anims = []
                for q in range(n):
                    b = steps[k]["bloch"][q]
                    ring, tick, hand, tip, lab = qclocks[q]
                    c = ring.get_center()
                    v = np.array([b["x"], b["y"], 0.0]) * Rq
                    L = float(np.linalg.norm(v))
                    end = c + (v if L > 1e-3 else np.array([1e-3, 0, 0]))
                    col = phase_color(b["x"], b["y"]) if L > 1e-3 else BLUE
                    anims.append(hand.animate.put_start_and_end_on(c, end).set_stroke(col, opacity=1 if L > 1e-3 else 0))
                    anims.append(tip.animate.move_to(end).set_fill(col, opacity=1 if L > 1e-3 else 0))
                return anims

            self.play(*set_hands(0), run_time=0.2)
            playhead = DashedLine([x0, 2.25, 0], [x0, -1.35, 0], dash_length=0.08).set_stroke(AMBER, width=3)
            self.add(playhead)
            cues = {1: "A Hadamard on each qubit", 2: "a half, a quarter", 3: "an eighth"}
            per = max(0.45, (T - self.now() - 3.2) / len(gates))
            for k in range(1, len(gates) + 1):
                if k in cues:
                    self.wait_to(self.cue(cues[k]))
                hx = x0 + dx * k
                self.play(playhead.animate.move_to([hx, playhead.get_center()[1], 0]), boxes[k - 1].animate.set_opacity(0.55), *set_hands(k), run_time=per * 0.75)
                self.wait(per * 0.25)
            # Final angles, as fractions of a turn.
            fr = {0: r"\tfrac{5}{8}", 1: r"\tfrac{1}{4}", 2: r"\tfrac{1}{2}"}
            turns = VGroup(*[MX(fr[q] + r"\text{ turn}", size=28, color=YELLOW).next_to(qclocks[q][0], LEFT, buff=0.2) for q in range(n)])
            self.wait_to(self.cue("Each qubit becomes one clock hand"))
            self.play(LaggedStart(*[FadeIn(t, shift=0.1 * LEFT) for t in turns], lag_ratio=0.25), run_time=1.1)
            cnt = TX(r"$n$ Hadamards and $n(n-1)/2$ turns, not $N^2$ steps", size=30, color=MUTED).move_to([0, -2.6, 0])
            self.play(FadeIn(cnt, shift=0.1 * UP), run_time=0.7)

        # ------------------------------------------------------------ comb
        with self.cued("comb") as T:
            self.play(*[FadeOut(m) for m in self.mobjects], run_time=0.6)
            CB = D["comb"]
            inp = Bars(CB["input"], width=5.4, height=1.6, gap=0.3, color=TEXT, vmax=0.25).move_to([-3.4, 1.2, 0])
            self.comb_y = 1.2
            inl = TX(r"input: every 4th value (1, 5, 9, 13)", size=28, color=MUTED).next_to(inp, DOWN, buff=0.3)
            idx = VGroup(*[MX(str(i), size=20, color=FAINT).move_to([inp.x_of(i), inp.base[1] - 0.16, 0]) for i in range(16)])
            self.play(FadeIn(inp, shift=0.2 * UP), FadeIn(idx), FadeIn(inl), run_time=1.0)
            # Phasors for outputs k = 4 and k = 1, tip to tail: one hand per tooth of the comb.
            S = 6.0

            def chain(terms, origin):
                pts = [np.array(origin, dtype=float)]
                for t in terms:
                    pts.append(pts[-1] + S * np.array([t["re"], t["im"], 0.0]))
                arrs = VGroup(*[Arrow(pts[i], pts[i + 1], buff=0, stroke_width=7, color=phase_color(t["re"], t["im"]), max_tip_length_to_length_ratio=0.22) for i, t in enumerate(terms)])
                return arrs, pts

            ph4, ph1 = CB["phasors"]
            a4, p4 = chain(ph4["terms"], [1.6, -3.3, 0])
            a1, p1 = chain(ph1["terms"], [4.6, -2.6, 0])
            t4 = TX(r"output 4: four hands", size=30).move_to([1.6, 0.0, 0])
            t1 = TX(r"output 1: four hands", size=30).move_to([5.0, 0.0, 0])
            self.wait_to(self.cue("Each output adds up one clock hand"))
            self.play(LaggedStart(*[Create(a) for a in a4], lag_ratio=0.35), FadeIn(t4), run_time=1.6)
            self.wait_to(self.cue("Where the hands agree"))
            s4 = Line(p4[0], p4[-1]).set_stroke(GREEN, width=12, opacity=0.35)
            big = TX(r"they add up", size=30, color=GREEN).next_to(s4, LEFT, buff=0.25)
            self.play(Create(s4), FadeIn(big), run_time=0.8)
            self.play(LaggedStart(*[Create(a) for a in a1], lag_ratio=0.35), FadeIn(t1), run_time=1.6)
            self.wait_to(self.cue("Everywhere else they cancel"))
            zero = TX(r"back where they started: 0", size=30, color=CORAL).next_to(VGroup(*a1), DOWN, buff=0.3)
            self.play(Indicate(VGroup(*a1), color=CORAL, scale_factor=1.08), FadeIn(zero), run_time=1.0)
            self.comb_group = VGroup(a4, a1, t4, t1, s4, big, zero)
            self.inp, self.inl, self.idx = inp, inl, idx

        # ------------------------------------------------------------ peaks
        with self.cued("peaks") as T:
            CB = D["comb"]
            self.play(FadeOut(self.comb_group), FadeOut(self.inl), run_time=0.5)
            out = Bars(CB["output"], width=5.4, height=1.6, gap=0.3, color=YELLOW, vmax=0.25).move_to([3.4, 1.2, 0])
            idx2 = VGroup(*[MX(str(i), size=20, color=FAINT).move_to([out.x_of(i), out.base[1] - 0.16, 0]) for i in range(16)])
            arrow = Arrow([-0.4, 1.6, 0], [0.4, 1.6, 0], buff=0, color=FAINT, stroke_width=5)
            ql = TX(r"QFT", size=28, color=FAINT).next_to(arrow, UP, buff=0.1)
            self.play(Create(arrow), FadeIn(ql), run_time=0.5)
            self.play(FadeIn(out, shift=0.2 * UP), FadeIn(idx2), run_time=1.0)
            peaks = TX(r"peaks at $0, 4, 8, 12$: multiples of $16/4$", size=30, color=YELLOW).next_to(out, DOWN, buff=0.3)
            self.play(Write(peaks), run_time=1.0)
            self.wait_to(self.cue("When the period does not divide evenly"))
            BL = D["blur"]
            inp3 = Bars(BL["input"], width=5.4, height=1.4, gap=0.2, color=TEXT).move_to([-3.4, -1.9, 0])
            out3 = Bars(BL["output"], width=5.4, height=1.4, gap=0.0, color=YELLOW).move_to([3.4, -1.9, 0])
            marks = VGroup(*[DashedLine([out3.x_of(j * 64 / 3), out3.base[1], 0], [out3.x_of(j * 64 / 3), out3.base[1] + 1.55, 0], dash_length=0.06).set_stroke(AMBER, width=2) for j in range(3)])
            l3 = TX(r"every 3rd of 64", size=26, color=MUTED).next_to(inp3, DOWN, buff=0.2)
            r3 = TX(r"blurred, but near multiples of $64/3$", size=26, color=MUTED).next_to(out3, DOWN, buff=0.2)
            arrow2 = arrow.copy().move_to([0, -1.3, 0])
            self.play(FadeIn(inp3, shift=0.2 * UP), FadeIn(l3), Create(arrow2), run_time=0.9)
            self.play(FadeIn(out3, shift=0.2 * UP), Create(marks), FadeIn(r3), run_time=1.1)
            self.wait_to(self.cue("they still point the way"))
            self.play(Indicate(marks, color=YELLOW), run_time=0.9)
            self.wait(max(0.1, T - self.now() - 0.7))
            self.play(*[FadeOut(m) for m in self.mobjects], run_time=0.6)


_ = (CORAL, DOWN, LEFT, UpdateFromAlphaFunc, SurroundingRectangle, dim, GREEN, MUTED)
