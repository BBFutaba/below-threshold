// Static content: chapter metadata for the Concept Library, glossary, honesty text.

export type PartId = 'basics' | 'shor' | 'qec';

export interface ChapterMeta {
  n: number;
  slug: string;
  part: PartId;
  title: string;
  question: string;
  minutes: string;
  difficulty: 'Beginner' | 'Intermediate';
  tags: string[];
  helpfulFirst?: string[];
  /** 30-second primer shown when opened out of order: two sentences. */
  primer?: string;
  aha: string;
}

export const PARTS: { id: PartId; label: string; name: string; blurb: string }[] = [
  {
    id: 'basics',
    label: 'Part I',
    name: 'Quantum basics',
    blurb: 'What a qubit is, what many qubits hold together, and entanglement: the three ideas everything else is built from.',
  },
  {
    id: 'shor',
    label: 'Part II',
    name: "Shor's algorithm",
    blurb: 'Factor a number with a quantum computer: turn factoring into finding a rhythm, then hear it with the quantum Fourier transform.',
  },
  {
    id: 'qec',
    label: 'Part III',
    name: 'Keeping it alive',
    blurb: 'Real qubits make mistakes. Quantum error correction protects them long enough to run Shor, and leads into the game.',
  },
];

export const partById = (id: PartId) => PARTS.find((p) => p.id === id)!;

export const CHAPTERS: ChapterMeta[] = [
  {
    n: 1,
    slug: 'superposition',
    part: 'basics',
    title: 'What is a qubit?',
    question: 'Is a qubit secretly 0 or 1?',
    minutes: '2 min',
    difficulty: 'Beginner',
    tags: ['Basics'],
    aha: "A qubit isn't secretly 0 or 1. It holds an amplitude for each, measuring picks one at random, and amplitudes can even cancel out, which is interference.",
  },
  {
    n: 2,
    slug: 'multi-qubit',
    part: 'basics',
    title: 'Many qubits at once',
    question: 'How much can a handful of qubits hold?',
    minutes: '2 min',
    difficulty: 'Beginner',
    tags: ['Basics'],
    helpfulFirst: ['superposition'],
    primer: 'A qubit holds two amplitudes, one for 0 and one for 1. Measuring gives 0 or 1 with probability equal to the amplitude squared.',
    aha: 'n qubits carry 2ⁿ amplitudes at once, so a register can hold every number from 0 to 2ⁿ − 1 in superposition. That is the raw material of Shor’s algorithm. In a product state the qubits are independent: measuring one leaves the others alone.',
  },
  {
    n: 3,
    slug: 'entanglement',
    part: 'basics',
    title: 'Entanglement',
    question: 'What makes two qubits more than two qubits?',
    minutes: '2 min',
    difficulty: 'Beginner',
    tags: ['Basics', 'Entanglement'],
    helpfulFirst: ['multi-qubit'],
    primer: 'Two qubits hold four amplitudes, for 00, 01, 10 and 11. A CNOT flips its target qubit only when its control is 1.',
    aha: 'An entangled pair cannot be split into two separate qubits: each one alone is random, yet they always agree. Shor’s algorithm entangles its two registers, and error correction stores one qubit in the correlations of many.',
  },
  {
    n: 4,
    slug: 'period',
    part: 'shor',
    title: 'Factoring is a hunt for rhythm',
    question: 'How can a repeating pattern break encryption?',
    minutes: '2 min',
    difficulty: 'Beginner',
    tags: ['Shor'],
    aha: 'Factoring N turns into finding the period r of aˣ mod N. Once you know r, two gcd calculations give the factors (unless r is odd or a^(r/2) ≡ −1, and then you just pick another a). For big numbers the period is astronomically long, and that is the step a quantum computer speeds up.',
  },
  {
    n: 5,
    slug: 'phase',
    part: 'shor',
    title: "Phase: a qubit's hidden clock",
    question: 'What does a phase do if you can never measure it?',
    minutes: '2 min',
    difficulty: 'Beginner',
    tags: ['Basics', 'Fourier'],
    helpfulFirst: ['superposition'],
    primer: 'A qubit holds two amplitudes, one for |0⟩ and one for |1⟩. Measuring gives 0 or 1 with probability equal to the amplitude squared.',
    aha: 'A phase is a direction, like a clock hand. Measuring cannot see it, but interference turns it into probabilities. The quantum Fourier transform is built entirely from these turns.',
  },
  {
    n: 6,
    slug: 'qft',
    part: 'shor',
    title: 'The quantum Fourier transform',
    question: 'How does a quantum computer hear a rhythm?',
    minutes: '4 min',
    difficulty: 'Intermediate',
    tags: ['Shor', 'Fourier'],
    helpfulFirst: ['phase'],
    primer:
      'A phase is the direction of an amplitude, like a clock hand. A phase gate turns the |1⟩ hand; interference (a Hadamard) turns those directions into measurable probabilities.',
    aha: 'The QFT gives every qubit a clock that turns at its own speed. A pattern that repeats every r steps makes those clocks agree only near multiples of N/r, so the answer lands on sharp peaks that reveal r.',
  },
  {
    n: 7,
    slug: 'shor',
    part: 'shor',
    title: "Shor's algorithm, end to end",
    question: 'How do you factor 15 with a quantum computer?',
    minutes: '4 min',
    difficulty: 'Intermediate',
    tags: ['Shor', 'Fourier', 'Entanglement'],
    helpfulFirst: ['period', 'qft'],
    primer:
      'Factoring N reduces to finding the period r of aˣ mod N. The quantum Fourier transform turns a pattern that repeats every r steps into peaks near multiples of Q/r.',
    aha: 'Superpose every x, compute aˣ mod N for all of them at once, measure, then let the QFT turn the hidden rhythm into peaks. A little classical arithmetic does the rest. The quantum part only has to find r.',
  },
  {
    n: 8,
    slug: 'noise',
    part: 'shor',
    title: 'Noise ruins the answer',
    question: 'What happens when the qubits make mistakes?',
    minutes: '2 min',
    difficulty: 'Beginner',
    tags: ['Shor', 'Errors'],
    helpfulFirst: ['shor'],
    primer: "Shor's algorithm ends with sharp peaks in the measurement results; the peak positions reveal the period, and the period gives the factors.",
    aha: 'Errors blur the peaks into noise. Breaking real encryption needs billions of operations, far more than any physical qubit survives. That is why we need quantum error correction, the rest of this story.',
  },
  {
    n: 9,
    slug: 'no-cloning',
    part: 'qec',
    title: 'No-cloning',
    question: "Why can't we back up a qubit?",
    minutes: '1–2 min',
    difficulty: 'Beginner',
    tags: ['Basics', 'Errors'],
    helpfulFirst: ['superposition'],
    primer: 'A qubit can be in a superposition like |+⟩ = (|0⟩ + |1⟩)/√2, an equal mix of 0 and 1. Measuring it gives a random answer and destroys the mix.',
    aha: "No machine can copy an unknown quantum state. That's a law of physics, called the no-cloning theorem. Classical backups won't work.",
  },
  {
    n: 10,
    slug: 'syndrome',
    part: 'qec',
    title: 'Measurement and syndromes',
    question: 'How do you find an error without looking?',
    minutes: '2 min',
    difficulty: 'Intermediate',
    tags: ['Measurement', 'Errors'],
    helpfulFirst: ['entanglement'],
    primer:
      'Two CNOTs spread one qubit α|0⟩ + β|1⟩ across three: α|000⟩ + β|111⟩. No single qubit holds the information; it lives in their agreement.',
    aha: "We asked 'do these qubits agree?' instead of 'what are they?'. That's a stabilizer measurement, the core of all quantum error correction.",
  },
  {
    n: 11,
    slug: 'phase-errors',
    part: 'qec',
    title: 'Phase errors and interference',
    question: 'What error can the bit-flip code not see?',
    minutes: '2 min',
    difficulty: 'Intermediate',
    tags: ['Errors', 'Measurement'],
    helpfulFirst: ['syndrome'],
    primer:
      'The 3-qubit code α|000⟩ + β|111⟩ uses two parity checks (do qubits 0 and 1 agree? do 1 and 2?) to find a single bit flip without reading α or β.',
    aha: 'Quantum errors come in two kinds, bit flips and phase flips. Real codes need checks for both, which is why the surface code has two types of checks.',
  },
  {
    n: 12,
    slug: 'discretization',
    part: 'qec',
    title: 'Error discretization',
    question: 'How can we fix errors that are tiny drifts?',
    minutes: '1–2 min',
    difficulty: 'Intermediate',
    tags: ['Errors', 'Measurement'],
    helpfulFirst: ['syndrome'],
    primer:
      'The 3-qubit code α|000⟩ + β|111⟩ uses two parity checks on helper qubits to find which qubit flipped, without revealing α or β.',
    aha: 'Measuring the checks snaps a continuous error into a discrete one we know how to fix. Without this quantum effect, error correction would be impossible.',
  },
];

export const chapterBySlug = (slug: string) => CHAPTERS.find((c) => c.slug === slug);

export const PATHS: { name: string; chapters: number[]; then?: string }[] = [
  { name: 'Full story', chapters: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], then: 'the game' },
  { name: 'Quantum basics', chapters: [1, 2, 3] },
  { name: "Shor's algorithm", chapters: [1, 2, 4, 5, 6, 7, 8] },
  { name: 'QFT deep dive', chapters: [5, 6, 7] },
  { name: 'Error correction', chapters: [3, 9, 10, 11, 12], then: 'the game' },
  { name: 'Fast track to the game', chapters: [1, 10, 12], then: 'the game' },
];

export const LIBRARY_TAGS = ['Basics', 'Shor', 'Fourier', 'Entanglement', 'Measurement', 'Errors'];

export const GLOSSARY: [string, string][] = [
  ['Qubit', 'The basic unit of quantum information; can be in a superposition of 0 and 1.'],
  ['Superposition', 'A state holding amplitudes for 0 and 1 at once; measurement picks one.'],
  ['Interference', 'Amplitudes adding up or canceling, changing outcome probabilities.'],
  ['Phase', 'The direction of an amplitude, like a clock hand. Invisible to a single measurement, but it decides how amplitudes interfere.'],
  ["Shor's algorithm", 'A quantum algorithm (Peter Shor, 1994) that factors large numbers exponentially faster than any known classical method, by finding a period.'],
  ['RSA', 'A widely used encryption scheme whose security rests on how hard it is to factor a product of two large primes.'],
  ['Period', 'The number of steps r after which a repeating pattern starts over; for aˣ mod N, the smallest r with aʳ ≡ 1 (mod N).'],
  ['Modular arithmetic', 'Arithmetic that wraps around: x mod N is the remainder after dividing by N, like hours on a clock.'],
  ['Register', 'A group of qubits that together hold a number, like the input register x and the output register aˣ mod N.'],
  ['Product state', 'A multi-qubit state that is just each qubit’s own state side by side; measuring one qubit leaves the others unchanged.'],
  ['Quantum Fourier transform (QFT)', 'A circuit of Hadamards and controlled phase turns that maps a repeating pattern to sharp peaks at its frequencies.'],
  ['Continued fraction', 'A way to find the simple fraction j/r closest to a measured value k/Q; it recovers the period in Shor’s algorithm.'],
  ['Entanglement', 'Correlations between qubits that no description of the individual qubits can capture.'],
  ['No-cloning theorem', 'No process can copy an unknown quantum state.'],
  ['Pauli X, Z, Y', 'Bit flip, phase flip, and both together; the basic error types.'],
  ['Stabilizer', 'A multi-qubit check (product of Paulis) the protected state always passes.'],
  ['Syndrome', 'The pattern of check results; fired checks signal nearby errors.'],
  ['Ancilla', 'A helper qubit used to measure a check without disturbing the data.'],
  ['Logical qubit', 'One protected qubit stored across many physical qubits.'],
  ['Code distance d', 'The smallest number of physical errors that can silently corrupt the logical qubit.'],
  ['Decoder', 'The algorithm that infers the most likely errors from the syndrome.'],
  ['MWPM', 'Minimum-weight perfect matching, a decoder that pairs fired checks by shortest total path.'],
  ['Union-find decoder', 'A near-linear-time decoder that grows and merges clusters around fired checks.'],
  ['Threshold', 'The physical error rate below which bigger codes reduce logical errors.'],
  ['Suppression factor', 'How much the logical error rate drops when the distance increases by 2 (often called Λ).'],
  ['Detection event', 'A check whose result changed since the previous round; used when checks themselves can be wrong.'],
  ['Backlog problem', 'Syndrome data arriving faster than the decoder can process it, so the queue grows.'],
  ['T gate', 'A gate needed for universal quantum computing whose correct use depends on decoded results.'],
];

export const HONESTY_TEXT =
  "What we simplify: the Shor's algorithm chapters factor small numbers (15 to 35). The walkthrough writes the registers down " +
  'exactly; the gate-level noise simulation uses 10 qubits and treats each controlled modular multiplication as one exact gate ' +
  'rather than compiling it into elementary gates. ' +
  'The main game uses code-capacity and phenomenological noise, not full circuit-level noise. ' +
  'Bit-flip and phase-flip errors are decoded separately. Real-time mode runs on a slowed-down clock, scaled from our ' +
  'measured browser decode times. Distances are small compared with future machines. Everything shown is computed ' +
  'live or comes from our validation runs, documented in the repo.';

/** Public repository URL, set at build time with VITE_REPO_URL (links are hidden when unset). */
export const REPO_URL: string = (import.meta.env.VITE_REPO_URL as string | undefined) ?? '';
