"""Chapter 5: decoding is a matching problem.

Everything drawn here is the real d = 5 surface code and two real seeded bit-flip instances
decoded by the project's own MWPM decoder (media/data/film/matching.json, exported by
scripts/film/matching.ts from src/core):

- success, seed 10060, p = 8 %: four lit checks; the weighted graph's edge labels are the true
  shortest-path distances (decodingGraph.distance), the flickering candidate chains are the real
  shortest chains (pathEdges), the alternative totals are real pairings of those distances, and
  the highlighted matching, corrections, errors and the residual loop (one X plaquette) are the
  decoder's actual output.
- failure, seed 153, p = 12 %: the cheapest explanation (weight 2) is not the truth (weight 3);
  error times correction is the whole left column, a logical X from the top edge to the bottom.
"""

from __future__ import annotations

import numpy as np
from manim import (
    DOWN,
    LEFT,
    ORIGIN,
    RIGHT,
    UP,
    AnimationGroup,
    Circle,
    Create,
    DashedLine,
    DashedVMobject,
    Dot,
    FadeIn,
    FadeOut,
    LaggedStart,
    Line,
    Restore,
    Succession,
    Transform,
    TransformFromCopy,
    TransformMatchingTex,
    ValueTracker,
    VGroup,
    VMobject,
    Wait,
    Write,
    interpolate_color,
    linear,
    ManimColor,
    rate_functions,
    smooth,
    there_and_back,
)

from common import TILE_FILL, Lattice
from film import AMBER, BG, BLUE, CORAL, FAINT, GREEN, MUTED, MX, TEAL, TEXT, TX, YELLOW, NarratedMovingScene, load

S = 1.0  # lattice cell size (world units)
GC = np.array([-1.25, -0.05, 0.0])  # centre of the abstract graph
GR = 2.75  # its radius
EQ_X = 3.15  # left edge of the equation column next to the graph


# --------------------------------------------------------------------------- drawing helpers


def glow_path(pts, color, width=4.0, opacity=1.0, glow=0.16, z=2):
    """A polyline with a soft halo (2swap-style glowing edge)."""
    core = VMobject().set_points_as_corners([np.array(p, dtype=float) for p in pts])
    core.set_stroke(color, width=width, opacity=opacity)
    halo = core.copy().set_stroke(color, width=width * 3.6, opacity=opacity * glow)
    return VGroup(halo, core).set_z_index(z)


def glow_node(color, r=0.13, fill=True):
    halos = [Circle(radius=r * k).set_fill(color, a).set_stroke(width=0) for k, a in ((3.0, 0.07), (2.0, 0.16))]
    if fill:
        core = Circle(radius=r).set_fill(color, 1).set_stroke(color, width=0)
    else:
        core = Circle(radius=r * 1.25).set_fill(BG, 1).set_stroke(color, width=4)
    return VGroup(*halos, core)


def ring(p, r=0.31, color=CORAL, width=4.2):
    return Circle(radius=r).move_to(p).set_stroke(color, width=width).set_fill(opacity=0).set_z_index(4)


class GEdge(VGroup):
    """Graph edge whose geometry follows two node mobjects and whose look is driven by trackers,
    so it can flow with moving nodes while it is restyled."""

    def __init__(self, a, b, color=TEXT):
        super().__init__()
        self.a, self.b = a, b
        self.base = color
        self.target = color
        self.grow = ValueTracker(0.0)
        self.op = ValueTracker(0.42)
        self.wd = ValueTracker(2.6)
        self.mix = ValueTracker(0.0)
        self.halo = Line(LEFT, RIGHT)
        self.core = Line(LEFT, RIGHT)
        self.add(self.halo, self.core)
        self.set_z_index(1)
        self.add_updater(lambda m: m.refresh())
        self.refresh()

    def ends(self):
        A, B = self.a.get_center(), self.b.get_center()
        g = max(self.grow.get_value(), 1e-3)
        return A, A + (B - A) * g

    def refresh(self):
        A, E = self.ends()
        if np.linalg.norm(E - A) < 1e-4:
            E = A + 1e-4 * RIGHT
        col = interpolate_color(ManimColor(self.base), ManimColor(self.target), self.mix.get_value())
        op = self.op.get_value() * (1.0 if self.grow.get_value() > 2e-3 else 0.0)
        for line, w, o in ((self.halo, self.wd.get_value() * 4.0, op * 0.16), (self.core, self.wd.get_value(), op)):
            line.put_start_and_end_on(A, E)
            line.set_stroke(col, width=w, opacity=o)
        return self

    def mid(self):
        return (self.a.get_center() + self.b.get_center()) / 2


class MatchingScene(NarratedMovingScene):
    scene_id = "matching"

    def construct(self):
        data = load("film/matching")
        ok, bad = data["success"], data["failure"]
        self.chapter_card()

        frame = self.camera.frame
        lat = Lattice(data["layout"], s=S)
        self.lat = lat
        lit = ok["lit"]

        # Shared clock for the graph's gentle breathing.
        self.clock = ValueTracker(0.0)
        ticker = VMobject()
        ticker.add_updater(lambda m, dt: self.clock.increment_value(dt))
        self.add(ticker)

        # ------------------------------------------------------------------ puzzle
        with self.beat("puzzle") as T:
            p_lab = MX("p", "=", r"8\%", size=38, color=MUTED).move_to([-4.0, 2.5, 0])
            self.add(lat.dots)
            self.play(
                LaggedStart(*[FadeIn(t, scale=0.85) for t in lat.tiles], lag_ratio=0.035),
                LaggedStart(*[FadeIn(q, scale=0.6) for q in lat.qubits], lag_ratio=0.035),
                frame.animate.set(width=12.6).move_to([-0.35, 0.05, 0]),
                run_time=2.2,
            )
            # The FadeIns added each part on its own; keep the lattice as one object in the scene.
            self.remove(*lat.tiles, *lat.qubits, lat.dots)
            self.add(lat)
            self.play(FadeIn(p_lab, shift=0.1 * DOWN), run_time=0.6)
            self.until(0.47, T)
            # "Noise strikes somewhere we cannot see": a faint shimmer runs across every qubit
            # (it marks no location; the real errors stay hidden until the end of the chapter).
            order = sorted(range(lat.lay["n"]), key=lambda q: lat.qpos(q)[0] - lat.qpos(q)[1])
            self.play(
                LaggedStart(
                    *[lat.qubits[q].animate(rate_func=there_and_back).scale(1.22).set_stroke(width=4.2) for q in order],
                    lag_ratio=0.05,
                ),
                run_time=1.6,
            )
            self.until(0.70, T)
            self.play(*lat.fire(lit), *self.pulses(lit), run_time=1.3)
            # Keep breathing until the line ends.
            n = int((T - (self.renderer.time - self._t0()) - 0.2) / 1.5)
            for _ in range(max(0, min(n, 3))):
                self.play(*self.pulses(lit, start=0.42), run_time=1.5)

        # ------------------------------------------------------------------ ends
        with self.beat("ends") as T:
            cands = ok["candidates"]
            pair_c = [c for c in cands if not c["toBoundary"]]
            bnd_c = [c for c in cands if c["toBoundary"]]
            rng = np.random.default_rng(5)
            pair_c = [pair_c[i] for i in rng.permutation(len(pair_c))]
            bnd_c = [bnd_c[i] for i in rng.permutation(len(bnd_c))]
            top_y = lat.rc(-0.5, 0)[1]
            bot_y = lat.rc(lat.d - 0.5, 0)[1]
            xl, xr = lat.qpos(0)[0] - 0.5 * S, lat.qpos(lat.d - 1)[0] + 0.5 * S
            edges = VGroup(
                DashedLine([xl, top_y, 0], [xr, top_y, 0], dash_length=0.13).set_stroke(MUTED, width=3, opacity=0.9),
                DashedLine([xl, bot_y, 0], [xr, bot_y, 0], dash_length=0.13).set_stroke(MUTED, width=3, opacity=0.9),
            ).set_z_index(1)
            self.bedges = edges

            def flicker(c, show=0.45):
                path = glow_path(lat.path_points(c), BLUE, width=4.6, opacity=0.85, glow=0.24)
                return Succession(Create(path, run_time=0.55, rate_func=smooth), Wait(show), FadeOut(path, run_time=0.6))

            t_pairs = 0.25 + 0.68 * (T - 0.7)
            gap = (t_pairs - 0.35 - 1.6) / max(1, len(pair_c) - 1)
            self.wait(0.35)
            self.play(LaggedStart(*[flicker(c) for c in pair_c], lag_ratio=gap / 1.6), run_time=gap * (len(pair_c) - 1) + 1.6)
            edges.save_state()
            rem = T - (self.renderer.time - self._t0()) - 0.1
            one = 1.6  # one flicker: draw 0.55, hold 0.45, fade 0.6
            lag = max(0.15, (rem - one) / max(1, len(bnd_c) - 1))
            self.play(
                Create(edges, lag_ratio=0, run_time=0.6),
                LaggedStart(*[flicker(c) for c in bnd_c], lag_ratio=lag / one),
                run_time=lag * (len(bnd_c) - 1) + one,
            )

        # ------------------------------------------------------------------ graph
        with self.beat("graph") as T:
            fit = min(1.0, (T - 0.15) / 9.6)  # the steps below take 9.6 s; a quicker read speeds them up to fit
            lat.save_state()
            keys = list(lit) + ["B"]
            homes = {i: lat.anchor[i] for i in lit}
            targets = self.pentagon(lit)
            # Hidden anchors carry the layout; visible nodes follow them plus a tiny breathing drift.
            self.amp = ValueTracker(0.0)
            self.anchors = {k: Dot(homes.get(k, targets["B"]), radius=0.01).set_opacity(0) for k in keys}
            self.nodes = {}
            for j, k in enumerate(keys):
                node = glow_node(TEAL) if k != "B" else glow_node(TEXT, r=0.15, fill=False)
                node.move_to(self.anchors[k].get_center())
                node.set_z_index(3)
                self.nodes[k] = node
            for j, k in enumerate(keys):
                self.nodes[k].add_updater(self.follower(k, j))
            self.add(*self.anchors.values())

            # 1. Strip away the qubits: the lattice dissolves, lit checks condense into points.
            unlit = [i for i in range(len(lat.stabs)) if i not in lit]
            copies = {i: lat.tiles[i].copy().set_z_index(3) for i in lit}
            self.play(
                LaggedStart(*[q.animate.scale(0.2).set_opacity(0) for q in lat.qubits], lag_ratio=0.03),
                LaggedStart(*[lat.tiles[i].animate.set_opacity(0) for i in unlit], lag_ratio=0.03),
                *[lat.dots[i].animate.set_opacity(0) for i in lit],
                *[Transform(copies[i], self.nodes[i].copy().clear_updaters()) for i in lit],
                *[lat.tiles[i].animate.set_opacity(0) for i in lit],
                run_time=2.0 * fit,
            )
            # Swap the static copies for the live nodes (same place, same look).
            self.remove(*copies.values())
            for i in lit:
                self.add(self.nodes[i])

            # 2. Points glide into an abstract graph; the two boundary edges flow into one node.
            bpos = targets["B"]
            self.play(
                *[self.anchors[i].animate(path_arc=-0.5).move_to(targets[i]) for i in lit],
                edges[0].animate.scale(0.04).move_to(bpos).set_opacity(0),
                edges[1].animate.scale(0.04).move_to(bpos).set_opacity(0),
                frame.animate.set(width=12.8).move_to([GC[0] + 0.2, 0.0, 0]),
                p_lab.animate.set_opacity(0.3),
                run_time=2.4 * fit,
                rate_func=smooth,
            )
            self.remove(edges)
            self.anchors["B"].move_to(bpos)
            self.nodes["B"].move_to(bpos)
            blab = TX(r"\textit{boundary}", size=30, color=MUTED).next_to(bpos, DOWN, buff=0.38)
            self.play(FadeIn(self.nodes["B"], scale=0.4), FadeIn(blab, shift=0.1 * UP), run_time=0.7 * fit)
            self.blab = blab

            # 3. Every pair can be joined; the cost is the real shortest-chain length.
            self.gedges = {}
            self.glabels = {}
            for a_i in range(len(keys)):
                for b_i in range(a_i + 1, len(keys)):
                    a, b = keys[a_i], keys[b_i]
                    e = GEdge(self.nodes[a], self.nodes[b])
                    self.gedges[(a, b)] = e
                    w = self.weight(ok, a, b)
                    self.glabels[(a, b)] = self.edge_label(e, w)
            self.add(*self.gedges.values())
            self.play(
                LaggedStart(*[e.grow.animate.set_value(1) for e in self.gedges.values()], lag_ratio=0.12),
                run_time=1.9 * fit,
            )
            self.play(LaggedStart(*[FadeIn(l, scale=0.5) for l in self.glabels.values()], lag_ratio=0.1), run_time=1.6 * fit)
            self.play(self.amp.animate.set_value(1.0), run_time=1.0 * fit, rate_func=linear)

        # ------------------------------------------------------------------ mwpm
        with self.beat("mwpm") as T:
            eq = MX(r"\Pr(\text{chain}) \;\propto\; \Big(\frac{p}{1-p}\Big)^{\ell}", size=40).move_to([EQ_X, 2.3, 0], aligned_edge=LEFT)
            self.play(Write(eq), frame.animate.set(width=14.2).move_to([1.5, 0.0, 0]), run_time=1.6)
            self.until(0.22, T)
            # Real alternatives (all four to the boundary; the cheapest all-pairs option), then the optimum.
            alts = self.alternatives(ok)
            rows = VGroup()
            for k, (pairs, color) in enumerate(alts):
                is_best = k == len(alts) - 1
                terms = [self.weight(ok, a, b) for a, b in pairs]
                row = self.sum_tex([str(int(w)) for w in terms], int(sum(terms)), color)
                row.move_to([EQ_X, 1.05 - 0.8 * k, 0], aligned_edge=LEFT)
                rows.add(row)
                es = [self.gedges[self.ekey(a, b)] for a, b in pairs]
                nums = [self.glabels[self.ekey(a, b)][1] for a, b in pairs]
                rest = [o for o in self.gedges.values() if o not in es]
                if is_best:
                    # Brighten the real MWPM edges one by one; their costs add up.
                    for j, (e, num) in enumerate(zip(es, nums)):
                        e.target = BLUE
                        anims = [
                            e.mix.animate.set_value(1),
                            e.wd.animate.set_value(6.5),
                            e.op.animate.set_value(1.0),
                            TransformFromCopy(num, row[2 * j]),
                        ]
                        if j:
                            anims.append(FadeIn(row[2 * j - 1]))
                        if j == 0:
                            anims += [o.op.animate.set_value(0.13) for o in rest]
                            anims += [self.label_of(o).op.animate.set_value(0.3) for o in rest]
                        self.play(*anims, run_time=0.65)
                    self.play(FadeIn(row[-2]), FadeIn(row[-1], scale=1.4), run_time=0.55)
                else:
                    self.play(
                        *[e.op.animate.set_value(1.0) for e in es],
                        *[e.wd.animate.set_value(5.0) for e in es],
                        *[o.op.animate.set_value(0.13) for o in rest],
                        *[self.label_of(o).op.animate.set_value(0.3) for o in rest],
                        *[TransformFromCopy(num, row[2 * j]) for j, num in enumerate(nums)],
                        run_time=0.7,
                    )
                    self.play(FadeIn(VGroup(*[row[2 * j - 1] for j in range(1, len(nums))], row[-2], row[-1])), run_time=0.3)
                    self.wait(0.25)
                    self.play(
                        *[o.op.animate.set_value(0.42) for o in rest],
                        *[self.label_of(o).op.animate.set_value(1.0) for o in rest],
                        *[e.op.animate.set_value(0.42) for e in es],
                        *[e.wd.animate.set_value(2.6) for e in es],
                        row.animate.set_opacity(0.5),
                        run_time=0.35,
                    )
            best = rows[-1]
            name = VGroup(TX(r"minimum weight", size=36), TX(r"perfect matching", size=36)).arrange(DOWN, buff=0.14, aligned_edge=LEFT)
            name.next_to(rows, DOWN, buff=0.6).align_to(rows, LEFT)
            self.until(0.62, T)
            self.play(Write(name), best[-1].animate.set_color(YELLOW).scale(1.2), run_time=1.3)
            self.play(best[-1].animate.set_color(BLUE).scale(1 / 1.2), run_time=0.5)
            algo = TX(r"\textit{Edmonds' blossom algorithm}", size=30, color=MUTED).next_to(name, DOWN, buff=0.3).align_to(name, LEFT)
            self.until(0.8, T)
            self.play(FadeIn(algo, shift=0.1 * UP), run_time=0.7)
            self.mw_side = VGroup(eq, rows, name, algo)

        # ------------------------------------------------------------------ saved
        with self.beat("saved") as T:
            match_keys = [self.ekey(*pr) for pr in self.pairs_of(ok["matching"])]
            others = [e for k, e in self.gedges.items() if k not in match_keys]
            self.play(
                FadeOut(self.mw_side, shift=0.2 * RIGHT),
                FadeOut(VGroup(*self.glabels.values())),
                FadeOut(self.blab),
                *[e.op.animate.set_value(0) for e in others],
                self.amp.animate.set_value(0),
                run_time=0.7,
            )
            self.remove(*others)
            # Fold back: nodes glide home along the reverse arc; matched edges become the real chains.
            for e in self.gedges.values():
                e.clear_updaters()
            for n in self.nodes.values():
                n.clear_updaters()
            solid, dashed = [], []
            for m in ok["matching"]:
                k = self.ekey(*self.pair_key(m))
                pts = lat.path_points(m)
                sol = glow_path(pts, BLUE, width=5.0, opacity=1.0, glow=0.2)
                solid.append((self.gedges[k], sol))
                dashed.append(lat.dashed_path(m, color=BLUE, width=5.0))
            arc = 0.5
            self.add(self.bedges)
            self.play(
                Restore(lat),
                *[self.nodes[i].animate(path_arc=arc).move_to(lat.anchor[i]) for i in lit],
                *[Transform(e, sol, path_arc=arc) for e, sol in solid],
                self.nodes["B"].animate.scale(0.2).set_opacity(0),
                Restore(self.bedges),
                p_lab.animate.set_opacity(1),
                frame.animate.set(width=12.6).move_to([0.4, 0.05, 0]),
                run_time=2.2,
                rate_func=smooth,
            )
            self.play(
                *[FadeOut(e) for e, _ in solid],
                *[FadeIn(dp) for dp in dashed],
                *[FadeOut(self.nodes[i]) for i in lit],
                run_time=0.6,
            )
            self.remove(self.nodes["B"])
            # Apply the corrections: the decoder's flips; every lit check goes dark.
            corr = ok["correction"]
            self.play(
                LaggedStart(*[lat.correct_anim(q) for q in corr], lag_ratio=0.15),
                *lat.fire(lit, on=False),
                run_time=1.2,
            )
            self.until(0.45, T)
            # The hidden errors, revealed.
            errs = ok["errors"]
            rings = {q: ring(lat.qpos(q)) for q in errs}
            self.play(LaggedStart(*[Create(r) for r in rings.values()], lag_ratio=0.15), run_time=1.1)
            # Where error and correction coincide they cancel; the rest closes into a loop (a stabilizer).
            same = [q for q in errs if q in corr]
            loop_q = ok["residual"]
            stab = lat.stabs[ok["residualAsStabilizers"][0]]
            sq = self.loop_order(stab["support"])
            loop = glow_path([lat.qpos(q) for q in sq + sq[:1]], GREEN, width=6.0, opacity=1.0, glow=0.28, z=2)
            self.play(
                *[FadeOut(rings[q]) for q in same],
                *[lat.qubits[q].animate.set_fill(BG, 1) for q in same],
                FadeOut(VGroup(*dashed, self.bedges)),
                run_time=0.8,
            )
            self.until(0.66, T)
            self.play(Create(loop), run_time=1.3)
            lc = sum(lat.qpos(q) for q in sq) / len(sq)
            saved = TX(r"\textit{saved}", size=36, color=GREEN).move_to([lat.rc(0, lat.d - 0.5)[0] + 1.05, lc[1], 0])
            self.play(
                loop[0].animate(rate_func=there_and_back).set_stroke(width=34, opacity=0.35),
                FadeIn(saved, shift=0.1 * LEFT),
                run_time=1.2,
            )
            self.saved_group = VGroup(loop, saved, *[rings[q] for q in errs if q not in same])
            self.corr_q = corr

        # ------------------------------------------------------------------ failure
        with self.beat("failure") as T:
            # "But not always": reset the grid.
            self.play(
                FadeOut(self.saved_group),
                *[lat.qubits[q].animate.set_fill(BG, 1) for q in self.corr_q],
                frame.animate.set(width=13.0).move_to([0.9, 0.05, 0]),
                run_time=1.0,
            )
            p_new = MX("p", "=", r"12\%", size=38, color=MUTED)
            p_new.move_to(p_lab, aligned_edge=LEFT)
            p_new[2].set_color(AMBER)
            self.until(0.1, T)
            self.play(TransformMatchingTex(p_lab, p_new), run_time=0.8)
            blit = bad["lit"]
            self.play(*lat.fire(blit), *self.pulses(blit), run_time=1.2)
            # The decoder's cheapest explanation.
            dashed = [lat.dashed_path(m, color=BLUE, width=5.0) for m in bad["matching"]]
            guess_terms = [str(int(m["length"])) for m in bad["matching"]]
            sx = lat.rc(0, lat.d - 0.5)[0] + 2.0
            guess = self.sum_tex(guess_terms, int(bad["weight"]), BLUE).move_to([sx, 0.55, 0])
            self.play(LaggedStart(*[Create(d) for d in dashed], lag_ratio=0.3), FadeIn(guess, shift=0.1 * LEFT), run_time=1.3)
            self.play(
                LaggedStart(*[lat.correct_anim(q) for q in bad["correction"]], lag_ratio=0.2),
                *lat.fire(blit, on=False),
                run_time=0.9,
            )
            # The truth costs more, so matching never picks it.
            errs = bad["errors"]
            rings = [ring(lat.qpos(q)) for q in errs]
            truth_terms = self.true_terms(bad)
            truth = self.sum_tex(truth_terms, int(bad["trueWeight"]), CORAL).move_to([sx, -0.25, 0])
            truth.align_to(guess, RIGHT)
            self.play(LaggedStart(*[Create(r) for r in rings], lag_ratio=0.2), FadeIn(truth, shift=0.1 * LEFT), run_time=1.2)
            self.until(0.47, T)
            # Together: one chain from the top edge to the bottom edge.
            walk = bad["residualWalk"]["qubits"]
            pts = [lat.qpos(q) for q in walk]
            top_ext = pts[0] + (pts[0] - pts[1]) / np.linalg.norm(pts[0] - pts[1]) * 0.55 * S
            bot_ext = pts[-1] + (pts[-1] - pts[-2]) / np.linalg.norm(pts[-1] - pts[-2]) * 0.55 * S
            chain = glow_path([top_ext] + pts + [bot_ext], CORAL, width=8.0, opacity=1.0, glow=0.3, z=2)
            dim = [lat.tiles[i] for i in range(len(lat.stabs))]
            self.play(
                *[FadeOut(d) for d in dashed],
                *[t.animate.set_fill(opacity=0.07).set_stroke(opacity=0.25) for t in dim],
                *[lat.qubits[q].animate.set_stroke(opacity=0.35) for q in range(lat.lay["n"]) if q not in walk],
                run_time=0.6,
            )
            self.play(Create(chain), run_time=1.8, rate_func=smooth)
            lost = TX(r"\textit{logical error}", size=34, color=CORAL).next_to(truth, DOWN, buff=0.6).align_to(truth, RIGHT)
            self.until(0.79, T)
            self.play(
                chain[0].animate(rate_func=there_and_back).set_stroke(width=40, opacity=0.4),
                FadeIn(lost, shift=0.1 * UP),
                run_time=1.1,
            )
            self.wait(max(0.05, T - (self.renderer.time - self._t0()) - 0.7))
            # (LaggedStart adds its own Group of parts to the scene, so fade every top-level object.)
            self.play(*[FadeOut(m) for m in self.mobjects if m is not ticker and not isinstance(m, ValueTracker)], run_time=0.6)

    # ---------------------------------------------------------------- helpers
    def _t0(self):
        """Start time of the beat currently playing."""
        return self._beat_start

    def beat(self, key):
        self._beat_start = self.renderer.time
        return super().beat(key)

    def until(self, frac, T):
        """Wait until a fraction of the spoken line (by words) has been said."""
        target = self._beat_start + 0.25 + frac * max(0.0, T - 0.7)
        dt = target - self.renderer.time
        if dt > 0.02:
            self.wait(dt)

    def pulses(self, idxs, start=0.2, color=TEAL):
        anims = []
        for i in idxs:
            r = Circle(radius=start * S).move_to(self.lat.anchor[i]).set_stroke(color, width=3.2, opacity=0.8).set_z_index(5)
            anims.append(Succession(FadeIn(r, run_time=0.01), r.animate.scale(2.5).set_stroke(opacity=0, width=1)))
        return anims

    def follower(self, k, j):
        phase = 1.7 * j + 0.4

        def upd(m):
            t = self.clock.get_value()
            a = self.amp.get_value() * 0.055
            off = np.array([np.sin(0.9 * t + phase), np.cos(0.73 * t + 1.3 * phase), 0.0]) * a
            m.move_to(self.anchors[k].get_center() + off)

        return upd

    def pentagon(self, lit):
        """Pentagon vertices for the lit checks plus the boundary node, keeping their cyclic order
        around the grid and putting the boundary at the bottom."""
        ang = {i: np.arctan2(self.lat.anchor[i][1], self.lat.anchor[i][0]) % (2 * np.pi) for i in lit}
        ang["B"] = 1.5 * np.pi
        order = sorted(ang, key=lambda k: ang[k])
        bi = order.index("B")
        out = {}
        for j, k in enumerate(order):
            a = 1.5 * np.pi + 2 * np.pi * (j - bi) / len(order)
            out[k] = GC + GR * np.array([np.cos(a), np.sin(a), 0.0])
        return out

    def weight(self, inst, a, b):
        lit = inst["lit"]
        if a == "B":
            a, b = b, a
        if b == "B":
            return inst["toBoundary"][lit.index(a)]
        return inst["dist"][lit.index(a)][lit.index(b)]

    def label_of(self, e):
        return next(self.glabels[k] for k, v in self.gedges.items() if v is e)

    def ekey(self, a, b):
        keys = list(self.gedges.keys())
        return (a, b) if (a, b) in keys else (b, a)

    def pair_key(self, m):
        return (m["from"], "B" if m["toBoundary"] else m["to"])

    def pairs_of(self, matching):
        return [self.pair_key(m) for m in matching]

    def edge_label(self, e, w):
        disk = Circle(radius=0.24).set_fill(BG, 1).set_stroke(width=0)
        num = MX(str(int(w)) if float(w).is_integer() else f"{w:.1f}", size=40, color=TEXT)
        lab = VGroup(disk, num).set_z_index(2)
        lab.op = ValueTracker(1.0)

        def upd(m):
            m.move_to(e.mid())
            num.set_opacity(m.op.get_value())

        lab.add_updater(upd)
        return lab

    def alternatives(self, inst):
        """Two real alternative pairings (from the exported distances) and the decoder's optimum."""
        lit = inst["lit"]
        best = self.pairs_of(inst["matching"])
        all_b = [(i, "B") for i in lit]
        options = []
        if sorted(map(str, all_b)) != sorted(map(str, best)):
            options.append(all_b)
        # A cheapest pairing that matches no check to the boundary.
        import itertools

        best_pp, best_w = None, None
        for perm in itertools.permutations(lit):
            pp = [(perm[k], perm[k + 1]) for k in range(0, len(perm) - 1, 2)]
            w = sum(self.weight(inst, a, b) for a, b in pp)
            if best_w is None or w < best_w:
                best_pp, best_w = pp, w
        if best_pp:
            options.append(best_pp)
        return [(o, MUTED) for o in options] + [(best, BLUE)]

    def loop_order(self, support):
        pts = {q: self.lat.qpos(q) for q in support}
        c = sum(pts.values()) / len(pts)
        return sorted(support, key=lambda q: np.arctan2(pts[q][1] - c[1], pts[q][0] - c[0]))

    def sum_tex(self, terms, total, color):
        parts = []
        for j, t in enumerate(terms):
            if j:
                parts.append("+")
            parts.append(t)
        parts += ["=", str(total)]
        return MX(*parts, size=42, color=color)

    def true_terms(self, inst):
        """The true errors as an explanation: chain lengths of each connected error cluster."""
        lat = self.lat
        errs = list(inst["errors"])
        # Group errors that share a Z-check (they form one chain); each chain costs its length.
        zs = {q: {i for i, s in enumerate(lat.stabs) if s["type"] == "Z" and q in s["support"]} for q in errs}
        groups = []
        for q in errs:
            hit = [g for g in groups if any(zs[q] & zs[o] for o in g)]
            merged = {q}.union(*hit) if hit else {q}
            groups = [g for g in groups if g not in hit] + [merged]
        lens = sorted(len(g) for g in groups)
        return [str(n) for n in lens]
