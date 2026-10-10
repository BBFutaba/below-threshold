"""Synthesize a DRAFT narration with Windows' built-in offline speech engine (System.Speech).

Only for checking pacing and the record/mix pipeline before the team records the real
voiceover; the drafts go to media/voiceover/draft/ (gitignored) and are used only when
NARRATION=draft is set.

    .venv/Scripts/python media/voiceover/draft_tts.py [scene ...]
"""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from script import SCRIPT  # noqa: E402

OUT = Path(__file__).resolve().parent / "draft"

PS = r"""
Add-Type -AssemblyName System.Speech
$items = Get-Content -Raw -Encoding UTF8 $args[0] | ConvertFrom-Json
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.Rate = 0
foreach ($it in $items) {
  New-Item -ItemType Directory -Force (Split-Path $it.path) | Out-Null
  $s.SetOutputToWaveFile($it.path)
  $s.Speak($it.text)
}
$s.SetOutputToNull()
"""


def main() -> None:
    want = set(sys.argv[1:])
    items = []
    for sc in SCRIPT:
        if want and sc.id not in want:
            continue
        for b in sc.beats:
            if b.text:
                items.append({"path": str(OUT / sc.id / f"{b.key}.wav"), "text": b.text})
    with tempfile.TemporaryDirectory() as td:
        js = Path(td) / "items.json"
        js.write_text(json.dumps(items), encoding="utf-8")
        ps1 = Path(td) / "tts.ps1"
        ps1.write_text(PS, encoding="utf-8")
        subprocess.run(["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(ps1), str(js)], check=True)
    print(f"wrote {len(items)} draft lines to {OUT}")


if __name__ == "__main__":
    main()
