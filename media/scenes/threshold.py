"""ThresholdScene: logical vs physical error rate for d = 5, 7, 9 from real Monte Carlo runs.

Data: media/data/threshold.json (scripts/manim-data.ts). Bit-flip noise, decoder 'mwpm'.
Points inside the validation window (8-12%) are the validation runs in src/data/validation.json
(4000 failures per point); points outside it come from runPoint() in src/core/simulate.ts
(1500 failures or 300k trials). 95% Wilson intervals. The crossing is computed from the
merged curves by crossings() in src/core/stats.ts; the full finite-size fit quoted on screen
is the bitflip/mwpm verdict in validation.json.
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from manim import *  # noqa: F403,E402

from common import (  # noqa: E402
    AMBER,
    BG,
    BORDER,
    FAINT,
    GREEN,
    MUTED,
    SURFACE,
    TEXT,
    Captions,
    H,
    T,
    eyebrow,
    load,
    setup,
)

# One hue, dim -> bright with distance (validated ordinal ramp on the dark surface).
DCOL = {5: "#6F7BA8", 7: "#A9B6E0", 9: "#F2F5FF"}

X0, X1 = -5.05, 2.45
Y0, Y1 = -1.9, 2.8
P0, P1 = 0.025, 0.165
L0, L1 = -2.6, -0.3


def X(p):
    return X0 + (p - P0) / (P1 - P0) * (X1 - X0)


def Y(pl):
    return Y0 + (math.log10(max(pl, 1e-6)) - L0) / (L1 - L0) * (Y1 - Y0)


def P_of_x(x):
    return P0 + (x - X0) / (X1 - X0) * (P1 - P0)


def pnum(p):
    s = f"{p * 100:.1f}"
    return s[:-2] if s.endswith(".0") else s


def pct(v):
    if v >= 0.1:
        return f"{v * 100:.0f}%"
    if v >= 0.01:
        return f"{v * 100:.1f}%"
    return f"{v * 100:.2f}%"


class ThresholdScene(Scene):
    def construct(self):
        setup(self)
        data = load("threshold")
        ds = data["distances"]
        curves = {int(d): pts for d, pts in data["curves"].items()}
        ps = data["ps"]
        cross = data["crossings"][f"{ds[0]}/{ds[-1]}"][0]
        val = data.get("validationVerdict") or {}
        vd = data.get("validationDistances") or ds
        cap = Captions(self)
        self.add(eyebrow("BELOW THRESHOLD  ·  THE THRESHOLD"))

        # ---- axes ---------------------------------------------------------
        axes = VGroup()
        axes.add(Line([X0, Y0, 0], [X1, Y0, 0]).set_stroke(BORDER, width=2.5))
        axes.add(Line([X0, Y0, 0], [X0, Y1, 0]).set_stroke(BORDER, width=2.5))
        grid = VGroup()
        labels = VGroup()
        for p in [0.04, 0.06, 0.08, 0.10, 0.12, 0.14, 0.16]:
            grid.add(Line([X(p), Y0, 0], [X(p), Y1, 0]).set_stroke(BORDER, width=1, opacity=0.45))
            labels.add(T(f"{p * 100:.0f}%", size=21, color=MUTED).move_to([X(p), Y0 - 0.27, 0]))
        for v, s in [(0.003, "0.3%"), (0.01, "1%"), (0.03, "3%"), (0.1, "10%"), (0.3, "30%")]:
            grid.add(Line([X0, Y(v), 0], [X1, Y(v), 0]).set_stroke(BORDER, width=1, opacity=0.45))
            labels.add(T(s, size=21, color=MUTED).move_to([X0 - 0.12, Y(v), 0], aligned_edge=RIGHT))
        xt = T("physical error rate per qubit, p", size=23, color=MUTED).move_to([(X0 + X1) / 2, Y0 - 0.66, 0])
        yt = T("logical error rate", size=23, color=MUTED).rotate(PI / 2).move_to([X0 - 1.05, (Y0 + Y1) / 2, 0])
        self.play(Create(axes), FadeIn(grid), FadeIn(labels), FadeIn(xt), FadeIn(yt), run_time=0.9)
        cap.show("More qubits only help if each is good enough.")

        # ---- curves with 95% bands -----------------------------------------
        legend = VGroup()
        for d in ds:
            sw = Line(LEFT * 0.22, RIGHT * 0.22).set_stroke(DCOL[d], width=4)
            legend.add(VGroup(sw, T(f"d = {d}", size=22, color=TEXT)).arrange(RIGHT, buff=0.14))
        band_sw = Rectangle(width=0.44, height=0.18).set_fill(MUTED, opacity=0.3).set_stroke(width=0)
        legend.add(VGroup(band_sw, T("95% interval", size=21, color=MUTED)).arrange(RIGHT, buff=0.14))
        legend.arrange(DOWN, aligned_edge=LEFT, buff=0.14).move_to([X0 + 0.35, Y1 - 0.15, 0], aligned_edge=UL)

        lines = {}
        for d in ds:
            pts = curves[d]
            band = Polygon(
                *[np.array([X(q["p"]), Y(q["hi"]), 0]) for q in pts],
                *[np.array([X(q["p"]), Y(q["lo"]), 0]) for q in reversed(pts)],
            ).set_fill(DCOL[d], opacity=0.22).set_stroke(width=0)
            line = VMobject().set_points_as_corners([np.array([X(q["p"]), Y(q["pL"]), 0]) for q in pts])
            line.set_stroke(DCOL[d], width=3.2)
            marks = VGroup(*[Dot([X(q["p"]), Y(q["pL"]), 0], radius=0.05, color=DCOL[d]).set_stroke(BG, width=2) for q in pts])
            tag = T(f"d = {d}", size=21, color=TEXT).next_to([X(pts[0]["p"]), Y(pts[0]["pL"]), 0], LEFT, buff=0.14)
            lines[d] = line
            idx = ds.index(d)
            self.play(FadeIn(band), Create(line), LaggedStart(*[FadeIn(m, scale=0.5) for m in marks], lag_ratio=0.05), FadeIn(tag), FadeIn(legend[idx]), run_time=1.0)
        self.play(FadeIn(legend[-1]), run_time=0.3)

        # ---- the crossing ---------------------------------------------------
        cx = X(cross)
        vline = DashedLine([cx, Y0, 0], [cx, Y1, 0], dash_length=0.1).set_stroke(TEXT, width=2.2, opacity=0.8)
        ctag = T(f"curves cross ≈ {cross * 100:.1f}%", size=22, color=TEXT).next_to([cx, Y1, 0], RIGHT, buff=0.12).shift(DOWN * 0.18)
        cap.show("The curves cross at the threshold.")
        self.play(Create(vline), FadeIn(ctag), run_time=0.8)
        self.wait(0.6)

        # ---- noise marker and readout -----------------------------------------
        card = RoundedRectangle(width=3.6, height=4.75, corner_radius=0.22).set_fill(SURFACE, opacity=0.92).set_stroke(BORDER, width=1.5)
        card.move_to([4.72, 0.45, 0])
        pm = ValueTracker(0.05)
        ox = card.get_left()[0] + 0.3

        def nearest_p():
            v = pm.get_value()
            return min(ps, key=lambda q: abs(q - v))

        def readout():
            p = nearest_p()
            j = ps.index(p)
            g = VGroup(T(f"noise p = {pnum(p)}%", size=26, color=TEXT, weight="SEMIBOLD").move_to([ox, 2.4, 0], aligned_edge=LEFT))
            g.add(T("logical error rate", size=21, color=FAINT).move_to([ox, 1.95, 0], aligned_edge=LEFT))
            for i, d in enumerate(ds):
                y = 1.55 - i * 0.42
                g.add(Line(LEFT * 0.18, RIGHT * 0.18).set_stroke(DCOL[d], width=4).move_to([ox + 0.18, y, 0]))
                g.add(T(f"d = {d}", size=22, color=TEXT).move_to([ox + 0.5, y, 0], aligned_edge=LEFT))
                g.add(T(pct(curves[d][j]["pL"]), size=22, color=TEXT, weight="SEMIBOLD").move_to([ox + 2.95, y, 0], aligned_edge=RIGHT))
            return g

        def verdict_state():
            j = ps.index(nearest_p())
            return 1.0 if curves[ds[-1]][j]["pL"] < curves[ds[0]][j]["pL"] else 0.0

        below = VGroup(
            T("▼ Below threshold", size=24, color=GREEN, weight="SEMIBOLD"),
            T("bigger codes make", size=22, color=TEXT),
            T("things better", size=22, color=TEXT),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.08).move_to([ox, -0.5, 0], aligned_edge=LEFT)
        above = VGroup(
            T("▲ Above threshold", size=24, color=AMBER, weight="SEMIBOLD"),
            T("bigger codes make", size=22, color=TEXT),
            T("things worse", size=22, color=TEXT),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.08).move_to([ox, -0.5, 0], aligned_edge=LEFT)
        sep = Line([card.get_left()[0] + 0.3, 0.05, 0], [card.get_right()[0] - 0.3, 0.05, 0]).set_stroke(BORDER, width=1.5)
        foot = VGroup(
            T("MWPM · bit-flip noise", size=21, color=FAINT),
            T(f"scaling fit, d = {max(7, vd[0])} to {vd[-1]}: {val.get('estimate', cross) * 100:.1f}%", size=21, color=FAINT),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.06).move_to([ox, -1.5, 0], aligned_edge=LEFT)

        mix = {"v": verdict_state()}
        below.set_opacity(mix["v"])
        above.set_opacity(1 - mix["v"])

        def blend(m, dt):
            target = verdict_state()
            v = mix["v"]
            step = dt / 0.3
            v = min(target, v + step) if target > v else max(target, v - step)
            mix["v"] = v
            below.set_opacity(v)
            above.set_opacity(1 - v)

        def marker():
            p = pm.get_value()
            x = X(p)
            g = VGroup(Line([x, Y0, 0], [x, Y1, 0]).set_stroke(AMBER if verdict_state() < 0.5 else GREEN, width=3, opacity=0.9))
            for d in ds:
                pts = curves[d]
                for a, b in zip(pts, pts[1:]):
                    if a["p"] <= p <= b["p"]:
                        t = (p - a["p"]) / (b["p"] - a["p"])
                        ly = (1 - t) * math.log10(a["pL"]) + t * math.log10(b["pL"])
                        g.add(Dot([x, Y(10 ** ly), 0], radius=0.075, color=DCOL[d]).set_stroke(BG, width=2.5))
                        break
            return g

        mk = always_redraw(marker)
        ro = always_redraw(readout)
        holder = VGroup(below, above)
        holder.add_updater(blend)
        cap.show("Below it, each bigger code wins.")
        self.play(FadeIn(card), FadeIn(sep), FadeIn(foot), FadeIn(mk), FadeIn(ro), run_time=0.7)
        self.add(holder)
        self.wait(1.8)
        cap.show("Above it, adding qubits adds errors.")
        self.play(pm.animate.set_value(0.14), run_time=3.2, rate_func=smooth)
        self.wait(1.6)
        cap.show("Get below threshold, then grow the code.")
        self.play(pm.animate.set_value(0.06), run_time=2.6, rate_func=smooth)
        self.wait(2.0)
