"""Chapter 3: why errors become digital.

Everything is read from media/data/film/digital.json (scripts/film/digital.ts), which re-runs
the discretization experiment of scripts/manim-data.ts with the same code and seed and checks
it against media/data/discretization.json:

- logical |0> = |000>, data qubit 0 rotated by Rx(theta), theta = 0.9 (QState);
- Rx(theta) = cos(theta/2) I - i sin(theta/2) X, read off the simulator's own gate matrix;
- 200 seeded runs (seed 6006) of the two parity checks, in order; each square is one run;
- the histogram is the real counts (00: 168, 10: 32, 01: 0, 11: 0);
- the dashed marks are 200 cos^2(theta/2) and 200 sin^2(theta/2), the state-vector odds.
"""

from __future__ import annotations

import math

import numpy as np
from manim import (
    DOWN,
    PI,
    RIGHT,
    UP,
    Arc,
    Circle,
    Circumscribe,
    DashedLine,
    Dot,
    FadeIn,
    FadeOut,
    Flash,
    Indicate,
    Integer,
    LaggedStart,
    Line,
    MoveAlongPath,
    ReplacementTransform,
    Rectangle,
    RoundedRectangle,
    TransformFromCopy,
    UpdateFromAlphaFunc,
    VGroup,
    Write,
    smooth,
)

from common import BG, BLUE, CORAL, FAINT, MUTED, TEAL, TEXT
from film import MX, TX, YELLOW, NarratedMovingScene, load
from parity import Cued, Glyph, dim, vec_to

N_COLS, N_ROWS = 20, 10


class DigitalScene(Cued, NarratedMovingScene):
    scene_id = "digital"

    def construct(self):
        D = load("film/digital")
        th = D["theta"]
        seq = D["sequence"]
        counts = D["counts"]
        n_runs = D["runs"]
        assert len(seq) == n_runs == sum(counts.values())
        b = D["single"]["bloch"]
        tilt_vec = (-b["y"], b["z"])  # the rotation is about x: draw the y-z plane, tilting right
        assert abs(math.atan2(tilt_vec[0], tilt_vec[1]) - th) < 1e-9
        dec = D["rxDecomposition"]
        assert abs(dec["I"] - math.cos(th / 2)) < 1e-12 and abs(dec["X_im"] + math.sin(th / 2)) < 1e-12
        after_z = D["blochAfterZ"]

        self.chapter_card()

        # ------------------------------------------------------------ drift
        with self.cued("drift") as T:
            row_x = [-2.8, 0.0, 2.8]
            gs = [Glyph((0, 1), R=0.95).move_to([x, -0.35, 0]) for x in row_x]
            for g in gs:
                g.set_z_index(2)
            ket = MX(r"|000\rangle", size=56).move_to(UP * 2.35)
            self.play(LaggedStart(*[FadeIn(g, scale=0.85) for g in gs], lag_ratio=0.12), FadeIn(ket, shift=0.1 * DOWN), run_time=1.2)
            g0 = gs[0]
            # "not clean flips": the flip the code was built for, shown once and undone.
            self.wait_to(self.cue("not clean flips") - 0.6)
            self.play(vec_to(g0, (0, -1), turn=PI), g0.ring.animate.set_stroke(CORAL), run_time=0.7)
            self.play(vec_to(g0, (0, 1), turn=-PI), g0.ring.animate.set_stroke(FAINT), run_time=0.6)
            # "tiny rotations, a sliver of a turn at a time": Rx(theta) in six equal slivers.
            self.wait_to(self.cue("They are tiny rotations"))
            arc = Arc(radius=0.4, angle=1e-4).set_stroke(YELLOW, width=3)
            lab = MX(r"\theta", size=44, color=YELLOW)

            def draw_arc(m):
                a = math.atan2(g0.vec[0], g0.vec[1])
                rad = 0.42 * g0.R
                m.become(Arc(radius=rad, start_angle=PI / 2, angle=-max(a, 1e-4), arc_center=g0.c).set_stroke(YELLOW, width=3).set_z_index(4))

            def place_lab(m):
                a = math.atan2(g0.vec[0], g0.vec[1])
                m.move_to(g0.c + (0.42 * g0.R + 0.24) * np.array([math.sin(a / 2), math.cos(a / 2), 0]))
                m.set_opacity(min(1.0, a / 0.3))

            arc.add_updater(draw_arc)
            lab.add_updater(place_lab)
            arc.set_z_index(4)
            lab.set_z_index(4)
            self.add(arc, lab)
            n_sl = 6
            for k in range(1, n_sl + 1):
                a = th * k / n_sl
                v = (math.sin(a), math.cos(a))
                self.play(vec_to(g0, v), run_time=0.42, rate_func=smooth)
                self.wait(0.12)
            # The real Bloch vector after Rx(theta) (from QState), which the slivers add up to.
            g0.set_vec(tilt_vec)
            eq_rx = MX(r"R_x(\theta)", r"\,|000\rangle", size=56).move_to(ket)
            eq_rx[0][3].set_color(YELLOW)
            self.play(ReplacementTransform(ket, eq_rx[1]), FadeIn(eq_rx[0], shift=0.2 * RIGHT), run_time=0.9)
            self.wait_to(self.cue("How can a code"))
            self.play(dim(VGroup(gs[1], gs[2]), 0.45), run_time=0.8)
            self.play(Indicate(lab, color=YELLOW, scale_factor=1.4), run_time=1.0)

        # ------------------------------------------------------------ runs
        with self.cued("runs") as T:
            px = [-5.55, -4.25, -2.95]
            py = 0.9
            Rp = 0.5
            arc.clear_updaters()
            lab.clear_updaters()
            self.play(FadeOut(arc), FadeOut(lab), run_time=0.35)
            self.play(
                *[g.animate.styled(1.0).scale(Rp / g.R).move_to([x, py, 0]) for g, x in zip(gs, px)],
                eq_rx.animate.scale(0.8).move_to([-4.25, 2.85, 0]),
                run_time=0.9,
            )
            anc_pos = [np.array([(px[0] + px[1]) / 2, -0.5, 0]), np.array([(px[1] + px[2]) / 2, -0.5, 0])]
            ancs = VGroup(*[Circle(radius=0.27).move_to(p).set_stroke(TEAL, width=2.6).set_fill(BG, opacity=1) for p in anc_pos])
            links = VGroup()
            for k, (a, b2) in enumerate([(0, 1), (1, 2)]):
                for q in (a, b2):
                    d = anc_pos[k] - gs[q].c
                    u = d / np.linalg.norm(d)
                    links.add(Line(gs[q].c + u * (Rp + 0.03), anc_pos[k] - u * 0.29).set_stroke(TEAL, width=2, opacity=0.5))
            alabs = VGroup(
                MX(r"Z_0 Z_1", size=36, color=TEAL).next_to(ancs[0], DOWN, buff=0.2),
                MX(r"Z_1 Z_2", size=36, color=TEAL).next_to(ancs[1], DOWN, buff=0.2),
            )
            # Digits for both outcomes, toggled per run (cheap, no re-typesetting).
            digs = [[MX("0", size=36, color=TEAL).move_to(a), MX("1", size=36, color=BG).move_to(a)] for a in ancs]
            for pair in digs:
                for dg in pair:
                    dg.set_opacity(0)
                    dg.set_z_index(3)
            self.play(FadeIn(ancs), FadeIn(links), FadeIn(alabs), run_time=0.6)
            self.add(*[dg for pair in digs for dg in pair])

            # The run grid: one square per run, in run order.
            pitch, side = 0.355, 0.27
            gx0, gy0 = 2.35 - (N_COLS - 1) * pitch / 2, 0.3 + (N_ROWS - 1) * pitch / 2
            cells = [np.array([gx0 + (i % N_COLS) * pitch, gy0 - (i // N_COLS) * pitch, 0]) for i in range(n_runs)]
            col = {"00": BLUE, "10": CORAL}
            squares = VGroup(*[RoundedRectangle(width=side, height=side, corner_radius=0.045).set_stroke(width=0).set_fill(col.get(seq[i], YELLOW), opacity=1).move_to(cells[i]) for i in range(n_runs)])
            slots = VGroup(*[RoundedRectangle(width=side, height=side, corner_radius=0.045).set_stroke(FAINT, width=1, opacity=0.35).set_fill(opacity=0).move_to(c) for c in cells])
            n_lab = MX(r"n =", size=40, color=MUTED)
            n_val = Integer(0, font_size=40, color=TEXT)
            counter = VGroup(n_lab, n_val).arrange(RIGHT, buff=0.18).move_to([2.35, -2.0, 0])
            self.play(FadeIn(slots, lag_ratio=0.002), FadeIn(counter), run_time=0.7)

            def show_outcome(k):
                s = seq[k]
                for a_i, pair in enumerate(digs):
                    bit = int(s[a_i])
                    pair[0].set_opacity(0 if bit else 1)
                    pair[1].set_opacity(1 if bit else 0)
                    ancs[a_i].set_fill(TEAL if bit else BG, opacity=1)

            def clear_outcome():
                for a_i, pair in enumerate(digs):
                    pair[0].set_opacity(0)
                    pair[1].set_opacity(0)
                    ancs[a_i].set_fill(BG, opacity=1)

            def one_run(k, rt):
                """Run k in detail: tilt (unless already tilted), checks pulse, outcome, snap, square."""
                if abs(g0.vec[0] - tilt_vec[0]) > 1e-6:
                    clear_outcome()
                    self.play(vec_to(g0, (0, 1)), run_time=0.15 * rt)
                    self.play(vec_to(g0, tilt_vec), run_time=0.25 * rt)
                pulses = [MoveAlongPath(Dot(li.get_start(), radius=0.055, color=TEAL), li) for li in links]
                self.play(*pulses, run_time=0.3 * rt)
                self.remove(*[p.mobject for p in pulses])
                show_outcome(k)
                zf = after_z[k]
                sq = squares[k].copy().move_to(g0.c).scale(0.6)
                self.play(vec_to(g0, (0, zf)), FadeIn(sq, scale=0.5), run_time=0.25 * rt)
                self.play(sq.animate.move_to(cells[k]).scale(1 / 0.6), n_val.animate.set_value(k + 1), run_time=0.35 * rt, rate_func=smooth)
                self.remove(sq)
                self.add(squares[k])

            one_run(0, 2.0)
            self.wait_to(self.cue("Then do it again"))
            one_run(1, 1.3)
            # The remaining 198 runs, fast, in order; the panel flickers through each real outcome.
            self.wait_to(self.cue("Two hundred times") - 0.2)
            rest = list(range(2, n_runs))
            for i in rest:
                squares[i].set_opacity(0)
            self.add(*[squares[i] for i in rest])

            def fill(m, a):
                f = 2 + a * (n_runs - 2)
                for i in rest:
                    o = float(np.clip(f - i, 0, 1))
                    squares[i].set_fill(opacity=o)
                k = int(min(n_runs - 1, max(2, math.floor(f))))
                show_outcome(k)
                g0.set_vec((0, after_z[k]))
                n_val.set_value(min(n_runs, int(math.floor(f)) + (1 if a >= 1 else 0)))

            # Everything the updater touches is part of the animated mobject (Cairo caches the rest).
            panel = VGroup(g0, ancs, *[dg for pair in digs for dg in pair], n_val)
            self.play(UpdateFromAlphaFunc(VGroup(squares, panel), fill), run_time=max(1.4, T - self.now() - 0.35), rate_func=lambda t: t)
            n_val.set_value(n_runs)

        # ------------------------------------------------------------ two
        with self.cued("two") as T:
            base_y = -2.05
            bins = ["00", "10", "01", "11"]
            bx = {"00": -0.05, "10": 1.75, "01": 3.55, "11": 5.35}
            spitch = 0.14
            per_row = 7
            unit = spitch / per_row  # height per run in the solid bar
            stack_side = 0.115
            axis = Line([-1.0, base_y, 0], [6.2, base_y, 0]).set_stroke(FAINT, width=2)
            blabs = VGroup(*[MX(s, size=40).move_to([bx[s], base_y - 0.38, 0]) for s in bins])
            words = VGroup(
                TX("no error", size=30, color=MUTED).move_to([bx["00"], base_y - 0.88, 0]),
                TX("full flip", size=30, color=MUTED).move_to([bx["10"], base_y - 0.88, 0]),
            )
            # Squares fly into stacks: run i joins its syndrome's column in arrival order.
            fill_k = {s: 0 for s in bins}
            moves = []
            bar_w = per_row * spitch
            for i in range(n_runs):
                s = seq[i]
                k = fill_k[s]
                fill_k[s] += 1
                r_, c_ = divmod(k, per_row)
                p = np.array([bx[s] - bar_w / 2 + spitch * (c_ + 0.5), base_y + spitch * (r_ + 0.5), 0])
                moves.append(squares[i].animate.move_to(p).scale(stack_side / side))
            assert fill_k == counts
            self.play(
                FadeOut(slots),
                FadeOut(counter),
                Write(axis),
                FadeIn(blabs, shift=0.1 * UP),
                LaggedStart(*moves, lag_ratio=0.004),
                run_time=2.4,
            )
            bars = {}
            for s in bins:
                h = counts[s] * unit
                bars[s] = Rectangle(width=bar_w, height=max(h, 1e-3)).set_stroke(width=0).set_fill(col.get(s, FAINT), opacity=0.9 if h > 0 else 0)
                bars[s].move_to([bx[s], base_y + h / 2, 0])
            nums = VGroup(*[Integer(counts[s], font_size=40, color=TEXT if counts[s] else MUTED).next_to(bars[s], UP, buff=0.18) for s in bins])
            self.play(*[FadeIn(bars[s]) for s in bins if counts[s]], FadeOut(squares), LaggedStart(*[FadeIn(nm, shift=0.1 * UP) for nm in nums], lag_ratio=0.12), run_time=0.9)
            # "Most of the time the checks report nothing": a real 00 run on the panel.
            self.wait_to(self.cue("Most of the time"))
            self.play(FadeIn(words[0], shift=0.1 * UP), Indicate(bars["00"], color=BLUE, scale_factor=1.04), show_outcome_anim(VGroup(ancs, *[dg for pair in digs for dg in pair]), show_outcome, seq.index("00")), vec_to(g0, (0, 1)), run_time=0.9)
            # The rotation is a superposition of exactly these two: no error (I) and a full flip (X).
            full = MX(r"R_x(\theta)", "=", r"\cos(\theta/2)", r"\,I", "-", r"i\sin(\theta/2)", r"\,X", size=48)
            full[0][3].set_color(YELLOW)
            full.move_to([1.2, 3.2, 0])
            full[3].set_color(BLUE)
            full[6].set_color(CORAL)
            self.play(
                ReplacementTransform(eq_rx[0], full[0]),
                FadeOut(eq_rx[1], shift=0.2 * UP),
                Write(VGroup(*full[1:])),
                run_time=1.3,
            )
            self.wait_to(self.cue("simply gone"))
            self.play(Circumscribe(gs[0], shape=Circle, color=BLUE, buff=0.1), Indicate(full[3], color=BLUE, scale_factor=1.3), run_time=1.0)
            self.wait_to(self.cue("Now and then"))
            self.play(
                FadeIn(words[1], shift=0.1 * UP),
                Indicate(full[6], color=CORAL, scale_factor=1.3),
                Indicate(bars["10"], color=CORAL, scale_factor=1.04),
                show_outcome_anim(VGroup(ancs, *[dg for pair in digs for dg in pair]), show_outcome, seq.index("10")),
                vec_to(g0, (0, -1), turn=PI),
                run_time=0.9,
            )
            self.wait_to(self.cue("which we know how to undo"))
            fix = MX("X", size=40, color=BLUE).move_to(g0.c + np.array([0.55, 0.5, 0]))
            self.play(FadeIn(fix, scale=1.5), Flash(g0.c, color=BLUE, flash_radius=Rp + 0.12, line_length=0.18), vec_to(g0, (0, 1), turn=-PI), run_time=0.9)
            self.play(FadeOut(fix, shift=0.15 * UP), run_time=0.4)

        # ------------------------------------------------------------ formula
        with self.cued("formula") as T:
            p_th = D["stateVectorProb"]
            f = D["formula"]
            assert abs(p_th["00"] - f["00"]) < 1e-12 and abs(p_th["10"] - f["10"]) < 1e-12
            marks = {}
            for s in ("00", "10"):
                h = n_runs * f[s] * unit
                y = base_y + h
                marks[s] = DashedLine([bx[s] - bar_w / 2 - 0.3, y, 0], [bx[s] + bar_w / 2 + 0.3, y, 0], dash_length=0.09, dashed_ratio=0.55).set_stroke(YELLOW, width=3.5)
            cos_l = MX(r"\cos^2(\theta/2)", "=", f"{f['00']:.2f}", size=42, color=YELLOW).next_to(marks["00"], RIGHT, buff=0.2)
            sin_l = MX(r"\sin^2(\theta/2)", "=", f"{f['10']:.2f}", size=42, color=YELLOW).next_to(marks["10"], UP, buff=0.75).shift(RIGHT * 0.75)
            meas = {s: MX(f"{counts[s] / n_runs:.2f}", size=40) for s in ("00", "10")}
            self.wait_to(self.cue("cosine squared"))
            self.play(TransformFromCopy(full[2], cos_l[0]), run_time=0.8)
            self.play(Write(marks["00"]), FadeIn(cos_l[1:]), run_time=0.6)
            self.wait_to(self.cue("sine squared"))
            self.play(TransformFromCopy(full[5], sin_l[0]), run_time=0.8)
            self.play(Write(marks["10"]), FadeIn(sin_l[1:]), run_time=0.6)
            self.wait_to(self.cue("right on the formula"))
            # Measured fractions replace the counts: 0.84 vs 0.81, 0.16 vs 0.19.
            for s in ("00", "10"):
                top = max(bars[s].get_top()[1], marks[s].get_center()[1])
                meas[s].move_to([bx[s], top + 0.18 + meas[s].height / 2, 0])
            self.play(*[ReplacementTransform(nums[i], meas[s]) for i, s in enumerate(bins[:2])], run_time=0.8)
            # "make up its mind": the tilted arrow splits into the two outcomes.
            self.wait_to(self.cue("Measuring the checks"))
            g0.set_vec((0, 1))
            clear_outcome()  # a fresh run: tilted, not yet measured
            self.play(vec_to(g0, tilt_vec), run_time=0.6)
            up = Glyph(tilt_vec, R=Rp).move_to(g0.c)
            dn = Glyph(tilt_vec, R=Rp).move_to(g0.c)
            for gg in (up, dn):
                gg.ring.set_stroke(opacity=0).set_fill(opacity=0)
                gg.axis.set_stroke(opacity=0)
                gg.hub.set_opacity(0)
                gg.set_z_index(4)
            dn.shaft.set_stroke(CORAL)
            dn.head.set_fill(CORAL)
            self.add(up, dn)
            g0.shaft.set_stroke(opacity=0)
            g0.head.set_fill(opacity=0)
            self.play(vec_to(up, (0, 1)), vec_to(dn, (0, -1), turn=PI), run_time=0.9)
            self.wait(0.4)
            # One run decides. Shown: run 3 of the real sequence.
            k_demo = 2
            keep_up = seq[k_demo] == "00"
            self.play(FadeOut(dn if keep_up else up), show_outcome_anim(VGroup(ancs, *[dg for pair in digs for dg in pair]), show_outcome, k_demo), run_time=0.5)
            g0.set_vec((0, after_z[k_demo]))
            g0.shaft.set_stroke(opacity=1)
            g0.head.set_fill(opacity=1)
            self.remove(up, dn)
            # Continuous to discrete.
            self.wait_to(self.cue("A continuous problem"))
            disc = MX(r"R_x(\theta)", r"\;\longrightarrow\;", r"\{\, I,\; X \,\}", size=48).move_to([-4.2, -2.55, 0])
            disc[0][3].set_color(YELLOW)
            self.play(TransformFromCopy(full[0], disc[0]), run_time=0.9)
            self.play(Write(disc[1]), FadeIn(disc[2], shift=0.2 * RIGHT), run_time=0.9)
            self.wait_to(self.cue("and that is why"))
            keep = VGroup(disc, bars["00"], bars["10"], marks["00"], marks["10"], cos_l, sin_l)
            others = VGroup(*gs, ancs, links, alabs, *[dg for pair in digs for dg in pair], blabs, words, axis, full, meas["00"], meas["10"], nums[2], nums[3])
            self.play(dim(others, 0.3), run_time=0.9)
            # A slow push-in over the closing line.
            focus = VGroup(disc, bars["00"], bars["10"], cos_l)
            self.play(
                Circumscribe(disc, color=YELLOW, buff=0.15, time_width=0.6),
                self.camera.frame.animate.scale(0.94).move_to(focus.get_center() * 0.35),
                run_time=max(1.4, T - self.now() - 0.2),
                rate_func=smooth,
            )


def show_outcome_anim(readout: VGroup, show_outcome, k):
    """Switch the ancilla readout to run k's real outcome partway through a play.
    `readout` (the ancillas and their digits) is the animated mobject, so Cairo redraws it."""
    return UpdateFromAlphaFunc(readout, lambda m, a: show_outcome(k) if a > 0.3 else None)
