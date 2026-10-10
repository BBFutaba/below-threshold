"""Chapter 1: a fragile kind of information.

The Bloch sphere, a real noisy drift (seeded small rotations applied to QState, exported by
scripts/film/fragile.ts), and the CNOT "copy machine" on |+>, whose output overlaps two
true copies with fidelity exactly 1/2 and whose qubits have zero-length Bloch vectors.
"""

from __future__ import annotations

import numpy as np
from manim import (
    PI,
    Dot,
    DEGREES,
    DOWN,
    LEFT,
    OUT,
    RIGHT,
    UP,
    Arrow3D,
    Circle,
    Create,
    Cross,
    DashedVMobject,
    Dot3D,
    FadeIn,
    FadeOut,
    Line,
    Line3D,
    Sphere,
    TracedPath,
    TransformMatchingTex,
    ValueTracker,
    VGroup,
    Write,
    always_redraw,
    smooth,
)

from common import BLUE, CORAL, FAINT, GREEN, MUTED, TEXT
from film import MX, TX, Narrated3DScene, load

R = 2.0


def bloch_point(x: float, y: float, z: float) -> np.ndarray:
    return R * np.array([x, y, z])


class FragileScene(Narrated3DScene):
    scene_id = "fragile"

    def fixed(self, *mobs):
        """2D overlay that ignores the 3D camera."""
        self.add_fixed_in_frame_mobjects(*mobs)
        self.remove(*mobs)
        return mobs

    def construct(self):
        data = load("film/fragile")
        self.chapter_card()
        self.set_camera_orientation(phi=68 * DEGREES, theta=-52 * DEGREES, zoom=1.0)

        # 3b1b-style wireframe sphere: a camera-facing silhouette plus a few great circles.
        # (A shaded Surface is ~50x slower to render in Manim's Cairo renderer.)
        silhouette = Circle(radius=R).set_fill(BLUE, opacity=0.07).set_stroke(MUTED, width=1.4, opacity=0.6)
        self.add_fixed_orientation_mobjects(silhouette)
        rings = VGroup()
        for lat in (-45, 45):
            z = R * np.sin(np.radians(lat))
            rr = R * np.cos(np.radians(lat))
            rings.add(Circle(radius=rr).shift(OUT * z).set_stroke(FAINT, width=1.0, opacity=0.5))
        for lon in (0, 60, 120):
            m = Circle(radius=R).rotate(PI / 2, axis=RIGHT).rotate(np.radians(lon), axis=OUT)
            rings.add(m.set_stroke(FAINT, width=1.0, opacity=0.45))
        sphere = VGroup(silhouette, rings)
        equator = DashedVMobject(Circle(radius=R).set_stroke(MUTED, width=1.6), num_dashes=48)
        axis = Line3D(start=DOWN * 0 + OUT * -R * 1.15, end=OUT * R * 1.15, color=FAINT, thickness=0.008)
        k0 = MX(r"|0\rangle", size=40).move_to(OUT * (R + 0.45))
        k1 = MX(r"|1\rangle", size=40).move_to(OUT * -(R + 0.45))
        self.add_fixed_orientation_mobjects(k0, k1)

        # The state vector follows a tracked point on the sphere.
        tip = ValueTracker(0)
        target = {"p": bloch_point(0, 0, 1)}
        self.origin = {"p": np.zeros(3)}  # the sphere slides left later; the arrow follows
        def vec():
            a = self.origin["p"]
            b = a + target["p"] * max(tip.get_value(), 1e-3)
            return VGroup(Line(a, b, color=BLUE, stroke_width=7), Dot(b, radius=0.09, color=BLUE))

        arrow = always_redraw(vec)

        with self.beat("arrow") as T:
            self.play(Create(sphere), Create(equator), FadeIn(axis), FadeIn(k0), FadeIn(k1), run_time=1.6)
            self.add(arrow)
            self.play(tip.animate.set_value(1), run_time=0.8)
            self.begin_ambient_camera_rotation(rate=0.06)
            self.move_vec(target, bloch_point(0, 0, -1), run_time=1.6, via=bloch_point(1, 0, 0))
            self.wait(0.4)
            sup = MX(r"\alpha", r"|0\rangle", "+", r"\beta", r"|1\rangle", size=46).to_corner(UP + RIGHT, buff=0.7)
            sup[0].set_color(BLUE)
            sup[3].set_color(BLUE)
            self.fixed(sup)
            th = data["start"]["theta"]
            self.move_vec(target, bloch_point(np.sin(th), 0, np.cos(th)), run_time=1.8)
            self.play(Write(sup), run_time=1.2)

        with self.beat("drift") as T:
            pts = [bloch_point(p["x"], p["y"], p["z"]) for p in data["drift"]]
            trail = TracedPath(lambda: target["p"] * 1.0, stroke_color=CORAL, stroke_width=3.0, stroke_opacity=[0.0, 0.9], dissipating_time=None)
            self.add(trail)
            # One continuous motion through all the real points (no per-step frame rounding).
            self.follow_path(target, pts, run_time=max(1.0, T - 1.0))
            note = TX(r"\textit{a real drift: 90 random kicks of about $6^\circ$}", size=28, color=MUTED).to_corner(DOWN + LEFT, buff=0.5)
            self.fixed(note)
            self.play(FadeIn(note), run_time=0.5)

        with self.beat("backup") as T:
            self.stop_ambient_camera_rotation()
            ball = VGroup(sphere, equator, axis, k0, k1)
            self.play(FadeOut(note), FadeOut(trail), FadeOut(sup), run_time=0.5)
            # Slide the sphere into the left half so the right half can hold the argument.
            shift = self.frame_left_in_3d(3.4)
            o = ValueTracker(0)
            start_o = self.origin["p"].copy()
            mover = Dot3D(radius=0.001).set_opacity(0)
            mover.add_updater(lambda m: self.origin.__setitem__("p", start_o + o.get_value() * shift))
            self.add(mover)
            self.play(ball.animate.shift(shift), o.animate.set_value(1), run_time=1.0)
            mover.clear_updaters()
            self.remove(mover)
            bit = MX(r"0", size=64)
            copies = MX(r"0", r"0", r"0", size=64).arrange(RIGHT, buff=0.35)
            vote = MX(r"\text{vote} \;\Rightarrow\; 0", size=44, color=GREEN)
            classical = VGroup(TX(r"\textsc{classical bit}", size=28, color=MUTED), bit).arrange(DOWN, buff=0.3)
            classical.move_to(RIGHT * 3.0 + UP * 1.6)
            copies.move_to(bit.get_center())
            self.fixed(classical, copies, vote)
            vote.next_to(classical, DOWN, buff=1.1)
            self.play(FadeIn(classical, shift=0.2 * LEFT), run_time=0.7)
            self.play(Transform_(bit, copies), run_time=0.9)
            self.play(Write(vote), run_time=0.8)
            qcopy = MX(r"|\psi\rangle", r"\;\to\;", r"|\psi\rangle|\psi\rangle|\psi\rangle", size=46).move_to(RIGHT * 3.0 + DOWN * 1.9)
            cross = Cross(qcopy, stroke_color=CORAL, stroke_width=6)
            self.fixed(qcopy, cross)
            self.play(Write(qcopy), run_time=1.0)
            self.play(Create(cross), run_time=0.6)
            self.left_group = VGroup(classical, copies, vote, qcopy, cross)

        with self.beat("clone") as T:
            self.play(FadeOut(self.left_group), run_time=0.6)
            # The copy machine: control = input, target = blank |0>.
            w0 = Line(LEFT * 1.6, RIGHT * 1.6, color=FAINT).shift(UP * 0.5)
            w1 = Line(LEFT * 1.6, RIGHT * 1.6, color=FAINT).shift(DOWN * 0.5)
            ctrl = Circle(radius=0.09, color=BLUE).set_fill(BLUE, 1).move_to(UP * 0.5)
            targ = Circle(radius=0.22, color=BLUE).move_to(DOWN * 0.5)
            plus_line = VGroup(Line(DOWN * 0.22, UP * 0.22, color=BLUE).move_to(DOWN * 0.5), Line(LEFT * 0.22, RIGHT * 0.22, color=BLUE).move_to(DOWN * 0.5))
            stem = Line(UP * 0.5, DOWN * 0.28, color=BLUE)
            in0 = MX(r"|+\rangle", size=40).next_to(w0, LEFT, buff=0.2)
            in1 = MX(r"|0\rangle", size=40).next_to(w1, LEFT, buff=0.2)
            circuit = VGroup(w0, w1, stem, ctrl, targ, plus_line, in0, in1).move_to(RIGHT * 3.0 + UP * 2.0)
            self.fixed(circuit)
            self.play(Create(VGroup(w0, w1)), FadeIn(in0), FadeIn(in1), run_time=0.7)
            self.play(Create(stem), FadeIn(ctrl), Create(targ), Create(plus_line), run_time=0.7)
            eq = MX(r"|+\rangle|0\rangle", size=44).move_to(RIGHT * 3.0 + DOWN * 0.1)
            out = MX(r"\tfrac{1}{\sqrt{2}}\big(|00\rangle + |11\rangle\big)", size=44).move_to(eq)
            want = MX(r"\neq\; |+\rangle|+\rangle", size=44, color=CORAL).next_to(out, DOWN, buff=0.3)
            fid = data["clone"]["fidelity"]
            fid_t = MX(r"\big|\langle{+}{+}|\psi\rangle\big|^2 = " + (r"\tfrac{1}{2}" if abs(fid - 0.5) < 1e-9 else f"{fid:.3f}"), size=44).next_to(want, DOWN, buff=0.4)
            self.fixed(eq, out, want, fid_t)
            self.play(Write(eq), run_time=0.8)
            self.play(TransformMatchingTex(eq, out), run_time=1.1)
            # Each qubit alone now has a zero-length Bloch vector (real value from QState).
            r0 = np.linalg.norm([data["clone"]["blochAfter"][0][k] for k in "xyz"])
            self.play(tip.animate.set_value(max(r0, 0.0)), run_time=1.4, rate_func=smooth)
            zero = TX(rf"each qubit alone: $|\vec r| = {r0:.0f}$", size=30, color=MUTED).to_corner(DOWN + RIGHT, buff=0.5)
            self.fixed(zero)
            self.play(FadeIn(zero), Write(want), run_time=0.9)
            self.play(Write(fid_t), run_time=1.0)
            self.clone_group = VGroup(circuit, out, want, fid_t, zero)

        with self.beat("nocloning") as T:
            title = TX(r"the \textbf{no-cloning theorem}", size=60).move_to(DOWN * 0.1)
            self.fixed(title)
            self.play(
                FadeOut(self.clone_group),
                FadeOut(VGroup(sphere, equator, axis, k0, k1)),
                tip.animate.set_value(1e-3),
                run_time=0.9,
            )
            self.remove(arrow)
            self.play(Write(title), run_time=1.3)
            self.wait(max(0.1, T - 3.0))
            self.play(FadeOut(title), run_time=0.6)

    # ---------------------------------------------------------------- helpers
    def follow_path(self, target: dict, pts: list, run_time: float):
        """Move the arrow tip through a list of sphere points at constant speed."""
        pts = [np.array(p, dtype=float) for p in pts]
        seg = [np.linalg.norm(pts[i + 1] - pts[i]) for i in range(len(pts) - 1)]
        cum = np.concatenate([[0.0], np.cumsum(seg)])
        total = cum[-1] if cum[-1] > 0 else 1.0
        t = ValueTracker(0)

        def update(_):
            d = t.get_value() * total
            i = int(np.clip(np.searchsorted(cum, d) - 1, 0, len(seg) - 1))
            u = 0.0 if seg[i] == 0 else (d - cum[i]) / seg[i]
            p = pts[i] + u * (pts[i + 1] - pts[i])
            target["p"] = R * p / np.linalg.norm(p)

        dummy = Dot3D(radius=0.001).set_opacity(0)
        dummy.add_updater(update)
        self.add(dummy)
        self.play(t.animate.set_value(1), run_time=run_time, rate_func=lambda x: x)
        dummy.clear_updaters()
        self.remove(dummy)
        target["p"] = pts[-1]

    def frame_left_in_3d(self, units: float) -> np.ndarray:
        """World-space vector that moves an object `units` to the left on screen."""
        theta = self.camera.get_theta()
        # Screen-right in world coordinates for the current azimuth (independent of phi).
        right = np.array([-np.sin(theta), np.cos(theta), 0.0])
        return -units * right

    def move_vec(self, target: dict, end: np.ndarray, run_time: float = 1.0, via=None, rate=smooth):
        """Move the arrow tip along a great circle (slerp) to `end`."""
        start = target["p"].copy()
        waypoints = [start] + ([via] if via is not None else []) + [np.array(end, dtype=float)]
        t = ValueTracker(0)
        n_seg = len(waypoints) - 1

        def slerp(a, b, s):
            a_n, b_n = a / np.linalg.norm(a), b / np.linalg.norm(b)
            dot = np.clip(np.dot(a_n, b_n), -1.0, 1.0)
            om = np.arccos(dot)
            if om < 1e-6:
                return a
            return R * (np.sin((1 - s) * om) * a_n + np.sin(s * om) * b_n) / np.sin(om)

        def update(_):
            u = t.get_value() * n_seg
            i = min(int(u), n_seg - 1)
            target["p"] = slerp(waypoints[i], waypoints[i + 1], u - i)

        dummy = Dot3D(radius=0.001).set_opacity(0)
        dummy.add_updater(update)
        self.add(dummy)
        self.play(t.animate.set_value(1), run_time=run_time, rate_func=rate)
        dummy.clear_updaters()
        self.remove(dummy)
        target["p"] = np.array(end, dtype=float)


def Transform_(a, b):
    from manim import ReplacementTransform

    return ReplacementTransform(a, b)
