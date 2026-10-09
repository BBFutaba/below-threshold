"""Cross-check our TypeScript MWPM decoder against PyMatching.

For every exported instance, PyMatching decodes the same defects on the same graph with
the same weights. Pass criteria (from the plan):
  * our correction weight equals PyMatching's on 100% of instances (ties may give
    different but equally short corrections, so weights and logical outcomes are compared,
    not exact flips);
  * logical outcomes agree on at least 99.9% of instances.

Adjustment (documented in docs/validation-report.md): with p = q every edge of the
phenomenological graph weighs 1, so many instances have several minimum-weight
corrections in different logical classes. Any logical disagreement on such an instance
is a proven tie (both corrections have the same, minimum, weight). For those configs we
require 100% weight agreement plus a paired McNemar test showing our tie-breaking is not
biased (p > 0.01); the 99.9% per-instance rule is applied to every config with
non-degenerate weights.

Also checks our rotated surface code layout against Stim's generated circuits.

Run:  python validate/cross_check.py        (prints a summary, writes data/cross_check.json)
      pytest validate                        (same checks as tests)
"""

from __future__ import annotations

import glob
import json
import os
import sys
from dataclasses import dataclass, asdict

import numpy as np
import pymatching
import stim

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")


@dataclass
class GraphCheck:
    name: str
    error_type: str
    instances: int
    weight_agree: int
    logical_agree: int
    max_weight_diff: float
    our_failures: int
    pm_failures: int
    ours_only: int
    pm_only: int
    degenerate: bool

    @property
    def weight_rate(self) -> float:
        return self.weight_agree / max(1, self.instances)

    @property
    def logical_rate(self) -> float:
        return self.logical_agree / max(1, self.instances)

    @property
    def mcnemar_p(self) -> float:
        """Two-sided exact McNemar p-value on the discordant pairs."""
        from scipy.stats import binomtest

        n = self.ours_only + self.pm_only
        if n == 0:
            return 1.0
        return float(binomtest(self.ours_only, n, 0.5).pvalue)

    @property
    def passed(self) -> bool:
        if self.weight_rate != 1.0:
            return False
        if self.degenerate:
            return self.mcnemar_p > 0.01
        return self.logical_rate >= 0.999


def build_matching(graph: dict) -> tuple[pymatching.Matching, dict, int]:
    m = pymatching.Matching()
    weights: dict[tuple[int, int], float] = {}
    nq = 0
    for u, v, q, w in graph["edges"]:
        fault = {q} if q >= 0 else set()
        nq = max(nq, q + 1)
        if v < 0:
            m.add_boundary_edge(u, fault_ids=fault, weight=w, merge_strategy="smallest-weight")
            key = (u, -1)
        else:
            m.add_edge(u, v, fault_ids=fault, weight=w, merge_strategy="smallest-weight")
            key = (min(u, v), max(u, v))
        weights[key] = min(weights.get(key, np.inf), w)
    # Make sure every detector exists even if isolated (never happens, but be safe).
    if m.num_detectors < graph["numDetectors"]:
        raise RuntimeError("graph has detectors with no edges")
    return m, weights, nq


def logical_flip(qubits: list[int] | np.ndarray, logical: set[int]) -> int:
    return int(sum(1 for q in qubits if q in logical) % 2)


def check_file(path: str) -> list[GraphCheck]:
    with open(path, encoding="utf8") as f:
        data = json.load(f)
    name = os.path.basename(path).removeprefix("instances_").removesuffix(".json")
    out = []
    for entry in data["graphs"]:
        graph, instances = entry["graph"], entry["instances"]
        m, weights, nq = build_matching(graph)
        logical = set(graph["logical"])
        nd = graph["numDetectors"]
        wa = la = 0
        of = pf = oo = po = 0
        max_diff = 0.0
        for inst in instances:
            syn = np.zeros(nd, dtype=np.uint8)
            for dft in inst["defects"]:
                syn[dft] ^= 1
            # PyMatching correction weight from its matched edges.
            pm_edges = m.decode_to_edges_array(syn)
            pm_w = 0.0
            for a, b in pm_edges:
                a, b = int(a), int(b)
                key = (a, -1) if b < 0 else (b, -1) if a < 0 else (min(a, b), max(a, b))
                pm_w += weights[key]
            diff = abs(pm_w - inst["ourWeight"])
            max_diff = max(max_diff, diff)
            if diff < 1e-6:
                wa += 1
            # Logical outcomes.
            pm_corr = m.decode(syn)
            pm_flips = np.nonzero(pm_corr[:nq])[0]
            err = set(inst["error"])
            pm_res = err.symmetric_difference(set(int(x) for x in pm_flips))
            our_res = err.symmetric_difference(set(inst["ourFlips"]))
            pm_fail = logical_flip(list(pm_res), logical)
            our_fail = logical_flip(list(our_res), logical)
            of += our_fail
            pf += pm_fail
            if pm_fail == our_fail:
                la += 1
            elif our_fail:
                oo += 1
            else:
                po += 1
        ws = {round(w, 9) for _, _, _, w in graph["edges"]}
        has_time = any(q < 0 for _, _, q, _ in graph["edges"])
        degenerate = has_time and len(ws) == 1
        out.append(GraphCheck(name, graph["errorType"], len(instances), wa, la, max_diff, of, pf, oo, po, degenerate))
    return out


# ---------------------------------------------------------------------------------------
# Layout cross-check against Stim's generated rotated surface code circuit.
# ---------------------------------------------------------------------------------------

def stim_stabilizers(d: int) -> tuple[set[frozenset], set[frozenset], list[tuple[float, float]]]:
    """Extract X- and Z-type stabilizer supports (as sets of data-qubit coordinates)."""
    c = stim.Circuit.generated("surface_code:rotated_memory_z", distance=d, rounds=1)
    coords = c.get_final_qubit_coordinates()
    flat = c.flattened()
    measure_qubits: set[int] = set()
    data_qubits: set[int] = set()
    for inst in flat:
        if inst.name == "MR":
            measure_qubits.update(t.value for t in inst.targets_copy())
        if inst.name == "M":
            data_qubits.update(t.value for t in inst.targets_copy())
    x_type: set[int] = set()
    for inst in flat:
        if inst.name == "H":
            x_type.update(t.value for t in inst.targets_copy() if t.value in measure_qubits)
    support: dict[int, set] = {mq: set() for mq in measure_qubits}
    seen_measure = False
    for inst in flat:
        if inst.name == "MR":
            seen_measure = True
        if seen_measure:
            break
        if inst.name == "CX":
            ts = [t.value for t in inst.targets_copy()]
            for a, b in zip(ts[0::2], ts[1::2]):
                if a in measure_qubits and b in data_qubits:
                    support[a].add(tuple(coords[b]))
                elif b in measure_qubits and a in data_qubits:
                    support[b].add(tuple(coords[a]))
    xs = {frozenset(s) for mq, s in support.items() if mq in x_type}
    zs = {frozenset(s) for mq, s in support.items() if mq not in x_type}
    return xs, zs, [tuple(coords[q]) for q in sorted(data_qubits)]


def our_stabilizers(layout: dict) -> tuple[set[frozenset], set[frozenset]]:
    d = layout["d"]
    xs, zs = set(), set()
    for s in layout["stabilizers"]:
        cells = frozenset((q // d, q % d) for q in s["support"])
        (xs if s["type"] == "X" else zs).add(cells)
    return xs, zs


def layout_matches_stim(d: int) -> tuple[bool, str]:
    with open(os.path.join(DATA, f"layout_d{d}.json"), encoding="utf8") as f:
        layout = json.load(f)
    sx, sz, data_coords = stim_stabilizers(d)
    # Map Stim coordinates onto a (row, col) grid.
    xs_ = sorted({x for x, _ in data_coords})
    ys_ = sorted({y for _, y in data_coords})
    to_rc = lambda xy: (ys_.index(xy[1]), xs_.index(xy[0]))  # noqa: E731
    sx = {frozenset(to_rc(p) for p in s) for s in sx}
    sz = {frozenset(to_rc(p) for p in s) for s in sz}
    ox, oz = our_stabilizers(layout)
    # Our layout may differ from Stim's by a symmetry of the square and/or swapping X <-> Z.
    syms = {
        "identity": lambda r, c: (r, c),
        "transpose": lambda r, c: (c, r),
        "flip-rows": lambda r, c: (d - 1 - r, c),
        "flip-cols": lambda r, c: (r, d - 1 - c),
        "rot180": lambda r, c: (d - 1 - r, d - 1 - c),
        "anti-transpose": lambda r, c: (d - 1 - c, d - 1 - r),
        "rot90": lambda r, c: (c, d - 1 - r),
        "rot270": lambda r, c: (d - 1 - c, r),
    }
    for name, f in syms.items():
        mx = {frozenset(f(*p) for p in s) for s in ox}
        mz = {frozenset(f(*p) for p in s) for s in oz}
        if mx == sx and mz == sz:
            return True, name
        if mx == sz and mz == sx:
            return True, name + "+swapXZ"
    return False, "no symmetry maps our layout onto Stim's"


def main() -> int:
    files = sorted(glob.glob(os.path.join(DATA, "instances_*.json")))
    if not files:
        print("No exported instances. Run: npm run export:instances", file=sys.stderr)
        return 2
    results: list[GraphCheck] = []
    for p in files:
        results.extend(check_file(p))
    ok = True
    print(f"{'config':<20}{'type':<5}{'n':>7}{'weight=':>10}{'logical=':>10}{'ourFail':>8}{'pmFail':>8}{'McNemar p':>10}  result")
    for r in results:
        print(
            f"{r.name:<20}{r.error_type:<5}{r.instances:>7}{r.weight_rate:>10.3%}{r.logical_rate:>10.3%}"
            f"{r.our_failures:>8}{r.pm_failures:>8}{r.mcnemar_p:>10.3f}  {'pass' if r.passed else 'FAIL'}"
            f"{' (degenerate weights: tie rule)' if r.degenerate else ''}"
        )
        ok &= r.passed
    layout = {}
    for d in (3, 5, 7, 9, 11):
        match, how = layout_matches_stim(d)
        layout[d] = how if match else None
        print(f"layout d={d}: {'matches Stim (' + how + ')' if match else 'MISMATCH'}")
        ok &= match
    summary = {
        "graphs": [
            asdict(r)
            | {"weight_rate": r.weight_rate, "logical_rate": r.logical_rate, "mcnemar_p": r.mcnemar_p, "passed": r.passed}
            for r in results
        ],
        "layout": layout,
        "pymatching": pymatching.__version__,
        "stim": stim.__version__,
        "passed": bool(ok),
    }
    with open(os.path.join(DATA, "cross_check.json"), "w", encoding="utf8") as f:
        json.dump(summary, f, indent=2)
    print("PASS" if ok else "FAIL")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
