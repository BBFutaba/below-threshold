"""Chapter 4: two kinds of error, one grid.

Everything is read from media/data/film/surface.json (scripts/film/surface.ts):

- the phase flip on the 3-qubit code from QState: alpha|000> + beta|111> becomes
  alpha|000> - beta|111>, and the parity checks Z0Z1, Z1Z2 read 00 with certainty;
- H Z H = X, checked on QState;
- the real d = 5 rotated surface code (makeRotatedSurfaceCode), with the repetition row
  embedded as qubits 11, 12, 13 of its middle row; its two checks become the Z plaquettes
  that hold those pairs, and the X plaquettes on the same pairs are the ones the phase flip
  trips (pauliFrame.syndrome of Z on qubit 12);
- an X chain growing down the middle column, each step's syndrome from pauliFrame.syndrome,
  ending at code.logicalX with zero syndrome and a logical flip (logicalOutcome).
"""

from __future__ import annotations

import numpy as np
from manim import (
    DOWN,
    LEFT,
    ORIGIN,
    RIGHT,
    UP,
    BraceBetweenPoints,
    Circle,
    Circumscribe,
    Create,
    FadeIn,
    FadeOut,
    Flash,
    GrowFromCenter,
    Indicate,
    LaggedStart,
    Line,
    MoveAlongPath,
    Dot,
    ReplacementTransform,
    RoundedRectangle,
    VGroup,
    Write,
    smooth,
)

from common import BG, CORAL, FAINT, MUTED, QSTROKE, TEAL, TEXT, TILE_FILL, VIOLET, Lattice
from film import MX, TX, YELLOW, NarratedMovingScene, load
from parity import Cued, EqMorph, check_eq_terms, eq_idx, ket_parts, state_eq

S = 1.15  # lattice pitch
C = np.array([0.0, -0.45, 0.0])  # lattice center


def err_mark(pos, pauli: str = "X", s: float = S, size: float = 30, r_q: float = 0.16) -> VGroup:
    """A Pauli error on a data qubit: the qubit turns coral with the Pauli's letter, inside a coral ring."""
    ring = Circle(radius=(r_q + 0.14) * s).move_to(pos).set_stroke(CORAL, width=3.6).set_fill(opacity=0)
    disc = Circle(radius=r_q * s * 1.03).move_to(pos).set_fill(CORAL, opacity=1).set_stroke(CORAL, width=2.6)
    letter = MX(pauli, size=size, color=BG).move_to(pos)
    return VGroup(ring, disc, letter).set_z_index(5)


class SurfaceScene(Cued, NarratedMovingScene):
    scene_id = "surface"

    def construct(self):
        D = load("film/surface")
        lay = D["layout"]
        assert lay["d"] == 5
        lat = Lattice(lay, s=S, center=C)
        stabs = lay["stabilizers"]
        row = D["embedRow"]
        ph = D["phase"]
        al, be = ph["before"][0]["re"], ph["before"][1]["re"]
        check_eq_terms([{"data": t["data"], "re": t["re"]} for t in ph["before"]], "000", "111", al, be)
        check_eq_terms([{"data": t["data"], "re": t["re"]} for t in ph["after"]], "000", "111", al, be, sign=-1.0)
        assert ph["checks"]["syndrome"] == [0, 0] and ph["checks"]["p1"] == [0, 0]
        assert abs(D["hzhEqualsX"] - 1) < 1e-12
        zq = D["zError"]["qubit"]
        assert zq == row[ph["qubit"]] and sorted(D["zError"]["fired"]) == sorted(D["repToSurfaceX"])
        cam = self.camera.frame

        self.chapter_card()

        # ------------------------------------------------------------ phase
        with self.cued("phase") as T:
            eq = state_eq("000", "111", size=56).move_to(UP * 2.55)
            bx, by = [-2.4, 0.0, 2.4], -0.1
            bigq = VGroup(*[Circle(radius=0.42).move_to([x, by, 0]).set_fill(BG, opacity=1).set_stroke(QSTROKE, width=3.2) for x in bx]).set_z_index(3)
            checks = VGroup(
                *[
                    RoundedRectangle(width=0.8, height=0.8, corner_radius=0.08).move_to([(bx[k] + bx[k + 1]) / 2, by, 0]).set_fill(TEAL, opacity=TILE_FILL).set_stroke(TEAL, width=1.8, opacity=0.6)
                    for k in range(2)
                ]
            )
            clabs = VGroup(*[MX(t, size=36, color=TEAL).next_to(c, DOWN, buff=0.32) for t, c in zip([r"Z_0 Z_1", r"Z_1 Z_2"], checks)])
            self.play(Write(eq), LaggedStart(*[GrowFromCenter(q) for q in bigq], lag_ratio=0.15), run_time=1.3)
            self.play(LaggedStart(*[GrowFromCenter(c) for c in checks], lag_ratio=0.2), FadeIn(clabs, shift=0.1 * UP), run_time=0.8)
            # A phase flip (Z) on the middle qubit.
            self.wait_to(self.cue("A phase flip"))
            mid = bigq[ph["qubit"]]
            zbig = err_mark(mid.get_center(), "Z", s=1.0, size=54, r_q=0.42)
            self.play(Flash(mid.get_center(), color=CORAL, flash_radius=0.75, line_length=0.22, num_lines=12), FadeIn(zbig, scale=1.4), run_time=0.8)
            self.wait_to(self.cue("leaves every bit"))
            ix = eq_idx(3)
            digits = VGroup(*[eq[k] for k in ix["a"] + ix["b"]])
            self.play(Indicate(digits, color=TEXT, scale_factor=1.18), run_time=1.0)
            # Only the sign between the branches changes (QState: beta -> -beta).
            self.wait_to(self.cue("only changes the sign"))
            eqM = state_eq("000", "111", sign="-", size=56).move_to(eq)
            m = EqMorph(self, eq, eqM, ket_parts("000", "111", "+"), ket_parts("000", "111", "-"), color_changed=CORAL)
            self.play(*m.anims(), run_time=0.9)
            eq = m.finish()
            self.play(Circumscribe(eq[ix["sign"]], color=CORAL, buff=0.1, time_width=0.6), run_time=0.9)
            # The parity checks run and report 0, 0 (with certainty).
            self.wait_to(self.cue("Our parity checks"))
            zeros = VGroup(*[MX(str(b), size=40, color=TEAL).move_to(c) for b, c in zip(ph["checks"]["syndrome"], checks)]).set_z_index(4)
            self.play(LaggedStart(*[Indicate(c, color=TEAL, scale_factor=1.15) for c in checks], lag_ratio=0.25), run_time=0.9)
            self.play(FadeIn(zeros, scale=0.6), run_time=0.5)

        # ------------------------------------------------------------ grid
        with self.cued("grid") as T:
            self.play(FadeOut(eq, shift=0.3 * UP), run_time=0.7)
            hzh = MX("H", "Z", "H", "=", "X", size=56).move_to(UP * 3.2)
            hzh[1].set_color(CORAL)
            hzh[4].set_color(CORAL)
            self.wait_to(self.cue("check in a rotated basis"))
            self.play(Write(hzh), run_time=1.0)
            # The row becomes the middle row of the d = 5 grid; its checks become the Z plaquettes on those pairs.
            ztiles = [lat.tiles[i] for i in D["repToSurface"]]
            for t in ztiles:
                t.set_z_index(0)
            zmark = err_mark(lat.qpos(zq), "Z")
            self.play(
                *[ReplacementTransform(bigq[k], lat.qubits[row[k]]) for k in range(3)],
                *[ReplacementTransform(checks[k], ztiles[k]) for k in range(2)],
                ReplacementTransform(zbig, zmark),
                FadeOut(clabs),
                FadeOut(zeros),
                run_time=1.6,
                rate_func=smooth,
            )
            # The rotated-basis (X) checks on the same pairs see the phase flip.
            self.wait_to(self.cue("where phase flips"))
            xtiles = [lat.tiles[i] for i in D["repToSurfaceX"]]
            self.play(LaggedStart(*[GrowFromCenter(t) for t in xtiles], lag_ratio=0.25), Indicate(hzh[4], color=CORAL, scale_factor=1.3), run_time=0.8)
            self.add(*[lat.dots[i] for i in D["repToSurfaceX"]])
            self.play(*lat.fire(D["zError"]["fired"]), run_time=0.5)
            # Both kinds of check, everywhere.
            self.wait_to(self.cue("Do both"))
            others_q = [q for q in range(lay["n"]) if q not in row]
            others_q.sort(key=lambda q: np.linalg.norm(lat.qpos(q) - lat.qpos(zq)))
            zi = [i for i, st in enumerate(stabs) if st["type"] == "Z" and i not in D["repToSurface"]]
            xi = [i for i, st in enumerate(stabs) if st["type"] == "X" and i not in D["repToSurfaceX"]]
            by_dist = lambda i: np.linalg.norm(lat.anchor[i] - lat.qpos(zq))  # noqa: E731
            zi.sort(key=by_dist)
            xi.sort(key=by_dist)
            self.add(*[lat.dots[i] for i in range(len(stabs)) if i not in D["repToSurfaceX"]])
            self.play(LaggedStart(*[GrowFromCenter(lat.qubits[q]) for q in others_q], lag_ratio=0.05), run_time=1.0)
            self.play(LaggedStart(*[GrowFromCenter(lat.tiles[i]) for i in zi], lag_ratio=0.06), run_time=1.0)
            self.play(LaggedStart(*[GrowFromCenter(lat.tiles[i]) for i in xi], lag_ratio=0.06), run_time=1.0)
            self.wait_to(self.cue("and you get the surface code"))
            title = TX("the surface code", size=54).move_to(UP * 3.2)
            self.play(FadeOut(hzh, shift=0.25 * UP), FadeIn(title, shift=0.25 * UP), *lat.fire(D["zError"]["fired"], on=False), FadeOut(zmark), run_time=1.1)

        # ------------------------------------------------------------ legend
        with self.cued("legend") as T:
            L = D["legend"]

            def label(text, color, side, y, target_pt):
                t = TX(text, size=34, color=color)
                x = -4.75 if side < 0 else 4.75
                t.move_to([x, y, 0])
                edge = t.get_right() + RIGHT * 0.15 if side < 0 else t.get_left() + LEFT * 0.15
                d = target_pt - edge
                end = target_pt - d / np.linalg.norm(d) * 0.3 * S
                ln = Line(edge, end).set_stroke(FAINT, width=1.8)
                return VGroup(t, ln)

            q0 = L["qubit"]
            lab_q = label("data qubit", TEXT, -1, 1.75, lat.qpos(q0))
            self.play(Circumscribe(lat.qubits[q0], shape=Circle, color=YELLOW, buff=0.08, time_width=0.7), FadeIn(lab_q[0], shift=0.1 * RIGHT), Create(lab_q[1]), run_time=1.0)
            self.wait_to(self.cue("Teal squares"))
            zt = L["zTile"]
            lab_z = label("bit-flip check", TEAL, -1, 0.05, lat.anchor[zt])
            self.play(Indicate(lat.tiles[zt], color=TEAL, scale_factor=1.15), FadeIn(lab_z[0], shift=0.1 * RIGHT), Create(lab_z[1]), run_time=1.0)
            self.wait_to(self.cue("Violet squares"))
            xt = L["xTile"]
            lab_x = label("phase-flip check", VIOLET, 1, 0.05, lat.anchor[xt])
            self.play(Indicate(lat.tiles[xt], color=VIOLET, scale_factor=1.15), FadeIn(lab_x[0], shift=0.1 * LEFT), Create(lab_x[1]), run_time=1.0)
            self.wait_to(self.cue("Each check touches four"))
            sup = stabs[xt]["support"]
            assert len(sup) == 4
            self.play(LaggedStart(*[Indicate(lat.qubits[q], color=VIOLET, scale_factor=1.5) for q in sup], lag_ratio=0.2), run_time=1.3)
            self.wait_to(self.cue("or two along the edge"))
            bd = L["boundary"]
            assert stabs[bd]["weight"] == 2 and stabs[bd]["edge"]
            self.play(Indicate(lat.tiles[bd], color=VIOLET, scale_factor=1.25), *[Indicate(lat.qubits[q], color=VIOLET, scale_factor=1.5) for q in stabs[bd]["support"]], run_time=1.1)
            legend = VGroup(lab_q, lab_z, lab_x)

        # ------------------------------------------------------------ chain
        with self.cued("chain") as T:
            chain = D["chain"]
            marks = {}
            lit = set()

            def step(k, extra=()):
                """Add chain[k]'s new error; update the checks to chain[k]'s real syndrome."""
                new = [q for q in chain[k]["errors"] if q not in marks]
                fired = set(chain[k]["fired"])
                anims = []
                for q in new:
                    marks[q] = err_mark(lat.qpos(q), "X")
                    anims.append(FadeIn(marks[q], scale=1.4))
                anims += lat.fire(sorted(lit - fired), on=False) + lat.fire(sorted(fired - lit), on=True)
                lit.clear()
                lit.update(fired)
                return anims + list(extra)

            self.play(FadeOut(legend), FadeOut(title), cam.animate.scale(0.86).move_to(C + UP * 0.05), run_time=0.9)
            # One X error, then its real syndrome.
            self.wait_to(self.cue("Flip one qubit"))
            (q_first,) = chain[0]["errors"]
            marks[q_first] = err_mark(lat.qpos(q_first), "X")
            self.play(FadeIn(marks[q_first], scale=1.4), Flash(lat.qpos(q_first), color=CORAL, flash_radius=0.4 * S, line_length=0.15), run_time=0.6)
            self.wait_to(self.cue("the checks beside it"))
            self.play(*lat.fire(chain[0]["fired"]), run_time=0.6)
            lit.update(chain[0]["fired"])
            # The chain grows: 12 -> 12,17 -> 12,17,7. Each step's lit checks are the real syndrome.
            self.wait_to(self.cue("Flip a whole chain"))
            seg = VGroup()

            def link(a, b):
                ln = Line(lat.qpos(a), lat.qpos(b)).set_stroke(CORAL, width=9, opacity=0.5).set_z_index(2)
                seg.add(ln)
                return Create(ln)

            self.play(*step(1), link(chain[0]["errors"][-1], chain[1]["errors"][-1]), run_time=0.8)
            self.play(*step(2), link(chain[0]["errors"][-1], chain[2]["errors"][-1]), run_time=0.8)
            self.wait_to(self.cue("only its two ends"))
            ends = sorted(lit)
            assert len(ends) == 2
            self.play(*[Circumscribe(lat.tiles[i], color=YELLOW, buff=0.06, time_width=0.7) for i in ends], run_time=1.1)
            # Interior checks see two errors each: the parities cancel.
            self.wait_to(self.cue("Everything in between"))
            errs = set(chain[2]["errors"])
            interior = [i for i, st in enumerate(stabs) if st["type"] == "Z" and len(errs & set(st["support"])) == 2]
            assert interior and not (set(interior) & lit)
            # Each interior check collects two flips (two pulses in), and their parity is even: it stays dark.
            pulses, dots = [], []
            for i in interior:
                for q in sorted(errs & set(stabs[i]["support"])):
                    path = Line(lat.qpos(q), lat.anchor[i])
                    dt = Dot(lat.qpos(q), radius=0.07, color=YELLOW).set_z_index(6)
                    dots.append(dt)
                    pulses.append(MoveAlongPath(dt, path, rate_func=smooth))
            self.play(*pulses, run_time=0.9)
            self.play(*[FadeOut(dt, scale=2.2) for dt in dots], *[Indicate(lat.tiles[i], color=YELLOW, scale_factor=1.1) for i in interior], run_time=0.9)

        # ------------------------------------------------------------ logical
        with self.cued("logical") as T:
            col = D["logicalX"]
            assert chain[-1]["errors"] and sorted(chain[-1]["errors"]) == sorted(col)
            assert chain[-1]["zeroSyndrome"] and chain[-1]["logicalXFlip"] is True
            top_q, bot_q = col[0], col[-1]
            top_edge = lat.qpos(top_q) + UP * 0.5 * S
            bot_edge = lat.qpos(bot_q) + DOWN * 0.5 * S
            self.wait_to(self.cue("A chain from one edge"))
            e3 = Line(lat.qpos(chain[2]["errors"][-1]), top_edge).set_stroke(CORAL, width=9, opacity=0.5).set_z_index(2)
            self.play(*step(3), Create(e3), run_time=0.8)
            e4 = Line(lat.qpos(chain[1]["errors"][-1]), bot_edge).set_stroke(CORAL, width=9, opacity=0.5).set_z_index(2)
            self.play(*step(4), Create(e4), run_time=0.8)
            assert not lit
            seg.add(e3, e4)
            # Nothing lit; ease back out to the whole grid.
            self.wait_to(self.cue("lights up nothing"))
            self.play(cam.animate.scale(1 / 0.86).move_to(ORIGIN), run_time=1.3, rate_func=smooth)
            # Yet it is a logical X: the column glows.
            self.wait_to(self.cue("yet it flips"))
            glow = VGroup(*[Line(top_edge, bot_edge).set_stroke(CORAL, width=w, opacity=o) for w, o in [(46, 0.07), (30, 0.12), (18, 0.22)]]).set_z_index(1)
            xl = MX(r"X_L", size=48, color=CORAL).next_to(top_edge, UP, buff=0.55)
            self.play(FadeIn(glow), seg.animate.set_stroke(opacity=0.85), Write(xl), *[Indicate(marks[q][0], color=CORAL, scale_factor=1.2) for q in col], run_time=1.2)
            # Its length is the distance: d = 5.
            self.wait_to(self.cue("The shortest such chain"))
            nums = VGroup(*[MX(str(k + 1), size=36, color=TEXT).move_to(lat.qpos(q) + np.array([-0.5 * S, 0.22 * S, 0])) for k, q in enumerate(col)]).set_z_index(6)
            self.play(LaggedStart(*[FadeIn(n, shift=0.1 * RIGHT) for n in nums], lag_ratio=0.25), run_time=1.3)
            self.wait_to(self.cue("has length d"))
            rx = lat.rc(0, 0)[0] + (lay["d"] - 1) * S + 0.95
            brace = BraceBetweenPoints([rx, lat.qpos(top_q)[1] + 0.2, 0], [rx, lat.qpos(bot_q)[1] - 0.2, 0], direction=RIGHT, color=MUTED)
            dl = MX(r"d = " + str(lay["d"]), size=56).next_to(brace, RIGHT, buff=0.3)
            self.play(GrowFromCenter(brace), Write(dl), cam.animate.shift(RIGHT * 0.75), run_time=1.1)
            self.wait_to(self.cue("the distance of the code"))
            self.play(Indicate(dl, color=YELLOW, scale_factor=1.15), run_time=1.0)
