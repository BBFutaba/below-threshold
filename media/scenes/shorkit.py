"""Building blocks for the Shor's algorithm chapters (qubit, period, qft, shor, noise).

- Clock: one complex amplitude drawn the way the app draws it (FourierViews.tsx): a ring,
  a disk whose radius is the amplitude's size, and a hand pointing along its phase
  (0 = to the right, counterclockwise positive).
- Bars: a bar chart whose heights can be morphed between real distributions.
"""

from __future__ import annotations

import math

import numpy as np
from manim import DOWN, LEFT, RIGHT, UP, Circle, Dot, Line, Rectangle, VGroup

from common import BG, BLUE, BORDER_STRONG, FAINT, MUTED, SURFACE2, TEXT


def phase_color(re: float, im: float) -> str:
    """Same hue rule as the app (QuantumViews.phaseColor): phase 0 is blue, hue turns with phase."""
    ang = math.degrees(math.atan2(im, re))
    hue = (ang + 360 + 200) % 360
    # HSL(h, 80%, 62%) to hex.
    s, l = 0.8, 0.62
    c = (1 - abs(2 * l - 1)) * s
    x = c * (1 - abs((hue / 60) % 2 - 1))
    m = l - c / 2
    r, g, b = [(c, x, 0), (x, c, 0), (0, c, x), (0, x, c), (x, 0, c), (c, 0, x)][int(hue // 60) % 6]
    return "#{:02X}{:02X}{:02X}".format(*(int(round((v + m) * 255)) for v in (r, g, b)))


class Clock(VGroup):
    """An amplitude as a clock. `ref` is the amplitude that fills the ring."""

    def __init__(self, re: float = 1.0, im: float = 0.0, R: float = 0.5, ref: float = 1.0, color: str | None = None, **kw):
        super().__init__(**kw)
        self.R = R
        self.ref = ref
        self.fixed_color = color
        self.ring = Circle(radius=R).set_stroke(BORDER_STRONG, width=2.2).set_fill(SURFACE2, opacity=1)
        self.tick = Line(RIGHT * R, RIGHT * (R + 0.09)).set_stroke(FAINT, width=2)
        self.disk = Circle(radius=R).set_stroke(width=0).set_fill(BLUE, opacity=0.25)
        self.hand = Line(np.zeros(3), RIGHT * R).set_stroke(BLUE, width=5)
        self.tipdot = Dot(RIGHT * R, radius=0.045, color=BLUE)
        self.hub = Dot(radius=0.03, color=FAINT)
        self.add(self.ring, self.tick, self.disk, self.hand, self.tipdot, self.hub)
        self.set_amp(re, im)

    @property
    def c(self) -> np.ndarray:
        return self.ring.get_center()

    def set_amp(self, re: float, im: float, ref: float | None = None):
        if ref is not None:
            self.ref = ref
        self.re, self.im = re, im
        a = math.hypot(re, im)
        rel = min(1.0, a / self.ref) if self.ref > 0 else 0.0
        col = self.fixed_color or phase_color(re, im)
        c = self.c
        r = max(rel * self.R, 1e-3)
        self.disk.become(Circle(radius=r).set_stroke(width=0).set_fill(col, opacity=0.25 if rel > 1e-3 else 0).move_to(c))
        ang = math.atan2(im, re)
        tip = c + r * np.array([math.cos(ang), math.sin(ang), 0.0])
        on = rel > 1e-3
        self.hand.put_start_and_end_on(c, tip if on else c + np.array([1e-3, 0, 0]))
        self.hand.set_stroke(col, opacity=1 if on else 0)
        self.tipdot.move_to(tip).set_fill(col, opacity=1 if on else 0)
        return self


def clock_row(amps: list[dict], R: float = 0.42, buff: float = 0.22, ref: float | None = None, labels: list[str] | None = None, label_size: float = 26):
    """A row of clocks with optional labels underneath. Returns (clocks, labels) VGroups."""
    from film import TX  # local import: film imports common, not shorkit

    ref = ref if ref is not None else max(math.hypot(a["re"], a["im"]) for a in amps)
    clocks = VGroup(*[Clock(a["re"], a["im"], R=R, ref=ref) for a in amps]).arrange(RIGHT, buff=buff)
    for c, a in zip(clocks, amps):
        c.set_amp(a["re"], a["im"])
    labs = VGroup()
    if labels:
        for c, t in zip(clocks, labels):
            labs.add(TX(t, size=label_size, color=MUTED).next_to(c, DOWN, buff=0.14))
    return clocks, labs


class Bars(VGroup):
    """Bar chart of nonnegative values on a baseline; `set_values` redraws in place."""

    def __init__(self, values, width: float = 8.0, height: float = 2.4, gap: float = 0.15, color: str = BLUE, colors=None, vmax: float | None = None, **kw):
        super().__init__(**kw)
        self.n = len(values)
        self.W, self.H = width, height
        self.gapf = gap
        self.color = color
        self.colors = colors
        self.vmax = vmax
        self.axis = Line(LEFT * width / 2, RIGHT * width / 2).set_stroke(FAINT, width=2)
        self.rects = VGroup(*[Rectangle(width=0.1, height=0.1).set_stroke(width=0) for _ in range(self.n)])
        self.add(self.axis, self.rects)
        self.values = list(values)
        self.set_values(values)

    @property
    def base(self) -> np.ndarray:
        return self.axis.get_center()

    def x_of(self, i: float) -> float:
        return self.base[0] - self.W / 2 + (i + 0.5) * self.W / self.n

    def set_values(self, values, colors=None, vmax: float | None = None):
        self.values = list(values)
        if colors is not None:
            self.colors = colors
        m = vmax if vmax is not None else (self.vmax if self.vmax is not None else max(max(self.values), 1e-12))
        bw = self.W / self.n
        w = max(bw * (1 - self.gapf), 0.004)
        b = self.base
        for i, (r, v) in enumerate(zip(self.rects, self.values)):
            h = max(1e-3, self.H * v / m)
            col = (self.colors[i] if self.colors else None) or self.color
            r.stretch_to_fit_width(w).stretch_to_fit_height(h)
            r.move_to([self.x_of(i), b[1] + h / 2, 0])
            r.set_fill(col, opacity=0.95 if v > 1e-9 else 0)
        return self


def lerp_values(a, b, t: float):
    return [x + (y - x) * t for x, y in zip(a, b)]


__all__ = ["Clock", "Bars", "clock_row", "lerp_values", "phase_color", "BG", "TEXT", "MUTED", "FAINT", "BLUE", "DOWN", "UP"]
