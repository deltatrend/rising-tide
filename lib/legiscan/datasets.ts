/**
 * getDatasetList — bulk session archives.
 *
 * Rising Tide does not use the Bulk API today: the daily incremental workflow
 * (search → change hash comparison → getBill) fits comfortably inside the
 * Public API budget and keeps the dataset scoped to water policy rather than
 * every bill New York introduces.
 *
 * This module exists so a future developer who needs a full session backfill has
 * a typed starting point, and to document why it is deliberately unused.
 */

import type { LegiScanClient } from './client';
import { datasetListResponseSchema } from './schemas';

/** One API query. Recommended refresh frequency: weekly. */
export async function fetchDatasetList(client: LegiScanClient, state = 'NY') {
  const body = await client.call('getDatasetList', { state });
  return datasetListResponseSchema.parse(body).datasetlist;
}

/**
 * Whether a stored dataset archive is out of date. `dataset_hash` reflects the
 * archive version, not the file bytes.
 */
export function datasetChanged(
  storedHash: string | null | undefined,
  incomingHash: string | null | undefined,
): boolean {
  if (!storedHash) return true;
  if (!incomingHash) return false;
  return storedHash !== incomingHash;
}
