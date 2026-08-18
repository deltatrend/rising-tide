/** getBill and getMasterListRaw. */

import type { LegiScanClient } from './client';
import {
  billResponseSchema,
  parseMasterList,
  type LegiScanBill,
  type LegiScanMasterListEntry,
} from './schemas';

/** One API query. Recommended refresh frequency: 3 hours. */
export async function fetchBill(client: LegiScanClient, billId: number): Promise<LegiScanBill> {
  const body = await client.call('getBill', { id: billId });
  return billResponseSchema.parse(body).bill;
}

/**
 * One API query for an entire session's change hashes. This is the cheapest way
 * to find out which of the bills we already track have moved.
 */
export async function fetchMasterListRaw(
  client: LegiScanClient,
  sessionId: number,
): Promise<LegiScanMasterListEntry[]> {
  const body = await client.call('getMasterListRaw', { id: sessionId });
  return parseMasterList(body);
}

/** Full master list with titles — heavier payload, same single query cost. */
export async function fetchMasterList(
  client: LegiScanClient,
  sessionId: number,
): Promise<LegiScanMasterListEntry[]> {
  const body = await client.call('getMasterList', { id: sessionId });
  return parseMasterList(body);
}

/**
 * Decides whether a bill needs a detail fetch.
 *
 * A missing stored hash means we have never had the detail payload. Equal
 * hashes mean nothing about the bill has changed and getBill would return
 * identical data — the core of the incremental strategy.
 */
export function needsDetailFetch(
  storedHash: string | null | undefined,
  incomingHash: string | null | undefined,
): boolean {
  if (!storedHash) return true;
  if (!incomingHash) return false;
  return storedHash !== incomingHash;
}

/** Splits candidates into fetch/skip groups without any network access. */
export function partitionByChangeHash<T extends { billId: number; changeHash: string | null }>(
  candidates: T[],
  storedHashes: Map<number, string | null>,
): { changed: T[]; unchanged: T[] } {
  const changed: T[] = [];
  const unchanged: T[] = [];

  for (const candidate of candidates) {
    const stored = storedHashes.get(candidate.billId);
    if (storedHashes.has(candidate.billId) && !needsDetailFetch(stored, candidate.changeHash)) {
      unchanged.push(candidate);
    } else {
      changed.push(candidate);
    }
  }

  return { changed, unchanged };
}
