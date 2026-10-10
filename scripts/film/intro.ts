// Intro: real syndromes on a d = 7 code for the breathing background lattice.
import { makeRotatedSurfaceCode } from '../../src/core/surfaceCode';
import { makeRng } from '../../src/core/rng';
import { sampleNoise } from '../../src/core/noise';
import { layout, ones, write } from './_util';

const code = makeRotatedSurfaceCode(7);
const rng = makeRng(20261009);
const frames = Array.from({ length: 10 }, () => {
  const s = sampleNoise(code, { kind: 'depolarizing', p: 0.03 }, rng);
  if (s.kind !== 'codeCapacity') throw new Error();
  return ones(s.syndrome);
});
write('intro', { layout: layout(code), model: 'depolarizing p=3%, seed 20261009', frames });
