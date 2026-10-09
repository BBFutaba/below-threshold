"""DiscretizationScene (chapter 6): a small Rx(theta) drift, measured by the parity checks.

Data: media/data/discretization.json (scripts/manim-data.ts): 200 runs of the QState
state-vector simulator (src/core/quantum.ts): |000>, rx(0, 0.9), two ancilla parity checks
Z1Z2 and Z2Z3 measured with makeRng(6006). Bloch vectors come from QState.bloch().
"""

import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from manim import *  # noqa: F403,E402

from common import (  # noqa: E402
    BG,
    BORDER,
    CORAL,
    FAINT,
    GREEN,
    MUTED,
    QSTROKE,
    SURFACE,
    TEAL,
    TEXT,
    TILE_FILL,
    Captions,
    H,
    T,
    eyebrow,
    footnote,
    load,
    setup,
)


def bar_shape(x, base, w, h, color):
    h = max(h, 0.0)
    if h < 1e-3:
        return VGroup(Line([x - w / 2, base, 0], [x + w / 2, base, 0]).set_stroke(color, width=2, opacity=0.6))
    r = min(0.07, h / 2)
    body = RoundedRectangle(width=w, height=h, corner_radius=r).move_to([x, base + h / 2, 0])
    patch = Rectangle(width=w, height=min(r, h / 2)).move_to([x, base + min(r, h / 2) / 2, 0])
    g = VGroup(body, patch)
    g.set_fill(interpolate_color(ManimColor(BG), ManimColor(color), 0.9), opacity=1).set_stroke(width=0)
    return g


class DiscretizationScene(Scene):
    def construct(self):
        setup(self)
        data = load("discretization")
        theta = data["theta"]
        seq = data["sequence"]
        N = data["runs"]
        cap = Captions(self)
        self.add(eyebrow("BELOW THRESHOLD  ·  CHAPTER 6  ·  WHY ERRORS ARE DIGITAL"))

        # ---- the 3-qubit code ------------------------------------------
        y0 = 0.75
        xs = [-4.75, -3.35, -1.95]
        qubits = VGroup(*[Circle(radius=0.22).move_to([x, y0, 0]).set_fill(BG, opacity=1).set_stroke(QSTROKE, width=2.8) for x in xs])
        qubits.set_z_index(3)
        names = VGroup(*[T(f"qubit {i + 1}", size=21, color=MUTED).next_to(q, DOWN, buff=0.22) for i, q in enumerate(qubits)])
        checks = VGroup()
        dots = VGroup()
        for a, b in [(0, 1), (1, 2)]:
            mid = (qubits[a].get_center() + qubits[b].get_center()) / 2
            h = (xs[b] - xs[a]) / 2 * 0.93
            dm = Polygon(mid + LEFT * h, mid + UP * h * 0.62, mid + RIGHT * h, mid + DOWN * h * 0.62)
            dm.set_fill(TEAL, opacity=TILE_FILL).set_stroke(TEAL, width=1.6, opacity=0.55)
            checks.add(dm)
            dots.add(Dot(mid, radius=0.08, color=BG).set_opacity(0).set_z_index(1))

        # Drift gauge on qubit 1: the Bloch vector's tilt away from |0> (QState.bloch()).
        b0 = data["blochBefore"]
        tilt = math.atan2(math.hypot(b0["x"], b0["y"]), b0["z"])  # = theta for this state
        gc = np.array([xs[0], 2.3, 0])
        R = 0.55
        dial = Circle(radius=R).move_to(gc).set_stroke(BORDER, width=2.5).set_fill(SURFACE, opacity=0.9)
        top_lbl = T("|0⟩", size=21, color=MUTED).next_to(dial, UP, buff=0.06)
        bot_lbl = T("|1⟩", size=21, color=MUTED).next_to(dial, DOWN, buff=0.06)
        angle = ValueTracker(0.0)

        def needle():
            a = angle.get_value()
            tip = gc + R * 0.86 * np.array([math.sin(a), math.cos(a), 0])
            ln = Line(gc, tip).set_stroke(TEXT, width=4)
            return VGroup(ln, Dot(tip, radius=0.06, color=TEXT), Dot(gc, radius=0.04, color=TEXT))

        nd = always_redraw(needle)

        def arc():
            a = angle.get_value()
            if a < 1e-3:
                return VGroup()
            return Arc(radius=R * 0.5, start_angle=PI / 2, angle=-a, arc_center=gc).set_stroke(CORAL, width=3)

        ar = always_redraw(arc)
        drift_lbl = VGroup(
            T("qubit 1 drifts by Rx(θ)", size=23, color=TEXT),
            T(f"θ = {theta:g} rad, a small rotation", size=21, color=MUTED),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.1).next_to(dial, RIGHT, buff=0.32)

        self.play(
            LaggedStart(*[FadeIn(q, scale=0.8) for q in qubits], lag_ratio=0.15),
            LaggedStart(*[FadeIn(c, scale=0.85) for c in checks], lag_ratio=0.2),
            FadeIn(names),
            run_time=1.0,
        )
        self.add(dots)
        self.play(FadeIn(dial), FadeIn(top_lbl), FadeIn(bot_lbl), FadeIn(nd), run_time=0.6)
        self.add(ar)
        cap.show("A small drift on qubit 1, not a full flip.")
        self.play(angle.animate.set_value(tilt), FadeIn(drift_lbl, shift=0.1 * LEFT), run_time=1.0)
        self.wait(0.8)

        # ---- histogram -------------------------------------------------
        base = -1.85
        Hmax = 3.55
        bx = [2.2, 4.75]
        bw = 1.45
        axis = Line([0.95, base, 0], [6.1, base, 0]).set_stroke(BORDER, width=2)
        grid = VGroup()
        for f, lab in [(0.5, "50%"), (1.0, "100%")]:
            y = base + f * Hmax
            grid.add(DashedLine([0.95, y, 0], [6.1, y, 0], dash_length=0.08).set_stroke(BORDER, width=1.5))
            grid.add(T(lab, size=21, color=FAINT).move_to([0.65, y, 0]))
        lbl_none = T("no error", size=24, color=TEXT).move_to([bx[0], base - 0.32, 0])
        lbl_flip = T("full flip on qubit 1", size=24, color=TEXT).move_to([bx[1], base - 0.32, 0])

        n = ValueTracker(0)
        cum_none = [0]
        cum_flip = [0]
        for s in seq:
            cum_none.append(cum_none[-1] + (s == "none"))
            cum_flip.append(cum_flip[-1] + (s == "flip1"))

        def counts():
            k = int(round(n.get_value()))
            return k, cum_none[k], cum_flip[k]

        def bars():
            k, a, b = counts()
            return VGroup(bar_shape(bx[0], base, bw, Hmax * a / N, GREEN), bar_shape(bx[1], base, bw, Hmax * b / N, CORAL))

        fm = data["formula"]

        def bar_labels():
            k, a, b = counts()
            g = VGroup()
            # Sit above both the bar and its formula tick, so the two never collide.
            for x, c, f in [(bx[0], a, fm["none"]), (bx[1], b, fm["flip1"])]:
                h = max(Hmax * c / N, Hmax * f if k == N else 0)
                g.add(T(f"{c}", size=26, color=TEXT, weight="SEMIBOLD").move_to([x, base + h + 0.3, 0]))
            return g

        def counter():
            k, a, b = counts()
            return T(f"run {k} / {N}", size=24, color=MUTED).move_to([3.5, 2.6, 0])

        bars_m = always_redraw(bars)
        labels_m = always_redraw(bar_labels)
        counter_m = always_redraw(counter)

        # Run strip: one cell per real run, in order.
        cols = 25
        cell = 0.17
        gap = 0.04
        strip = VGroup()
        sx0 = -5.3
        sy0 = -0.85
        for i, s in enumerate(seq):
            r, c = divmod(i, cols)
            sq = Square(cell).move_to([sx0 + c * (cell + gap), sy0 - r * (cell + gap), 0])
            sq.set_fill(GREEN if s == "none" else CORAL, opacity=0.0).set_stroke(width=0)
            strip.add(sq)
        strip_frame = VGroup(*[Square(cell).move_to(sq).set_fill(SURFACE3_COLOR, opacity=1).set_stroke(width=0) for sq in strip])
        strip_lbl = T("each run, in order", size=21, color=MUTED).next_to(strip_frame, UP, buff=0.14).align_to(strip_frame, LEFT)

        def strip_update(m):
            k = int(round(n.get_value()))
            for i, sq in enumerate(m):
                sq.set_fill(opacity=0.9 if i < k else 0.0)

        strip.add_updater(strip_update)

        cap.show("Now run the two checks, 200 times.")
        self.play(
            Create(axis), FadeIn(grid), FadeIn(lbl_none), FadeIn(lbl_flip), FadeIn(counter_m),
            FadeIn(strip_frame), FadeIn(strip_lbl),
            run_time=0.7,
        )
        self.add(bars_m, labels_m, strip)

        # First runs, slowly: each measurement snaps the drift to 0 or to a full flip.
        ring = Circle(radius=0.36).move_to(qubits[0]).set_stroke(CORAL, width=3.5).set_z_index(4)
        xl = T("X", size=24, color=CORAL, weight="BOLD").move_to(qubits[0]).set_z_index(4)
        flag = VGroup(ring, xl)
        bz = data["blochAfterZ"]
        for i in range(6):
            flip = seq[i] == "flip1"
            target = PI if bz[i] < 0 else 0.0  # real post-measurement Bloch z = -1 or +1
            self.play(*[Indicate(c, color=TEAL, scale_factor=1.06) for c in checks], run_time=0.3)
            anims = [angle.animate.set_value(target), n.animate.set_value(i + 1)]
            if flip:
                anims += [checks[0].animate.set_fill(opacity=0.85).set_stroke(opacity=1), dots[0].animate.set_opacity(1), FadeIn(flag, scale=1.2)]
            self.play(*anims, run_time=0.35)
            self.wait(0.12)
            reset = [angle.animate.set_value(tilt)]
            if flip:
                reset += [checks[0].animate.set_fill(opacity=TILE_FILL).set_stroke(opacity=0.55), dots[0].animate.set_opacity(0), FadeOut(flag)]
            self.play(*reset, run_time=0.25)

        # The remaining runs, fast.
        self.play(n.animate.set_value(N), run_time=4.0, rate_func=rate_functions.ease_in_out_sine)
        self.wait(0.4)

        # ---- compare with the formula ------------------------------------
        meas = data["measured"]
        ticks = VGroup()
        for x, f in [(bx[0], fm["none"]), (bx[1], fm["flip1"])]:
            y = base + Hmax * f
            ticks.add(DashedLine([x - bw / 2 - 0.12, y, 0], [x + bw / 2 + 0.12, y, 0], dash_length=0.07).set_stroke(TEXT, width=3))
        cx = [0.95, 3.55, 4.35]
        hdr = VGroup(
            T("measured", size=21, color=FAINT).move_to([cx[1], 3.0, 0]),
            VGroup(DashedLine(LEFT * 0.2, RIGHT * 0.2, dash_length=0.07).set_stroke(TEXT, width=3), T("formula", size=21, color=FAINT)).arrange(RIGHT, buff=0.12).move_to([cx[2], 3.0, 0], aligned_edge=LEFT),
        )
        table = VGroup(hdr)
        for i, (name, color, m, form, f) in enumerate([
            ("no error", GREEN, meas["none"], "cos²(θ/2)", fm["none"]),
            ("full flip", CORAL, meas["flip1"], "sin²(θ/2)", fm["flip1"]),
        ]):
            y = 2.58 - i * 0.42
            sw = Square(0.2).set_fill(color, opacity=1).set_stroke(width=0).move_to([cx[0] + 0.1, y, 0])
            table.add(VGroup(
                sw,
                T(name, size=22, color=TEXT).next_to(sw, RIGHT, buff=0.15),
                T(f"{m:.0%}", size=22, color=TEXT, weight="SEMIBOLD").move_to([cx[1], y, 0]),
                T(f"{form} = {f:.0%}", size=22, color=TEXT).move_to([cx[2], y, 0], aligned_edge=LEFT),
            ))
        other = data["counts"]["01"] + data["counts"]["11"]
        other_t = T(f"any other outcome: {other} of {N}", size=21, color=MUTED)
        other_t.next_to(axis, DOWN, buff=0.72).align_to(axis, RIGHT)
        cap.show("Two outcomes only, at the predicted rates.")
        self.play(FadeOut(counter_m), Create(ticks), run_time=0.6)
        self.play(FadeIn(table, shift=0.1 * DOWN), FadeIn(other_t), run_time=0.6)
        self.wait(1.4)
        cap.show("Measuring snaps a small drift into a full flip, or nothing.")
        self.wait(2.6)


SURFACE3_COLOR = "#1B2136"
