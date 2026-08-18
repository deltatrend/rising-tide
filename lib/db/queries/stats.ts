/**
 * Site-wide statistics and data freshness.
 *
 * Every number here is computed from persisted data. If nothing has been
 * synchronized the counts are genuinely zero — they are never invented.
 */

import { and, desc, eq, gte, sql } from 'drizzle-orm';

import { safeQuery } from '../client';
import {
  apiUsage,
  billActions,
  billTopics,
  bills,
  events,
  people,
  rollCalls,
  sessions,
  syncRuns,
  topics,
} from '../schema';
import { col, tbl } from './sql-helpers';
import type { DataFreshness } from './types';

export interface SiteSnapshot {
  trackedBills: number;
  updatedInLast30Days: number;
  upcomingEvents: number;
  recentVotes: number;
  activeTopics: number;
  trackedLegislators: number;
  currentSessionLabel: string | null;
}

export async function getSiteSnapshot(): Promise<SiteSnapshot> {
  return safeQuery<SiteSnapshot>(
    async (db) => {
      const [row] = await db
        .select({
          trackedBills: sql<number>`(
            select count(*)::int from ${tbl(bills)} where ${col(bills.isTracked)} = true
          )`,
          updatedInLast30Days: sql<number>`(
            select count(*)::int from ${tbl(bills)}
            where ${col(bills.isTracked)} = true
              and ${col(bills.lastSourceChangeAt)} >= (now() - interval '30 days')
          )`,
          upcomingEvents: sql<number>`(
            select count(*)::int from ${tbl(events)} where ${col(events.eventDate)} >= current_date
          )`,
          recentVotes: sql<number>`(
            select count(*)::int from ${tbl(rollCalls)}
            join ${tbl(bills)} on ${col(bills.id)} = ${col(rollCalls.billId)}
            where ${col(bills.isTracked)} = true
              and ${col(rollCalls.voteDate)} >= (current_date - interval '90 days')
          )`,
          activeTopics: sql<number>`(
            select count(distinct ${col(billTopics.topicId)})::int from ${tbl(billTopics)}
            join ${tbl(bills)} on ${col(bills.id)} = ${col(billTopics.billId)}
            where ${col(bills.isTracked)} = true
          )`,
          trackedLegislators: sql<number>`(select count(*)::int from ${tbl(people)})`,
        })
        .from(sql`(select 1) as _`);

      const [session] = await db
        .select({ label: sessions.sessionTitle })
        .from(sessions)
        .where(and(eq(sessions.prior, false), eq(sessions.special, false)))
        .orderBy(desc(sessions.yearStart))
        .limit(1);

      return {
        trackedBills: Number(row?.trackedBills ?? 0),
        updatedInLast30Days: Number(row?.updatedInLast30Days ?? 0),
        upcomingEvents: Number(row?.upcomingEvents ?? 0),
        recentVotes: Number(row?.recentVotes ?? 0),
        activeTopics: Number(row?.activeTopics ?? 0),
        trackedLegislators: Number(row?.trackedLegislators ?? 0),
        currentSessionLabel: session?.label ?? null,
      };
    },
    {
      trackedBills: 0,
      updatedInLast30Days: 0,
      upcomingEvents: 0,
      recentVotes: 0,
      activeTopics: 0,
      trackedLegislators: 0,
      currentSessionLabel: null,
    },
    'getSiteSnapshot',
  );
}

export async function getDataFreshness(): Promise<DataFreshness> {
  return safeQuery<DataFreshness>(
    async (db) => {
      const [lastSuccess] = await db
        .select({ completedAt: syncRuns.completedAt, status: syncRuns.status })
        .from(syncRuns)
        .where(sql`${syncRuns.status} in ('success', 'partial')`)
        .orderBy(desc(syncRuns.completedAt))
        .limit(1);

      const [lastAttempt] = await db
        .select({ startedAt: syncRuns.startedAt, status: syncRuns.status })
        .from(syncRuns)
        .orderBy(desc(syncRuns.startedAt))
        .limit(1);

      const [counts] = await db
        .select({ tracked: sql<number>`count(*)::int` })
        .from(bills)
        .where(eq(bills.isTracked, true));

      return {
        lastSuccessfulSyncAt: lastSuccess?.completedAt ?? null,
        lastAttemptedSyncAt: lastAttempt?.startedAt ?? null,
        lastSyncStatus: lastAttempt?.status ?? null,
        trackedBillCount: Number(counts?.tracked ?? 0),
        hasSyncedEver: Boolean(lastSuccess),
      };
    },
    {
      lastSuccessfulSyncAt: null,
      lastAttemptedSyncAt: null,
      lastSyncStatus: null,
      trackedBillCount: 0,
      hasSyncedEver: false,
    },
    'getDataFreshness',
  );
}

export interface SyncRunSummary {
  id: number;
  triggerType: string;
  status: string;
  startedAt: Date;
  completedAt: Date | null;
  queriesConsumed: number;
  billsInserted: number;
  billsUpdated: number;
  billsUnchanged: number;
  candidatesDiscovered: number;
  errorCount: number;
}

export async function getRecentSyncRuns(limit = 10): Promise<SyncRunSummary[]> {
  return safeQuery(
    async (db) => {
      const rows = await db
        .select()
        .from(syncRuns)
        .orderBy(desc(syncRuns.startedAt))
        .limit(limit);

      return rows.map((r) => ({
        id: r.id,
        triggerType: r.triggerType,
        status: r.status,
        startedAt: r.startedAt,
        completedAt: r.completedAt,
        queriesConsumed: r.queriesConsumed,
        billsInserted: r.billsInserted,
        billsUpdated: r.billsUpdated,
        billsUnchanged: r.billsUnchanged,
        candidatesDiscovered: r.candidatesDiscovered,
        errorCount: Array.isArray(r.errors) ? r.errors.length : 0,
      }));
    },
    [] as SyncRunSummary[],
    'getRecentSyncRuns',
  );
}

/** Current-month LegiScan query usage, shown on the methodology page. */
export async function getApiUsageThisMonth(): Promise<{
  used: number;
  limit: number;
  period: string;
} | null> {
  const period = new Date().toISOString().slice(0, 7);

  return safeQuery(
    async (db) => {
      const [row] = await db
        .select()
        .from(apiUsage)
        .where(and(eq(apiUsage.periodMonth, period), eq(apiUsage.provider, 'legiscan')))
        .limit(1);

      if (!row) return { used: 0, limit: 30000, period };
      return { used: row.queriesUsed, limit: row.monthlyLimit, period };
    },
    null,
    'getApiUsageThisMonth',
  );
}

/**
 * Topics with the most official actions in a recent window.
 *
 * Counts rows in `bill_actions`, not `bills.last_action_date`. A 60-day window
 * in August is empty every year — session ended in early June — which made this
 * look broken. The homepage therefore asks for a year.
 */
export async function getMostActiveTopics(
  days = 365,
  limit = 6,
): Promise<{ slug: string; name: string; count: number }[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  return safeQuery(
    async (db) => {
      const rows = await db
        .select({
          slug: topics.slug,
          name: topics.name,
          count: sql<number>`count(*)::int`,
        })
        .from(billActions)
        .innerJoin(bills, eq(bills.id, billActions.billId))
        .innerJoin(billTopics, eq(billTopics.billId, bills.id))
        .innerJoin(topics, eq(topics.id, billTopics.topicId))
        .where(
          and(
            eq(bills.isTracked, true),
            sql`${billActions.actionDate} is not null`,
            gte(billActions.actionDate, since),
          ),
        )
        .groupBy(topics.slug, topics.name)
        .orderBy(desc(sql`count(*)`))
        .limit(limit);

      return rows.map((r) => ({ ...r, count: Number(r.count) }));
    },
    [] as { slug: string; name: string; count: number }[],
    'getMostActiveTopics',
  );
}
