"""Chapter 7: below threshold.

Every number on screen is ours or quoted with its source:
- lattices: makeRotatedSurfaceCode(5, 7, 9) layouts (scripts/film/threshold.ts);
- sparks: seeded bit-flip sampleNoise draws at p = 6%; the p dial: one seeded stream per
  lattice, where qubit i flips iff its uniform u_i < p (exactly what sampleNoise does);
- curves: media/data/threshold.json (validation.json points + runPoint sweep; bit-flip
  noise, MWPM, d = 5, 7, 9); the plotted line is a monotone cubic through the measured
  points in (p, log eps) and the riding dots use the same interpolation;
- thresholds: 9.9% (bit flips) and 2.8% (lying checks) from src/data/validation.json;
  about 1% for circuit-level noise is the literature value (Fowler et al. 2012);
- Lambda: our eps_d / eps_{d+2} at p = 4% from the sweep; Willow's 2.14 is a citation.
"""

from __future__ import annotations

import math

import numpy as np
from manim import (
    AnimationGroup,
    Succession,
    Wait,
    DOWN,
    LEFT,
    ORIGIN,
    RIGHT,
    UP,
    Arrow,
    Axes,
    Circle,
    Create,
    CurvedArrow,
    DashedLine,
    DecimalNumber,
    Dot,
    FadeIn,
    FadeOut,
    Flash,
    GrowFromCenter,
    LaggedStart,
    Line,
    LogBase,
    ReplacementTransform,
    Transform,
    TransformFromCopy,
    Triangle,
    ValueTracker,
    VGroup,
    VMobject,
    Write,
    linear,
    smooth,
)

from common import BG, Lattice
from film import (
    AMBER,
    CORAL,
    FAINT,
    LEAD_IN,
    MUTED,
    MX,
    TAIL,
    TEXT,
    TX,
    YELLOW,
    NarratedMovingScene,
    load,
    script_scene,
    word_time,
)

D_COL = {5: "#4A7DF0", 7: "#7CC4FF", 9: "#F4F6FB"}
DS = (5, 7, 9)


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


# --------------------------------------------------------------------------- curves


def pchip(xs: np.ndarray, ys: np.ndarray):
    """Monotone cubic (Fritsch-Carlson) through the points; returns f(x)."""
    xs, ys = np.asarray(xs, float), np.asarray(ys, float)
    h = np.diff(xs)
    delta = np.diff(ys) / h
    m = np.zeros_like(ys)
    m[0], m[-1] = delta[0], delta[-1]
    for k in range(1, len(xs) - 1):
        if delta[k - 1] * delta[k] <= 0:
            m[k] = 0.0
        else:
            w1, w2 = 2 * h[k] + h[k - 1], h[k] + 2 * h[k - 1]
            m[k] = (w1 + w2) / (w1 / delta[k - 1] + w2 / delta[k])

    def f(x: float) -> float:
        x = min(max(x, xs[0]), xs[-1])
        k = min(int(np.searchsorted(xs, x, side="right") - 1), len(xs) - 2)
        t = (x - xs[k]) / h[k]
        h00, h10 = 2 * t**3 - 3 * t**2 + 1, t**3 - 2 * t**2 + t
        h01, h11 = -2 * t**3 + 3 * t**2, t**3 - t**2
        return h00 * ys[k] + h10 * h[k] * m[k] + h01 * ys[k + 1] + h11 * h[k] * m[k + 1]

    return f


def pct(x: float, nd: int = 1) -> str:
    return f"{100 * x:.{nd}f}"


class ThresholdScene(NarratedMovingScene):
    scene_id = "threshold"

    def construct(self):
        data = load("film/threshold")
        self.chapter_card()
        frame = self.camera.frame

        # ------------------------------------------------------------------ geometry
        S = 0.5
        gap = 0.85
        total = sum(d * S for d in DS) + 2 * gap
        x = -total / 2
        LAT_Y = -0.3
        centers = {}
        for d in DS:
            centers[d] = np.array([x + d * S / 2, LAT_Y, 0.0])
            x += d * S + gap
        lats = {d: Lattice(data["layouts"][str(d)], s=S, center=centers[d]) for d in DS}
        dlabels = {d: MX(rf"d = {d}", size=40, color=D_COL[d]).next_to(lats[d], DOWN, buff=0.38) for d in DS}
        for d in DS:
            dlabels[d].set_y(LAT_Y - 9 * S / 2 - 0.55)

        # ================================================================== question
        with self.beat("question") as T:
            cu = Cues(self, "question", T)
            k = min(1.0, T / 8.4)
            first = lats[5].copy().move_to(np.array([0, LAT_Y, 0]))
            first.center_pt = np.array([0, LAT_Y, 0.0])
            lab0 = dlabels[5].copy().set_x(0)
            self.play(self.grow_in(first, None, 1.5 * k), Write(lab0), run_time=1.5 * k)
            cu.until(cu.at("If we build"))
            # d = 5 slides to its seat; a copy of it grows into d = 7.
            seed7 = first.copy()
            self.play(
                ReplacementTransform(first, lats[5]),
                ReplacementTransform(lab0, dlabels[5]),
                seed7.animate.move_to(centers[7]),
                run_time=1.0 * k,
            )
            self.play(self.grow_in(lats[7], seed7, 1.3 * k), FadeIn(dlabels[7], shift=0.15 * UP), run_time=1.3 * k)
            seed9 = lats[7].copy()
            self.play(seed9.animate.move_to(centers[9]), run_time=0.7 * k)
            self.play(self.grow_in(lats[9], seed9, 1.4 * k), FadeIn(dlabels[9], shift=0.15 * UP), run_time=1.4 * k)

        # ================================================================== tradeoff
        with self.beat("tradeoff") as T:
            cu = Cues(self, "tradeoff", T)
            k = min(1.0, T / 12.2)
            # (a) More qubits, more places for noise to strike: three real draws at p = 6%.
            draws = data["sparks"]["draws"]
            t_but = cu.at("But a bigger code")
            per = max(0.9, (t_but - 0.3) / 3)
            for j in range(3):
                on, fl = [], []
                for d in DS:
                    for q in draws[str(d)][j]["errors"]:
                        on.append(lats[d].qubits[q].animate.set_fill(CORAL, opacity=1).set_stroke(CORAL))
                        fl.append(Flash(lats[d].qpos(q), color=CORAL, line_length=0.13, num_lines=10, flash_radius=0.17, line_stroke_width=2.5))
                self.play(*on, *fl, run_time=0.45)
                self.wait(max(0.05, per - 0.85))
                self.play(*[self.unspark(lats[d], draws[str(d)][j]["errors"]) for d in DS], run_time=0.4)
            # (b) ... but a longer chain is needed to cross the bigger code.
            cu.until(t_but)
            chains, counts = VGroup(), VGroup()
            anims = []
            for d in DS:
                L = lats[d]
                col = L.lay["logicalX"]
                top, bot = L.qpos(col[0]) + UP * 0.55 * S, L.qpos(col[-1]) + DOWN * 0.55 * S
                ln = Line(top, bot, stroke_width=7, color=CORAL).set_z_index(2)
                n = MX(str(len(col)), size=40, color=CORAL).next_to(top, UP, buff=0.16)
                chains.add(ln)
                counts.add(n)
                anims.append(Create(ln, rate_func=linear))
                anims.append(LaggedStart(*[L.qubits[q].animate.set_fill(CORAL, opacity=1).set_stroke(CORAL) for q in col], lag_ratio=0.25))
            self.play(*anims, run_time=1.5 * k)
            self.play(LaggedStart(*[FadeIn(n, shift=0.15 * UP) for n in counts], lag_ratio=0.3), run_time=0.9 * k)
            # (c) Which wins depends on p: the p dial adds the same seeded errors as p grows.
            cu.until(cu.at("Which effect wins"))
            col_q = {d: lats[d].lay["logicalX"] for d in DS}
            self.play(
                FadeOut(chains),
                FadeOut(counts),
                *[self.unspark(lats[d], col_q[d]) for d in DS],
                run_time=0.6,
            )
            self.pv = ValueTracker(0.02)
            dial = self.make_dial()
            self.play(Create(dial.line), FadeIn(dial.ticks), FadeIn(dial.pointer), run_time=0.8)
            u = {d: np.array(data["dial"]["draws"][str(d)]["u"]) for d in DS}
            lit = {d: np.zeros(len(u[d]), bool) for d in DS}

            def light(_m):
                p = self.pv.get_value()
                for d in DS:
                    now = u[d] < p
                    for q in np.nonzero(now != lit[d])[0]:
                        if now[q]:
                            lats[d].qubits[q].set_fill(CORAL, opacity=1).set_stroke(CORAL)
                        else:
                            lats[d].qubits[q].set_fill(BG, opacity=1).set_stroke("#F4F6FB")
                    lit[d] = now

            lighter = VMobject()
            lighter.add_updater(light)
            self.add(lighter)
            P_HIGH = 0.15
            sweep = max(2.0, min(3.6, cu.left() - 0.8))
            self.play(self.pv.animate.set_value(P_HIGH), run_time=sweep, rate_func=smooth)
            self.wait(max(0.0, cu.left() - 0.05))
            lighter.clear_updaters()
            self.remove(lighter)

        # ================================================================== curves
        cur = data["curves"]["byD"]
        ax = Axes(
            x_range=[0.02, 0.17, 0.01],
            y_range=[-2.5, 0, 1],
            x_length=7.4,
            y_length=5.2,
            tips=False,
            axis_config={"color": MUTED, "stroke_width": 2.2, "include_ticks": True, "tick_size": 0.06},
            y_axis_config={"scaling": LogBase()},
        )
        PLOT_C = np.array([-2.15, -0.1, 0])
        ax.shift(PLOT_C - (ax.c2p(0.02, 10**-2.5) + ax.c2p(0.17, 1.0)) / 2)
        self.ax = ax
        fns = {d: pchip([c["p"] for c in cur[str(d)]], [math.log10(c["pL"]) for c in cur[str(d)]]) for d in DS}
        self.fns = fns

        def P(p, d):
            return ax.c2p(p, 10 ** fns[d](p))

        xt = VGroup(*[MX(rf"{v}\%", size=30, color=MUTED).next_to(ax.c2p(v / 100, 10**-2.5), DOWN, buff=0.18) for v in (4, 8, 12, 16)])
        yt = VGroup(*[MX(rf"10^{{{e}}}", size=32, color=MUTED).next_to(ax.c2p(0.02, 10.0**e), LEFT, buff=0.18) for e in (-2, -1, 0)])
        grid = VGroup(*[Line(ax.c2p(0.02, 10.0**e), ax.c2p(0.17, 10.0**e), stroke_width=1.2, color=FAINT).set_opacity(0.28) for e in (-2, -1, 0)])
        xlab = TX(r"physical error rate $p$", size=30, color=MUTED).next_to(xt, DOWN, buff=0.16).set_x(ax.c2p(0.095, 1)[0])
        ylab = TX(r"logical error rate $\varepsilon_d$", size=30, color=MUTED)
        ylab.move_to(ax.c2p(0.02, 1.0) + UP * 0.78, aligned_edge=LEFT).shift(LEFT * 0.75)
        curves, dots = {}, {}
        for d in DS:
            ps = np.linspace(0.04, 0.16, 241)
            c = VMobject().set_points_as_corners([P(p, d) for p in ps]).set_stroke(D_COL[d], width=4.2)
            curves[d] = c
            dots[d] = VGroup(*[Dot(ax.c2p(pt["p"], pt["pL"]), radius=0.045, color=D_COL[d]) for pt in cur[str(d)]])
        curve_lab = {d: dlabels[d].copy().scale(0.85).next_to(ax.c2p(0.04, cur[str(d)][0]["pL"]), LEFT, buff=0.16) for d in DS}
        CAM_PLOT = np.array([PLOT_C[0] - 0.2, 0, 0])

        with self.beat("curves") as T:
            cu = Cues(self, "curves", T)
            k = min(1.0, T / 13.4)
            # The lattices hand their labels to the curves; the p dial becomes the p axis.
            dial = self.dial
            dial.pointer.clear_updaters()
            self.play(
                *[FadeOut(lats[d], scale=0.85, shift=0.2 * DOWN) for d in DS],
                FadeOut(dial.pointer),
                run_time=0.7 * k,
            )
            self.play(
                frame.animate.move_to(CAM_PLOT),
                *[Transform(dlabels[d], curve_lab[d]) for d in DS],
                ReplacementTransform(dial.line, ax.x_axis),
                ReplacementTransform(dial.ticks, xt),
                run_time=1.2 * k,
            )
            self.play(Create(ax.y_axis), FadeIn(yt), FadeIn(grid), FadeIn(xlab), FadeIn(ylab), run_time=0.8 * k)
            # Curves grow left to right; each measured point appears as the pen passes it.
            reveal = ValueTracker(0.04)
            for d in DS:
                for dot, pt in zip(dots[d], cur[str(d)]):
                    dot.set_opacity(0)
                    dot.add_updater(lambda m, pp=pt["p"]: m.set_opacity(1.0 if reveal.get_value() >= pp - 1e-9 else 0.0))
                self.add(dots[d])
            # Callout on the first point drawn: the leftmost d = 9 point is 300,000 decoded memories.
            p9 = cur["9"][0]
            note = VGroup(
                MX(rf"{p9['trials']:,}".replace(",", "{,}"), size=36, color=D_COL[9]),
                TX(r"decoded memories", size=30, color=MUTED),
            ).arrange(RIGHT, buff=0.18)
            note.move_to(ax.c2p(0.053, 10**-2.33), aligned_edge=LEFT)
            lead = Line(ax.c2p(p9["p"], p9["pL"]) + RIGHT * 0.09, note.get_left() + LEFT * 0.1, stroke_width=1.5, color=MUTED)
            draw_t = max(2.6, min(3.4, cu.at("Above a critical") - cu.now() - 0.9))
            self.play(
                *[Create(curves[d], rate_func=linear) for d in DS],
                reveal.animate.set_value(0.16),
                Succession(Wait(0.25), AnimationGroup(Create(lead), FadeIn(note, shift=0.1 * RIGHT), run_time=0.8)),
                run_time=draw_t,
                rate_func=linear,
            )
            for d in DS:
                for dot in dots[d]:
                    dot.clear_updaters()
                    dot.set_opacity(1)
            # The noise marker returns at the dial's last value, above threshold.
            cu.until(cu.at("Above a critical") - 0.3)
            marker = self.make_marker()
            self.play(FadeOut(VGroup(note, lead)), FadeIn(marker), run_time=0.7)
            cu.until(cu.at("Below it"))
            self.play(self.pv.animate.set_value(0.05), run_time=max(2.0, min(3.6, cu.left() - 0.6)), rate_func=smooth)

        # ================================================================== value
        pth = data["thresholds"]["bitflip"]["estimate"]
        pph = data["thresholds"]["phenomenological"]["estimate"]
        pcir = data["thresholds"]["circuit"]["estimate"]
        RC = 4.35  # centre of the right-hand column once the camera is back at the origin
        with self.beat("value") as T:
            cu = Cues(self, "value", T)
            k = min(1.0, T / 11.85)
            self.play(self.pv.animate.set_value(pth), run_time=1.3 * k, rate_func=smooth)
            xc = 0.0965
            yc = np.mean([fns[d](xc) for d in DS])
            ring = Circle(radius=0.42, color=YELLOW, stroke_width=3.5).move_to(ax.c2p(xc, 10**yc))
            self.play(Create(ring), run_time=0.8 * k)
            cu.until(cu.at("For this simple") - 0.2)
            plab = MX(r"p_{\mathrm{th}} \approx " + pct(pth) + r"\%", size=42, color=YELLOW)
            plab.move_to(ax.c2p(0.06, 10**-0.62))
            self.play(Write(plab), run_time=1.0 * k)
            # Camera eases back to make room: a log number line of thresholds.
            NL_Y, X0, X1 = 0.75, 2.55, 6.75
            lo, hi = math.log10(0.006), math.log10(0.14)

            def nx(p):
                return X0 + (math.log10(p) - lo) / (hi - lo) * (X1 - X0)

            nline = Line([X0, NL_Y, 0], [X1, NL_Y, 0], stroke_width=2.2, color=MUTED)
            nticks = VGroup(*[Line([nx(p), NL_Y - 0.07, 0], [nx(p), NL_Y + 0.07, 0], stroke_width=2, color=MUTED) for p in (0.01, 0.1)])
            nhead = MX(r"p_{\mathrm{th}}", size=42, color=MUTED).next_to(nline, LEFT, buff=0.22)
            self.play(frame.animate.move_to(ORIGIN), Create(nline), FadeIn(nticks), FadeIn(nhead), run_time=1.1 * k)

            def mark(p, txt, tag, color, extra=None):
                dot = Dot([nx(p), NL_Y, 0], radius=0.085, color=color)
                val = MX(txt, size=40, color=color).next_to(dot, UP, buff=0.22)
                tg = TX(tag, size=30, color=MUTED).next_to(dot, DOWN, buff=0.24)
                g = VGroup(dot, val, tg)
                if extra is not None:
                    g.add(TX(extra, size=28, color=FAINT).next_to(tg, DOWN, buff=0.1))
                return g

            m1 = mark(pth, pct(pth) + r"\%", r"\shortstack{bit\\flips}", YELLOW)
            m2 = mark(pph, pct(pph) + r"\%", r"\shortstack{lying\\checks}", AMBER)
            m3 = mark(pcir, r"\sim 1\%", r"\shortstack{faulty\\gates}", CORAL, extra=r"\textit{literature}")
            self.play(ReplacementTransform(plab[0][-4:].copy(), m1[1]), FadeIn(m1[0], scale=0.5), FadeIn(m1[2]), run_time=0.9 * k)
            cu.until(cu.at("With checks"))
            self.play(TransformFromCopy(m1[0], m2[0]), FadeIn(m2[1:], shift=0.25 * LEFT), run_time=1.0 * k)
            cu.until(cu.at("For full circuits"))
            self.play(TransformFromCopy(m2[0], m3[0]), FadeIn(m3[1:], shift=0.25 * LEFT), run_time=1.0 * k)
            nl = VGroup(nline, nticks, nhead, m1, m2, m3)

        # ================================================================== lambda
        lam = data["lambda"]["chosen"]
        with self.beat("lambda") as T:
            cu = Cues(self, "lambda", T)
            k = min(1.0, T / 14.2)
            P_L = lam["p"]
            ghost = DashedLine(ax.c2p(pth, 10**-2.5), ax.c2p(pth, 1.0), dash_length=0.08, stroke_width=2, color=YELLOW).set_opacity(0.45)
            self.add(ghost)
            # The other thresholds have made their point: they clear the column.
            self.play(
                FadeOut(nl, shift=0.3 * UP),
                FadeOut(ring),
                plab.animate.set_opacity(0.45),
                self.pv.animate.set_value(P_L),
                run_time=1.6 * k,
                rate_func=smooth,
            )
            # Arrows between the curves at fixed p.
            e = {5: lam["e5"], 7: lam["e7"], 9: lam["e9"]}
            arr = VGroup(
                Arrow(ax.c2p(P_L, e[5]), ax.c2p(P_L, e[7]), buff=0.1, stroke_width=4, color=YELLOW, max_tip_length_to_length_ratio=0.35),
                Arrow(ax.c2p(P_L, e[7]), ax.c2p(P_L, e[9]), buff=0.1, stroke_width=4, color=YELLOW, max_tip_length_to_length_ratio=0.35),
            )
            self.play(LaggedStart(*[GrowFromCenter(a) for a in arr], lag_ratio=0.4), run_time=0.9 * k)
            # Lift the slice out of the plot and magnify it.
            RX, RY0, RY1 = 3.35, 1.95, -0.25
            l5, l9 = math.log10(e[5]), math.log10(e[9])

            def ry(v):
                return RY0 + (math.log10(v) - l5) / (l9 - l5) * (RY1 - RY0)

            rdots = VGroup(*[Dot([RX, ry(e[d]), 0], radius=0.09, color=D_COL[d]) for d in DS])
            rline = Line([RX, RY0 + 0.35, 0], [RX, RY1 - 0.35, 0], stroke_width=2.5, color=TEXT).set_opacity(0.55)
            src_line = Line(ax.c2p(P_L, e[5]) + UP * 0.25, ax.c2p(P_L, e[9]) + DOWN * 0.25, stroke_width=2.5, color=TEXT).set_opacity(0.55)
            src_dots = VGroup(*[Dot(ax.c2p(P_L, e[d]), radius=0.06, color=D_COL[d]) for d in DS])
            elabs = VGroup(
                *[MX(rf"\varepsilon_{d} = {100 * e[d]:.2f}\%", size=36, color=D_COL[d]).next_to(rdots[i], RIGHT, buff=0.25) for i, d in enumerate(DS)]
            )
            ptag = MX(rf"p = {100 * P_L:.0f}\%", size=36, color=MUTED).next_to(rline, UP, buff=0.14)
            arcs, rlabs = VGroup(), VGroup()
            for (a, b), r in zip(((0, 1), (1, 2)), (lam["l57"], lam["l79"])):
                ca = CurvedArrow(rdots[a].get_center() + LEFT * 0.14, rdots[b].get_center() + LEFT * 0.14, angle=math.pi * 0.6, color=YELLOW, stroke_width=3.5, tip_length=0.16)
                arcs.add(ca)
                rlabs.add(MX(rf"\div\,{r:.2f}", size=36, color=YELLOW).next_to(ca, LEFT, buff=0.12))
            cu.until(max(cu.now(), cu.at("divides") - 0.6))
            self.add(src_line, src_dots)
            self.play(ReplacementTransform(src_line, rline), ReplacementTransform(src_dots, rdots), run_time=1.3 * k)
            self.play(FadeIn(ptag), LaggedStart(*[FadeIn(m, shift=0.15 * RIGHT) for m in elabs], lag_ratio=0.25), run_time=1.0 * k)
            self.play(LaggedStart(*[Create(a) for a in arcs], lag_ratio=0.5), LaggedStart(*[FadeIn(m) for m in rlabs], lag_ratio=0.5), run_time=1.2 * k)
            cu.until(max(cu.now(), cu.at("called lambda") - 0.2))
            eq = MX(r"\Lambda", r"=", r"{\varepsilon_d \over \varepsilon_{d+2}}", size=52).move_to([RC, -1.55, 0])
            eq[0].set_color(YELLOW)
            self.play(Write(eq), run_time=1.1 * k)
            cu.until(max(cu.now(), cu.at("In 2024")))
            g1 = MX(r"\Lambda_{\text{Willow}} \approx 2.14", size=38, color=TEXT)
            g2 = TX(r"Google Quantum AI, 2024", size=28, color=MUTED)
            goo = VGroup(g1, g2).arrange(DOWN, buff=0.16).move_to([RC, -2.95, 0])
            self.play(FadeIn(goo, shift=0.12 * UP), run_time=0.9 * k)
            cu.until(cu.T - 0.75)
            self.marker.clear_updaters()
            everything = VGroup(*[m for m in self.mobjects if isinstance(m, VMobject) and m is not frame])
            self.play(FadeOut(everything), run_time=0.65)

    # ---------------------------------------------------------------- helpers
    def grow_in(self, big: Lattice, seed: Lattice | None, run_time: float):
        """Grow `big` ring by ring out of `seed` (a smaller lattice already on its centre)."""
        c = big.center_pt
        elems = [*big.tiles, *big.qubits]

        def ring(m):
            return int(round(2 * np.max(np.abs(m.get_center() - c)) / big.s + 1e-6))

        half = 0 if seed is None else (seed.d - 1) / 2 * big.s + 1e-6
        inner = [m for m in elems if seed is not None and np.max(np.abs(m.get_center() - c)) <= half]
        outer = [m for m in elems if m not in inner]
        rings = sorted({ring(m) for m in outer})
        groups = [AnimationGroup(*[FadeIn(m, scale=0.5) for m in outer if ring(m) == r]) for r in rings]
        self.add(big.dots)
        anims = [LaggedStart(*groups, lag_ratio=0.55, run_time=run_time)]
        if seed is not None:
            anims += [FadeOut(seed, run_time=run_time * 0.35), *[FadeIn(m, run_time=run_time * 0.35) for m in inner]]
        return AnimationGroup(*anims, run_time=run_time)

    def unspark(self, L: Lattice, qs):
        return AnimationGroup(*[L.qubits[q].animate.set_fill(BG, opacity=1).set_stroke("#F4F6FB") for q in qs])

    def make_dial(self):
        """The p dial: a number line over the same p range as the plot's axis."""
        y = 3.15
        x0, x1 = -3.9, 3.9

        def X(p):
            return x0 + (p - 0.02) / 0.15 * (x1 - x0)

        line = Line([x0, y, 0], [x1, y, 0], stroke_width=2.2, color=MUTED)
        ticks = VGroup(*[MX(rf"{v}\%", size=28, color=MUTED).move_to([X(v / 100), y - 0.32, 0]) for v in (4, 8, 12, 16)])
        tri = Triangle(color=TEXT, fill_opacity=1, stroke_width=0).scale(0.09).rotate(math.pi)
        num = DecimalNumber(2.0, num_decimal_places=1, font_size=34, color=TEXT)
        pre = MX(r"p =", size=34)
        suf = MX(r"\%", size=34)
        pointer = VGroup(tri, pre, num, suf)

        def upd(m):
            p = self.pv.get_value()
            num.set_value(100 * p)
            tri.move_to([X(p), y + 0.12, 0])
            num.next_to(pre, RIGHT, buff=0.16)
            suf.next_to(num, RIGHT, buff=0.06)
            VGroup(pre, num, suf).next_to(tri, UP, buff=0.1)

        pointer.add_updater(upd)
        upd(pointer)
        dial = VGroup(line, ticks, pointer)
        dial.line, dial.ticks, dial.pointer = line, ticks, pointer
        self.dial = dial
        return dial

    def make_marker(self):
        """Vertical noise marker on the plot, with dots riding the three curves."""
        ax, fns = self.ax, self.fns
        line = Line(ax.c2p(0.1, 10**-2.5), ax.c2p(0.1, 1.0), stroke_width=2.2, color=TEXT).set_opacity(0.6)
        riders = VGroup(*[Dot(radius=0.085, color=D_COL[d]).set_z_index(5) for d in DS])
        num = DecimalNumber(15.0, num_decimal_places=1, font_size=34, color=TEXT)
        pre = MX(r"p =", size=34)
        suf = MX(r"\%", size=34)
        lab = VGroup(pre, num, suf)

        def upd(m):
            p = self.pv.get_value()
            line.put_start_and_end_on(ax.c2p(p, 10**-2.5), ax.c2p(p, 1.0))
            for r, d in zip(riders, DS):
                r.move_to(ax.c2p(p, 10 ** fns[d](p)))
            num.set_value(100 * p)
            num.next_to(pre, RIGHT, buff=0.16)
            suf.next_to(num, RIGHT, buff=0.06)
            lab.next_to(line, UP, buff=0.12)

        g = VGroup(line, riders, lab)
        g.add_updater(upd)
        upd(g)
        self.marker = g
        return g
