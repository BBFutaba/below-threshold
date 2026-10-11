// Pitch video (media/scenes/pitch.py): everything the scene shows that is not drawn from an
// existing film export.
//
// - qr: the QR code for the live site, from 'qrcode-generator' (error correction level M);
//   rows of '0'/'1', row 0 at the top. The scene adds the quiet zone.
// - rsa2048: the RSA-2048 challenge modulus (RSA Laboratories' RSA Factoring Challenge, 1991;
//   unfactored). Checked here: 617 decimal digits, 2048 bits, odd, composite (Fermat witness 2).
// - rigor: the numbers the "rigor" beat shows, read from the validation outputs and the README
//   so the video cannot drift from them.
// - team: member names from src/ui/screens/Team.tsx.
//
// Usage: npx tsx scripts/film/pitch.ts
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import qrcode from 'qrcode-generator';
import { write } from './_util';

const URL = 'https://bbfutaba.github.io/below-threshold/';

// ---------------------------------------------------------------- QR code
const q = qrcode(0, 'M');
q.addData(URL);
q.make();
const size = q.getModuleCount();
const rows: string[] = [];
for (let r = 0; r < size; r++) {
  let s = '';
  for (let c = 0; c < size; c++) s += q.isDark(r, c) ? '1' : '0';
  rows.push(s);
}
// typeNumber from the module count: size = 17 + 4 * version.
const version = (size - 17) / 4;

// ---------------------------------------------------------------- RSA-2048
const RSA_2048 =
  '25195908475657893494027183240048398571429282126204032027777137836043662020707595556264018525880784406918290641249515082189298559149176184502808489120072844992687392807287776735971418347270261896375014971824691165077613379859095700097330459748808428401797429100642458691817195118746121515172654632282216869987549182422433637259085141865462043576798423387184774447920739934236584823824281198163815010674810451660377306056201619676256133844143603833904414952634432190114657544454178424020924616515723350778707749817125772467962926386356373289912154831438167899885040445364023527381951378636564391212010397122822120720357';

function modpow(b: bigint, e: bigint, m: bigint): bigint {
  let r = 1n;
  b %= m;
  while (e > 0n) {
    if (e & 1n) r = (r * b) % m;
    b = (b * b) % m;
    e >>= 1n;
  }
  return r;
}

const N = BigInt(RSA_2048);
const bits = N.toString(2).length;
if (RSA_2048.length !== 617) throw new Error(`RSA-2048 should have 617 digits, got ${RSA_2048.length}`);
if (bits !== 2048) throw new Error(`RSA-2048 should have 2048 bits, got ${bits}`);
if (N % 2n === 0n) throw new Error('RSA-2048 should be odd');
if (modpow(2n, N - 1n, N) === 1n) throw new Error('RSA-2048 should be composite (2 is a Fermat witness)');

// ---------------------------------------------------------------- rigor numbers
type Graph = { name: string; error_type: string; instances: number; weight_agree: number };
const cross = JSON.parse(readFileSync('validate/data/cross_check.json', 'utf8')) as {
  graphs: Graph[];
  layout: Record<string, string>;
  pymatching: string;
  stim: string;
  passed: boolean;
};
const problems = cross.graphs.reduce((a, g) => a + g.instances, 0);
const agree = cross.graphs.reduce((a, g) => a + g.weight_agree, 0);
const layoutDs = Object.keys(cross.layout)
  .map(Number)
  .sort((a, b) => a - b);

type Verdict = { model: string; decoder: string; estimate: number; published: number; source: string; pass: boolean };
const validation = JSON.parse(readFileSync('src/data/validation.json', 'utf8')) as { verdicts: Verdict[] };
const verdict = (model: string) => {
  const v = validation.verdicts.find((x) => x.model === model && x.decoder === 'mwpm');
  if (!v || !v.pass) throw new Error(`no passing MWPM verdict for ${model}`);
  return { model, estimate: v.estimate, published: v.published, source: v.source };
};

// Test counts straight from the test runners (the README can go stale).
const listed = (cmd: string) => {
  const r = spawnSync(cmd, { shell: true, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`${cmd} failed: ${r.stderr}`);
  return r.stdout;
};
const unit = listed('npx vitest list')
  .split(/\r?\n/)
  .filter((l) => l.includes(' > ')).length;
const e2eMatch = listed('npx playwright test --list').match(/Total: (\d+) tests?/);
if (!unit || !e2eMatch) throw new Error('could not count tests');
const e2e = Number(e2eMatch[1]);
console.log(`tests: ${unit} unit + ${e2e} end-to-end`);

// ---------------------------------------------------------------- team
const team = [...readFileSync('src/ui/screens/Team.tsx', 'utf8').matchAll(/\{ name: '([^']+)'/g)].map((m) => m[1]);
if (team.length !== 4) throw new Error(`expected 4 team members, found ${team.length}`);

write('pitch', {
  url: URL,
  qr: { ecc: 'M', version, size, rows },
  rsa2048: {
    digits: RSA_2048,
    decimalDigits: RSA_2048.length,
    bits,
    source: "RSA Laboratories' RSA Factoring Challenge (1991), RSA-2048; unfactored",
  },
  rigor: {
    crossCheck: { problems, agree, pymatching: cross.pymatching, stim: cross.stim, passed: cross.passed },
    layout: { distances: layoutDs, stim: cross.stim },
    thresholds: [verdict('bitflip'), verdict('phenomenological')],
    tests: { unit, e2e, total: unit + e2e },
  },
  team,
});
