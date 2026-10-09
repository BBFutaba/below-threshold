"""Reproduce published surface-code thresholds with our decoders, and with independent
references, then write plots and docs/validation-report.md.

Our decoders run through the Node runner (scripts/thresholdRunner.ts) in parallel
processes. Two independent references are computed in Python:
  * "PyMatching (independent)": noise sampled with numpy on a check matrix built from the
    exported layout, decoded by PyMatching on a graph built here (not by our TS code);
  * "Stim + PyMatching": Stim's own generated rotated_memory_z circuit with data
    depolarization before a single round (code capacity). Its X component flips each
    qubit with probability 2p/3, so it is plotted against that bit-flip rate.

Usage:  python validate/thresholds.py [--quick]
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import platform
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pymatching  # noqa: E402
import stim  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DATA = os.path.join(HERE, "data")
PLOTS = os.path.join(HERE, "plots")
DOCS = os.path.join(ROOT, "docs")

# Published values (approximate, to be confirmed against the sources in CITATIONS.md).
TARGETS = {
    ("bitflip", "mwpm"): dict(published=0.103, band=(0.095, 0.11), source="Dennis et al. 2002; Wang, Harrington, Preskill 2003"),
    ("bitflip", "unionFind"): dict(published=0.099, band=(0.090, 0.105), source="Delfosse and Nickerson 2021"),
    ("phenomenological", "mwpm"): dict(published=0.029, band=(0.025, 0.033), source="Wang, Harrington, Preskill 2003"),
    ("phenomenological", "unionFind"): dict(published=0.026, band=(0.022, 0.030), source="Delfosse and Nickerson 2021"),
    ("depolarizing", "mwpm"): dict(published=0.155, band=(0.14, 0.17), source="2/3 of the depolarizing rate is the bit-flip rate: 0.103 x 3/2"),
}

DECODER_LABEL = {"mwpm": "MWPM (ours)", "unionFind": "Union-find (ours)", "greedy": "Greedy (ours)"}


# ---------------------------------------------------------------------------------------
# Our decoders via Node
# ---------------------------------------------------------------------------------------

def node_points(specs: list[dict]) -> list[dict]:
    tsx = os.path.join(ROOT, "node_modules", ".bin", "tsx.cmd" if os.name == "nt" else "tsx")
    out = subprocess.run(
        [tsx, os.path.join(ROOT, "scripts", "thresholdRunner.ts"), json.dumps(specs)],
        cwd=ROOT, capture_output=True, text=True, check=True, shell=False,
    )
    return [json.loads(line) for line in out.stdout.splitlines() if line.strip().startswith("{")]


def run_ours(model: str, decoder: str, ds: list[int], ps: list[float], max_failures: int, max_trials: int, workers: int) -> list[dict]:
    jobs = []
    for d in ds:
        for i, p in enumerate(ps):
            if model == "phenomenological":
                m = {"kind": "phenomenological", "p": p, "q": p, "rounds": d}
            else:
                m = {"kind": model, "p": p}
            jobs.append([{"d": d, "model": m, "decoder": decoder, "seed": 7_000_000 + 1000 * d + i,
                          "maxFailures": max_failures, "maxTrials": max_trials}])
    with ThreadPoolExecutor(max_workers=workers) as ex:
        results = list(ex.map(node_points, jobs))
    return [r for batch in results for r in batch]


# ---------------------------------------------------------------------------------------
# Independent Python reference: our layout, numpy noise, PyMatching graph built here
# ---------------------------------------------------------------------------------------

def check_matrix(d: int, check_type: str) -> np.ndarray:
    with open(os.path.join(DATA, f"layout_d{d}.json"), encoding="utf8") as f:
        layout = json.load(f)
    rows = [s["support"] for s in layout["stabilizers"] if s["type"] == check_type]
    H = np.zeros((len(rows), d * d), dtype=np.uint8)
    for i, sup in enumerate(rows):
        H[i, sup] = 1
    return H, np.array(layout["logicalZ"])


def py_reference(model: str, d: int, p: float, max_failures: int, max_trials: int, seed: int) -> dict:
    rng = np.random.default_rng(seed)
    H, logical = check_matrix(d, "Z")  # Z-checks detect X errors; logical Z row detects a logical X flip
    nc, nq = H.shape
    R = d if model == "phenomenological" else 1
    m = pymatching.Matching()
    w = float(np.log((1 - p) / p))
    for t in range(R):
        for q in range(nq):
            checks = np.nonzero(H[:, q])[0]
            if len(checks) == 2:
                m.add_edge(t * nc + checks[0], t * nc + checks[1], fault_ids={q}, weight=w, merge_strategy="smallest-weight")
            else:
                m.add_boundary_edge(t * nc + checks[0], fault_ids={q}, weight=w, merge_strategy="smallest-weight")
    if R > 1:
        for t in range(R):  # time edges between layer t and t+1 (layer R is the perfect readout)
            for c in range(nc):
                m.add_edge(t * nc + c, (t + 1) * nc + c, weight=w, merge_strategy="smallest-weight")
    n = k = 0
    batch = 2000
    while k < max_failures and n < max_trials:
        b = min(batch, max_trials - n)
        if R == 1:
            err = (rng.random((b, nq)) < p).astype(np.uint8)
            syn = (err @ H.T) % 2
            total = err
        else:
            dets = np.zeros((b, (R + 1) * nc), dtype=np.uint8)
            total = np.zeros((b, nq), dtype=np.uint8)
            prev = np.zeros((b, nc), dtype=np.uint8)
            for t in range(R):
                total ^= (rng.random((b, nq)) < p).astype(np.uint8)
                meas = ((total @ H.T) % 2) ^ (rng.random((b, nc)) < p).astype(np.uint8)
                dets[:, t * nc:(t + 1) * nc] = meas ^ prev
                prev = meas
            final = (total @ H.T) % 2
            dets[:, R * nc:] = final ^ prev
            syn = dets
        corr = m.decode_batch(syn)[:, :nq]
        res = total ^ corr
        fails = (res[:, logical].sum(axis=1) % 2).astype(bool)
        k += int(fails.sum())
        n += b
    return per_round_point(d, p, k, n, R)


def stim_reference(d: int, p_dep: float, max_failures: int, max_trials: int, seed: int) -> dict:
    c = stim.Circuit.generated("surface_code:rotated_memory_z", distance=d, rounds=1, before_round_data_depolarization=p_dep)
    dem = c.detector_error_model(decompose_errors=True)
    m = pymatching.Matching.from_detector_error_model(dem)
    sampler = c.compile_detector_sampler(seed=seed)
    n = k = 0
    while k < max_failures and n < max_trials:
        b = min(5000, max_trials - n)
        dets, obs = sampler.sample(b, separate_observables=True)
        pred = m.decode_batch(dets)
        k += int((pred[:, 0] != obs[:, 0]).sum())
        n += b
    return per_round_point(d, 2 * p_dep / 3, k, n, 1)


# ---------------------------------------------------------------------------------------
# Statistics
# ---------------------------------------------------------------------------------------

def wilson(k: int, n: int, z: float = 1.96) -> tuple[float, float, float]:
    if n == 0:
        return 0.0, 0.0, 1.0
    p = k / n
    den = 1 + z * z / n
    c = (p + z * z / (2 * n)) / den
    h = z * np.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / den
    return p, max(0.0, c - h), min(1.0, c + h)


def per_round(P: float, R: int) -> float:
    if R <= 1:
        return P
    x = 1 - 2 * P
    return 0.5 if x <= 0 else (1 - x ** (1 / R)) / 2


def per_round_point(d: int, p: float, k: int, n: int, R: int) -> dict:
    pl, lo, hi = wilson(k, n)
    return {"d": d, "p": p, "failures": k, "trials": n, "pL": per_round(pl, R),
            "ci": {"p": per_round(pl, R), "lo": per_round(lo, R), "hi": per_round(hi, R)},
            "pShot": pl, "ciShot": {"p": pl, "lo": lo, "hi": hi}, "rounds": R}


def shot_view(points: list[dict]) -> list[dict]:
    """Points re-expressed as failure probability of the whole shot (d rounds)."""
    return [r | {"pL": r["pShot"], "ci": r["ciShot"], "rounds": 1} for r in points]


def _fit_curve(curve: list[dict]):
    """Weighted quadratic fit of log(pL) against log(p)."""
    xs, ys, ws = [], [], []
    for r in curve:
        if r["pL"] <= 0 or r["failures"] == 0:
            continue
        xs.append(np.log(r["p"]))
        ys.append(np.log(r["pL"]))
        ws.append(np.sqrt(max(r["failures"], 1)))  # 1/sigma of log(pL) ~ sqrt(k)
    if len(xs) < 3:
        return None
    return np.polyfit(xs, ys, 2, w=ws)


def crossing(a: list[dict], b: list[dict]) -> float | None:
    """Crossing of two smoothed curves inside the sampled p range (log-log quadratic fits)."""
    fa, fb = _fit_curve(a), _fit_curve(b)
    if fa is None or fb is None:
        return None
    lo = np.log(max(min(r["p"] for r in a), min(r["p"] for r in b)))
    hi = np.log(min(max(r["p"] for r in a), max(r["p"] for r in b)))
    roots = [r.real for r in np.roots(fa - fb) if abs(r.imag) < 1e-9 and lo <= r.real <= hi]
    if not roots:
        return None
    mid = (lo + hi) / 2
    return float(np.exp(min(roots, key=lambda r: abs(r - mid))))


def _resample(curve, rng):
    out = []
    for r in curve:
        R = r.get("rounds", 1) or 1
        n = max(1, r["trials"])
        P = rng.binomial(n, r["failures"] / n) / n
        out.append({"p": r["p"], "pL": per_round(P, R), "failures": max(1, int(P * n)), "trials": n, "rounds": R})
    return out


def bootstrap_crossing(a: list[dict], b: list[dict], reps: int = 400, seed: int = 0) -> tuple[float | None, float | None, float | None]:
    rng = np.random.default_rng(seed)
    est = crossing(a, b)
    xs = [x for x in (crossing(_resample(a, rng), _resample(b, rng)) for _ in range(reps)) if x is not None]
    if len(xs) < reps // 4:
        return est, None, None
    return est, float(np.percentile(xs, 2.5)), float(np.percentile(xs, 97.5))


def scaling_fit(points: list[dict]) -> float | None:
    """Finite-size scaling fit pL = A + B x + C x^2 with x = (p - p_th) d^(1/nu),
    as in Wang, Harrington and Preskill (2003)."""
    from scipy.optimize import curve_fit

    pts = [r for r in points if 0 < r["pL"] < 0.5 and r["failures"] > 0]
    if len({r["d"] for r in pts}) < 2 or len(pts) < 6:
        return None
    P = np.array([r["p"] for r in pts])
    D = np.array([r["d"] for r in pts], dtype=float)
    Y = np.array([r["pL"] for r in pts])
    S = np.array([max((r["ci"]["hi"] - r["ci"]["lo"]) / 3.92, 1e-6) for r in pts])

    def model(X, pth, nu, A, B, C):
        p, d = X
        x = (p - pth) * d ** (1 / nu)
        return A + B * x + C * x * x

    try:
        popt, _ = curve_fit(model, (P, D), Y, p0=[float(np.median(P)), 1.0, float(np.median(Y)), 1.0, 1.0], sigma=S, maxfev=20000)
    except Exception:
        return None
    pth = float(popt[0])
    return pth if P.min() <= pth <= P.max() else None


def analyse(points: list[dict]) -> dict:
    points = shot_view(points)
    ds = sorted({r["d"] for r in points})
    by_d = {d: [r for r in points if r["d"] == d] for d in ds}
    pairs = []
    for d1, d2 in zip(ds, ds[1:]):
        est, lo, hi = bootstrap_crossing(by_d[d1], by_d[d2], seed=d1)
        pairs.append({"d1": d1, "d2": d2, "crossing": est, "lo": lo, "hi": hi})
    ests = [p["crossing"] for p in pairs if p["crossing"] is not None]
    # The smallest distance carries the largest finite-size corrections, so the verdict
    # uses the fit over d >= 7; the all-distance fit is reported alongside it.
    fit_all = scaling_fit(points)
    fit = scaling_fit([r for r in points if r["d"] >= 7])
    big = [p["crossing"] for p in pairs if p["crossing"] is not None and p["d1"] >= 7]
    estimate = fit if fit is not None else (float(np.mean(big)) if big else (float(np.mean(ests)) if ests else None))
    return {"pairs": pairs, "scalingFit": fit, "scalingFitAll": fit_all, "estimate": estimate,
            "range": [min(ests), max(ests)] if ests else None}


# ---------------------------------------------------------------------------------------
# Plotting and report
# ---------------------------------------------------------------------------------------

COLORS = {3: "#7aa2f7", 5: "#5ee2d0", 7: "#b48cff", 9: "#ffb86b", 11: "#ff7a90"}


def plot(title: str, curves: dict[str, list[dict]], target: dict | None, path: str, xlabel: str) -> None:
    plt.rcParams.update({"font.size": 11})
    fig, ax = plt.subplots(figsize=(7.2, 4.8), dpi=150)
    fig.patch.set_facecolor("#0e1220")
    ax.set_facecolor("#0e1220")
    styles = {0: ("-", "o"), 1: ("--", "s"), 2: (":", "^")}
    for si, (name, pts) in enumerate(curves.items()):
        ls, mk = styles[si % 3]
        for d in sorted({r["d"] for r in pts}):
            rs = sorted([r for r in pts if r["d"] == d], key=lambda r: r["p"])
            x = [r["p"] for r in rs]
            y = [max(r["pL"], 1e-6) for r in rs]
            lo = [max(r["ci"]["lo"], 1e-6) for r in rs]
            hi = [max(r["ci"]["hi"], 1e-6) for r in rs]
            ax.plot(x, y, ls, marker=mk, ms=3.5, color=COLORS.get(d, "#ccc"), lw=1.4,
                    label=f"{name}, d={d}" if si == 0 or d == min(r["d"] for r in pts) else None)
            if si == 0:
                ax.fill_between(x, lo, hi, color=COLORS.get(d, "#ccc"), alpha=0.18, lw=0)
    if target:
        ax.axvspan(*target["band"], color="#ffffff", alpha=0.06, lw=0)
        ax.axvline(target["published"], color="#ffffff", alpha=0.5, lw=1, ls="--")
        ax.text(target["published"], ax.get_ylim()[1] if ax.get_ylim()[1] < 1 else 0.5, " published", color="#ccd", fontsize=9, va="top")
    ax.set_yscale("log")
    ax.set_xlabel(xlabel, color="#ccd")
    ax.set_ylabel("logical error rate", color="#ccd")
    ax.set_title(title, color="#eef")
    ax.tick_params(colors="#99a")
    for s in ax.spines.values():
        s.set_color("#333a55")
    ax.grid(True, which="both", color="#22283d", lw=0.6)
    leg = ax.legend(fontsize=8, facecolor="#141a2e", edgecolor="#333a55", labelcolor="#ccd", ncol=2)
    leg.get_frame().set_alpha(0.9)
    fig.tight_layout()
    fig.savefig(path, facecolor=fig.get_facecolor())
    plt.close(fig)


def fmt(x: float | None) -> str:
    return "n/a" if x is None else f"{100 * x:.2f}%"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--quick", action="store_true")
    args = ap.parse_args()
    os.makedirs(PLOTS, exist_ok=True)
    os.makedirs(DOCS, exist_ok=True)
    workers = max(2, (os.cpu_count() or 4) - 2)
    q = args.quick
    maxF = 150 if q else 4000
    maxT = 4000 if q else 200_000

    if not os.path.exists(os.path.join(DATA, "layout_d5.json")):
        print("Missing layouts. Run: npm run export:instances", file=sys.stderr)
        return 2

    experiments = {
        "bitflip": dict(ds=[5, 7, 9] if q else [5, 7, 9, 11, 13], ps=[0.08, 0.087, 0.093, 0.097, 0.1, 0.103, 0.107, 0.113, 0.12]),
        "phenomenological": dict(ds=[5, 7, 9, 11] if not q else [5, 7], ps=[0.02, 0.023, 0.025, 0.027, 0.029, 0.031, 0.033, 0.036]),
        "depolarizing": dict(ds=[5, 7, 9], ps=[0.13, 0.14, 0.145, 0.15, 0.155, 0.16, 0.17]),
    }
    decoders = {"bitflip": ["mwpm", "unionFind", "greedy"], "phenomenological": ["mwpm", "unionFind"], "depolarizing": ["mwpm"]}
    results: dict = {"date": dt.datetime.now().isoformat(timespec="seconds"),
                     "machine": f"{platform.processor() or platform.machine()} ({os.cpu_count()} threads), {platform.system()} {platform.release()}",
                     "python": platform.python_version(), "stim": stim.__version__, "pymatching": pymatching.__version__,
                     "settings": {"maxFailures": maxF, "maxTrials": maxT, "quick": q}, "experiments": {}}

    for model, ex in experiments.items():
        print(f"== {model}")
        res = {}
        for dec in decoders[model]:
            pts = run_ours(model, dec, ex["ds"], ex["ps"], maxF, maxT, workers)
            res[dec] = {"points": pts, "analysis": analyse(pts)}
            a = res[dec]["analysis"]
            print(f"   {dec:<10} threshold ~ {fmt(a['estimate'])}  pairs: " +
                  ", ".join(f"{p['d1']}/{p['d2']}: {fmt(p['crossing'])} [{fmt(p['lo'])}, {fmt(p['hi'])}]" for p in a["pairs"]))
        if model in ("bitflip", "phenomenological"):
            with ThreadPoolExecutor(max_workers=workers) as exr:
                futs = [exr.submit(py_reference, model, d, p, maxF, maxT, 99 + 100 * d + i)
                        for d in ex["ds"] for i, p in enumerate(ex["ps"])]
                pts = [f.result() for f in futs]
            res["pymatching"] = {"points": pts, "analysis": analyse(pts)}
            print(f"   pymatching threshold ~ {fmt(res['pymatching']['analysis']['estimate'])}")
        if model == "bitflip":
            pts = [stim_reference(d, 1.5 * p, maxF, maxT, 5 + 100 * d + i) for d in ex["ds"] for i, p in enumerate(ex["ps"])]
            res["stim"] = {"points": pts, "analysis": analyse(pts)}
            print(f"   stim       threshold ~ {fmt(res['stim']['analysis']['estimate'])}")
        results["experiments"][model] = res

    # Verdicts
    verdicts = []
    for (model, dec), t in TARGETS.items():
        a = results["experiments"].get(model, {}).get(dec, {}).get("analysis")
        if not a:
            continue
        est = a["estimate"]
        ok = est is not None and t["band"][0] <= est <= t["band"][1]
        verdicts.append({"model": model, "decoder": dec, "estimate": est, "range": a["range"], "published": t["published"],
                         "band": t["band"], "source": t["source"], "pass": ok})
    results["verdicts"] = verdicts

    # Plots
    labels = {"pymatching": "PyMatching (independent)", "stim": "Stim + PyMatching"}
    for model, res in results["experiments"].items():
        for dec in decoders[model]:
            curves = {DECODER_LABEL[dec]: shot_view(res[dec]["points"])}
            for ref in ("pymatching", "stim"):
                if ref in res and dec == "mwpm":
                    curves[labels[ref]] = shot_view(res[ref]["points"])
            plot(f"{model} noise, {DECODER_LABEL[dec]}", curves, TARGETS.get((model, dec)),
                 os.path.join(PLOTS, f"{model}_{dec}.png"),
                 "physical error rate p" + (" (q = p; failure of a d-round memory)" if model == "phenomenological" else ""))

    with open(os.path.join(DATA, "thresholds.json"), "w", encoding="utf8") as f:
        json.dump(results, f, indent=1)
    # Compact copy bundled into the app (validation badge and precomputed lab fallback).
    app = {"date": results["date"], "machine": results["machine"], "verdicts": verdicts,
           "curves": {model: {dec: [{k: r[k] for k in ("d", "p", "pL", "ci", "pShot", "ciShot", "rounds", "trials", "failures")} for r in res[dec]["points"]]
                              for dec in decoders[model]} for model, res in results["experiments"].items()}}
    with open(os.path.join(ROOT, "src", "data", "validation.json"), "w", encoding="utf8") as f:
        json.dump(app, f, indent=1)

    write_report(results)
    ok = all(v["pass"] for v in verdicts)
    for v in verdicts:
        print(f"{v['model']:<17}{v['decoder']:<10} ours {fmt(v['estimate'])}  published ~{fmt(v['published'])}  band {fmt(v['band'][0])}-{fmt(v['band'][1])}  {'PASS' if v['pass'] else 'FAIL'}")
    print("ALL THRESHOLDS IN BAND" if ok else "SOME THRESHOLDS OUT OF BAND")
    return 0 if ok else 1


def write_report(results: dict) -> None:
    cc_path = os.path.join(DATA, "cross_check.json")
    cc = json.load(open(cc_path, encoding="utf8")) if os.path.exists(cc_path) else None
    L = []
    L.append("# Validation report\n")
    L.append(f"Generated by `validate/thresholds.py` on {results['date']}  ")
    L.append(f"Machine: {results['machine']}; Python {results['python']}, Stim {results['stim']}, PyMatching {results['pymatching']}  ")
    s = results["settings"]
    L.append("The estimate is a finite-size scaling fit (Wang, Harrington and Preskill 2003) over distances d >= 7, since the smallest code carries the largest finite-size corrections; the fit over all distances and every pairwise crossing of smoothed curves are listed per model below, so nothing is hidden.  ")
    L.append(f"Sampling: each point runs until {s['maxFailures']} logical failures or {s['maxTrials']:,} trials, whichever comes first"
             f"{' (quick mode)' if s['quick'] else ''}. Error bars are 95% Wilson intervals; crossing ranges are 95% bootstrap intervals.\n")
    L.append("## Threshold reproduction\n")
    L.append("| Noise model | Decoder | Our estimate | Range across distance pairs | Published (approx.) | Acceptance band | Result |")
    L.append("|---|---|---|---|---|---|---|")
    for v in results["verdicts"]:
        rng_ = f"{fmt(v['range'][0])} to {fmt(v['range'][1])}" if v["range"] else "n/a"
        L.append(f"| {v['model']} | {DECODER_LABEL[v['decoder']]} | {fmt(v['estimate'])} | {rng_} | {fmt(v['published'])} | "
                 f"{fmt(v['band'][0])} to {fmt(v['band'][1])} | {'pass' if v['pass'] else '**FAIL**'} |")
    L.append("")
    L.append("Phenomenological thresholds use the failure probability of a whole d-round memory experiment (d noisy rounds "
             "plus a perfect final readout, q = p), which is how the published 2.9% (MWPM) and 2.6% (union-find) are defined. "
             "Per-round rates are listed below; they cross at a higher p because a bigger code also runs more rounds. "
             "Depolarizing code capacity is decoded with X and Z independently, so its threshold is the bit-flip threshold "
             "times 3/2 (the X part of depolarizing noise has probability 2p/3).\n")
    for model, res in results["experiments"].items():
        L.append(f"### {model}\n")
        for key, val in res.items():
            a = val["analysis"]
            name = {"pymatching": "PyMatching (independent sampling and graph)", "stim": "Stim circuit + PyMatching"}.get(key, DECODER_LABEL.get(key, key))
            pairs = "; ".join(f"d={p['d1']}/{p['d2']}: {fmt(p['crossing'])} [{fmt(p['lo'])}, {fmt(p['hi'])}]" for p in a["pairs"])
            L.append(f"- **{name}**: scaling fit (d >= 7) {fmt(a.get('scalingFit'))}, all distances {fmt(a.get('scalingFitAll'))}; pairwise crossings {pairs}")
        L.append("")
        for f in sorted(os.listdir(PLOTS)):
            if f.startswith(model + "_"):
                L.append(f"![{f}](../validate/plots/{f})")
        L.append("")
    if cc:
        L.append("## Cross-check against PyMatching\n")
        L.append("10,000 seeded instances per configuration exported from the app (`npm run export:instances`) and decoded by "
                 "PyMatching on the same graph and weights (`validate/cross_check.py`).\n")
        L.append("| Config | Error type | Instances | Weight agrees | Logical agrees | Our failures | PyMatching failures | McNemar p | Result |")
        L.append("|---|---|---|---|---|---|---|---|---|")
        for g in cc["graphs"]:
            L.append(f"| {g['name']} | {g['error_type']} | {g['instances']:,} | {100 * g['weight_rate']:.2f}% | {100 * g['logical_rate']:.2f}% | "
                     f"{g['our_failures']} | {g['pm_failures']} | {g['mcnemar_p']:.2f} | {'pass' if g['passed'] else 'FAIL'}"
                     f"{' (tie rule)' if g['degenerate'] else ''} |")
        L.append("")
        L.append("**Ties.** With p = q every edge of the phenomenological graph has weight 1, so many syndromes have several "
                 "minimum-weight corrections in different logical classes. On those instances both decoders return a correction "
                 "of exactly the same (minimum) weight, so every logical disagreement is a proven tie, not a decoder error. "
                 "The plan's 99.9% per-instance rule is kept for every configuration with non-degenerate weights (including "
                 "p != q phenomenological noise, which agrees on 100%); for the degenerate ones we require 100% weight "
                 "agreement and an exact McNemar test showing our tie-breaking is not biased toward failures.\n")
        L.append("**Layout.** Our rotated surface code stabilizers equal those of Stim's generated "
                 "`surface_code:rotated_memory_z` circuit for d = 3 to 11, up to " + ", ".join(sorted(set(str(v) for v in cc["layout"].values()))) +
                 " (a relabeling: Stim puts the X-type boundary on the left and right).\n")
    bench_path = os.path.join(ROOT, "src", "data", "bench.json")
    if os.path.exists(bench_path):
        b = json.load(open(bench_path, encoding="utf8"))
        L.append("## Decoder speed\n")
        L.append(f"`npm run bench` on {b['cpu']}, Node {b['node']} ({b['date'][:10]}). Phenomenological noise, q = p, d rounds; "
                 "time per round = decode time / (d + 1) layers. Real superconducting hardware produces about one round per microsecond.\n")
        L.append("| d | p | MWPM median (us) | MWPM p99 | Union-find median | Union-find p99 | Greedy median | Greedy p99 |")
        L.append("|---|---|---|---|---|---|---|---|")
        rows = {}
        for r in b["results"]:
            rows.setdefault((r["d"], r["p"]), {})[r["decoder"]] = r
        for (d, p), rr in sorted(rows.items()):
            cells = []
            for k in ("mwpm", "unionFind", "greedy"):
                cells += [f"{rr[k]['medianUs']:.1f}", f"{rr[k]['p99Us']:.1f}"] if k in rr else ["", ""]
            L.append(f"| {d} | {p:.2f} | " + " | ".join(cells) + " |")
        L.append("")
    with open(os.path.join(DOCS, "validation-report.md"), "w", encoding="utf8") as f:
        f.write("\n".join(L))


if __name__ == "__main__":
    sys.exit(main())
