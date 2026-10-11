"""Chapter 2: ask a different question.

The 3-qubit bit-flip code, every number read from media/data/film/parity.json
(scripts/film/parity.ts runs it on the exact state-vector simulator, src/core/quantum.ts):

- the chapter 1 qubit Ry(1.15)|0> is spread by two CNOTs into alpha|000> + beta|111>;
- each qubit's reduced Bloch vector, after each gate, from QState.bloch (length |alpha^2 - beta^2|);
- an X error on qubit 1, the ancilla parities Z0Z1 and Z1Z2 measured with QState.measure;
- the syndrome table, computed by sending every single flip through the same circuit;
- the fidelity with the encoded state before (0) and after (1) the correction.

Also holds small helpers shared with digital.py and surface.py (Bloch glyph, phrase cues,
digit-by-digit ket morphs).
"""

from __future__ import annotations

import math
import re
from contextlib import contextmanager

import numpy as np
from manim import (
    DOWN,
    LEFT,
    ORIGIN,
    PI,
    RIGHT,
    UP,
    ArcBetweenPoints,
    Circle,
    Circumscribe,
    Create,
    DashedLine,
    DecimalNumber,
    Dot,
    FadeIn,
    FadeOut,
    Flash,
    GrowFromCenter,
    Indicate,
    LaggedStart,
    Line,
    ManimColor,
    MoveAlongPath,
    Polygon,
    ReplacementTransform,
    RoundedRectangle,
    SurroundingRectangle,
    UpdateFromAlphaFunc,
    VGroup,
    Write,
    interpolate_color,
    smooth,
)

from common import AMBER, BG, BLUE, CORAL, FAINT, GREEN, MUTED, TEAL, TEXT
from film import LEAD_IN, MX, TAIL, TX, YELLOW, NarratedMovingScene, load, word_time
from script import scene as script_scene, words


# =========================================================================== shared helpers


class Cued:
    """Mixin: place visuals on phrases of the beat's spoken line.

    `with self.cued("key") as T:` behaves like `self.beat("key")`; inside it,
    `self.wait_to(self.cue("some phrase"))` waits until that phrase is (about to be) spoken: at the
    recording's real word time when the line is aligned (film.word_time), else at an even pace.
    """

    @contextmanager
    def cued(self, key: str):
        with self.beat(key) as T:
            self._t0 = self.renderer.time
            self._T = T
            self._key = key
            self._text = next(b for b in script_scene(self.scene_id).beats if b.key == key).text
            yield T

    def cue(self, phrase: str, lead: float = 0.15) -> float:
        m = re.search(r"(?<![\w-])" + re.escape(phrase), self._text)  # from a word start ("sine", not inside "cosine")
        i = m.start() if m else -1
        if i < 0:  # the line was edited: do not wait, but say so
            print(f"[cue] {self.scene_id}: phrase {phrase!r} not found in its beat line; not waiting")
            return 0.0
        speech = max(0.1, self._T - LEAD_IN - TAIL)
        return max(0.0, LEAD_IN + word_time(self.scene_id, self._key, words(self._text[:i]), speech) - lead)

    def now(self) -> float:
        return self.renderer.time - self._t0

    def wait_to(self, t: float):
        dt = t - self.now()
        if dt > 1e-3:
            self.wait(dt)


class Glyph(VGroup):
    """A 2D Bloch glyph: ring, dashed z axis and the state arrow.

    `vec` is (horizontal, vertical) in units of the ring radius; (0, 1) is |0>, (0, -1) is |1>.
    A mixed reduced state has a shorter arrow.
    """

    def __init__(self, vec=(0.0, 1.0), R: float = 0.6, color: str = BLUE, **kw):
        super().__init__(**kw)
        self.ring = Circle(radius=R).set_stroke(FAINT, width=2.4).set_fill(BG, opacity=1)
        self.axis = DashedLine(UP * R * 0.96, DOWN * R * 0.96, dash_length=0.06, dashed_ratio=0.45)
        self.axis.set_stroke(FAINT, width=1.5, opacity=0.6)
        self.hub = Dot(ORIGIN, radius=0.035, color=FAINT)
        self.shaft = Line(ORIGIN, UP * R).set_stroke(color, width=6)
        self.head = Polygon(UP, LEFT, RIGHT).set_fill(color, opacity=1).set_stroke(color, width=0)
        self.add(self.ring, self.axis, self.hub, self.shaft, self.head)
        self.vec = np.array(vec, dtype=float)
        self.set_vec(self.vec)

    @property
    def R(self) -> float:
        return self.ring.width / 2

    @property
    def c(self) -> np.ndarray:
        return self.ring.get_center()

    def set_vec(self, v):
        self.vec = np.array(v, dtype=float)
        c, R = self.c, self.R
        d = R * np.array([self.vec[0], self.vec[1], 0.0])
        L = float(np.linalg.norm(d))
        u = d / L if L > 1e-6 else UP
        L = max(L, 1e-3)
        p = np.array([-u[1], u[0], 0.0])
        hl = min(0.26 * R, 0.45 * L)
        hw = 0.55 * hl
        tip = c + u * L
        base = tip - u * hl
        self.shaft.put_start_and_end_on(c, c + u * max(L - 0.8 * hl, 2e-3))
        self.head.set_points_as_corners([tip, base + p * hw, base - p * hw, tip])
        return self

    def add_ghost(self, opacity: float = 0.3):
        """Leave a faint copy of the current arrow behind (to compare lengths)."""
        self.ghost = VGroup(self.shaft.copy(), self.head.copy())
        self.ghost[0].set_stroke(MUTED, opacity=opacity)
        self.ghost[1].set_fill(MUTED, opacity=opacity)
        self.ghost.set_z_index(self.shaft.z_index)
        self.add_to_back(self.ghost)
        self.remove(self.ring)
        self.add_to_back(self.ring)
        return self.ghost

    def styled(self, op: float = 1.0):
        """Dim or restore the glyph (the ring keeps an opaque background so wires stay hidden)."""
        self.ring.set_stroke(opacity=op).set_fill(BG, opacity=1)
        self.axis.set_stroke(opacity=0.6 * op)
        self.hub.set_opacity(op)
        self.shaft.set_stroke(opacity=op)
        self.head.set_fill(opacity=op)
        return self

    def tip(self) -> np.ndarray:
        return self.c + self.R * np.array([self.vec[0], self.vec[1], 0.0])


def faded(m, op: float):
    """Set the opacity of whatever is visible in m (fills that are on, strokes that are drawn)."""
    for sm in m.family_members_with_points():
        if sm.get_fill_opacity() > 1e-3:
            sm.set_fill(opacity=op)
        if sm.get_stroke_width() > 0 and sm.get_stroke_opacity() > 1e-3:
            sm.set_stroke(opacity=op)
    return m


def dim(m, op: float = 0.25):
    """Animation: fade m to opacity op without lighting up fills that are off (3b1b-style dimming)."""
    from manim import MoveToTarget

    m.generate_target()
    faded(m.target, op)
    return MoveToTarget(m)


def polar(v):
    """(length, angle from +vertical, clockwise positive)."""
    return float(np.hypot(v[0], v[1])), math.atan2(v[0], v[1])


def vec_to(g: Glyph, target, turn: float | None = None, **kw):
    """Animate the glyph's arrow to `target`, rotating and scaling (polar interpolation).
    `turn` forces the swept angle (e.g. PI for a flip to the right)."""
    r0, a0 = polar(g.vec)
    r1, a1 = polar(target)
    if turn is None:
        da = (a1 - a0 + PI) % (2 * PI) - PI
        if r0 < 1e-3 or r1 < 1e-3:
            da = 0.0
    else:
        da = turn

    def upd(m, a):
        r = r0 + (r1 - r0) * a
        ang = a0 + da * a
        m.set_vec((r * math.sin(ang), r * math.cos(ang)))

    return UpdateFromAlphaFunc(g, upd, **kw)


def ket_parts(a_bits: str, b_bits: str, sign: str = "+") -> list[str]:
    return [r"\alpha", "|", *a_bits, r"\rangle", sign, r"\beta", "|", *b_bits, r"\rangle"]


def state_eq(a_bits: str, b_bits: str, sign: str = "+", size: float = 52) -> VGroup:
    """alpha|a> + beta|b> with every digit its own part (indexable for digit-wise morphs)."""
    m = MX(*ket_parts(a_bits, b_bits, sign), size=size)
    n = len(a_bits)
    m[0].set_color(BLUE)
    m[4 + n].set_color(BLUE)
    m.n = n
    return m


def eq_idx(n: int) -> dict:
    """Part indices in state_eq for n-digit kets."""
    return {
        "alpha": 0,
        "a_bar": 1,
        "a": list(range(2, 2 + n)),
        "a_ket": 2 + n,
        "sign": 3 + n,
        "beta": 4 + n,
        "b_bar": 5 + n,
        "b": list(range(6 + n, 6 + 2 * n)),
        "b_ket": 6 + 2 * n,
    }


class EqMorph:
    """Digit-by-digit morph between two state_eq's with the same digit count.

    Parts with equal TeX glide into place; changed parts roll over (old out upward, new in).
    Call .anims() inside a play, then .finish(scene) to regroup the new equation.
    """

    def __init__(self, scene, old, new, old_tex: list[str], new_tex: list[str], color_changed: str | None = None, extra_pairs=None, copies=None):
        self.scene, self.old, self.new = scene, old, new
        self.old_tex, self.new_tex = old_tex, new_tex
        self.color_changed = color_changed
        self.extra_pairs = extra_pairs  # explicit (i_old, j_new) pairs; otherwise index-aligned
        self.copies = copies or []  # (i_old, j_new): new part grows out of a copy of an old one

    def anims(self):
        sc = self.scene
        sc.remove(self.old)
        sc.add(*self.old.submobjects)
        out = []
        used_new = set()
        pairs = self.extra_pairs if self.extra_pairs is not None else list(zip(range(len(self.old)), range(len(self.new))))
        used_old = set()
        for i, j in pairs:
            used_old.add(i)
            used_new.add(j)
            if self.old_tex[i] == self.new_tex[j]:
                out.append(ReplacementTransform(self.old[i], self.new[j]))
            else:
                if self.color_changed:
                    self.new[j].set_color(self.color_changed)
                out.append(FadeOut(self.old[i], shift=0.3 * UP))
                out.append(FadeIn(self.new[j], shift=0.3 * UP))
        for i, j in self.copies:
            used_new.add(j)
            src = self.old[i].copy()
            if self.color_changed:
                self.new[j].set_color(self.color_changed)
            out.append(ReplacementTransform(src, self.new[j]))
        for j in range(len(self.new)):
            if j not in used_new:
                out.append(FadeIn(self.new[j]))
        for i in range(len(self.old)):
            if i not in used_old:
                out.append(FadeOut(self.old[i]))
        return out

    def finish(self):
        sc = self.scene
        sc.remove(*self.new.submobjects)
        sc.add(self.new)
        return self.new


def cnot_gate(x: float, yc: float, yt: float, color: str = TEXT) -> VGroup:
    r = 0.21
    dot = Dot([x, yc, 0], radius=0.09, color=color)
    ring = Circle(radius=r).move_to([x, yt, 0]).set_stroke(color, width=3).set_fill(opacity=0)
    plus = VGroup(Line([x, yt - r, 0], [x, yt + r, 0]), Line([x - r, yt, 0], [x + r, yt, 0])).set_stroke(color, width=3)
    far = yt - r if yt < yc else yt + r
    stem = Line([x, yc, 0], [x, far, 0]).set_stroke(color, width=3)
    g = VGroup(stem, dot, ring, plus)
    g.dot, g.ring, g.plus, g.stem = dot, ring, plus, stem
    return g


def check_eq_terms(terms: list[dict], a: str, b: str, alpha: float, beta: float, sign: float = 1.0):
    """Guard: the drawn equation must be what QState produced."""
    got = {t["data"]: t["re"] for t in terms}
    assert set(got) == {a, b}, (got, a, b)
    assert abs(got[a] - alpha) < 1e-9 and abs(got[b] - sign * beta) < 1e-9, got


# =========================================================================== the scene


class ParityScene(Cued, NarratedMovingScene):
    scene_id = "parity"

    def construct(self):
        D = load("film/parity")
        al, be = D["alpha"], D["beta"]
        check_eq_terms(D["encoded"]["terms"], "000", "111", al, be)
        eq_q = D["error"]["qubit"]
        bad = "".join("1" if q == eq_q else "0" for q in range(3))
        bad_b = "".join("0" if q == eq_q else "1" for q in range(3))
        check_eq_terms(D["errored"]["terms"], bad, bad_b, al, be)
        check_eq_terms(D["corrected"]["terms"], "000", "111", al, be)
        bl = lambda key: [(b["x"], b["z"]) for b in D[key]["bloch"]]  # noqa: E731

        self.chapter_card()

        # ------------------------------------------------------------ spread
        with self.cued("spread") as T:
            eq1 = state_eq("0", "1", size=56).move_to(UP * 2.6)
            ys = [0.85, -0.4, -1.65]
            x_in, x_out = -4.3, 3.7
            g_in = [Glyph(v, R=0.5).move_to([x_in, y, 0]) for v, y in zip(bl("input"), ys)]
            for g in g_in:
                g.set_z_index(2)
            wires = VGroup(*[Line([x_in, y, 0], [x_out + 0.75, y, 0]).set_stroke(FAINT, width=2.2) for y in ys]).set_z_index(-2)
            kets = VGroup(
                MX(r"|\psi\rangle", size=42).next_to(g_in[0], LEFT, buff=0.3),
                MX(r"|0\rangle", size=42).next_to(g_in[1], LEFT, buff=0.3),
                MX(r"|0\rangle", size=42).next_to(g_in[2], LEFT, buff=0.3),
            )
            gx = [-1.35, 0.75]
            gate1 = cnot_gate(gx[0], ys[0], ys[1])
            gate2 = cnot_gate(gx[1], ys[0], ys[2])
            self.play(Write(eq1), run_time=1.3)
            self.play(
                LaggedStart(*[Create(w) for w in wires], lag_ratio=0.15),
                LaggedStart(*[FadeIn(g, scale=0.8) for g in g_in], lag_ratio=0.15),
                FadeIn(kets, shift=0.15 * RIGHT),
                run_time=1.5,
            )
            self.wait_to(self.cue("Two CNOT gates"))
            # CNOT 1: copies the first digit of each branch onto qubit 1.
            self.play(GrowFromCenter(gate1.dot), Create(gate1.stem), Create(gate1.ring), Create(gate1.plus), run_time=0.8)
            eq2 = state_eq("00", "11", size=56).move_to(eq1)
            t1 = ket_parts("0", "1")
            t2 = ket_parts("00", "11")
            m = EqMorph(self, eq1, eq2, t1, t2, extra_pairs=[(0, 0), (1, 1), (2, 2), (3, 4), (4, 5), (5, 6), (6, 7), (7, 8), (8, 10)], copies=[(2, 3), (7, 9)])
            self.play(*m.anims(), Indicate(gate1, color=YELLOW, scale_factor=1.08), run_time=1.0)
            eq2 = m.finish()
            self.play(GrowFromCenter(gate2.dot), Create(gate2.stem), Create(gate2.ring), Create(gate2.plus), run_time=0.8)
            eq3 = state_eq("000", "111", size=56).move_to(eq1)
            t3 = ket_parts("000", "111")
            m = EqMorph(self, eq2, eq3, t2, t3, extra_pairs=[(0, 0), (1, 1), (2, 2), (3, 3), (4, 5), (5, 6), (6, 7), (7, 8), (8, 9), (9, 10), (10, 12)], copies=[(2, 4), (8, 11)])
            self.play(*m.anims(), Indicate(gate2, color=YELLOW, scale_factor=1.08), run_time=1.0)
            eq = m.finish()

        # ------------------------------------------------------------ shrink
        with self.cued("shrink") as T:
            before, mid, after = bl("input"), bl("afterCnot1"), bl("encoded")
            # Which reduced Bloch vector each qubit has after each gate (real values from QState).
            stages = [before, mid, after]

            def travel(i):
                g = g_in[i]
                y = ys[i]

                def upd(m, a):
                    x = x_in + (x_out - x_in) * a
                    m.move_to([x, y, 0])
                    # Smoothly swap to the next stage's vector while the glyph passes each gate.
                    v = np.array(stages[0][i], dtype=float)
                    for k, gxk in enumerate(gx):
                        w = 0.32
                        s = np.clip((x - (gxk - w)) / (2 * w), 0, 1)
                        s = smooth(s)
                        v = (1 - s) * v + s * np.array(stages[k + 1][i], dtype=float)
                    # (a linear blend: the x component drains away while z stays, as the reduced state does)
                    m.set_vec(v)

                return UpdateFromAlphaFunc(g, upd)

            ghosts = [g.add_ghost(0.3) for g in g_in]
            self.play(*[travel(i) for i in range(3)], dim(kets, 0.35), run_time=4.6, rate_func=smooth)
            length = D["encoded"]["bloch"][0]["length"]
            assert abs(length - D["reducedLength"]) < 1e-9
            rlab = MX(r"|\vec r\,| = |\alpha^2-\beta^2| = " + f"{length:.2f}", size=40)
            rlab.next_to(VGroup(*g_in), DOWN, buff=0.45).shift(LEFT * 0.4)
            self.wait_to(self.cue("its arrow has shrunk"))
            self.play(*[Indicate(g.shaft, color=YELLOW, scale_factor=1.0) for g in g_in], run_time=0.9)
            self.play(Write(rlab), run_time=1.2)
            self.wait_to(self.cue("The information is not"))
            circuit = VGroup(wires, gate1, gate2, kets)
            self.play(dim(circuit, 0.25), run_time=1.0)
            self.wait_to(self.cue("It lives in how"))
            ix = eq_idx(3)
            ka = VGroup(*[eq[k] for k in [ix["a_bar"], *ix["a"], ix["a_ket"]]])
            kb = VGroup(*[eq[k] for k in [ix["b_bar"], *ix["b"], ix["b_ket"]]])
            self.play(Circumscribe(ka, color=YELLOW, buff=0.08, time_width=0.6), Circumscribe(kb, color=YELLOW, buff=0.08, time_width=0.6), run_time=1.6)

        # ------------------------------------------------------------ question
        with self.cued("question") as T:
            row_x = [-2.8, 0.0, 2.8]
            row_y = 0.3
            Rr = 0.8
            scale = Rr / g_in[0].R
            for g in g_in:  # the ghosts stay behind and fade while the glyphs move on
                g.remove(g.ghost)
                self.add(g.ghost)
            self.play(
                FadeOut(circuit),
                FadeOut(rlab),
                *[FadeOut(gh) for gh in ghosts],
                *[g.animate.styled(1.0).scale(scale).move_to([x, row_y, 0]) for g, x in zip(g_in, row_x)],
                run_time=1.6,
                rate_func=smooth,
            )
            gs = g_in
            qlabs = VGroup(*[MX(f"q_{k}", size=38, color=MUTED).next_to(g, UP, buff=0.22) for k, g in enumerate(gs)])
            self.play(FadeIn(qlabs, shift=0.1 * DOWN), run_time=0.6)
            # Noise flips one qubit (X on qubit eq_q).
            self.wait_to(self.cue("noise flips"))
            ge = gs[eq_q]
            xmark = MX("X", size=46, color=CORAL).move_to(ge.c + np.array([0.72, 0.62, 0]) * Rr / 0.64)
            eqE = state_eq(bad, bad_b, size=56).move_to(eq)
            m = EqMorph(self, eq, eqE, ket_parts("000", "111"), ket_parts(bad, bad_b), color_changed=CORAL)
            self.play(
                Flash(ge.c, color=CORAL, line_length=0.25, num_lines=12, flash_radius=Rr + 0.15, run_time=0.7),
                ge.ring.animate.set_stroke(CORAL, width=3.2),
                FadeIn(xmark, scale=1.6),
                vec_to(ge, (D["errored"]["bloch"][eq_q]["x"], D["errored"]["bloch"][eq_q]["z"]), turn=PI),
                *m.anims(),
                run_time=1.3,
            )
            eq = m.finish()
            ix = eq_idx(3)
            self.wait_to(self.cue("destroy alpha and beta"))
            self.play(Indicate(eq[ix["alpha"]], color=AMBER, scale_factor=1.35), Indicate(eq[ix["beta"]], color=AMBER, scale_factor=1.35), run_time=1.2)
            self.wait_to(self.cue("do these two agree"))
            bot = lambda g: g.c + DOWN * (g.R + 0.1)  # noqa: E731
            arcs = VGroup(
                ArcBetweenPoints(bot(gs[0]), bot(gs[1]), angle=1.5),
                ArcBetweenPoints(bot(gs[1]), bot(gs[2]), angle=1.5),
            ).set_stroke(TEAL, width=3, opacity=0.85)
            anc_pos = [np.array([(row_x[0] + row_x[1]) / 2, -1.85, 0]), np.array([(row_x[1] + row_x[2]) / 2, -1.85, 0])]
            qms = VGroup(*[MX("?", size=52, color=TEAL).move_to(p) for p in anc_pos])
            self.play(Create(arcs[0]), FadeIn(qms[0], scale=0.6), run_time=0.8)
            self.play(Create(arcs[1]), FadeIn(qms[1], scale=0.6), run_time=0.8)

        # ------------------------------------------------------------ syndrome
        with self.cued("syndrome") as T:
            ancs = VGroup(*[Circle(radius=0.32).move_to(p).set_stroke(TEAL, width=3).set_fill(BG, opacity=1) for p in anc_pos])
            links = VGroup()
            for k, (a, b) in enumerate([(0, 1), (1, 2)]):
                for q in (a, b):
                    st = gs[q].c + (anc_pos[k] - gs[q].c) / np.linalg.norm(anc_pos[k] - gs[q].c) * (gs[q].R + 0.04)
                    en = anc_pos[k] + (gs[q].c - anc_pos[k]) / np.linalg.norm(gs[q].c - anc_pos[k]) * 0.34
                    links.add(Line(st, en).set_stroke(TEAL, width=2.2, opacity=0.55))
            links.set_z_index(-1)
            alabs = VGroup(
                MX(r"Z_0 Z_1", size=38, color=TEAL).next_to(ancs[0], DOWN, buff=0.25),
                MX(r"Z_1 Z_2", size=38, color=TEAL).next_to(ancs[1], DOWN, buff=0.25),
            )
            self.play(
                ReplacementTransform(arcs, links),
                ReplacementTransform(qms[0], ancs[0]),
                ReplacementTransform(qms[1], ancs[1]),
                run_time=1.2,
            )
            self.play(FadeIn(alabs, shift=0.1 * UP), run_time=0.6)
            # Parity pulses: each pair's information flows into its ancilla.
            pulses = []
            for li in links:
                dot = Dot(li.get_start(), radius=0.07, color=TEAL)
                pulses.append(MoveAlongPath(dot, li, rate_func=smooth))
            self.play(LaggedStart(*pulses, lag_ratio=0.12), run_time=1.0)
            self.remove(*[p.mobject for p in pulses])
            syn = D["measured"]["syndrome"]
            # The outcomes were certain (probability 1 or 0): the checks never disturb alpha, beta.
            assert all(abs(p - s) < 1e-9 for p, s in zip(D["measured"]["p1"], syn))
            bits = VGroup(*[MX(str(s), size=44, color=BG if s else TEAL).move_to(a) for s, a in zip(syn, ancs)])
            self.play(
                *[a.animate.set_fill(TEAL if s else BG, opacity=1) for a, s in zip(ancs, syn)],
                *[FadeIn(b, scale=0.5) for b in bits],
                run_time=0.6,
            )
            # The syndrome table (each row computed by running that flip through the same circuit).
            self.wait_to(self.cue("the syndrome,"))
            tbl_x, tbl_y = [4.55, 6.15], [1.45, 0.6, -0.1, -0.8, -1.5]
            head = VGroup(MX(r"s_1 s_2", size=40, color=MUTED).move_to([tbl_x[0], tbl_y[0], 0]), TX("flip", size=36, color=MUTED).move_to([tbl_x[1], tbl_y[0], 0]))
            rule = Line([tbl_x[0] - 0.75, tbl_y[0] - 0.42, 0], [tbl_x[1] + 0.75, tbl_y[0] - 0.42, 0]).set_stroke(FAINT, width=1.6)
            rows = VGroup()
            for r, y in zip(D["table"], tbl_y[1:]):
                s = "".join(str(b) for b in r["syndrome"])
                right = TX("none", size=34, color=MUTED) if r["flip"] is None else MX(f"q_{r['flip']}", size=42)
                rows.add(VGroup(MX(s, size=44).move_to([tbl_x[0], y, 0]), right.move_to([tbl_x[1], y, 0])))
            self.play(
                self.camera.frame.animate.shift(RIGHT * 1.7),
                FadeIn(head),
                Create(rule),
                LaggedStart(*[FadeIn(r, shift=0.1 * LEFT) for r in rows], lag_ratio=0.15),
                run_time=1.2,
            )
            hit = next(i for i, r in enumerate(D["table"]) if r["syndrome"] == syn)
            assert D["table"][hit]["flip"] == D["decoded"] == eq_q
            flying = VGroup(*[b.copy().set_color(TEXT) for b in bits])
            target = rows[hit][0]
            self.play(
                flying[0].animate.move_to(target[0][0].get_center()),
                flying[1].animate.move_to(target[0][1].get_center()),
                run_time=0.9,
                rate_func=smooth,
            )
            self.remove(*flying)
            self.wait_to(self.cue("points straight at the culprit"))
            box = SurroundingRectangle(rows[hit], color=YELLOW, buff=0.16, corner_radius=0.1, stroke_width=3)
            others = VGroup(*[r for i, r in enumerate(rows) if i != hit])
            self.play(Create(box), dim(others, 0.35), run_time=0.7)
            self.play(Circumscribe(gs[eq_q], shape=Circle, color=YELLOW, buff=0.12, time_width=0.7), Indicate(qlabs[eq_q], color=YELLOW), run_time=1.2)
            table = VGroup(head, rule, rows, box)

        # ------------------------------------------------------------ restore
        with self.cued("restore") as T:
            f0 = D["errored"]["fidelity"]
            f1 = D["corrected"]["fidelity"]
            fid_lab = MX("F", "=", size=44)
            fid_num = DecimalNumber(f0, num_decimal_places=2, font_size=44, color=CORAL)
            track = RoundedRectangle(width=2.0, height=0.16, corner_radius=0.08).set_stroke(FAINT, width=1.5).set_fill(opacity=0)
            fid = VGroup(fid_lab, fid_num).arrange(RIGHT, buff=0.18)
            fid_word = TX("fidelity", size=28, color=MUTED)
            meter = VGroup(fid, track, fid_word).arrange(DOWN, buff=0.2).move_to([-5.15, 2.5, 0])
            fill = VGroup()  # the bar's filled part, rebuilt as F changes

            def set_f(f, color):
                w = max(2.0 * f, 0.02)
                bar = RoundedRectangle(width=w, height=0.16, corner_radius=min(0.08, w / 2)).set_stroke(width=0).set_fill(color, opacity=1)
                bar.move_to(track.get_left() + RIGHT * w / 2)
                fill.remove(*fill.submobjects)
                fill.add(bar)
                fid_num.set_value(f)
                fid_num.set_color(color)

            self.play(
                self.camera.frame.animate.shift(LEFT * 1.7),
                dim(table, 0.22),
                FadeIn(meter, shift=0.1 * DOWN),
                run_time=1.1,
            )
            set_f(f0, CORAL)
            self.add(fill)
            self.wait_to(self.cue("Flip it back"))
            # Correction X on the decoded qubit: the real corrected state, fidelity from QState.
            eqC = state_eq("000", "111", size=56).move_to(eq)
            m = EqMorph(self, eq, eqC, ket_parts(bad, bad_b), ket_parts("000", "111"), color_changed=TEXT)
            fix = MX("X", size=46, color=BLUE).move_to(xmark)
            cz = D["corrected"]["bloch"][eq_q]
            self.play(
                ReplacementTransform(xmark, fix),
                Flash(ge.c, color=BLUE, line_length=0.25, num_lines=12, flash_radius=Rr + 0.15),
                vec_to(ge, (cz["x"], cz["z"]), turn=-PI),
                ge.ring.animate.set_stroke(FAINT, width=2.4),
                *m.anims(),
                run_time=1.2,
            )
            eq = m.finish()
            self.play(
                FadeOut(fix, shift=0.2 * UP),
                UpdateFromAlphaFunc(VGroup(fid_num, fill), lambda m, a: set_f(f0 + (f1 - f0) * a, interpolate_color(ManimColor(CORAL), ManimColor(GREEN), a))),
                run_time=0.7,
                rate_func=smooth,
            )
            self.play(Flash(fid_num.get_center(), color=GREEN, flash_radius=0.45, line_length=0.18), run_time=0.6)
            self.wait_to(self.cue("without our ever learning"))
            ix = eq_idx(3)
            self.play(Circumscribe(eq[ix["alpha"]], color=BLUE, buff=0.06), Circumscribe(eq[ix["beta"]], color=BLUE, buff=0.06), run_time=1.2)
            self.wait_to(self.cue("That is a stabilizer"))
            title = TX(r"stabilizer measurement", size=60).move_to(DOWN * 3.25)
            rest = VGroup(eq, meter, fill, qlabs, links)
            self.play(dim(rest, 0.25), dim(table, 0.12), *[g.animate.styled(0.3) for g in gs], alabs.animate.set_color(YELLOW), run_time=0.8)
            self.play(Write(title), run_time=1.4)
            self.play(Indicate(alabs, color=YELLOW, scale_factor=1.1), run_time=1.0)

