"""BacklogScene: syndrome rounds arrive every 1 us; a decoder slower than that builds a queue.

Data: media/data/backlog.json (scripts/manim-data.ts), copied from src/data/bench.json:
median decode time per round measured by scripts/bench.ts (phenomenological noise, d = 9,
p = q = 3%, d rounds, time / (d + 1) layers). The hardware round period is 1 us.
The queue follows the exact FIFO rule: round k arrives at t = k us; decoding of round k
starts at max(k, finish of round k-1) and takes the measured time per round.
"""

import math
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from manim import *  # noqa: F403,E402

from common import (  # noqa: E402
    AMBER,
    BG,
    BORDER,
    FAINT,
    GREEN,
    MUTED,
    SURFACE,
    SURFACE3,
    TEXT,
    Captions,
    H,
    T,
    eyebrow,
    load,
    setup,
)

SEC_PER_US = 0.4  # slow motion: 1 us of chip time = 0.4 s of video
T_END = 30.0  # chip microseconds shown


def schedule(tau, n=80):
    """FIFO decode schedule: (start, finish) per round k = 1..n arriving at t = k."""
    out = []
    prev = 0.0
    for k in range(1, n + 1):
        s = max(float(k), prev)
        f = s + tau
        out.append((s, f))
        prev = f
    return out


def ease(x):
    x = min(max(x, 0.0), 1.0)
    return x * x * (3 - 2 * x)


def fmt_us(v):
    if v >= 1000:
        return f"{v / 1000:.1f} ms"
    if v >= 10:
        return f"{v:.0f} µs"
    return f"{v:.1f} µs"


class Lane:
    def __init__(self, y, tau, name, sub, measured=True):
        self.y = y
        self.tau = tau
        self.name = name
        self.sub = sub
        self.measured = measured
        self.sched = schedule(tau)
        self.x_src = -6.05
        self.x_dec = 3.95  # decoder entrance (slot 0 center)
        self.pitch = 0.272
        self.cell = 0.22

    def finished(self, t):
        return sum(1 for s, f in self.sched if f <= t)

    def arrived(self, t):
        return int(math.floor(t + 1e-9))

    def wait_now(self, t):
        """How long a T gate requested now waits for the decoder to catch up."""
        k = self.arrived(t)
        if k == 0:
            return 0.0
        return max(0.0, self.sched[k - 1][1] - t)

    def static(self):
        g = VGroup()
        track = RoundedRectangle(width=self.x_dec - self.x_src + 0.5, height=0.42, corner_radius=0.12)
        track.move_to([(self.x_src + self.x_dec) / 2, self.y - 0.12, 0]).set_fill(SURFACE, opacity=0.9).set_stroke(BORDER, width=1.5)
        box = RoundedRectangle(width=2.05, height=0.62, corner_radius=0.14).move_to([5.35, self.y - 0.12, 0])
        box.set_fill(SURFACE, opacity=1).set_stroke(BORDER if self.measured else GREEN, width=2)
        name = T(self.name, size=24, color=TEXT, weight="SEMIBOLD")
        sub = T(self.sub, size=22, color=MUTED)
        head = VGroup(name, sub).arrange(RIGHT, buff=0.22, aligned_edge=DOWN).move_to([self.x_src - 0.2, self.y + 0.43, 0], aligned_edge=LEFT)
        g.add(track, box, head)
        self.box = box
        return g

    def dynamic(self, t):
        g = VGroup()
        smooth_done = sum(ease((t - f) / 0.35) for s, f in self.sched if f - 0.0 <= t + 0.35)
        n_arr = self.arrived(t)
        cap = int((self.x_dec - self.x_src) / self.pitch)
        hidden = 0
        for k in range(1, n_arr + 1):
            s, f = self.sched[k - 1]
            slot = (k - 1) - smooth_done
            if slot < -0.95:
                continue
            if slot > cap - 1:
                hidden += 1
                continue
            a = ease((t - k) / 0.5)
            x_slot = self.x_dec - slot * self.pitch
            x = self.x_src + a * (x_slot - self.x_src)
            sq = RoundedRectangle(width=self.cell, height=self.cell, corner_radius=0.04).move_to([x, self.y - 0.12, 0])
            decoding = s <= t < f
            appear = min(1.0, a * 3.0)  # new rounds fade in as they leave the chip
            if slot < 0:  # entering the decoder: fade out
                op = max(0.0, 1 + slot)
                sq.set_fill(GREEN, opacity=0.85 * op).set_stroke(width=0)
            elif decoding:
                sq.set_fill(AMBER, opacity=appear).set_stroke(TEXT, width=1.5, opacity=appear)
            else:
                sq.set_fill(AMBER, opacity=0.62 * appear).set_stroke(width=0)
            g.add(sq)
        if hidden:
            g.add(T(f"+{hidden}", size=21, color=AMBER).move_to([self.x_src + 0.1, self.y - 0.12, 0]))
        # decoder box: progress on the round being decoded
        cur = next(((k, s, f) for k, (s, f) in enumerate(self.sched, 1) if s <= t < f), None)
        bx = self.box
        bar_w = bx.width - 0.36
        bar_bg = RoundedRectangle(width=bar_w, height=0.1, corner_radius=0.05).move_to(bx.get_center() + DOWN * 0.13)
        bar_bg.set_fill(SURFACE3, opacity=1).set_stroke(width=0)
        g.add(bar_bg)
        if cur is not None:
            k, s, f = cur
            frac = (t - s) / (f - s)
            if frac > 0.01:
                bar = RoundedRectangle(width=max(bar_w * frac, 0.1), height=0.1, corner_radius=0.05)
                bar.move_to(bar_bg.get_left(), aligned_edge=LEFT).set_fill(TEXT, opacity=0.9).set_stroke(width=0)
                g.add(bar)
            g.add(T(f"round {k}: {frac:.0%}", size=21, color=TEXT).move_to(bx.get_center() + UP * 0.1))
        else:
            g.add(T("idle", size=21, color=MUTED).move_to(bx.get_center() + UP * 0.1))
        # right of the header: backlog and T-gate wait
        backlog = n_arr - self.finished(t)
        waiting = self.wait_now(t)
        late = backlog > 1
        col = AMBER if late else GREEN
        info = VGroup(
            T(f"backlog {backlog}", size=22, color=col, weight="SEMIBOLD"),
            T("·", size=22, color=FAINT),
            T(f"T gate waits {fmt_us(waiting)}", size=22, color=col, weight="SEMIBOLD"),
        ).arrange(RIGHT, buff=0.14)
        info.move_to([6.35, self.y + 0.43, 0], aligned_edge=RIGHT)
        g.add(info)
        return g


class BacklogScene(Scene):
    def construct(self):
        setup(self)
        data = load("backlog")
        mw = data["mwpm"]
        uf = data["unionFind"]
        period = data["roundPeriodUs"]
        cap = Captions(self)
        self.add(eyebrow("BELOW THRESHOLD  ·  THE REAL-TIME BOTTLENECK"))

        lanes = [
            Lane(1.55, mw["medianUs"] / period, "Exact matching (MWPM)", f"{mw['medianUs']:.1f} µs per round, measured"),
            Lane(0.0, uf["medianUs"] / period, "Union-find", f"{uf['medianUs']:.1f} µs per round, measured"),
            Lane(-1.55, 1.0, "Keeping pace", "≤ 1 µs per round: the requirement", measured=False),
        ]
        clock_t = ValueTracker(0.0)

        # ---- clock row --------------------------------------------------
        def clock():
            t = clock_t.get_value()
            frac = t - math.floor(t)
            pulse = max(0.0, 1 - frac / 0.35) if t >= 1 else 0.0
            dot = Dot([-5.85, 2.72, 0], radius=0.11, color=TEXT).set_fill(TEXT, opacity=0.35 + 0.65 * pulse)
            ring = Circle(radius=0.11 + 0.18 * (1 - pulse), color=TEXT).move_to(dot).set_stroke(TEXT, width=2, opacity=0.6 * pulse)
            txt = T(f"chip time {t:4.1f} µs", size=24, color=TEXT, weight="SEMIBOLD").next_to(dot, RIGHT, buff=0.25)
            sub = T(f"·  one syndrome round every {period:g} µs", size=22, color=MUTED).next_to(txt, RIGHT, buff=0.16)
            return VGroup(ring, dot, txt, sub)

        slow = T(f"slow motion: 1 µs of chip time = {SEC_PER_US:g} s", size=21, color=AMBER)
        slow_bg = RoundedRectangle(width=slow.width + 0.3, height=slow.height + 0.16, corner_radius=0.1).move_to(slow)
        slow_bg.set_fill(BG, opacity=0).set_stroke(AMBER, width=1.5, opacity=0.7)
        slow_g = VGroup(slow_bg, slow).move_to([6.35, 3.55, 0], aligned_edge=RIGHT)

        cpu = re.sub(r"\s*\d+-Core Processor", "", data["cpu"]).replace("AMD ", "")
        foot = T(
            f"Median decode time per round  ·  d = {mw['d']}, p = {mw['p']:.0%}  ·  JavaScript on {cpu}  ·  src/data/bench.json",
            size=21,
            color=FAINT,
        )
        if foot.width > 12.6:
            foot.scale_to_fit_width(12.6)
        foot.move_to([0, -2.58, 0])

        statics = VGroup(*[ln.static() for ln in lanes])
        clk = always_redraw(clock)
        self.play(FadeIn(clk), FadeIn(slow_g), LaggedStart(*[FadeIn(s, shift=0.1 * UP) for s in statics], lag_ratio=0.15), FadeIn(foot), run_time=1.0)
        dyn = always_redraw(lambda: VGroup(*[ln.dynamic(clock_t.get_value()) for ln in lanes]))
        self.add(dyn)

        ratio = mw["medianUs"] / uf["medianUs"]
        steps = [
            (8.0, "Every microsecond, the chip hands over a new round."),
            (16.0, f"MWPM needs {mw['medianUs']:.0f} µs per round. Its queue never drains."),
            (24.0, f"Union-find is {ratio:.0f}× faster, yet still over 1 µs."),
            (T_END, "Only ≤ 1 µs per round keeps the queue flat."),
        ]
        t0 = 0.0
        for t1, text in steps:
            dur = (t1 - t0) * SEC_PER_US
            swap = Succession(AnimationGroup(*cap.swap(text), run_time=0.6), Wait(run_time=dur - 0.6))
            self.play(clock_t.animate(rate_func=linear).set_value(t1), swap, run_time=dur)
            t0 = t1
        self.play(*cap.swap("A decoder that is right but too slow still stops the computer."), run_time=0.7)
        self.wait(2.8)
