// What we simplify, how we validated it, and where every number comes from.

import validation from '../../data/validation.json';
import bench from '../../data/bench.json';
import { HONESTY_TEXT } from '../content';
import { Card, Pill, pct } from '../components/ui';
import s from './screen.module.css';

interface V {
  model: string;
  decoder: string;
  estimate: number | null;
  range: [number, number] | null;
  published: number;
  band: [number, number];
  source: string;
  pass: boolean;
}

const DEC: Record<string, string> = { mwpm: 'Exact matching (MWPM)', unionFind: 'Union-find', greedy: 'Greedy' };

export function Honesty() {
  const verdicts = validation.verdicts as unknown as V[];
  const b = bench as { cpu: string; node: string; date: string; results: { decoder: string; d: number; p: number; medianUs: number; p99Us: number }[] };
  const row = (dec: string, d: number, p: number) => b.results.find((r) => r.decoder === dec && r.d === d && r.p === p);
  return (
    <div className={`${s.page} ${s.narrow}`}>
      <header className={s.header}>
        <p className={s.eyebrow}>Honesty panel</p>
        <h1>What we simplify, and how we checked</h1>
      </header>
      <div className={s.stateGrid}>
        <Card title="What we simplify">
          <p style={{ margin: 0 }}>{HONESTY_TEXT}</p>
          <ul className="muted" style={{ marginBottom: 0 }}>
            <li>Under depolarizing noise, decoding X and Z separately ignores Y correlations; correlated decoders do slightly better.</li>
            <li>The phenomenological model has perfect gates; only data qubits and check results are noisy. Circuit-level noise (faulty gates) gives thresholds near 1%.</li>
            <li>Real-time mode measures decode time in your browser and divides it by a hardware speed-up you choose; the speed-up is an assumption, labeled as such.</li>
            <li>The chapters show the full state vector (“peek”), which a real quantum computer can never do.</li>
          </ul>
        </Card>

        <Card title="Shor's algorithm and the QFT">
          <ul style={{ margin: 0 }}>
            <li>
              The walkthrough writes down the two registers exactly after each step (superposition, aˣ mod N, measurement, QFT). The noise chapter runs the gate-level circuit
              on 10 simulated qubits, with each controlled modular multiplication applied as one exact gate; real hardware compiles these into thousands of elementary gates.
            </li>
            <li>The numbers are small (15 to 35) and the input register is capped at 9 qubits, below the textbook Q ≥ N² for 33 and 35; the chapter says so.</li>
            <li>
              Noise model: after every step, each qubit suffers a random X, Y or Z with probability p. Real devices also have correlated and leakage errors. For a number as
              small as 15, a random guess often factors it too, so the chapter measures the quantum signal (runs landing on a peak) as well.
            </li>
            <li>
              Checked by tests: the QFT circuit equals the exact discrete Fourier transform on random states (1 to 7 qubits), and without noise the gate-level Shor circuit
              reproduces the register-level distribution exactly (<span className="mono">tests/core/qft.test.ts</span>, <span className="mono">shor.test.ts</span>).
            </li>
          </ul>
        </Card>

        <Card title="Validation: thresholds">
          <p className="muted" style={{ fontSize: '0.9rem' }}>
            From <span className="mono">validate/thresholds.py</span> ({validation.date.slice(0, 10)}, {validation.machine}). Our decoders, plus independent Stim and
            PyMatching references, at distances up to 13.
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '6px 8px' }}>Noise</th>
                  <th style={{ padding: '6px 8px' }}>Decoder</th>
                  <th style={{ padding: '6px 8px' }}>Ours</th>
                  <th style={{ padding: '6px 8px' }}>Published</th>
                  <th style={{ padding: '6px 8px' }}>Band</th>
                  <th style={{ padding: '6px 8px' }} />
                </tr>
              </thead>
              <tbody>
                {verdicts.map((v) => (
                  <tr key={v.model + v.decoder} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '6px 8px' }}>{v.model}</td>
                    <td style={{ padding: '6px 8px' }}>{DEC[v.decoder]}</td>
                    <td style={{ padding: '6px 8px' }} className="mono">
                      {v.estimate ? pct(v.estimate, 2) : 'n/a'}
                    </td>
                    <td style={{ padding: '6px 8px' }} className="mono">
                      ≈ {pct(v.published, 1)}
                    </td>
                    <td style={{ padding: '6px 8px' }} className="mono">
                      {pct(v.band[0], 1)}–{pct(v.band[1], 1)}
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <Pill tone={v.pass ? 'green' : 'coral'}>{v.pass ? 'pass' : 'fail'}</Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="faint" style={{ fontSize: '0.82rem', marginBottom: 0 }}>
            Published values are approximate figures from the literature (see CITATIONS.md). Phenomenological thresholds use the failure probability of a whole
            d-round memory experiment, as in the published 2.9% figure.
          </p>
        </Card>

        <Card title="Validation: decoder correctness">
          <ul style={{ margin: 0 }}>
            <li>Our blossom MWPM returns exactly the minimum weight found by brute-force dynamic programming on every instance with up to 16 defects.</li>
            <li>On 90,000 exported instances, our correction weight equals PyMatching&apos;s on 100%; logical outcomes agree on 100% except on degenerate ties (several equally short corrections), where a paired McNemar test shows no bias.</li>
            <li>Our surface-code stabilizers equal those in Stim&apos;s generated rotated_memory_z circuits for d = 3 to 11 (up to a relabeling).</li>
            <li>Every decoder clears the syndrome on 100,000 random instances; every error of weight up to (d−1)/2 is corrected by MWPM and union-find.</li>
          </ul>
        </Card>

        <Card title="Decoder speed (benchmarks)">
          <p className="muted" style={{ fontSize: '0.9rem' }}>
            Median time per round, phenomenological noise, from <span className="mono">npm run bench</span> on {b.cpu} (Node {b.node}). Real chips produce about one round
            per microsecond.
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--text-muted)' }}>
                <th style={{ padding: '4px 8px' }}>d</th>
                <th style={{ padding: '4px 8px' }}>p</th>
                <th style={{ padding: '4px 8px' }}>MWPM</th>
                <th style={{ padding: '4px 8px' }}>Union-find</th>
                <th style={{ padding: '4px 8px' }}>Greedy</th>
              </tr>
            </thead>
            <tbody>
              {[3, 5, 7, 9, 11].flatMap((d) =>
                [0.01, 0.03].map((p) => (
                  <tr key={`${d}-${p}`} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '4px 8px' }}>{d}</td>
                    <td style={{ padding: '4px 8px' }}>{pct(p, 0)}</td>
                    {['mwpm', 'unionFind', 'greedy'].map((k) => (
                      <td key={k} style={{ padding: '4px 8px' }} className="mono">
                        {row(k, d, p) ? `${row(k, d, p)!.medianUs.toFixed(1)} µs` : '–'}
                      </td>
                    ))}
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </Card>

        <Card title="Prior art">
          <p style={{ margin: 0 }}>
            Error-correction games exist, notably James Wootton&apos;s Decodoku (around 2016). Below Threshold adds the quantum basics on an exact simulator, playable
            decoding with a decoder replay, measurement errors in a time stack, the real-time backlog, and a validated threshold lab in one experience.
          </p>
        </Card>
      </div>
    </div>
  );
}
