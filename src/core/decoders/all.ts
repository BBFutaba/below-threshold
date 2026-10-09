import type { Decoder, DecoderId } from './index';
import { exactSmallDecoder } from './exactSmall';
import { greedyDecoder } from './greedy';
import { mwpmDecoder } from './mwpm';
import { unionFindDecoder } from './unionFind';

export const DECODERS: Record<DecoderId, Decoder> = {
  mwpm: mwpmDecoder,
  unionFind: unionFindDecoder,
  greedy: greedyDecoder,
  exact: exactSmallDecoder,
};

/** Decoders offered in the UI, slowest-and-most-accurate first. */
export const UI_DECODERS: DecoderId[] = ['mwpm', 'unionFind', 'greedy'];

export { exactSmallDecoder, greedyDecoder, mwpmDecoder, unionFindDecoder };
