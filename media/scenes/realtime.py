"""Chapter 8: a race against the clock.

What is real here (media/data/film/realtime.json, scripts/film/realtime.ts):
- per-round decode times are the measured medians in src/data/bench.json (d = 9, p = 3%):
  MWPM 103.5 us, union-find 4.0 us; the hardware round period is 1 us;
- every queue follows src/core/realtime.ts (stepQueue, FIFO). The scene uses the same rule
  in continuous time (round k arrives at k, starts at max(k, c_{k-1}), ends s later) and
  checks itself against the exported stepQueue trace; T-gate waits are the exported
  stepQueue values for the actual request round;
- the "requirement" lane is labelled as the requirement, not a decoder: any decoder under
  one round period per round behaves like this (simulated at 0.9 us);
- the chip's pulses are real detection events of a seeded d = 9 phenomenological run.
Slow motion and fast-forward are labelled on screen with their exact scale.
"""

from __future__ import annotations

import bisect
import math

import numpy as np
from manim import (
    DOWN,
    LEFT,
    ORIGIN,
    RIGHT,
    UP,
    AnimationGroup,
    Brace,
    Circle,
    Create,
    DecimalNumber,
    Dot,
    FadeIn,
    FadeOut,
    FadeTransform,
    Transform,
    LaggedStart,
    Line,
    Rectangle,
    RoundedRectangle,
    Square,
    ValueTracker,
    VGroup,
    VMobject,
    Write,
    linear,
)

from common import BG, TILE_FILL, TILE_FIRE, Lattice
from film import (
    AMBER,
    BLUE,
    CORAL,
    FAINT,
    GREEN,
    LEAD_IN,
    MUTED,
    MX,
    TAIL,
    TEAL,
    TEXT,
    TX,
    YELLOW,
    NarratedScene,
    load,
    script_scene,
)

SLOW = 0.4  # film seconds per microsecond of chip time (slow motion)
FF_CHOICES = (0.1, 0.08, 0.05, 0.04, 0.03, 0.025, 0.02, 0.015, 0.01)

LANE_Y = {"mwpm": 1.2, "unionFind": -0.6, "requirement": -2.4}
CHIP = np.array([-5.6, LANE_Y["unionFind"], 0.0])
X_START = -4.45  # where the lanes leave the chip's fork
BOX_W, BOX_H = 2.7, 0.92
BOX_X = 5.2
BOX_L = BOX_X - BOX_W / 2
BLOCK = 0.22
BASE_SP = 0.28
Q0 = BOX_L - 0.08 - BLOCK / 2  # first waiting slot, right against the decoder
Q_LEN = Q0 - (X_START + 0.15)
FLY = 16.0  # film units per second for a block zipping to its slot
EXIT = 2.2  # film units per second for a decoded block leaving the box
TAU_SMOOTH = 0.6  # us over which the queue glides forward after a completion


# --------------------------------------------------------------------------- timing


def _norm(w: str) -> str:
    return "".join(ch for ch in w.lower() if ch.isalnum())


class Cues:
    """Beat-relative clock. `at(phrase)` estimates when a phrase is spoken (uniform pace)."""

    def __init__(self, scene, key: str, T: float):
        self.scene, self.T, self.t0 = scene, T, scene.renderer.time
        b = next(b for b in script_scene(scene.scene_id).beats if b.key == key)
        self.tokens = [_norm(w) for w in b.text.replace("—", " ").split() if any(ch.isalnum() for ch in w)]
        self.speech = max(0.5, T - LEAD_IN - TAIL) if b.text else T

    def at(self, phrase: str) -> float:
        ws = [_norm(w) for w in phrase.split()]
        for i in range(len(self.tokens)):
            if self.tokens[i : i + len(ws)] == ws:
                return LEAD_IN + self.speech * i / len(self.tokens)
        raise KeyError(phrase)

    def now(self) -> float:
        return self.scene.renderer.time - self.t0

    def until(self, t: float):
        w = t - self.now()
        if w > 0.02:
            self.scene.wait(w)

    def left(self) -> float:
        return self.T - self.now()


def ease(x: float) -> float:
    x = min(max(x, 0.0), 1.0)
    return x * x * (3 - 2 * x)


def ramp_rate(v0: float, v1: float):
    """rate_func for a tracker whose speed goes linearly from v0 to v1 (any units)."""
    avg = (v0 + v1) / 2

    def f(a: float) -> float:
        return (v0 * a + (v1 - v0) * a * a / 2) / avg

    return f


# --------------------------------------------------------------------------- queue model


class Lane:
    """One decoder lane: FIFO queue of syndrome rounds, drawn as blocks on a conveyor."""

    def __init__(self, key: str, service: float, trace: list, waits: list, nmax: int = 1400):
        self.key, self.s, self.y = key, service, LANE_Y[key]
        # Continuous-time FIFO: round k arrives at k, starts at max(k, c_{k-1}), takes s.
        self.c = [0.0]
        self.b = [0.0]
        for k in range(1, nmax + 1):
            b = max(float(k), self.c[-1])
            self.b.append(b)
            self.c.append(b + service)
        self.waits = waits
        # Exact port of stepQueue (src/core/realtime.ts) for the numbers we print:
        # decoded[m] = rounds fully decoded after hardware round m.
        pending: list[float] = []
        dec = 0
        self.dec_at = [0]
        for m in range(1, nmax + 1):
            cap = 1.0
            while cap > 0 and pending:
                if pending[0] <= cap:
                    cap -= pending.pop(0)
                    dec += 1
                else:
                    pending[0] -= cap
                    cap = 0.0
            pending.append(service)
            self.dec_at.append(dec)
        for row in trace:
            m = row["round"]
            assert self.dec_at[m] == row["decoded"], (key, m, self.dec_at[m], row["decoded"])
            assert m - self.dec_at[m] == row["backlog"], (key, m)
        self.blocks: dict[int, Square] = {}
        self.emitf: dict[int, float] = {}
        self.donef: dict[int, float] = {}
        self.gone = 0  # every block <= gone has left the screen
        self.group = VGroup()
        self.offset = 0  # queue round 0 of this lane, in shared queue time

    def decoded(self, t: float) -> int:
        return bisect.bisect_right(self.c, t + 1e-9) - 1

    def backlog_at(self, m: int) -> int:
        """stepQueue's backlog (pending rounds) after hardware round m (shared queue time)."""
        m -= self.offset
        return 0 if m < 1 else m - self.dec_at[m]

    def smooth_decoded(self, t: float) -> float:
        D = self.decoded(t)
        if D <= 0:
            return 0.0
        fr = (t - self.c[D]) / TAU_SMOOTH
        return D - 1 + ease(fr) if fr < 1 else float(D)

    def waiting(self, t: float) -> float:
        t -= self.offset
        n = math.floor(t) if t >= 1 else 0
        return max(0.0, n - self.smooth_decoded(t) - 1)

    def head(self, t: float):
        t -= self.offset
        k = self.decoded(t) + 1
        if k <= math.floor(t) and self.b[k] <= t:
            return k, (t - self.b[k]) / self.s
        return None, 0.0

    def block(self, k: int) -> Square:
        if k not in self.blocks:
            sq = Square(side_length=BLOCK).set_fill(TEAL, opacity=0.5).set_stroke(TEAL, width=1.4)
            sq.set_z_index(2)
            self.blocks[k] = sq
            self.group.add(sq)
        return self.blocks[k]

    def update(self, t: float, f: float, rate: float, sp: float, dim: float = 1.0):
        """Place every visible block for queue time t (us) at film time f."""
        t -= self.offset
        n = math.floor(t) if t >= 1 else 0
        Ds = self.smooth_decoded(t)
        w = max(0.07, min(BLOCK, sp - 0.03))
        x_chip = X_START - 0.1
        for k in range(self.gone + 1, n + 1):
            sq = self.block(k)
            if k not in self.emitf:
                self.emitf[k] = f - max(0.0, (t - k)) * rate
            done = self.c[k] <= t
            if k in self.donef:
                age = f - self.donef[k]
                op = max(0.0, 1 - age / 0.5)
                if op <= 0:
                    sq.set_opacity(0)
                    if k == self.gone + 1:
                        self.gone = k
                    continue
                sq.stretch_to_fit_width(BLOCK * 0.8).stretch_to_fit_height(BLOCK * 0.8)
                sq.move_to([BOX_L + BOX_W + 0.12 + EXIT * age, self.y, 0])
                sq.set_fill(BLUE, opacity=0.6 * op * dim).set_stroke(BLUE, width=1.4, opacity=op * dim)
                continue
            I = max(0.0, (k - 1) - Ds)
            x_slot = BOX_X if I <= 0 else (Q0 + (BOX_X - Q0) * (1 - I) if I < 1 else Q0 - (I - 1) * sp)
            x_fly = x_chip + FLY * (f - self.emitf[k])
            x = min(x_fly, x_slot)
            if done and x >= BOX_L:
                self.donef[k] = f
            sq.stretch_to_fit_width(w).stretch_to_fit_height(BLOCK)
            sq.move_to([x, self.y, 0])
            if x_fly < x_slot - 0.02:
                sq.set_fill(TEAL, opacity=0.55 * dim).set_stroke(TEAL, width=1.4, opacity=dim)
            else:
                sq.set_fill(AMBER, opacity=0.5 * dim).set_stroke(AMBER, width=1.2, opacity=0.9 * dim)

    def x_of(self, k: int) -> float:
        return self.blocks[k].get_x() if k in self.blocks else X_START


# --------------------------------------------------------------------------- scene


class RealtimeScene(NarratedScene):
    scene_id = "realtime"

    def construct(self):
        data = load("film/realtime")
        self.chapter_card()
        det = data["chip"]["detections"]
        lay = data["chip"]["layout"]
        L = data["lanes"]
        tq0 = {"v": None}
        lanes = {k: Lane(k, L[k]["serviceUs"], L[k]["trace"], L[k]["waitByRequestRound"]) for k in ("mwpm", "unionFind", "requirement")}
        self.lanes = lanes
        self.qt = lambda: self.tau.get_value() - tq0["v"]

        # ------------------------------------------------------------- chip + clock
        tau = ValueTracker(0.7)  # chip time in us; ticks and rounds happen at integers >= 1
        self.tau = tau
        chip = Lattice(lay, s=0.36, center=np.array([-2.3, -0.2, 0]))
        clock = self.make_clock(1.15).move_to([2.4, -0.2, 0])
        prev_lit: set[int] = set()
        self.pulse_gain = 1.0

        def pulse(_m):
            t = tau.get_value()
            k = math.floor(t)
            lit = set(det[k % len(det)]) if k >= 1 else set()
            amp = math.exp(-(t - k) / 0.7) * self.pulse_gain if k >= 1 else 0.0
            for i in prev_lit | lit:
                if i in lit:
                    chip.tiles[i].set_fill(opacity=TILE_FILL + (TILE_FIRE - TILE_FILL) * amp).set_stroke(opacity=0.55 + 0.45 * amp)
                    chip.dots[i].set_opacity(amp)
                else:
                    chip.tiles[i].set_fill(opacity=TILE_FILL).set_stroke(opacity=0.55)
                    chip.dots[i].set_opacity(0)
            prev_lit.clear()
            prev_lit.update(lit)

        pulser = VMobject()
        pulser.add_updater(pulse)

        # ================================================================== time
        with self.beat("time") as T:
            cu = Cues(self, "time", T)
            self.play(self.grow_lattice(chip, 1.4), Create(clock.face), FadeIn(clock.marks), run_time=1.4)
            self.play(FadeIn(clock.hand), FadeIn(clock.pin), run_time=0.4)
            self.add(pulser)
            cu.until(cu.at("time") - 0.15)
            self.play(tau.animate.set_value(1.95), run_time=min(1.4, max(0.6, cu.left() - 0.05)), rate_func=linear)

        # ================================================================== rate
        stream: dict[int, Square] = {}
        stream_g = VGroup()
        self.stream_stop = 10**9
        BR_X = -1.0

        def run_stream(_m):
            t = tau.get_value()
            for k in range(2, min(math.floor(t), self.stream_stop) + 1):
                if k not in stream:
                    sq = Square(side_length=BLOCK).set_fill(TEAL, opacity=0.55).set_stroke(TEAL, width=1.4)
                    stream[k] = sq
                    stream_g.add(sq)
                x = X_START - 0.1 + 1.0 * (t - k)
                op = 1.0 - ease((x - 2.2) / 1.4)
                stream[k].move_to([x, LANE_Y["unionFind"], 0]).set_opacity(op * self.stream_op)

        self.stream_op = 1.0
        with self.beat("rate") as T:
            cu = Cues(self, "rate", T)
            CLOCK_SMALL = np.array([-6.4, 3.3, 0])
            slow_lab = TX(r"slow motion: 1\,$\mu$s of chip time $=$ " + f"{SLOW:g}" + r"\,s", size=28, color=MUTED)
            slow_lab.next_to(CLOCK_SMALL, RIGHT, buff=0.55)
            conveyor = Line([X_START - 0.35, LANE_Y["unionFind"], 0], [6.9, LANE_Y["unionFind"], 0], stroke_width=2, color=FAINT)
            self.play(
                chip.animate.scale(0.17 / 0.36).move_to(CHIP),
                clock.animate.scale(0.36 / 1.15).move_to(CLOCK_SMALL),
                run_time=1.3,
            )
            self.play(Create(conveyor), FadeIn(slow_lab, shift=0.1 * DOWN), run_time=0.7)
            self.add(stream_g)
            stream_g.add_updater(run_stream)
            brace = Brace(Line([BR_X, 0, 0], [BR_X + 1.0, 0, 0]), DOWN, buff=0.0, color=MUTED).move_to([BR_X + 0.5, LANE_Y["unionFind"] - 0.38, 0])
            blab = MX(r"1\,\mu\text{s}", size=36, color=MUTED).next_to(brace, DOWN, buff=0.1)
            t_run = cu.left() - 0.1
            t_br = max(1.6, cu.at("about once every") - cu.now())
            t0 = tau.get_value()
            self.play(tau.animate.set_value(t0 + t_br / SLOW), run_time=t_br, rate_func=linear)
            self.play(tau.animate.set_value(tau.get_value() + 0.8 / SLOW), FadeIn(brace), FadeIn(blab), run_time=0.8, rate_func=linear)
            rest = max(0.2, cu.left() - 0.05)
            self.play(tau.animate.set_value(tau.get_value() + rest / SLOW), run_time=rest, rate_func=linear)

        # ================================================================== measured
        on_lanes = ["mwpm", "unionFind"]
        self.lane_dim = {k: 1.0 for k in lanes}

        def run_queues(_m):
            if tq0["v"] is None:
                return
            t = tau.get_value() - tq0["v"]
            f = self.renderer.time
            rate = self._rate
            Q = max(lanes[k].waiting(t) for k in on_lanes)
            sp = min(BASE_SP, Q_LEN / max(Q, 1.0))
            for k in on_lanes:
                lanes[k].update(t, f, rate, sp, self.lane_dim[k])

        qdriver = VMobject()
        qdriver.add_updater(run_queues)
        self._rate = SLOW

        def box_for(key, line1, line2, color=BLUE):  # noqa: C901
            y = LANE_Y[key]
            box = RoundedRectangle(width=BOX_W, height=BOX_H, corner_radius=0.12).set_fill(BG, opacity=1).set_stroke(color, width=2.6)
            box.move_to([BOX_X, y, 0]).set_z_index(5)
            a = TX(line1, size=30, color=TEXT).move_to([BOX_X, y + 0.18, 0]).set_z_index(6)
            b = MX(line2, size=32, color=color).move_to([BOX_X, y - 0.17, 0]).set_z_index(6)
            bar = Rectangle(width=BOX_W - 0.3, height=0.06).set_fill(color, opacity=0.9).set_stroke(width=0)
            bar.move_to([BOX_X, y - BOX_H / 2 + 0.1, 0]).set_z_index(6).set_opacity(0)
            g = VGroup(box, a, b, bar)
            g.box, g.name, g.time, g.bar = box, a, b, bar
            return g

        boxes = {
            "mwpm": box_for("mwpm", r"MWPM", rf"{L['mwpm']['serviceUs']:.1f}\,\mu\text{{s}} / \text{{round}}"),
            "unionFind": box_for("unionFind", r"union-find", rf"{L['unionFind']['serviceUs']:.1f}\,\mu\text{{s}} / \text{{round}}"),
            "requirement": box_for("requirement", r"requirement", r"< 1\,\mu\text{s} / \text{round}", color=GREEN),
        }
        self.boxes = boxes

        def bars(_m):
            if tq0["v"] is None:
                return
            t = tau.get_value() - tq0["v"]
            for k, g in boxes.items():
                if k not in on_lanes:
                    continue
                _, pr = lanes[k].head(t)
                wd = max(1e-3, (BOX_W - 0.3) * min(1.0, pr))
                g.bar.stretch_to_fit_width(wd).move_to([BOX_X - (BOX_W - 0.3) / 2 + wd / 2, LANE_Y[k] - BOX_H / 2 + 0.1, 0])
                g.bar.set_opacity(0.9 * self.lane_dim[k] if pr > 0 else 0)

        bar_driver = VMobject()
        bar_driver.add_updater(bars)

        counters = {}
        for k in ("mwpm", "unionFind", "requirement"):
            num = DecimalNumber(0, num_decimal_places=0, font_size=36, color=AMBER)
            cap = TX(r"backlog", size=28, color=MUTED)
            counters[k] = VGroup(cap, num)

        def count_upd(_m):
            if tq0["v"] is None:
                return
            m = math.floor(tau.get_value() - tq0["v"])
            for k in on_lanes:
                cap, num = counters[k]
                v = lanes[k].backlog_at(m)
                if int(num.get_value()) != v:
                    num.set_value(v)
                cap.move_to([X_START + 0.1, LANE_Y[k] - 0.42, 0], aligned_edge=LEFT)
                num.next_to(cap, RIGHT, buff=0.15)
                counters[k].set_opacity(self.lane_dim[k])

        cdriver = VMobject()
        cdriver.add_updater(count_upd)
        foot = TX(r"measured: $d = 9$, $p = 3\%$, median per round", size=28, color=FAINT).to_corner(UP + RIGHT, buff=0.45)

        def fork(key):
            y = LANE_Y[key]
            yc = LANE_Y["unionFind"]
            pts = [[X_START - 0.35, yc, 0], [X_START + 0.05, y, 0], [BOX_L, y, 0]]
            return VMobject().set_points_as_corners([np.array(p, float) for p in pts]).set_stroke(FAINT, width=2)

        with self.beat("measured") as T:
            cu = Cues(self, "measured", T)
            self.stream_stop = math.floor(tau.get_value())
            top = fork("mwpm")
            fade_stream = ValueTracker(1.0)
            stream_g.add_updater(lambda m: setattr(self, "stream_op", fade_stream.get_value()))
            dt = 1.2
            short = Line([X_START - 0.35, LANE_Y["unionFind"], 0], [BOX_L, LANE_Y["unionFind"], 0], stroke_width=2, color=FAINT)
            self.play(
                Create(top),
                Transform(conveyor, short),
                *[FadeIn(VGroup(boxes[k].box, boxes[k].name, boxes[k].bar), shift=0.15 * LEFT) for k in on_lanes],
                FadeOut(VGroup(brace, blab)),
                fade_stream.animate.set_value(0.0),
                tau.animate.set_value(tau.get_value() + dt / SLOW),
                run_time=dt,
                rate_func=linear,
            )
            stream_g.clear_updaters()
            self.remove(stream_g)
            tq0["v"] = tau.get_value()
            for k in on_lanes:
                self.add(lanes[k].group)
            self.add(qdriver, bar_driver, cdriver, counters["mwpm"], counters["unionFind"])
            self.play(FadeIn(foot), tau.animate.set_value(tau.get_value() + 0.6 / SLOW), run_time=0.6, rate_func=linear)
            self.run_chip(max(0.1, cu.at("takes about a hundred") - cu.now()))
            self.play(Write(boxes["mwpm"].time), tau.animate.set_value(tau.get_value() + 0.9 / SLOW), run_time=0.9, rate_func=linear)
            self.run_chip(max(0.1, cu.at("takes about four") - cu.now()))
            self.play(Write(boxes["unionFind"].time), tau.animate.set_value(tau.get_value() + 0.9 / SLOW), run_time=0.9, rate_func=linear)
            self.run_chip(cu.left() - 0.05)

        # ================================================================== stall
        with self.beat("stall") as T:
            cu = Cues(self, "stall", T)
            self.run_chip(max(0.1, cu.at("like the T gate") - 0.2 - cu.now()))
            # A T gate is requested now: it needs this round decoded before it can go on.
            R = math.floor(tau.get_value() - tq0["v"]) + 1
            self.run_chip(max(0.0, (R + 0.02 - (tau.get_value() - tq0["v"])) * SLOW))
            tok = {}
            for k in on_lanes:
                tok[k] = self.make_token(lanes[k], R)
            self.play(*[FadeIn(tok[k], scale=0.6) for k in on_lanes], tau.animate.set_value(tau.get_value() + 0.5 / SLOW), run_time=0.5, rate_func=linear)
            # Fast-forward so that union-find's T gate is released on screen.
            t_ff = max(cu.now() + 0.6, cu.at("must wait for") - 0.1)
            self.run_chip(max(0.0, t_ff - cu.now()))
            w_uf = lanes["unionFind"].waits[R - 1]
            w_mw = lanes["mwpm"].waits[R - 1]
            rel = R + w_uf  # queue time at which stepQueue releases it
            q_now = tau.get_value() - tq0["v"]
            ramp = 0.8
            window = cu.left() - 1.6 - ramp
            ff = FF_CHOICES[-1]
            for c in FF_CHOICES:
                if q_now + ramp * (1 / SLOW + 1 / c) / 2 + window / c >= rel:
                    ff = c
                    break
            fast_lab = TX(r"fast-forward: 1\,$\mu$s of chip time $=$ " + f"{ff:g}" + r"\,s", size=28, color=AMBER).move_to(slow_lab, aligned_edge=LEFT)
            self.play(
                FadeTransform(slow_lab, fast_lab),
                tau.animate.set_value(tau.get_value() + ramp * (1 / SLOW + 1 / ff) / 2),
                run_time=ramp,
                rate_func=ramp_rate(1 / SLOW, 1 / ff),
            )
            self._rate = ff
            self.pulse_gain = 0.45
            q_end = (tau.get_value() - tq0["v"]) + (cu.left() - 0.25) / ff
            # Run, releasing union-find's T exactly when stepQueue does.
            if q_end > rel + 0.05:
                self.run_chip((rel + 0.01 - (tau.get_value() - tq0["v"])) * ff, per=ff)
                done = self.release(tok["unionFind"], w_uf)
                self.play(*done[:-1], tau.animate.set_value(tau.get_value() + 0.6 / ff), run_time=0.6, rate_func=linear)
            note = TX(rf"will wait {w_mw / 1000:.1f}\,ms", size=28, color=CORAL)
            note.add_updater(lambda m: m.next_to(tok["mwpm"].disc, LEFT, buff=0.2))
            self.run_chip(max(0.1, cu.left() - 1.3), per=ff)
            self.play(FadeIn(note), tau.animate.set_value(tau.get_value() + 1.0 / ff), run_time=1.0, rate_func=linear)
            self.run_chip(max(0.0, cu.left() - 0.05), per=ff)

        # ================================================================== moral
        with self.beat("moral") as T:
            cu = Cues(self, "moral", T)
            slow2 = TX(r"slow motion: 1\,$\mu$s of chip time $=$ " + f"{SLOW:g}" + r"\,s", size=28, color=MUTED).move_to(fast_lab, aligned_edge=LEFT)
            ramp = 0.8
            self.play(
                FadeTransform(fast_lab, slow2),
                tau.animate.set_value(tau.get_value() + ramp * (1 / SLOW + 1 / self._rate) / 2),
                run_time=ramp,
                rate_func=ramp_rate(1 / self._rate, 1 / SLOW),
            )
            self._rate = SLOW
            self.pulse_gain = 1.0
            if getattr(self, "uf_done", None) is not None:
                self.play(FadeOut(self.uf_done), tau.animate.set_value(tau.get_value() + 0.5 / SLOW), run_time=0.5, rate_func=linear)
            self.run_chip(max(0.1, cu.at("A decoder that is right") - cu.now()))
            # Right, but too slow.
            right = TX(r"right $\checkmark$", size=30, color=GREEN)
            slow = TX(r"too slow", size=30, color=CORAL)
            verdict = VGroup(right, slow).arrange(RIGHT, buff=0.4).next_to(boxes["mwpm"], DOWN, buff=0.12)
            self.play(FadeIn(right, shift=0.1 * UP), tau.animate.set_value(tau.get_value() + 0.6 / SLOW), run_time=0.6, rate_func=linear)
            self.run_chip(0.5)
            self.play(FadeIn(slow, shift=0.1 * UP), tau.animate.set_value(tau.get_value() + 0.6 / SLOW), run_time=0.6, rate_func=linear)
            self.run_chip(max(0.1, cu.at("That is why") - cu.now()))
            # The requirement lane: any decoder under one round period per round keeps up.
            lanes["requirement"].offset = math.floor(tau.get_value() - tq0["v"]) + 1
            low = fork("requirement")
            # Dim the two measured lanes (box fills stay opaque so queued rounds stay hidden).
            dim = ValueTracker(1.0)
            faded = [boxes["mwpm"].name, boxes["mwpm"].time, boxes["unionFind"].name, boxes["unionFind"].time, verdict, note,
                     tok["mwpm"].letter, tok["mwpm"].timer]
            strokes = [boxes["mwpm"].box, boxes["unionFind"].box, top, conveyor, tok["mwpm"].disc]

            def apply_dim(_m):
                v = dim.get_value()
                self.lane_dim["mwpm"] = self.lane_dim["unionFind"] = v
                for m in faded:
                    m.set_opacity(v)
                for m in strokes:
                    m.set_stroke(opacity=v)

            dimmer = VMobject()
            dimmer.add_updater(apply_dim)
            self.add(dimmer)
            self.play(
                Create(low),
                FadeIn(VGroup(boxes["requirement"].box, boxes["requirement"].name, boxes["requirement"].bar, boxes["requirement"].time), shift=0.15 * LEFT),
                dim.animate.set_value(0.35),
                tau.animate.set_value(tau.get_value() + 1.0 / SLOW),
                run_time=1.0,
                rate_func=linear,
            )
            on_lanes.append("requirement")
            self.add(lanes["requirement"].group, counters["requirement"])
            self.run_chip(max(0.1, cu.at("fast enough") - cu.now()))
            moral = MX(r"t_{\text{decode}}", r"\;<\;", r"t_{\text{round}}", r"\approx 1\,\mu\text{s}", size=50).move_to([0, -3.3, 0])
            moral[0].set_color(BLUE)
            self.play(Write(moral), tau.animate.set_value(tau.get_value() + 1.3 / SLOW), run_time=1.3, rate_func=linear)
            self.run_chip(max(0.0, cu.left() - 0.75))
            for m in (qdriver, bar_driver, cdriver, pulser, dimmer):
                m.clear_updaters()
            for t in tok.values():
                t.clear_updaters()
            note.clear_updaters()
            everything = VGroup(*[m for m in self.mobjects if isinstance(m, VMobject)])
            self.play(FadeOut(everything), run_time=0.65)

    # ---------------------------------------------------------------- helpers
    def run_chip(self, seconds: float, per: float | None = None):
        """Let chip time run for `seconds` of film at `per` film seconds per us."""
        if seconds <= 0.02:
            return
        per = per or self._rate
        self.play(self.tau.animate.set_value(self.tau.get_value() + seconds / per), run_time=seconds, rate_func=linear)

    def grow_lattice(self, lat: Lattice, run_time: float):
        c = lat.center_pt
        elems = [*lat.tiles, *lat.qubits]

        def ring(m):
            return int(round(2 * np.max(np.abs(m.get_center() - c)) / lat.s + 1e-6))

        rings = sorted({ring(m) for m in elems})
        self.add(lat.dots)
        return LaggedStart(*[AnimationGroup(*[FadeIn(m, scale=0.5) for m in elems if ring(m) == r]) for r in rings], lag_ratio=0.5, run_time=run_time)

    def make_clock(self, r: float) -> VGroup:
        face = Circle(radius=r).set_stroke(TEXT, width=3.2)
        marks = VGroup()
        for i in range(12):
            a = math.pi / 2 - i * math.tau / 12
            u = np.array([math.cos(a), math.sin(a), 0])
            marks.add(Line(u * r * 0.84, u * r * 0.97, stroke_width=3 if i % 3 == 0 else 1.8, color=MUTED))
        hand = Line(ORIGIN, UP * r * 0.72, stroke_width=5, color=AMBER)
        pin = Dot(ORIGIN, radius=0.06 * r / 0.6 * 0.6, color=AMBER)
        g = VGroup(face, marks, hand, pin)
        g.face, g.marks, g.hand, g.pin = face, marks, hand, pin
        g.r = r

        def tick(m):
            t = self.tau.get_value()
            k = math.floor(t)
            steps = (k - 1 + ease((t - k) / 0.18)) if k >= 1 else 0.0
            a = math.pi / 2 - steps * math.tau / 12
            ctr = face.get_center()
            rr = face.width / 2
            hand.put_start_and_end_on(ctr, ctr + rr * 0.72 * np.array([math.cos(a), math.sin(a), 0]))

        hand.add_updater(tick)
        return g

    def make_token(self, lane: Lane, R: int) -> VGroup:
        """T gate waiting for round R of this lane to be decoded, with a live timer."""
        disc = Circle(radius=0.2).set_fill(BG, opacity=1).set_stroke(YELLOW, width=3)
        letter = MX(r"T", size=32, color=YELLOW)
        num = DecimalNumber(0, num_decimal_places=0, font_size=32, color=YELLOW)
        pre = TX(r"waiting", size=28, color=YELLOW)
        unit = MX(r"\mu\text{s}", size=32, color=YELLOW)
        timer = VGroup(pre, num, unit)
        g = VGroup(disc, letter, timer)
        g.disc, g.letter, g.timer, g.num = disc, letter, timer, num
        g.R, g.lane, g.released = R, lane, False
        def upd(m):
            if g.released:
                return
            t = self.qt()
            x = min(lane.x_of(R), BOX_L - 0.3)
            disc.move_to([x, lane.y + 0.58, 0])
            letter.move_to(disc)
            v = max(0, math.floor(t - R))
            if int(num.get_value()) != v:
                num.set_value(v)
            num.next_to(pre, RIGHT, buff=0.14)
            unit.next_to(num, RIGHT, buff=0.08)
            timer.next_to(disc, UP, buff=0.12)

        g.add_updater(upd)
        upd(g)
        return g

    def release(self, tok: VGroup, wait: int):
        tok.released = True
        tok.clear_updaters()
        done = TX(rf"waited {wait}\,$\mu$s", size=28, color=GREEN).move_to(tok.timer)
        self.uf_done = done
        return [
            tok.disc.animate.set_stroke(GREEN).shift(RIGHT * 0.5).set_opacity(0),
            tok.letter.animate.set_color(GREEN).shift(RIGHT * 0.5).set_opacity(0),
            FadeTransform(tok.timer, done),
            done,
        ]
