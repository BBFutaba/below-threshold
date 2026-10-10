# Citations

Every number quoted in the app, pitch or write-up that does not come from our own simulations is listed here with its source. Items marked **verify** must be checked against the paper by the physics lead before demo day (the plan requires it); the wording in the app is deliberately conservative.

## Surface codes and thresholds

1. E. Dennis, A. Kitaev, A. Landahl, J. Preskill, "Topological quantum memory", *J. Math. Phys.* 43, 4452 (2002). arXiv:quant-ph/0110143. Matching decoders and thresholds for the surface code.
2. C. Wang, J. Harrington, J. Preskill, "Confinement-Higgs transition in a disordered gauge theory and the accuracy threshold for quantum memory", *Annals of Physics* 303, 31 (2003). arXiv:quant-ph/0207088. MWPM thresholds of about 10.3% (code capacity, bit flip) and about 2.9% (phenomenological, q = p), and the finite-size scaling ansatz we use. **verify** exact values.
3. A. G. Fowler, M. Mariantoni, J. M. Martinis, A. N. Cleland, "Surface codes: Towards practical large-scale quantum computation", *Phys. Rev. A* 86, 032324 (2012). Rotated layout, circuit-level threshold near 1%.
4. B. M. Terhal, "Quantum error correction for quantum memories", *Rev. Mod. Phys.* 87, 307 (2015). arXiv:1302.3428. Surface-code basics and the decoder backlog argument (classical processing must keep up with syndrome generation). **verify** the section we cite.

## Decoders

5. N. Delfosse, N. H. Nickerson, "Almost-linear time decoding algorithm for topological codes", *Quantum* 5, 595 (2021). arXiv:1709.06218. Union-find decoder; thresholds of about 9.9% (code capacity) and about 2.6% (phenomenological). **verify** exact values.
6. N. Delfosse, G. Zémor, "Linear-time maximum likelihood decoding of surface codes over the quantum erasure channel", *Phys. Rev. Research* 2, 033042 (2020). arXiv:1703.01517. Peeling decoder.
7. J. Edmonds, "Paths, trees, and flowers", *Canad. J. Math.* 17, 449 (1965); Z. Galil, "Efficient algorithms for finding maximum matching in graphs", *ACM Computing Surveys* 18, 23 (1986). Blossom algorithm.
8. J. van Rantwijk, `mwmatching.py`, public domain (http://jorisvr.nl/article/maximum-matching). Our `src/core/decoders/blossom.ts` is a TypeScript port of it.
9. O. Higgott, "PyMatching: A Python package for decoding quantum codes with minimum-weight perfect matching", *ACM Trans. Quantum Comput.* 3, 16 (2022); O. Higgott, C. Gidney, "Sparse Blossom: correcting a million errors per core second with minimum-weight matching", arXiv:2303.15933 (2023). Reference decoder for our cross-check.

## Simulation

10. C. Gidney, "Stim: a fast stabilizer circuit simulator", *Quantum* 5, 497 (2021). Reference layouts and circuits for our cross-check.
11. D. Gottesman, "The Heisenberg representation of quantum computers", arXiv:quant-ph/9807006 (1998). Gottesman-Knill theorem: why tracking Pauli frames classically is exact for this noise.

## Hardware context

12. Google Quantum AI and collaborators, "Quantum error correction below the surface code threshold", *Nature* 638, 920 (2025); arXiv:2408.13687 (2024). Below-threshold surface-code memory on the Willow processor; error suppression factor Λ ≈ 2.14 per distance step (d = 3 → 5 → 7), roughly a microsecond per cycle, and real-time decoding. The app says "each step from d = 3 to 5 to 7 cut the logical error per cycle by a factor of about 2.1 (Λ ≈ 2.14)". **verify** Λ, the cycle time and the real-time decoding latency figures before quoting them in the pitch.
13. "Physical error about once per thousand operations" (pitch opening line): a commonly cited ballpark for today's best two-qubit gates. **verify** against a current source (e.g. reference 12's reported gate errors) and adjust.

## Prior art

14. J. R. Wootton, *Decodoku* (citizen-science QEC games, around 2016); J. R. Wootton, "Getting the public involved in quantum error correction", arXiv:1712.09649. We cite it in the README and explain what we add.

## Shor's algorithm and the quantum Fourier transform

15. P. W. Shor, "Algorithms for quantum computation: discrete logarithms and factoring", *Proc. 35th FOCS*, 124 (1994); expanded in *SIAM J. Comput.* 26, 1484 (1997), arXiv:quant-ph/9508027. The algorithm the Part II chapters and film follow.
16. D. Coppersmith, "An approximate Fourier transform useful in quantum factoring", IBM Research Report RC 19642 (1994), arXiv:quant-ph/0201067. The QFT circuit of Hadamards and controlled phase rotations.
17. M. A. Nielsen, I. L. Chuang, *Quantum Computation and Quantum Information* (Cambridge, 2000), Chapter 5. Order finding, continued fractions (including trying small multiples of the denominators) and the success probability of a run.
18. C. Gidney, "How to factor 2048 bit RSA integers with less than a million noisy qubits", arXiv:2505.15917 (2025); earlier C. Gidney, M. Ekerå, "How to factor 2048 bit RSA integers in 8 hours using 20 million noisy qubits", *Quantum* 5, 433 (2021). Source for "around a million qubits running for days" (assumes about 0.1% gate error). **verify** the qubit count and run time before quoting them in the pitch.
19. R. L. Rivest, A. Shamir, L. Adleman, "A method for obtaining digital signatures and public-key cryptosystems", *Commun. ACM* 21, 120 (1978). RSA.
