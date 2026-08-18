/**
 * Re-runs classification over already-stored LegiScan payloads.
 *
 * Costs zero API queries, because every bill's original payload is retained in
 * `bills.raw`. This is what makes the taxonomy safe to improve: change
 * config/water-taxonomy.ts, bump the classifier version, and re-derive every
 * decision without touching the monthly budget.
 *
 * Manual overrides still win — reclassification records what the classifier
 * now thinks, but a reviewer's decision continues to determine what is tracked.
 */

import { eq } from 'drizzle-orm';

import { classifyBill, resolveTracking } from '@/lib/classification';
import type { Database } from '@/lib/db/client';
import { bills } from '@/lib/db/schema';
import { billSchema, normalizeBillCommittee } from '@/lib/legiscan/schemas';
import { loadActiveOverride, replaceTopics, upsertClassification } from './persist';
import type { SyncError } from './types';

export interface ReclassifyResult {
  examined: number;
  updated: number;
  nowTracked: number;
  noLongerTracked: number;
  unparseable: number;
  errors: SyncError[];
}

export async function reclassifyStoredBills(
  db: Database,
  options: { logger?: (message: string) => void } = {},
): Promise<ReclassifyResult> {
  const log = options.logger ?? (() => {});
  const result: ReclassifyResult = {
    examined: 0,
    updated: 0,
    nowTracked: 0,
    noLongerTracked: 0,
    unparseable: 0,
    errors: [],
  };

  const rows = await db
    .select({
      id: bills.id,
      legiscanBillId: bills.legiscanBillId,
      billNumber: bills.billNumber,
      isTracked: bills.isTracked,
      relevanceScore: bills.relevanceScore,
      raw: bills.raw,
    })
    .from(bills);

  for (const row of rows) {
    result.examined += 1;

    const parsed = billSchema.safeParse(row.raw);
    if (!parsed.success) {
      result.unparseable += 1;
      result.errors.push({
        stage: 'reclassify',
        subject: row.billNumber,
        message: 'Stored payload could not be re-parsed; re-sync this bill to repair it.',
      });
      continue;
    }

    const payload = parsed.data;
    const committee = normalizeBillCommittee(payload.committee);

    try {
      const classification = await classifyBill({
        billNumber: payload.bill_number,
        title: payload.title,
        description: payload.description,
        subjects: payload.subjects.map((s) => s.subject_name).filter(Boolean) as string[],
        committeeName: committee?.name ?? null,
      });

      const override = await loadActiveOverride(db, row.legiscanBillId);
      const tracking = resolveTracking(classification, override);

      await upsertClassification(db, row.id, classification);
      await replaceTopics(db, row.id, classification);

      const changed =
        tracking.isTracked !== row.isTracked || classification.score !== row.relevanceScore;

      if (changed) {
        await db
          .update(bills)
          .set({ isTracked: tracking.isTracked, relevanceScore: classification.score })
          .where(eq(bills.id, row.id));

        result.updated += 1;
        if (tracking.isTracked && !row.isTracked) {
          result.nowTracked += 1;
          log(`${row.billNumber}: now tracked (score ${classification.score}).`);
        } else if (!tracking.isTracked && row.isTracked) {
          result.noLongerTracked += 1;
          log(`${row.billNumber}: no longer tracked (score ${classification.score}).`);
        }
      }
    } catch (error) {
      result.errors.push({
        stage: 'reclassify',
        subject: row.billNumber,
        message: error instanceof Error ? error.message : 'Unknown classification error',
      });
    }
  }

  return result;
}
