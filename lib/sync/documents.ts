/**
 * Selective document caching into Cloudflare R2.
 *
 * Only a small number of documents are worth caching, so this step is strictly
 * capped and prioritized. Everything about a bill still renders when R2 is
 * unavailable — a failure here degrades to "not cached" and nothing else.
 */

import { and, asc, desc, eq, sql } from 'drizzle-orm';

import type { Database } from '@/lib/db/client';
import { amendments, billDocuments, bills, r2Objects, supplements } from '@/lib/db/schema';
import { LegiScanError, type LegiScanClient } from '@/lib/legiscan/client';
import { fetchDocument, type DocumentKind } from '@/lib/legiscan/documents';
import { buildObjectKey, storeDocument, R2NotConfiguredError } from '@/lib/r2';
import { isR2Configured } from '@/lib/env';
import type { SyncError } from './types';

export interface DocumentCacheResult {
  fetched: number;
  stored: number;
  skipped: number;
  errors: SyncError[];
  notes: string[];
}

interface DocumentCandidate {
  kind: DocumentKind;
  rowId: number;
  externalId: number;
  billRowId: number;
  legiscanBillId: number;
  legiscanSessionId: number;
  mimeId: number | null;
  mime: string | null;
  sourceUrl: string | null;
  hash: string | null;
  priority: number;
}

/**
 * Priority order — the documents a reader is most likely to want:
 *   1. veto letters and fiscal notes (short, high value, rarely linked well)
 *   2. the introduced and enrolled versions of the bill text
 *   3. adopted amendments
 */
const TEXT_PRIORITY: Record<number, number> = { 1: 20, 5: 21, 6: 22, 4: 30, 3: 31 };
const SUPPLEMENT_PRIORITY: Record<number, number> = { 8: 1, 3: 2, 1: 3, 2: 4, 5: 10 };

async function collectCandidates(db: Database, limit: number): Promise<DocumentCandidate[]> {
  const [textRows, supplementRows, amendmentRows] = await Promise.all([
    db
      .select({
        rowId: billDocuments.id,
        externalId: billDocuments.legiscanDocId,
        billRowId: bills.id,
        legiscanBillId: bills.legiscanBillId,
        legiscanSessionId: sql<number>`(select s.legiscan_session_id from sessions s where s.id = ${bills.sessionId})`,
        mimeId: billDocuments.mimeId,
        mime: billDocuments.mimeType,
        sourceUrl: billDocuments.stateUrl,
        hash: billDocuments.textHash,
        typeId: billDocuments.versionTypeId,
      })
      .from(billDocuments)
      .innerJoin(bills, eq(bills.id, billDocuments.billId))
      .where(and(eq(billDocuments.isCached, false), eq(bills.isTracked, true)))
      .orderBy(desc(billDocuments.documentDate))
      .limit(limit * 4),
    db
      .select({
        rowId: supplements.id,
        externalId: supplements.legiscanSupplementId,
        billRowId: bills.id,
        legiscanBillId: bills.legiscanBillId,
        legiscanSessionId: sql<number>`(select s.legiscan_session_id from sessions s where s.id = ${bills.sessionId})`,
        mimeId: supplements.mimeId,
        mime: supplements.mimeType,
        sourceUrl: supplements.stateUrl,
        hash: supplements.supplementHash,
        typeId: supplements.supplementTypeId,
      })
      .from(supplements)
      .innerJoin(bills, eq(bills.id, supplements.billId))
      .where(and(eq(supplements.isCached, false), eq(bills.isTracked, true)))
      .orderBy(asc(supplements.supplementTypeId))
      .limit(limit * 4),
    db
      .select({
        rowId: amendments.id,
        externalId: amendments.legiscanAmendmentId,
        billRowId: bills.id,
        legiscanBillId: bills.legiscanBillId,
        legiscanSessionId: sql<number>`(select s.legiscan_session_id from sessions s where s.id = ${bills.sessionId})`,
        mimeId: amendments.mimeId,
        mime: amendments.mimeType,
        sourceUrl: amendments.stateUrl,
        hash: amendments.amendmentHash,
        adopted: amendments.adopted,
      })
      .from(amendments)
      .innerJoin(bills, eq(bills.id, amendments.billId))
      .where(and(eq(amendments.isCached, false), eq(bills.isTracked, true)))
      .orderBy(desc(amendments.amendmentDate))
      .limit(limit * 2),
  ]);

  const candidates: DocumentCandidate[] = [
    ...textRows.map((r) => ({
      kind: 'text' as const,
      rowId: r.rowId,
      externalId: r.externalId,
      billRowId: r.billRowId,
      legiscanBillId: r.legiscanBillId,
      legiscanSessionId: Number(r.legiscanSessionId),
      mimeId: r.mimeId,
      mime: r.mime,
      sourceUrl: r.sourceUrl,
      hash: r.hash,
      priority: TEXT_PRIORITY[r.typeId ?? 0] ?? 40,
    })),
    ...supplementRows.map((r) => ({
      kind: 'supplement' as const,
      rowId: r.rowId,
      externalId: r.externalId,
      billRowId: r.billRowId,
      legiscanBillId: r.legiscanBillId,
      legiscanSessionId: Number(r.legiscanSessionId),
      mimeId: r.mimeId,
      mime: r.mime,
      sourceUrl: r.sourceUrl,
      hash: r.hash,
      priority: SUPPLEMENT_PRIORITY[r.typeId ?? 0] ?? 15,
    })),
    ...amendmentRows.map((r) => ({
      kind: 'amendment' as const,
      rowId: r.rowId,
      externalId: r.externalId,
      billRowId: r.billRowId,
      legiscanBillId: r.legiscanBillId,
      legiscanSessionId: Number(r.legiscanSessionId),
      mimeId: r.mimeId,
      mime: r.mime,
      sourceUrl: r.sourceUrl,
      hash: r.hash,
      priority: r.adopted ? 25 : 45,
    })),
  ];

  return candidates.sort((a, b) => a.priority - b.priority).slice(0, limit);
}

export async function cacheDocuments(
  db: Database,
  client: LegiScanClient,
  options: { maxDocuments: number; logger?: (message: string) => void },
): Promise<DocumentCacheResult> {
  const result: DocumentCacheResult = {
    fetched: 0,
    stored: 0,
    skipped: 0,
    errors: [],
    notes: [],
  };

  if (options.maxDocuments <= 0) {
    result.notes.push('Document caching disabled for this run.');
    return result;
  }

  if (!isR2Configured()) {
    result.notes.push('R2 is not configured; document metadata was stored without caching blobs.');
    return result;
  }

  const candidates = await collectCandidates(db, options.maxDocuments);
  if (candidates.length === 0) {
    result.notes.push('No new documents needed caching.');
    return result;
  }

  for (const candidate of candidates) {
    // A stored object with this identity means the bytes are already in R2.
    const [existing] = await db
      .select({ id: r2Objects.id })
      .from(r2Objects)
      .where(
        and(
          eq(r2Objects.documentKind, candidate.kind),
          eq(r2Objects.externalDocumentId, candidate.externalId),
        ),
      )
      .limit(1);

    if (existing) {
      await markCached(db, candidate, existing.id);
      result.skipped += 1;
      continue;
    }

    try {
      const document = await fetchDocument(client, candidate.kind, candidate.externalId);
      result.fetched += 1;

      if (document.sourceHash && document.computedHash !== document.sourceHash) {
        result.errors.push({
          stage: 'documents',
          subject: `${candidate.kind}:${candidate.externalId}`,
          message: 'Downloaded document did not match the checksum supplied by LegiScan.',
        });
        continue;
      }

      const objectKey = buildObjectKey({
        sessionId: candidate.legiscanSessionId,
        billId: candidate.legiscanBillId,
        documentKind: candidate.kind,
        documentId: candidate.externalId,
        mimeId: candidate.mimeId,
        mime: candidate.mime,
      });

      const stored = await storeDocument({
        objectKey,
        bytes: document.bytes,
        contentType: document.contentType,
        checksum: document.sourceHash ?? document.computedHash,
        sourceUrl: candidate.sourceUrl,
        externalDocumentId: candidate.externalId,
        documentKind: candidate.kind,
      });

      const [objectRow] = await db
        .insert(r2Objects)
        .values({
          objectKey: stored.objectKey,
          bucket: stored.bucket,
          documentKind: candidate.kind,
          externalDocumentId: candidate.externalId,
          billId: candidate.billRowId,
          contentType: document.contentType,
          sizeBytes: document.sizeBytes,
          checksum: document.sourceHash ?? document.computedHash,
          sourceUrl: candidate.sourceUrl,
        })
        .onConflictDoUpdate({
          target: r2Objects.objectKey,
          set: {
            sizeBytes: document.sizeBytes,
            checksum: document.sourceHash ?? document.computedHash,
            storedAt: new Date(),
          },
        })
        .returning({ id: r2Objects.id });

      await markCached(db, candidate, objectRow!.id);

      if (stored.uploaded) result.stored += 1;
      else result.skipped += 1;

      options.logger?.(
        `Cached ${candidate.kind} ${candidate.externalId} (${document.sizeBytes} bytes)`,
      );
    } catch (error) {
      if (error instanceof R2NotConfiguredError) {
        result.notes.push('R2 became unavailable during the run; caching stopped.');
        break;
      }
      if (error instanceof LegiScanError && error.code === 'budget') {
        result.notes.push('Stopped caching documents to stay inside the query budget.');
        break;
      }
      result.errors.push({
        stage: 'documents',
        subject: `${candidate.kind}:${candidate.externalId}`,
        message: error instanceof Error ? error.message : 'Unknown document error',
      });
    }
  }

  return result;
}

async function markCached(
  db: Database,
  candidate: DocumentCandidate,
  r2ObjectId: number,
): Promise<void> {
  if (candidate.kind === 'text') {
    await db
      .update(billDocuments)
      .set({ isCached: true, r2ObjectId })
      .where(eq(billDocuments.id, candidate.rowId));
  } else if (candidate.kind === 'amendment') {
    await db
      .update(amendments)
      .set({ isCached: true, r2ObjectId })
      .where(eq(amendments.id, candidate.rowId));
  } else {
    await db
      .update(supplements)
      .set({ isCached: true, r2ObjectId })
      .where(eq(supplements.id, candidate.rowId));
  }
}
