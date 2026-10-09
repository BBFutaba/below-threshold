"""DecoderScene: a real d = 5 bit-flip instance decoded by the project's MWPM decoder.

Data: media/data/decoder.json (scripts/manim-data.ts): layout from makeRotatedSurfaceCode(5),
noise from sampleNoise(bitflip, p = 0.12, makeRng(seed)), matching and flips from
DECODERS.mwpm, residual and logical outcome from logicalOutcome().
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from manim import *  # noqa: F403,E402

from common import (  # noqa: E402
    BG,
    BLUE,
    BORDER,
    CORAL,
    GREEN,
    MUTED,
    QSTROKE,
    SURFACE,
    TEAL,
    TEXT,
    TILE_FILL,
    TILE_FIRE,
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

NUM = {1: "One", 2: "Two", 3: "Three", 4: "Four", 5: "Five", 6: "Six"}


class DecoderScene(Scene):
    def construct(self):
        setup(self)
        data = load("decoder")
        lay = data["layout"]
        ok = data["success"]
        bad = data["failure"]

        cap = Captions(self)
        lat = Lattice(lay, s=1.0, center=[-2.6, 0.22, 0])

        # ---- side card: what this is, and the visual key -----------------
        card = RoundedRectangle(width=4.95, height=6.05, corner_radius=0.22)
        card.set_fill(SURFACE, opacity=0.9).set_stroke(BORDER, width=1.5)
        card.move_to([3.95, 0.27, 0])
        title = H("Exact matching (MWPM)", size=27)
        meta = T(f"d = 5  ·  p = {ok['model']['p']:.0%} bit flips  ·  seed {ok['seed']}", size=21, color=MUTED)
        head = VGroup(title, meta).arrange(DOWN, aligned_edge=LEFT, buff=0.12)
        head.move_to(card.get_corner(UL) + np.array([0.34, -0.28, 0]), aligned_edge=UL)
        rule = Line(card.get_left() + RIGHT * 0.34, card.get_right() + LEFT * 0.34).set_stroke(BORDER, width=1.5)
        rule.set_y(head.get_bottom()[1] - 0.18)

        def icon_qubit(fill=BG, stroke=QSTROKE):
            return Circle(radius=0.14).set_fill(fill, opacity=1).set_stroke(stroke, width=2.4)

        def icon_tile(color, op, dot=False):
            sq = RoundedRectangle(width=0.34, height=0.34, corner_radius=0.05)
            sq.set_fill(color, opacity=op).set_stroke(color, width=1.4, opacity=0.6 if op < 0.5 else 1)
            if dot:
                return VGroup(sq, Dot(radius=0.05, color=BG).move_to(sq))
            return VGroup(sq)

        def icon_path():
            return VGroup(DashedLine(LEFT * 0.19, RIGHT * 0.19, dash_length=0.075).set_stroke(BLUE, width=5))

        def icon_error():
            q = Circle(radius=0.12).set_fill(BG, opacity=1).set_stroke(QSTROKE, width=2)
            ring = Circle(radius=0.19).set_stroke(CORAL, width=3)
            x = T("X", size=14, color=CORAL, weight="BOLD")
            return VGroup(q, ring, x)

        icons = [
            (icon_qubit(), "data qubit"),
            (icon_tile(TEAL, TILE_FILL), "Z-check: sees bit flips"),
            (icon_tile(VIOLET, TILE_FILL), "X-check: sees phase flips"),
            (icon_tile(TEAL, TILE_FIRE, dot=True), "fired check"),
            (icon_path(), "decoder's matching"),
            (icon_qubit(fill=BLUE), "correction (a flip)"),
            (icon_error(), "the actual error"),
        ]
        rows = VGroup()
        for ic, label in icons:
            slot = VGroup(Rectangle(width=0.4, height=0.36).set_opacity(0), ic)
            ic.move_to(slot[0])
            row = VGroup(slot, T(label, size=23, color=MUTED)).arrange(RIGHT, buff=0.26)
            rows.add(row)
        rows.arrange(DOWN, aligned_edge=LEFT, buff=0.1)
        rows.next_to(rule, DOWN, buff=0.22).align_to(head, LEFT)
        rule2 = rule.copy().set_y(rows.get_bottom()[1] - 0.2)
        status_anchor = np.array([head.get_left()[0], rule2.get_y() - 0.2, 0])
        status = {"m": None}

        def set_status(s, color=TEXT):
            new = T(s, size=22, color=color, line_spacing=0.85)
            new.move_to(status_anchor, aligned_edge=UL)
            anims = [FadeIn(new, shift=0.08 * UP)]
            if status["m"] is not None:
                anims.append(FadeOut(status["m"]))
            status["m"] = new
            return anims

        # ---- 1. the lattice and the card --------------------------------
        self.add(eyebrow("BELOW THRESHOLD  ·  HOW A DECODER THINKS"))
        self.play(
            LaggedStart(*[FadeIn(t, scale=0.92) for t in lat.tiles], lag_ratio=0.02, run_time=1.0),
            LaggedStart(*[FadeIn(q, scale=0.8) for q in lat.qubits], lag_ratio=0.02, run_time=1.0),
            FadeIn(card), FadeIn(head), Create(rule), Create(rule2),
            FadeIn(rows[0]), FadeIn(rows[1]), FadeIn(rows[2]),
        )
        self.add(lat)

        # ---- 2. noise strikes, hidden ------------------------------------
        cap.show("Noise strikes. The errors stay hidden.")
        glints = VGroup(*[Circle(radius=0.3).move_to(lat.qpos(i)).set_stroke(CORAL, width=3, opacity=0) for i in range(lay["n"])])
        glints.set_z_index(4)
        self.add(glints)
        order = sorted(range(lay["n"]), key=lambda i: lay["dataQubits"][i]["r"] + lay["dataQubits"][i]["c"])
        self.play(
            LaggedStart(
                *[Succession(glints[i].animate(run_time=0.2).set_stroke(opacity=0.5), glints[i].animate(run_time=0.35).set_stroke(opacity=0)) for i in order],
                lag_ratio=0.06,
            ),
            run_time=1.4,
        )
        self.remove(glints)

        # ---- 3. checks fire ------------------------------------------------
        k = len(ok["fired"])
        cap.show(f"{NUM.get(k, str(k))} checks fire. That is all we see.")
        self.play(*lat.fire(ok["fired"]), FadeIn(rows[3], shift=0.1 * UP), run_time=0.6)
        self.play(*[Indicate(lat.tiles[i], scale_factor=1.12, color=TEAL) for i in ok["fired"]], run_time=0.6)
        self.wait(0.3)
        cap.show("Which errors explain these?")
        self.wait(0.9)

        # ---- 4. MWPM matching, in the decoder's order -------------------
        cap.show("The decoder pairs them by the shortest paths.")
        self.play(FadeIn(rows[4], shift=0.1 * UP), run_time=0.3)
        paths_ok = VGroup()
        for m in ok["matching"]:
            p = lat.dashed_path(m)
            paths_ok.add(p)
            ends = [m["from"]] + ([m["to"]] if not m["toBoundary"] else [])
            self.play(*[Indicate(lat.tiles[i], scale_factor=1.1, color=TEAL) for i in ends], run_time=0.35)
            self.play(Create(p), run_time=0.75, rate_func=smooth)
            if m["toBoundary"]:
                lbl = T("edge", size=21, color=BLUE).next_to(p[-1], LEFT, buff=0.1)
                self.play(FadeIn(lbl), run_time=0.25)
                paths_ok.add(lbl)
        n_pairs = len(ok["matching"])
        self.play(*set_status(f"{n_pairs} pairs  ·  {len(ok['correction'])} flips in total\nThe fewest flips that fit."), run_time=0.4)
        self.wait(0.3)

        # ---- 5. corrections ---------------------------------------------
        cap.show("Flip every qubit the paths cross.")
        self.play(FadeIn(rows[5], shift=0.1 * UP), run_time=0.3)
        self.play(LaggedStart(*[lat.correct_anim(q) for q in ok["correction"]], lag_ratio=0.25), run_time=0.8)
        # error x correction has zero syndrome, so the fired checks go quiet.
        self.play(*lat.fire(ok["fired"], on=False), run_time=0.5)
        self.wait(0.2)

        # ---- 6. reveal the real errors ------------------------------------
        cap.show("Now reveal the real errors.")
        self.play(FadeIn(rows[6], shift=0.1 * UP), run_time=0.3)
        marks = VGroup(*[lat.error_mark(e["qubit"], e["pauli"], on_blue=e["qubit"] in ok["correction"]) for e in ok["errors"]])
        self.play(LaggedStart(*[FadeIn(mk, scale=1.3) for mk in marks], lag_ratio=0.2), run_time=0.8)
        self.wait(0.4)

        # ---- 7. the residual is a closed loop ------------------------------
        loop_stab = ok["residualAsStabilizers"][0]
        cap.show("Errors and fixes together close a loop.")
        sup = lay["stabilizers"][loop_stab]["support"]
        pts = [lat.qpos(q) for q in sup]
        cx = np.mean([p[0] for p in pts])
        cy = np.mean([p[1] for p in pts])
        loop = RoundedRectangle(width=1.5, height=1.5, corner_radius=0.34).move_to([cx, cy, 0])
        loop.set_stroke(GREEN, width=5).set_fill(GREEN, opacity=0.07).set_z_index(5)
        others = [i for i in range(lay["n"]) if i not in sup]
        dim = [lat.qubits[i].animate.set_stroke(opacity=0.35) for i in others]
        dim += [t.animate.set_fill(opacity=0.07).set_stroke(opacity=0.25) for j, t in enumerate(lat.tiles) if j != loop_stab]
        self.play(Create(loop), *dim, paths_ok.animate.set_opacity(0.3), run_time=0.8)
        self.play(*set_status("Leftover = one check's loop.\nIt changes nothing: harmless.", color=GREEN), run_time=0.5)
        self.wait(0.8)
        cap.show("Qubit saved.", color=GREEN)
        self.wait(1.2)

        # ---- 8. coda: a seed where the likeliest story is wrong -------------
        self.play(
            FadeOut(loop), FadeOut(marks), FadeOut(paths_ok), FadeOut(status["m"]),
            *[lat.qubits[i].animate.set_fill(BG, opacity=1).set_stroke(opacity=1) for i in range(lay["n"])],
            *[t.animate.set_fill(opacity=TILE_FILL).set_stroke(opacity=0.55) for t in lat.tiles],
            run_time=0.6,
        )
        status["m"] = None
        meta2 = T(f"d = 5  ·  p = {bad['model']['p']:.0%} bit flips  ·  seed {bad['seed']}", size=21, color=MUTED)
        meta2.move_to(meta, aligned_edge=LEFT)
        cap.show("Another seed. Same decoder, unluckier noise.")
        self.play(Transform(meta, meta2), *lat.fire(bad["fired"]), run_time=0.6)
        paths_bad = VGroup(*[lat.dashed_path(m) for m in bad["matching"]])
        self.play(LaggedStart(*[Create(p) for p in paths_bad], lag_ratio=0.5), run_time=1.0)
        self.play(
            LaggedStart(*[lat.correct_anim(q) for q in bad["correction"]], lag_ratio=0.3),
            *lat.fire(bad["fired"], on=False),
            run_time=0.7,
        )
        marks2 = VGroup(*[lat.error_mark(e["qubit"], e["pauli"], on_blue=e["qubit"] in bad["correction"]) for e in bad["errors"]])
        self.play(LaggedStart(*[FadeIn(mk, scale=1.3) for mk in marks2], lag_ratio=0.2), run_time=0.7)

        # Residual = error x correction: a chain from the top edge to the bottom edge.
        res_sorted = sorted(bad["residual"], key=lambda q: lay["dataQubits"][q]["r"])
        top = lat.qpos(res_sorted[0]) + UP * 0.6
        bot = lat.qpos(res_sorted[-1]) + DOWN * 0.6
        chain = VMobject().set_points_as_corners([top] + [lat.qpos(q) for q in res_sorted] + [bot])
        chain.set_stroke(CORAL, width=6).set_z_index(2.5)
        cap.show("The leftover chain runs edge to edge.")
        self.play(Create(chain), paths_bad.animate.set_opacity(0.3), *set_status("Leftover crosses the grid:\nthe stored bit has flipped.", color=CORAL), run_time=0.9)
        tl, br = lat.bounds_rect(pad=0.72)
        flash = RoundedRectangle(width=br[0] - tl[0], height=tl[1] - br[1], corner_radius=0.22).move_to((tl + br) / 2)
        flash.set_stroke(CORAL, width=3, opacity=0).set_fill(CORAL, opacity=0).set_z_index(6)
        self.add(flash)
        banner = pill(H("Logical error", size=30, color=CORAL), pad_x=0.36, pad_y=0.13, fill=BG, stroke=CORAL, stroke_width=2.5)
        banner.move_to([lat.center_pt[0] - 0.9, br[1], 0]).set_z_index(7)
        self.play(flash.animate.set_fill(opacity=0.4).set_stroke(opacity=1), FadeIn(banner, scale=1.08), run_time=0.35)
        self.play(flash.animate.set_fill(opacity=0.14), run_time=0.6)
        cap.show("Below threshold, bigger codes make this rarer.")
        self.wait(1.6)
