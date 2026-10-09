// Static content: chapter metadata for the Concept Library, glossary, honesty text.

export interface ChapterMeta {
  n: number;
  slug: string;
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

export const CHAPTERS: ChapterMeta[] = [
  {
    n: 1,
    slug: 'superposition',
    title: 'Superposition',
    question: 'Is a qubit secretly 0 or 1?',
    minutes: '2 min',
    difficulty: 'Beginner',
    tags: ['Basics'],
    aha: "A qubit isn't secretly 0 or 1. Its amplitudes can even cancel out, which is interference.",
  },
  {
    n: 2,
    slug: 'no-cloning',
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
    n: 3,
    slug: 'entanglement',
    title: 'Entanglement',
    question: 'How can three qubits share one?',
    minutes: '2 min',
    difficulty: 'Beginner',
    tags: ['Entanglement'],
    helpfulFirst: ['superposition'],
    primer: 'A qubit holds amplitudes α for |0⟩ and β for |1⟩. A CNOT flips its target qubit only when its control is 1.',
    aha: 'Entanglement lets us store one qubit in the relationships between many, which is how we protect it without copying.',
  },
  {
    n: 4,
    slug: 'syndrome',
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
    n: 5,
    slug: 'phase-errors',
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
    n: 6,
    slug: 'discretization',
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
  { name: 'Full story', chapters: [1, 2, 3, 4, 5, 6], then: 'the game' },
  { name: 'Fast track (5 minutes)', chapters: [1, 4, 6], then: 'the game' },
  { name: 'Why QEC is hard', chapters: [2, 5, 6] },
  { name: 'How checks work', chapters: [3, 4, 5] },
];

export const LIBRARY_TAGS = ['Basics', 'Entanglement', 'Measurement', 'Errors'];

export const GLOSSARY: [string, string][] = [
  ['Qubit', 'The basic unit of quantum information; can be in a superposition of 0 and 1.'],
  ['Superposition', 'A state holding amplitudes for 0 and 1 at once; measurement picks one.'],
  ['Interference', 'Amplitudes adding up or canceling, changing outcome probabilities.'],
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
  'What we simplify: the main game uses code-capacity and phenomenological noise, not full circuit-level noise. ' +
  'Bit-flip and phase-flip errors are decoded separately. Real-time mode runs on a slowed-down clock, scaled from our ' +
  'measured browser decode times. Distances are small compared with future machines. Everything shown is computed ' +
  'live or comes from our validation runs, documented in the repo.';

/** Public repository URL, set at build time with VITE_REPO_URL (links are hidden when unset). */
export const REPO_URL: string = (import.meta.env.VITE_REPO_URL as string | undefined) ?? '';
