/** getRollCall — individual member votes. */

import type { LegiScanClient } from './client';
import { rollCallResponseSchema, type LegiScanRollCall } from './schemas';

/**
 * One API query. Roll calls are static once recorded, so a stored roll call is
 * never re-fetched.
 */
export async function fetchRollCall(
  client: LegiScanClient,
  rollCallId: number,
): Promise<LegiScanRollCall> {
  const body = await client.call('getRollcall', { id: rollCallId });
  return rollCallResponseSchema.parse(body).roll_call;
}

/** Vote totals that can be shown without any additional API call. */
export interface VoteTotals {
  yea: number;
  nay: number;
  notVoting: number;
  absent: number;
  total: number;
}

export function summarizeVotes(rollCall: {
  yea?: number | null;
  nay?: number | null;
  nv?: number | null;
  absent?: number | null;
  total?: number | null;
}): VoteTotals {
  const yea = rollCall.yea ?? 0;
  const nay = rollCall.nay ?? 0;
  const notVoting = rollCall.nv ?? 0;
  const absent = rollCall.absent ?? 0;
  return {
    yea,
    nay,
    notVoting,
    absent,
    total: rollCall.total ?? yea + nay + notVoting + absent,
  };
}
