/**
 * The one synchronization implementation. The cron route and the CLI both call
 * `runLegiScanSync` — neither contains any ingestion logic of its own.
 *
 * Query-cost shape of a normal daily run:
 *   1                 getSessionList
 *   ~24-48            getSearch (configured searches x capped pages)
 *   0-150             getBill (only for new or changed candidates)
 *   0-40              getRollcall (only for votes we have never stored)
 *   0-10              document downloads (only for uncached documents)
 *
 * A visitor loading any page causes zero LegiScan requests. Everything the site
 * renders comes from Postgres.
 */

import { and, eq, sql } from 'drizzle-orm';

import { CANDIDATE_SEARCHES, CLASSIFIER_VERSION } from '@/config/water-taxonomy';
import { classifyBill, prescreenCandidate, resolveTracking } from '@/lib/classification';
import { getDb, type Database } from '@/lib/db/client';
import { apiUsage, bills, syncRuns } from '@/lib/db/schema';
import {
  LegiScanClient,
  LegiScanError,
  QueryBudget,
  deduplicateSearchResults,
  fetchBill,
  fetchRollCall,
  fetchSessionList,
  searchSessionPaged,
  selectCurrentSession,
  partitionByChangeHash,
  type LegiScanSearchResult,
} from '@/lib/legiscan';
import { cacheDocuments } from './documents';
import {
  findRollCallsNeedingVotes,
  loadActiveOverride,
  loadPeopleIdMap,
  loadStoredChangeHashes,
  persistBill,
  persistIndividualVotes,
  upsertSession,
  type SessionRow,
} from './persist';
import { SYNC_DEFAULTS, type SyncError, type SyncOptions, type SyncResult } from './types';

/** LegiScan's own relevance is trusted enough to justify a detail fetch. */
const HIGH_RELEVANCE_FLOOR = 75;

export async function runLegiScanSync(options: SyncOptions): Promise<SyncResult> {
  const startedAt = new Date();
  const log = options.logger ?? (() => {});
  const errors: SyncError[] = [];
  const notes: string[] = [];

  const maxQueries = options.maxQueries ?? SYNC_DEFAULTS.maxQueries;
  const maxBillFetches = options.maxBillFetches ?? SYNC_DEFAULTS.maxBillFetches;
  const maxRollCallFetches = options.maxRollCallFetches ?? SYNC_DEFAULTS.maxRollCallFetches;
  const maxDocumentFetches = options.maxDocumentFetches ?? SYNC_DEFAULTS.maxDocumentFetches;

  const db = getDb();
  const period = startedAt.toISOString().slice(0, 7);
  const monthlyUsed = await readMonthlyUsage(db, period);

  const budget = new QueryBudget({ maxQueriesPerRun: maxQueries, monthlyUsed });

  log(
    `Query budget: ${maxQueries} for this run; ${monthlyUsed} of 30,000 already used in ${period}.`,
  );

  if (!budget.canAfford(1)) {
    notes.push('Monthly LegiScan budget is exhausted; the run stopped before making any request.');
    return buildResult({
      runId: null,
      status: 'skipped',
      options,
      startedAt,
      session: null,
      budget,
      monthlyUsed,
      stats: emptyStats(),
      errors,
      notes,
    });
  }

  const client = new LegiScanClient({ budget, logger: log });

  const stats = emptyStats();
  let runId: number | null = null;
  let sessionRow: SessionRow | null = null;

  if (!options.dryRun) {
    const [row] = await db
      .insert(syncRuns)
      .values({
        triggerType: options.trigger,
        status: 'running',
        startedAt,
        classifierVersion: CLASSIFIER_VERSION,
      })
      .returning({ id: syncRuns.id });
    runId = row?.id ?? null;
  }

  try {
    /* --- 1. Session ----------------------------------------------------- */
    const sessionList = await fetchSessionList(client);
    const current = selectCurrentSession(sessionList);

    if (!current) {
      throw new LegiScanError('api', 'getSessionList', 'No New York sessions were returned.');
    }

    if (!options.dryRun) {
      // Every session is preserved so historical URLs keep working.
      for (const session of sessionList) {
        const row = await upsertSession(db, session);
        if (session.session_id === current.session_id) sessionRow = row;
      }
    } else {
      sessionRow = {
        id: -1,
        yearStart: current.year_start,
        legiscanSessionId: current.session_id,
        label: current.session_title ?? `${current.year_start}-${current.year_end}`,
      };
    }

    log(`Current New York session: ${sessionRow?.label} (LegiScan id ${current.session_id}).`);

    /* --- 2. Candidate discovery ----------------------------------------- */
    const discovered: LegiScanSearchResult[] = [];

    for (const search of CANDIDATE_SEARCHES) {
      if (!budget.canAfford(1)) {
        notes.push('Discovery stopped early to stay inside the query budget.');
        break;
      }

      try {
        const { results, pagesFetched, truncated } = await searchSessionPaged(client, {
          sessionId: current.session_id,
          query: search.query,
          maxPages: search.maxPages,
          minRelevance: search.minRelevance,
          onError: (error) => errors.push(error.toStructured()),
        });

        discovered.push(...results);
        log(`Search "${search.id}": ${results.length} candidates from ${pagesFetched} page(s).`);
        if (truncated) {
          notes.push(`Search "${search.id}" had more pages than the configured cap.`);
        }
      } catch (error) {
        if (error instanceof LegiScanError && error.code === 'budget') {
          notes.push('Discovery stopped: query budget reached.');
          break;
        }
        errors.push({
          stage: 'discovery',
          subject: search.id,
          message: error instanceof Error ? error.message : 'Unknown search error',
        });
      }
    }

    const candidates = deduplicateSearchResults(discovered);
    stats.candidatesDiscovered = candidates.length;
    log(`${discovered.length} raw results reduced to ${candidates.length} unique bills.`);

    /* --- 3. Change-hash comparison -------------------------------------- */
    const filtered = options.onlyBillIds
      ? candidates.filter((c) => options.onlyBillIds!.includes(c.bill_id))
      : candidates;

    const storedHashes = options.dryRun
      ? new Map<number, string | null>()
      : await loadStoredChangeHashes(
          db,
          filtered.map((c) => c.bill_id),
        );

    const { changed, unchanged } = partitionByChangeHash(
      filtered.map((c) => ({ billId: c.bill_id, changeHash: c.change_hash, source: c })),
      storedHashes,
    );

    stats.billsUnchanged = unchanged.length;
    log(`${unchanged.length} unchanged, ${changed.length} new or changed.`);

    /* --- 4. Pre-screen before spending detail queries -------------------- */
    const worthFetching = changed.filter((candidate) => {
      const title = candidate.source.title ?? '';
      const relevance = candidate.source.relevance ?? 0;
      if (relevance >= HIGH_RELEVANCE_FLOOR) return true;
      return prescreenCandidate(title, candidate.source.last_action).passes;
    });

    const toFetch = worthFetching.slice(0, maxBillFetches);
    if (worthFetching.length > toFetch.length) {
      notes.push(
        `${worthFetching.length - toFetch.length} changed bills were deferred to the next run by the per-run detail cap.`,
      );
    }

    log(`Fetching detail for ${toFetch.length} bill(s).`);

    if (options.dryRun) {
      notes.push('Dry run: no detail fetches, no classification and no writes were performed.');
      return buildResult({
        runId,
        status: 'success',
        options,
        startedAt,
        session: sessionRow,
        budget,
        monthlyUsed,
        stats,
        errors,
        notes,
      });
    }

    /* --- 5. Detail fetch, classify, persist ----------------------------- */
    const touchedBillRowIds: number[] = [];

    for (const candidate of toFetch) {
      if (!budget.canAfford(1)) {
        notes.push('Detail fetching stopped: query budget reached.');
        break;
      }

      try {
        const payload = await fetchBill(client, candidate.billId);

        const classification = await classifyBill({
          billNumber: payload.bill_number,
          title: payload.title,
          description: payload.description,
          subjects: payload.subjects.map((s) => s.subject_name).filter(Boolean) as string[],
          committeeName: extractCommitteeName(payload),
        });

        const override = await loadActiveOverride(db, candidate.billId);
        const tracking = resolveTracking(classification, override);

        if (!tracking.isTracked) {
          // Rejected bills are still stored (hash only) so the next run knows
          // they are unchanged and never re-fetches them.
          const result = await persistBill(db, {
            payload,
            classification,
            session: sessionRow!,
            isTracked: false,
          });
          stats.billsRejected += 1;
          if (result.inserted) stats.billsInserted += 1;
          continue;
        }

        const result = await persistBill(db, {
          payload,
          classification,
          session: sessionRow!,
          isTracked: true,
        });

        touchedBillRowIds.push(result.billRowId);
        stats.eventsUpserted += result.eventsUpserted;

        if (result.inserted) stats.billsInserted += 1;
        else if (result.sourceChanged) stats.billsUpdated += 1;
        else stats.billsUnchanged += 1;
      } catch (error) {
        if (error instanceof LegiScanError && error.code === 'budget') {
          notes.push('Detail fetching stopped: query budget reached.');
          break;
        }
        // One bad bill must never end the run.
        errors.push({
          stage: 'bill',
          subject: `bill:${candidate.billId}`,
          message: error instanceof Error ? error.message : 'Unknown bill error',
        });
      }
    }

    /* --- 6. Roll calls --------------------------------------------------- */
    if (maxRollCallFetches > 0 && touchedBillRowIds.length > 0) {
      const pending = (await findRollCallsNeedingVotes(db, touchedBillRowIds)).slice(
        0,
        maxRollCallFetches,
      );

      for (const rollCall of pending) {
        if (!budget.canAfford(1)) {
          notes.push('Roll-call synchronization stopped: query budget reached.');
          break;
        }

        try {
          const payload = await fetchRollCall(client, rollCall.legiscanRollCallId);
          const peopleMap = await loadPeopleIdMap(
            db,
            payload.votes.map((v) => v.people_id),
          );
          const stored = await persistIndividualVotes(db, rollCall.id, payload, peopleMap);
          if (stored > 0) stats.rollCallsUpdated += 1;
        } catch (error) {
          if (error instanceof LegiScanError && error.code === 'budget') {
            notes.push('Roll-call synchronization stopped: query budget reached.');
            break;
          }
          errors.push({
            stage: 'rollcall',
            subject: `rollcall:${rollCall.legiscanRollCallId}`,
            message: error instanceof Error ? error.message : 'Unknown roll-call error',
          });
        }
      }
    }

    /* --- 7. Documents into R2 ------------------------------------------- */
    const documentResult = await cacheDocuments(db, client, {
      maxDocuments: maxDocumentFetches,
      logger: log,
    });
    stats.documentsFetched = documentResult.fetched;
    stats.documentsStored = documentResult.stored;
    errors.push(...documentResult.errors);
    notes.push(...documentResult.notes);

    /* --- 8. Record usage ------------------------------------------------- */
    await recordUsage(db, period, budget.used);

    const status: SyncResult['status'] = errors.length > 0 ? 'partial' : 'success';
    const result = buildResult({
      runId,
      status,
      options,
      startedAt,
      session: sessionRow,
      budget,
      monthlyUsed,
      stats,
      errors,
      notes,
    });

    await finalizeRun(db, runId, result, sessionRow);
    log(
      `Finished: ${budget.used} queries used, ${stats.billsInserted} inserted, ${stats.billsUpdated} updated, ${stats.billsRejected} not water-related.`,
    );
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown synchronization error';
    errors.push({ stage: 'run', message });

    await recordUsage(db, period, budget.used).catch(() => {});

    const result = buildResult({
      runId,
      status: 'failed',
      options,
      startedAt,
      session: sessionRow,
      budget,
      monthlyUsed,
      stats,
      errors,
      notes,
    });

    await finalizeRun(db, runId, result, sessionRow).catch(() => {});
    return result;
  }
}

/* ------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* ------------------------------------------------------------------------- */

function extractCommitteeName(payload: {
  committee?: unknown;
}): string | null {
  const committee = payload.committee;
  if (!committee || Array.isArray(committee) || typeof committee !== 'object') return null;
  const record = committee as { name?: string | null; committee_name?: string | null };
  return record.name ?? record.committee_name ?? null;
}

interface Stats {
  candidatesDiscovered: number;
  billsInserted: number;
  billsUpdated: number;
  billsUnchanged: number;
  billsRejected: number;
  rollCallsUpdated: number;
  eventsUpserted: number;
  documentsFetched: number;
  documentsStored: number;
}

function emptyStats(): Stats {
  return {
    candidatesDiscovered: 0,
    billsInserted: 0,
    billsUpdated: 0,
    billsUnchanged: 0,
    billsRejected: 0,
    rollCallsUpdated: 0,
    eventsUpserted: 0,
    documentsFetched: 0,
    documentsStored: 0,
  };
}

function buildResult(input: {
  runId: number | null;
  status: SyncResult['status'];
  options: SyncOptions;
  startedAt: Date;
  session: SessionRow | null;
  budget: QueryBudget;
  monthlyUsed: number;
  stats: Stats;
  errors: SyncError[];
  notes: string[];
}): SyncResult {
  const completedAt = new Date();

  return {
    runId: input.runId,
    status: input.status,
    trigger: input.options.trigger,
    startedAt: input.startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    durationMs: completedAt.getTime() - input.startedAt.getTime(),
    sessionLabel: input.session?.label ?? null,
    legiscanSessionId: input.session?.legiscanSessionId ?? null,
    classifierVersion: CLASSIFIER_VERSION,
    queriesConsumed: input.budget.used,
    queryBudget: {
      maxQueriesPerRun: input.budget.maxQueriesPerRun,
      monthlyUsedBefore: input.monthlyUsed,
      monthlyRemainingAfter: input.budget.remainingThisMonth,
    },
    ...input.stats,
    errors: input.errors,
    notes: input.notes,
  };
}

async function readMonthlyUsage(db: Database, period: string): Promise<number> {
  try {
    const [row] = await db
      .select({ used: apiUsage.queriesUsed })
      .from(apiUsage)
      .where(and(eq(apiUsage.periodMonth, period), eq(apiUsage.provider, 'legiscan')))
      .limit(1);
    return row?.used ?? 0;
  } catch {
    // If usage cannot be read we still enforce the per-run cap.
    return 0;
  }
}

async function recordUsage(db: Database, period: string, used: number): Promise<void> {
  if (used <= 0) return;

  await db
    .insert(apiUsage)
    .values({ periodMonth: period, provider: 'legiscan', queriesUsed: used })
    .onConflictDoUpdate({
      target: apiUsage.periodMonth,
      set: {
        queriesUsed: sql`${apiUsage.queriesUsed} + ${used}`,
        updatedAt: new Date(),
      },
    });
}

async function finalizeRun(
  db: Database,
  runId: number | null,
  result: SyncResult,
  session: SessionRow | null,
): Promise<void> {
  if (!runId) return;

  await db
    .update(syncRuns)
    .set({
      status: result.status,
      completedAt: new Date(result.completedAt),
      durationMs: result.durationMs,
      sessionId: session && session.id > 0 ? session.id : null,
      classifierVersion: result.classifierVersion,
      queriesConsumed: result.queriesConsumed,
      candidatesDiscovered: result.candidatesDiscovered,
      billsInserted: result.billsInserted,
      billsUpdated: result.billsUpdated,
      billsUnchanged: result.billsUnchanged,
      billsRejected: result.billsRejected,
      rollCallsUpdated: result.rollCallsUpdated,
      eventsUpserted: result.eventsUpserted,
      documentsFetched: result.documentsFetched,
      documentsStored: result.documentsStored,
      errors: result.errors,
      notes: result.notes.join(' ') || null,
    })
    .where(eq(syncRuns.id, runId));
}

/** Convenience used by the developer override script. */
export async function countTrackedBills(): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(bills)
    .where(eq(bills.isTracked, true));
  return Number(row?.total ?? 0);
}
