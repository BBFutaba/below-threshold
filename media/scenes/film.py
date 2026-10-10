"""Film toolkit: 3Blue1Brown/2swap-style presentation on top of common.py.

- Narration-driven timing. Each scene is a sequence of `with self.beat("key") as T:`
  blocks whose lines live in media/voiceover/script.py. A beat lasts as long as its
  line takes to say (the team's recording if present, else an estimate), so the film
  is always cut to the voice. Timings are written to media/build/timings/<scene>.json
  for captions, the recording sheet and audio muxing.
- LaTeX typesetting (Computer Modern) for words and math, as in 3b1b videos; on-screen
  text is kept to labels and equations because the narration carries the explanation.
- The Team PhASE mark drawn natively so it can animate.

Recordings: media/voiceover/recordings/<scene>/<beat>.(wav|m4a|mp3|flac).
Set NARRATION=draft to use media/voiceover/draft/ (synthetic test voice) instead,
or NARRATION=estimate to ignore recordings.
"""

from __future__ import annotations

import json
import math
import os
import subprocess
import sys
from contextlib import contextmanager
from functools import lru_cache
from pathlib import Path

import numpy as np
from manim import (
    DOWN,
    LEFT,
    ORIGIN,
    RIGHT,
    UP,
    Circle,
    Create,
    Dot,
    FadeIn,
    FadeOut,
    Line,
    MathTex,
    MovingCameraScene,
    Scene,
    Sector,
    SVGMobject,
    Tex,
    TexTemplate,
    ThreeDScene,
    VGroup,
    Write,
    linear,
)

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "voiceover"))

from common import BG, BLUE, CORAL, GREEN, MUTED, TEAL, TEXT, VIOLET, AMBER, FAINT, load  # noqa: E402,F401
from script import Beat, scene as script_scene, words  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
VO = ROOT / "media" / "voiceover"
TIMINGS = ROOT / "media" / "build" / "timings"
BRAND = ROOT / "media" / "brand"

WORDS_PER_SECOND = 2.6  # ~155 wpm, a calm explainer pace
LEAD_IN = 0.25  # silence before a line starts
TAIL = 0.45  # breath after a line
AUDIO_EXT = (".wav", ".m4a", ".mp3", ".flac", ".ogg")
YELLOW = "#FFD166"  # 3b1b-style "look here" highlight (used sparingly)

# --------------------------------------------------------------------------- LaTeX

TEMPLATE = TexTemplate()
TEMPLATE.add_to_preamble(r"\usepackage{amsmath,amssymb}\usepackage[T1]{fontenc}\usepackage{lmodern}")


def TX(s: str, size: float = 40, color: str = TEXT, **kw) -> Tex:
    """Words, typeset by LaTeX (Computer Modern)."""
    return Tex(s, font_size=size, color=color, tex_template=TEMPLATE, **kw)


def MX(*parts: str, size: float = 44, color: str = TEXT, **kw) -> MathTex:
    """Math, typeset by LaTeX. Pass several parts to address them separately."""
    return MathTex(*parts, font_size=size, color=color, tex_template=TEMPLATE, **kw)


def ket(s: str, size: float = 40, color: str = TEXT) -> MathTex:
    return MX(rf"|{s}\rangle", size=size, color=color)


# --------------------------------------------------------------------------- narration


def _ffprobe_duration(path: Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        capture_output=True,
        text=True,
        check=True,
    )
    return float(out.stdout.strip())


@lru_cache(maxsize=None)
def recording_for(scene_id: str, key: str) -> Path | None:
    mode = os.environ.get("NARRATION", "auto")
    if mode == "estimate":
        return None
    folder = VO / ("draft" if mode == "draft" else "recordings") / scene_id
    for ext in AUDIO_EXT:
        p = folder / f"{key}{ext}"
        if p.exists():
            return p
    return None


def speech_seconds(scene_id: str, beat: Beat) -> tuple[float, str]:
    if not beat.text:
        return 0.0, "silent"
    rec = recording_for(scene_id, beat.key)
    if rec is not None:
        return _ffprobe_duration(rec), "recording"
    return words(beat.text) / WORDS_PER_SECOND, "estimate"


class Narrated:
    """Mixin: beat-timed narration for a Manim scene. Set `scene_id`."""

    scene_id = ""

    def _narration_init(self):
        if getattr(self, "_nar", None) is None:
            self._nar = {"beats": [], "script": script_scene(self.scene_id), "next": 0}

    @contextmanager
    def beat(self, key: str):
        """Play the visuals for one line of narration. Yields the beat's duration."""
        self._narration_init()
        sc = self._nar["script"]
        idx = next((i for i, b in enumerate(sc.beats) if b.key == key), None)
        if idx is None:
            raise KeyError(f"beat {key!r} not in script for {self.scene_id!r}")
        if idx != self._nar["next"]:
            raise RuntimeError(f"{self.scene_id}: beat {key!r} played out of order (expected {sc.beats[self._nar['next']].key!r})")
        b = sc.beats[idx]
        speech, source = speech_seconds(self.scene_id, b)
        target = max(b.min_seconds, (LEAD_IN + speech + TAIL) if b.text else 0.0)
        t0 = self.renderer.time
        yield target
        elapsed = self.renderer.time - t0
        if elapsed < target - 1e-3:
            self.wait(target - elapsed)
        self._nar["beats"].append(
            {
                "key": key,
                "text": b.text,
                "start": t0,
                "speechStart": t0 + (LEAD_IN if b.text else 0.0),
                "speech": speech,
                "end": self.renderer.time,
                "source": source,
                "overrun": max(0.0, elapsed - target),
            }
        )
        self._nar["next"] += 1

    def silent(self, seconds: float, label: str = "pause"):
        """Visual-only stretch that is not part of the script (e.g. a chapter card)."""
        self._narration_init()
        self._nar["beats"].append({"key": f"_{label}", "text": "", "start": self.renderer.time, "speechStart": self.renderer.time, "speech": 0, "end": self.renderer.time + seconds, "source": "silent", "overrun": 0})

    def chapter_card(self, seconds: float = 2.4):
        """3b1b-style chapter card: small caps chapter number over the title, then gone."""
        sc = script_scene(self.scene_id)
        if not sc.chapter:
            return
        self.silent(seconds, "chapter")
        num = TX(rf"\textsc{{{sc.chapter.lower()}}}", size=30, color=MUTED)
        title = TX(sc.title, size=56)
        g = VGroup(num, title).arrange(DOWN, buff=0.28)
        rule = Line(LEFT * 1.6, RIGHT * 1.6, stroke_width=1.5, color=FAINT).next_to(title, DOWN, buff=0.3)
        if isinstance(self, ThreeDScene):
            self.add_fixed_in_frame_mobjects(g, rule)
            g.set_opacity(0)
            rule.set_opacity(0)
            num.set_opacity(1)
            title.set_opacity(1)
            rule.set_opacity(1)
            self.remove(g, rule)
        self.play(FadeIn(num, shift=0.1 * DOWN), Write(title), Create(rule), run_time=1.3)
        self.wait(max(0.1, seconds - 1.3 - 0.6))
        self.play(FadeOut(VGroup(g, rule), shift=0.1 * UP), run_time=0.6)

    def tear_down(self):
        super().tear_down()
        self._narration_init()
        sc = self._nar["script"]
        if self._nar["next"] != len(sc.beats):
            missing = [b.key for b in sc.beats[self._nar["next"] :]]
            raise RuntimeError(f"{self.scene_id}: beats never played: {missing}")
        TIMINGS.mkdir(parents=True, exist_ok=True)
        data = {"scene": self.scene_id, "duration": self.renderer.time, "beats": self._nar["beats"]}
        (TIMINGS / f"{self.scene_id}.json").write_text(json.dumps(data, indent=1), encoding="utf-8")
        over = [b for b in self._nar["beats"] if b["overrun"] > 0.3]
        for b in over:
            print(f"[narration] {self.scene_id}/{b['key']}: visuals run {b['overrun']:.1f}s past the line")


class NarratedScene(Narrated, Scene):
    def setup(self):
        super().setup()
        self.camera.background_color = BG


class NarratedMovingScene(Narrated, MovingCameraScene):
    def setup(self):
        super().setup()
        self.camera.background_color = BG


class Narrated3DScene(Narrated, ThreeDScene):
    def setup(self):
        super().setup()
        self.camera.background_color = BG


# --------------------------------------------------------------------------- brand


def phase_mark(r: float = 1.0, ink: str = TEXT, phi_deg: float = 54.0) -> VGroup:
    """The Team PhASE mark: unit circle, real axis, phase vector at phi, swept angle.

    Parts are named so scenes can animate them: .circle, .axis, .sweep, .arc, .vector, .tip, .origin
    """
    phi = math.radians(phi_deg)
    g = VGroup()
    circle = Circle(radius=r).set_stroke(color=[TEAL, VIOLET], width=6 * r)
    circle.set_sheen_direction(np.array([1, 1, 0]))
    axis = Line(LEFT * r * 1.18, RIGHT * r * 1.18, stroke_width=2.2 * r, color=ink).set_opacity(0.35)
    sweep = Sector(radius=r, angle=phi, start_angle=0).set_fill(color=[TEAL, VIOLET], opacity=0.28).set_stroke(width=0)
    from manim import Arc

    arc = Arc(radius=r * 0.42, start_angle=0, angle=phi, stroke_width=2.6 * r, color=ink).set_stroke(opacity=0.75)
    tip_pt = np.array([r * math.cos(phi), r * math.sin(phi), 0])
    vector = Line(ORIGIN, tip_pt, stroke_width=7 * r, color=ink)
    tip = Dot(tip_pt, radius=0.12 * r, color=VIOLET)
    origin = Dot(ORIGIN, radius=0.07 * r, color=ink)
    g.add(sweep, circle, axis, arc, vector, tip, origin)
    g.circle, g.axis, g.sweep, g.arc, g.vector, g.tip, g.origin = circle, axis, sweep, arc, vector, tip, origin
    g.phi = phi
    return g


def wordmark(height: float = 1.0, ink: str = "dark") -> SVGMobject:
    """'TEAM PhASE' outlines (Latin Modern), generated by media/brand/make_logo.py."""
    svg = SVGMobject(str(BRAND / f"team-phase-wordmark-{ink}.svg"))
    svg.scale_to_fit_height(height)
    return svg


def ease_in_out_sine(t: float) -> float:
    return 0.5 - 0.5 * math.cos(math.pi * t)


__all__ = [
    "AMBER",
    "BG",
    "BLUE",
    "CORAL",
    "FAINT",
    "GREEN",
    "MUTED",
    "TEAL",
    "TEXT",
    "VIOLET",
    "YELLOW",
    "MX",
    "TX",
    "ket",
    "load",
    "Narrated",
    "NarratedScene",
    "NarratedMovingScene",
    "Narrated3DScene",
    "phase_mark",
    "wordmark",
    "ease_in_out_sine",
    "linear",
]
