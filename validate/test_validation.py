"""pytest entry points for the validation suite (run `npm run export:instances` first)."""

import glob
import os

import pytest

import cross_check

HERE = os.path.dirname(os.path.abspath(__file__))
FILES = sorted(glob.glob(os.path.join(HERE, "data", "instances_*.json")))


@pytest.mark.skipif(not FILES, reason="no exported instances; run npm run export:instances")
@pytest.mark.parametrize("path", FILES, ids=lambda p: os.path.basename(p))
def test_matches_pymatching(path):
    for r in cross_check.check_file(path):
        assert r.weight_rate == 1.0, f"{r.name} {r.error_type}: weight agreement {r.weight_rate:.4%}"
        assert r.passed, f"{r.name} {r.error_type}: logical {r.logical_rate:.4%}, McNemar p {r.mcnemar_p:.3f}"


@pytest.mark.parametrize("d", [3, 5, 7, 9, 11])
def test_layout_matches_stim(d):
    if not os.path.exists(os.path.join(HERE, "data", f"layout_d{d}.json")):
        pytest.skip("layouts not exported")
    ok, how = cross_check.layout_matches_stim(d)
    assert ok, how
