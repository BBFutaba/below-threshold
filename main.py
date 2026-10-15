"""Below Threshold, by Team PhASE: entry point for Qollab.

The project is an interactive web app (TypeScript + React) that runs in the browser, so this
script does not run it. It says where to open it, and checks that the complete source code
bundled with this upload is intact. Only the Python standard library is used.
"""

import zipfile
from pathlib import Path

SITE = "https://bbfutaba.github.io/below-threshold/"
HERE = Path(__file__).resolve().parent
ARCHIVE = HERE / "below-threshold-source.zip"

LINKS = [
    ("Open the app", SITE),
    ("3-minute pitch and 15-minute film", SITE + "film"),
    ("Factor 15 with Shor's algorithm", SITE + "learn/shor"),
    ("Play the decoder", SITE + "play"),
    ("Can a decoder keep up? (real time)", SITE + "realtime"),
    ("Watch the threshold appear", SITE + "lab"),
]


def check_archive() -> str:
    if not ARCHIVE.exists():
        return "below-threshold-source.zip is missing from this upload."
    with zipfile.ZipFile(ARCHIVE) as z:
        bad = z.testzip()
        files = [i for i in z.infolist() if not i.is_dir()]
    if bad:
        return f"below-threshold-source.zip is damaged (first bad file: {bad})."
    return f"below-threshold-source.zip: {len(files)} files, all intact (the complete source; see README.md to run it)."


def main() -> None:
    print("Below Threshold: factor a number with a quantum computer, then keep it alive.")
    print("An interactive guide to Shor's algorithm and quantum error correction, by Team PhASE.")
    print()
    print("It is a web app, so it runs in your browser:")
    width = max(len(name) for name, _ in LINKS)
    for name, url in LINKS:
        print(f"  {name:<{width}}  {url}")
    print()
    print("In this upload:")
    print("  README.md              overview, results and a map of the files")
    print("  video/                 the narrated 3-minute pitch in four parts")
    print("  docs/                  technical write-up, validation report, pitch scripts")
    print("  src/core/              the simulator and decoders (TypeScript)")
    print("  validate/              Python cross-checks against PyMatching and Stim")
    print()
    print(check_archive())


if __name__ == "__main__":
    main()
