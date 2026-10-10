"""Chapter 6: when the checks lie.

A real phenomenological instance on the d = 5 code (media/data/film/spacetime.json, exported by
scripts/film/spacetime.ts with timeStack.findStackPuzzle(157, 5)): data bit-flips p = 5 % and
check misreports q = 7 % per round, three noisy rounds plus a perfect final readout (four layers).

- round 1: Z-check 11 misreports while no data error exists anywhere (the lie);
- round 3: a real X error on qubit 10 lights checks 7 and 12, and check 11 lies again;
- the detection events (changes from the round before) are exactly the exported ones, and the
  blue space-time matching is the project's MWPM decoder run on buildPhenomenologicalGraph.

Only the Z-checks (teal) are stacked: they are the detectors for the bit flips decoded here.
"""

from __future__ import annotations

import numpy as np
from manim import (
    DEGREES,
    DOWN,
    LEFT,
    OUT,
    RIGHT,
    UP,
    Circle,
    Create,
    DashedLine,
    FadeIn,
    FadeOut,
    LaggedStart,
    Line,
    Rectangle,
    Restore,
    Succession,
    Transform,
    Triangle,
    ValueTracker,
    VGroup,
    VMobject,
    Wait,
    smooth,
    there_and_back,
)

from common import TILE_FILL, Lattice
from film import AMBER, BG, BLUE, CORAL, FAINT, MUTED, MX, TEAL, TEXT, TX, Narrated3DScene, load

S = 1.0  # lattice cell size
H = 1.4  # height of one round in the stack
LIT = 0.72  # fill opacity of a lit check in the stack
UNLIT = 0.045
UNLIT_STROKE = 0.2


class Glow(VGroup):
    """A group that remembers its parts' opacities, so it can be dimmed and restored as a whole
    (set_opacity would flatten a soft halo into a solid disc)."""

    def remember(self):
        self.base = [(m.get_fill_opacity(), m.get_stroke_opacity()) for m in self.get_family()[1:]]
        return self

    def level(self, f):
        for m, (fo, so) in zip(self.get_family()[1:], self.base):
            m.set_fill(opacity=fo * f, family=False)
            m.set_stroke(opacity=so * f, family=False)
        return self


def glow_dot(r=0.09, core=TEXT, halo=TEAL):
    return Glow(
        Circle(radius=r * 3.6).set_fill(halo, 0.12).set_stroke(width=0),
        Circle(radius=r * 2.2).set_fill(halo, 0.34).set_stroke(width=0),
        Circle(radius=r).set_fill(core, 1).set_stroke(width=0),
    ).set_z_index(8).remember()


def glow_line(pts, color, width=5.0, opacity=1.0, glow=0.2, z=6):
    core = VMobject().set_points_as_corners([np.array(p, dtype=float) for p in pts]).set_stroke(color, width=width, opacity=opacity)
    halo = core.copy().set_stroke(color, width=width * 3.5, opacity=opacity * glow)
    return Glow(halo, core).set_z_index(z).remember()


class SpacetimeScene(Narrated3DScene):
    scene_id = "spacetime"

    def fixed(self, *mobs):
        """2D overlay that ignores the 3D camera."""
        self.add_fixed_in_frame_mobjects(*mobs)
        self.remove(*mobs)
        return mobs

    def facing(self, *mobs):
        """Label that sits at a 3D point but always faces the camera."""
        self.add_fixed_orientation_mobjects(*mobs)
        self.remove(*mobs)
        return mobs

    def beat(self, key):
        self._beat_start = self.renderer.time
        return super().beat(key)

    def until(self, frac, T):
        """Wait until a fraction of the spoken line (by words) has been said."""
        target = self._beat_start + 0.25 + frac * max(0.0, T - 0.7)
        dt = target - self.renderer.time
        if dt > 0.02:
            self.wait(dt)

    def P(self, check, layer):
        return self.lat.anchor[check] + OUT * layer * H

    def construct(self):
        data = load("film/spacetime")
        self.data = data
        self.chapter_card()
        lat = Lattice(data["layout"], s=S)
        self.lat = lat
        zc = data["zChecks"]
        xc = [i for i in range(len(lat.stabs)) if i not in zc]
        L = data["layers"]
        measured = data["measured"]
        lie_check = data["lies"][0][0]
        lie_round = 0

        # ------------------------------------------------------------------ lie
        with self.beat("lie") as T:
            self.add(lat.dots)
            self.play(
                LaggedStart(*[FadeIn(t, scale=0.85) for t in lat.tiles], lag_ratio=0.03),
                LaggedStart(*[FadeIn(q, scale=0.6) for q in lat.qubits], lag_ratio=0.03),
                run_time=1.8,
            )
            # The FadeIns added each part on its own; keep the lattice as one object in the scene.
            self.remove(*lat.tiles, *lat.qubits, lat.dots)
            self.add(lat)
            rlab = TX(r"round 1", size=36, color=MUTED).move_to([lat.rc(0, -0.5)[0], lat.rc(-0.5, 0)[1] + 0.75, 0], aligned_edge=LEFT)
            self.fixed(rlab)
            self.until(0.42, T)
            # Round 1: check 11 reports a flip, but no data qubit has been touched.
            lie = TX(r"\textit{lie}", size=34, color=AMBER)
            lie.next_to(lat.anchor[lie_check], RIGHT, buff=0.42)
            ring = Circle(radius=0.2).move_to(lat.anchor[lie_check]).set_stroke(TEAL, width=3.2, opacity=0.85).set_z_index(5)
            self.play(
                FadeIn(rlab),
                *lat.fire(measured[0]),
                Succession(FadeIn(ring, run_time=0.01), ring.animate.scale(2.6).set_stroke(opacity=0, width=1)),
                run_time=1.0,
            )
            self.play(FadeIn(lie, shift=0.1 * LEFT), run_time=0.6)
            self.until(0.86, T)
            # Round 2: it reads correctly again.
            rlab2 = TX(r"round 2", size=36, color=MUTED).move_to(rlab)
            self.fixed(rlab2)
            self.play(FadeOut(rlab), FadeIn(rlab2), *lat.fire(measured[0], on=False), lie.animate.set_opacity(0.45), run_time=0.7)
            self.rlab = rlab2
            self.lie2d = lie

        # ------------------------------------------------------------------ stack
        with self.beat("stack") as T:
            # Layer 0 is the grid itself (its Z-checks); the rest of the grid fades away.
            layers = [VGroup(*[lat.tiles[i] for i in zc])]
            plates = []
            for t in range(L):
                plate = Rectangle(width=lat.d * S, height=lat.d * S).set_stroke(FAINT, width=1.6, opacity=0.55).set_fill(TEXT, 0.025)
                plate.move_to(OUT * t * H)
                plates.append(plate)
            self.play(FadeOut(self.rlab), FadeOut(self.lie2d), run_time=0.5)
            self.move_camera(
                phi=64 * DEGREES,
                theta=-56 * DEGREES,
                zoom=0.88,
                frame_center=OUT * 1.5 * H,
                added_anims=[
                    *[q.animate.set_opacity(0) for q in lat.qubits],
                    *[lat.tiles[i].animate.set_opacity(0) for i in xc],
                    *[lat.dots[i].animate.set_opacity(0) for i in range(len(lat.stabs))],
                    *[self.style_tile(lat.tiles[i], i in measured[0]).set_stroke(width=1.3) for i in zc],
                    FadeIn(plates[0]),
                ],
                run_time=2.6,
            )
            self.remove(lat.qubits, *[lat.tiles[i] for i in xc], lat.dots)
            # Rounds stack upward: each layer is that round's reported Z-check results.
            rise = []
            for t in range(1, L):
                lay = VGroup()
                for i in zc:
                    tile = lat.tiles[i].copy()
                    tile.set_fill(opacity=0).set_stroke(opacity=0, width=1.3)
                    lay.add(tile)
                layers.append(lay)
                target = lay.copy()
                for tile, i in zip(target, zc):
                    tile.shift(OUT * t * H)
                    self.style_now(tile, i in measured[t])
                plates[t].save_state()
                plates[t].move_to(np.zeros(3)).set_stroke(opacity=0)
                rise.append((lay, target, plates[t]))
            axis_x, axis_y = lat.rc(lat.d - 0.5, -0.5)[0] - 0.12, lat.rc(lat.d - 0.5, -0.5)[1] - 0.12
            top = (L - 1) * H + 0.45
            axis = Line([axis_x, axis_y, 0], [axis_x, axis_y, top], stroke_width=2.4, color=MUTED)
            # Arrow tip that always faces the camera (a flat chevron would vanish edge-on).
            tip = Triangle().set_fill(MUTED, 1).set_stroke(width=0).scale(0.11).move_to([axis_x, axis_y, top])
            tlab = TX(r"\textit{time}", size=34, color=MUTED).move_to([axis_x, axis_y, top + 0.42])
            self.facing(tlab, tip)
            per = max(0.9, (0.25 + 0.56 * (T - 0.7) - (self.renderer.time - self._beat_start)) / (L - 1))
            for k, (lay, target, plate) in enumerate(rise):
                anims = [Transform(lay, target), Restore(plate)]
                if k == 0:
                    anims += [
                        Create(axis),
                        Succession(Wait(per * 0.55), FadeIn(tip, run_time=per * 0.45)),
                        Succession(Wait(per * 0.55), FadeIn(tlab, run_time=per * 0.45)),
                    ]
                self.play(*anims, run_time=per, rate_func=smooth)
            self.layers = layers
            self.plates = plates
            # What we look for is change: detection events glow where a check differs from the round before.
            self.until(0.58, T)
            dets = []
            for t, row in enumerate(data["detections"]):
                for i in row:
                    dot = glow_dot().move_to(self.P(i, t))
                    dets.append(((i, t), dot))
            self.dets = dict(dets)
            for _, d in dets:
                self.facing(d)
            self.play(LaggedStart(*[FadeIn(d, scale=0.3) for _, d in dets], lag_ratio=0.15), run_time=1.6)
            self.until(0.76, T)
            # Lit checks that did not change (the error's checks in the final readout) are not events.
            calm = []
            for t in range(L):
                for tile, i in zip(layers[t], zc):
                    if i in measured[t] and (i, t) not in self.dets:
                        calm.append(tile)
            self.play(*[tile.animate.set_fill(opacity=0.22) for tile in calm], run_time=0.9)
            self.play(*[d[1].animate(rate_func=there_and_back).scale(1.6) for d in self.dets.values()], run_time=1.0)

        # ------------------------------------------------------------------ pairs
        with self.beat("pairs") as T:
            qpair = next(m for m in data["matching"] if m["kind"] == "qubit")
            cpair = next(m for m in data["matching"] if m["kind"] == "check" and m["a"]["layer"] == lie_round)
            qa, qb = (qpair["a"]["check"], qpair["a"]["layer"]), (qpair["b"]["check"], qpair["b"]["layer"])
            ca, cb = (cpair["a"]["check"], cpair["a"]["layer"]), (cpair["b"]["check"], cpair["b"]["layer"])
            e = qpair["edges"][0]
            q = e["qubit"]
            tq = e["layer"]
            qpt = lat.qpos(q) + OUT * tq * H
            # A real qubit error: two events in the same round, joined through the flipped qubit.
            others = [d for k, d in self.dets.items() if k not in (qa, qb)]
            err_ring = Glow(Circle(radius=0.27 * S).move_to(qpt).set_stroke(CORAL, width=4.5).set_fill(opacity=0)).set_z_index(7).remember()
            link = glow_line([self.P(*qa), qpt, self.P(*qb)], CORAL, width=5, glow=0.25)
            self.play(*[d.animate.level(0.2) for d in others], run_time=0.6)
            self.play(Create(err_ring), Create(link), run_time=1.2)
            xlab = Glow(MX(r"X", size=38, color=CORAL)).remember().move_to(qpt + 0.6 * OUT)
            self.facing(xlab)
            self.play(FadeIn(xlab, shift=0.1 * DOWN), run_time=0.5)
            self.until(0.45, T)
            # A lying check: the same check in two consecutive rounds.
            self.move_camera(
                theta=-38 * DEGREES,
                phi=66 * DEGREES,
                added_anims=[
                    err_ring.animate.level(0.3),
                    link.animate.level(0.3),
                    xlab.animate.level(0.3),
                    self.dets[qa].animate.level(0.3),
                    self.dets[qb].animate.level(0.3),
                    self.dets[ca].animate.level(1),
                    self.dets[cb].animate.level(1),
                ],
                run_time=1.6,
            )
            vlink = glow_line([self.P(*ca), self.P(*cb)], AMBER, width=6, glow=0.3)
            lie3 = TX(r"\textit{lie}", size=34, color=AMBER).move_to(self.P(*ca) + RIGHT * 0.75 + DOWN * 0.15)
            self.facing(lie3)
            self.play(Create(vlink), FadeIn(lie3), run_time=1.2)
            self.play(self.dets[ca][2].animate(rate_func=there_and_back).scale(1.5), self.dets[cb][2].animate(rate_func=there_and_back).scale(1.5), run_time=1.0)
            self.hl = VGroup(err_ring, link, xlab, vlink, lie3)

        # ------------------------------------------------------------------ match3d
        with self.beat("match3d") as T:
            # The whole space-time decoding graph (real edges), faint; then the decoder's matching.
            gl = VGroup()
            for ed in data["graph"]:
                u = ed["u"]
                if ed["kind"] == "time":
                    pts = [self.P(u["check"], u["layer"]), self.P(ed["v"]["check"], ed["v"]["layer"])]
                elif ed["kind"] == "space":
                    pts = [self.P(u["check"], ed["layer"]), lat.qpos(ed["qubit"]) + OUT * ed["layer"] * H, self.P(ed["v"]["check"], ed["layer"])]
                else:
                    m = {"nodes": [u["check"], -1], "qubits": [ed["qubit"]]}
                    pts = [p + OUT * ed["layer"] * H for p in lat.path_points(m)]
                line = VMobject().set_points_as_corners([np.array(p) for p in pts]).set_stroke(TEXT, width=1.3, opacity=0.22)
                gl.add(line)
            gl.set_z_index(5)
            self.begin_ambient_camera_rotation(rate=0.13)
            self.play(
                FadeOut(self.hl),
                *[d.animate.level(1) for d in self.dets.values()],
                *[tile.animate.set_fill(opacity=min(tile.get_fill_opacity(), 0.35)) for lay in self.layers for tile in lay],
                FadeIn(gl, lag_ratio=0.01),
                run_time=1.4,
            )
            paths = []
            for m in data["matching"]:
                for ed in m["edges"]:
                    if ed["kind"] == "time":
                        pts = [self.P(ed["u"]["check"], ed["u"]["layer"]), self.P(ed["v"]["check"], ed["v"]["layer"])]
                    else:
                        pts = [self.P(ed["u"]["check"], ed["layer"]), lat.qpos(ed["qubit"]) + OUT * ed["layer"] * H, self.P(ed["v"]["check"], ed["layer"])]
                    paths.append(glow_line(pts, BLUE, width=6.5, glow=0.3, z=7))
            self.play(LaggedStart(*[Create(p) for p in paths], lag_ratio=0.45), run_time=2.2)
            self.until(0.8, T)
            self.play(*[p[0].animate(rate_func=there_and_back).set_stroke(width=36, opacity=0.4) for p in paths], run_time=1.0)
            rest = T - (self.renderer.time - self._beat_start) - 0.7
            if rest > 0.05:
                self.wait(rest)
            self.stop_ambient_camera_rotation()
            self.play(*[FadeOut(m) for m in self.mobjects if not isinstance(m, ValueTracker)], run_time=0.6)

    # ---------------------------------------------------------------- helpers
    def style_tile(self, tile, on):
        return tile.animate.set_fill(opacity=LIT if on else UNLIT).set_stroke(opacity=0.85 if on else UNLIT_STROKE)

    def style_now(self, tile, on):
        tile.set_fill(opacity=LIT if on else UNLIT).set_stroke(opacity=0.85 if on else UNLIT_STROKE)
        return tile
