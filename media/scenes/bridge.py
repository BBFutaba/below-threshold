"""BridgeScene: the 3-qubit repetition code grows into the distance-3 rotated surface code.

Data: media/data/bridge.json (scripts/manim-data.ts). The repetition code's checks and the
surface-code layouts come from makeRotatedSurfaceCode(3/7); every fired check is computed by
syndrome() in src/core/pauliFrame.ts for the error shown.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from manim import *  # noqa: F403,E402

from common import (  # noqa: E402
    BG,
    BORDER,
    CORAL,
    GREEN,
    MUTED,
    QSTROKE,
    SURFACE,
    TEAL,
    TEXT,
    TILE_FILL,
    VIOLET,
    Captions,
    H,
    Lattice,
    T,
    eyebrow,
    load,
    pill,
    setup,
)


def status_line(ok: bool, text: str):
    mark = T("✓" if ok else "✗", size=26, color=GREEN if ok else CORAL, weight="BOLD")
    t = T(text, size=25, color=TEXT)
    return VGroup(mark, t).arrange(RIGHT, buff=0.18)


class BridgeScene(Scene):
    def construct(self):
        setup(self)
        data = load("bridge")
        lay3 = data["surface3"]
        rep = data["repetition"]
        S = 1.4
        C = np.array([0.0, 0.45, 0.0])
        lat = Lattice(lay3, s=S, center=C, q_radius=0.15)
        row = data["embedRow"]  # surface qubits that hold the repetition code
        cap = Captions(self)

        self.add(eyebrow("BELOW THRESHOLD  ·  FROM A ROW TO A GRID"))

        # ---- 1. the repetition code ------------------------------------
        rep_q = [lat.qubits[q] for q in row]
        diamonds = VGroup()
        for chk in rep["checks"]:
            a, b = (lat.qpos(row[i]) for i in chk["support"])
            mid = (a + b) / 2
            h = np.linalg.norm(b - a) / 2 * 0.93
            dm = Polygon(mid + LEFT * h, mid + UP * h * 0.62, mid + RIGHT * h, mid + DOWN * h * 0.62)
            dm.set_fill(TEAL, opacity=TILE_FILL).set_stroke(TEAL, width=1.6, opacity=0.55)
            diamonds.add(dm)
        rep_dots = VGroup(*[Dot(dm.get_center(), radius=0.075 * S, color=BG).set_opacity(0) for dm in diamonds])
        label = T("3-qubit repetition code", size=24, color=MUTED).next_to(VGroup(*rep_q), UP, buff=0.75)
        for m in rep_q:
            m.set_z_index(3)
        diamonds.set_z_index(0)
        rep_dots.set_z_index(1)
        self.play(
            LaggedStart(*[FadeIn(q, scale=0.8) for q in rep_q], lag_ratio=0.15),
            LaggedStart(*[FadeIn(d, scale=0.85) for d in diamonds], lag_ratio=0.2),
            FadeIn(label, shift=0.1 * DOWN),
            run_time=1.0,
        )
        self.add(rep_dots)
        cap.show("3 qubits catch one kind of error.")

        def err(qpos, letter):
            ring = Circle(radius=0.3 * S).move_to(qpos).set_stroke(CORAL, width=3.6)
            txt = T(letter, size=26, color=CORAL, weight="BOLD").move_to(qpos)
            return VGroup(ring, txt).set_z_index(4)

        def fire_rep(i, on=True):
            return [
                diamonds[i].animate.set_fill(opacity=0.85 if on else TILE_FILL).set_stroke(opacity=1 if on else 0.55),
                rep_dots[i].animate.set_opacity(1 if on else 0),
            ]

        # X (bit flip) on repetition qubit 0: its check fires (computed by syndrome()).
        ex = err(lat.qpos(row[rep["xError"]["qubit"]]), "X")
        note_x = status_line(True, "Bit flip X: a check fires.")
        note_x.move_to([0, -1.25, 0])
        self.play(FadeIn(ex, scale=1.3), run_time=0.5)
        self.play(*[a for i in rep["xError"]["fired"] for a in fire_rep(i)], FadeIn(note_x, shift=0.1 * UP), run_time=0.6)
        self.wait(1.0)
        # Z (phase flip) on repetition qubit 1: syndrome() returns no fired checks.
        ez = err(lat.qpos(row[rep["zError"]["qubit"]]), "Z")
        note_z = status_line(len(rep["zError"]["fired"]) > 0, "Phase flip Z: nothing fires.")
        note_z.next_to(note_x, DOWN, buff=0.22).align_to(note_x, LEFT)
        self.play(
            FadeOut(ex), *[a for i in rep["xError"]["fired"] for a in fire_rep(i, on=False)],
            FadeIn(ez, scale=1.3), run_time=0.6,
        )
        self.play(FadeIn(note_z, shift=0.1 * UP), Indicate(ez, color=CORAL, scale_factor=1.15), run_time=0.8)
        self.wait(1.1)

        # ---- 2. morph into the distance-3 surface code -------------------
        cap.show("The surface code catches both,")
        self.play(FadeOut(ez), FadeOut(note_x), FadeOut(note_z), FadeOut(label), run_time=0.5)
        targets = data["repToSurface"]  # repetition check i -> surface stabilizer index
        self.play(
            *[ReplacementTransform(diamonds[i], lat.tiles[targets[i]]) for i in range(len(diamonds))],
            FadeOut(rep_dots),
            run_time=0.9,
        )
        others_q = [i for i in range(lay3["n"]) if i not in row]
        self.play(LaggedStart(*[FadeIn(lat.qubits[i], scale=0.8) for i in others_q], lag_ratio=0.08), run_time=0.8)
        z_rest = [i for i, s in enumerate(lay3["stabilizers"]) if s["type"] == "Z" and i not in targets]
        x_all = [i for i, s in enumerate(lay3["stabilizers"]) if s["type"] == "X"]

        legend = VGroup()
        for color, name, what in [(TEAL, "Z-check", "catches bit flips (X)"), (VIOLET, "X-check", "catches phase flips (Z)")]:
            sq = RoundedRectangle(width=0.42, height=0.42, corner_radius=0.06).set_fill(color, opacity=TILE_FILL).set_stroke(color, width=1.6, opacity=0.7)
            txt = VGroup(T(name, size=25, color=TEXT, weight="SEMIBOLD"), T(what, size=23, color=MUTED)).arrange(DOWN, aligned_edge=LEFT, buff=0.06)
            legend.add(VGroup(sq, txt).arrange(RIGHT, buff=0.24))
        legend.arrange(DOWN, aligned_edge=LEFT, buff=0.4).move_to([4.75, 0.45, 0])

        self.play(LaggedStart(*[FadeIn(lat.tiles[i], scale=0.85) for i in z_rest], lag_ratio=0.2), FadeIn(legend[0], shift=0.1 * LEFT), run_time=0.8)
        self.play(LaggedStart(*[FadeIn(lat.tiles[i], scale=0.85) for i in x_all], lag_ratio=0.15), FadeIn(legend[1], shift=0.1 * LEFT), run_time=0.9)
        self.remove(*lat.tiles, *lat.qubits)
        self.add(lat)

        # ---- 3. both kinds of error are now caught ------------------------
        sx, sz = data["surfaceXError"], data["surfaceZError"]
        ex2 = lat.error_mark(sx["qubit"], "X")
        n1 = status_line(True, "X: teal checks fire")
        n1.move_to([-4.75, 1.0, 0])
        self.play(FadeIn(ex2, scale=1.3), run_time=0.45)
        self.play(*lat.fire(sx["fired"]), FadeIn(n1, shift=0.1 * RIGHT), run_time=0.6)
        self.wait(0.5)
        ez2 = lat.error_mark(sz["qubit"], "Z")
        n2 = status_line(True, "Z: violet checks fire")
        n2.next_to(n1, DOWN, buff=0.3).align_to(n1, LEFT)
        self.play(FadeIn(ez2, scale=1.3), run_time=0.45)
        self.play(*lat.fire(sz["fired"]), FadeIn(n2, shift=0.1 * RIGHT), run_time=0.6)
        self.wait(1.2)

        # ---- 4. it tiles a chip ---------------------------------------
        cap.show("on a 2D grid real chips can build.")
        self.play(
            FadeOut(ex2), FadeOut(ez2), FadeOut(n1), FadeOut(n2), FadeOut(legend),
            *lat.fire(sx["fired"] + sz["fired"], on=False),
            run_time=0.5,
        )
        lay7 = data["surface7"]
        lat7 = Lattice(lay7, s=0.62, center=[-1.1, 0.42, 0], q_radius=0.17)
        tl, br = lat7.bounds_rect(pad=1.15)
        chip = RoundedRectangle(width=br[0] - tl[0], height=tl[1] - br[1], corner_radius=0.3).move_to((tl + br) / 2)
        chip.set_fill(SURFACE, opacity=0.85).set_stroke(BORDER, width=2).set_z_index(-1)
        pins = VGroup()
        for k in range(9):
            for side in (-1, 1):
                x = chip.get_left()[0] + (k + 1) * chip.width / 10
                pins.add(Line([x, chip.get_top()[1] if side > 0 else chip.get_bottom()[1], 0], [x, (chip.get_top()[1] + 0.14) if side > 0 else (chip.get_bottom()[1] - 0.14), 0]))
                y = chip.get_bottom()[1] + (k + 1) * chip.height / 10
                pins.add(Line([chip.get_left()[0] if side < 0 else chip.get_right()[0], y, 0], [(chip.get_left()[0] - 0.14) if side < 0 else (chip.get_right()[0] + 0.14), y, 0]))
        pins.set_stroke(BORDER, width=3).set_z_index(-1)
        dist = lambda m: np.linalg.norm(m.get_center() - lat7.center_pt)  # noqa: E731
        tiles7 = sorted(lat7.tiles, key=dist)
        qs7 = sorted(lat7.qubits, key=dist)
        self.play(lat.animate.scale(0.44).set_opacity(0), run_time=0.6)
        self.remove(lat)
        self.play(
            FadeIn(chip, scale=0.96), FadeIn(pins),
            LaggedStart(*[FadeIn(t, scale=0.6) for t in tiles7], lag_ratio=0.02),
            LaggedStart(*[FadeIn(q, scale=0.6) for q in qs7], lag_ratio=0.015),
            run_time=1.6,
        )
        self.remove(*lat7.tiles, *lat7.qubits)
        self.add(lat7)
        n_checks = len(lay7["stabilizers"])
        info = T(f"distance 7  ·  {lay7['n']} data qubits  ·  {n_checks} checks", size=24, color=MUTED)
        info.next_to(chip, RIGHT, buff=0.55).shift(UP * 0.0)
        info = VGroup(
            T("distance 7", size=26, color=TEXT, weight="SEMIBOLD"),
            T(f"{lay7['n']} data qubits", size=24, color=MUTED),
            T(f"{n_checks} checks", size=24, color=MUTED),
            T("nearest neighbours only", size=24, color=MUTED),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.14)
        info.next_to(chip, RIGHT, buff=0.7)
        self.play(FadeIn(info, shift=0.1 * LEFT), run_time=0.6)
        self.wait(2.0)
