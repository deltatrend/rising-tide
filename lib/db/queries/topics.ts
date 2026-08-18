/** Topic queries. Topic copy itself lives in config/topics.ts, not the database. */

import { and, asc, desc, eq, sql } from 'drizzle-orm';

import { safeQuery } from '../client';
import { billTopics, bills, eventTopics, events, rollCalls, topics } from '../schema';
import { col, tbl } from './sql-helpers';

export interface TopicSummary {
  slug: string;
  name: string;
  shortDescription: string;
  category: string | null;
  sortOrder: number;
  billCount: number;
  activeBillCount: number;
  recentlyChangedCount: number;
  upcomingEventCount: number;
}

export async function listTopicSummaries(): Promise<TopicSummary[]> {
  return safeQuery(
    async (db) => {
      const rows = await db
        .select({
          slug: topics.slug,
          name: topics.name,
          shortDescription: topics.shortDescription,
          category: topics.category,
          sortOrder: topics.sortOrder,
          billCount: sql<number>`(
            select count(*)::int from ${tbl(billTopics)}
            join ${tbl(bills)} on ${col(bills.id)} = ${col(billTopics.billId)}
            where ${col(billTopics.topicId)} = ${col(topics.id)} and ${col(bills.isTracked)} = true
          )`,
          activeBillCount: sql<number>`(
            select count(*)::int from ${tbl(billTopics)}
            join ${tbl(bills)} on ${col(bills.id)} = ${col(billTopics.billId)}
            where ${col(billTopics.topicId)} = ${col(topics.id)}
              and ${col(bills.isTracked)} = true
              and coalesce(${col(bills.statusId)}, 1) not in (4, 5, 6, 8, 11)
          )`,
          recentlyChangedCount: sql<number>`(
            select count(*)::int from ${tbl(billTopics)}
            join ${tbl(bills)} on ${col(bills.id)} = ${col(billTopics.billId)}
            where ${col(billTopics.topicId)} = ${col(topics.id)}
              and ${col(bills.isTracked)} = true
              and ${col(bills.lastSourceChangeAt)} >= (now() - interval '30 days')
          )`,
          upcomingEventCount: sql<number>`(
            select count(*)::int from ${tbl(eventTopics)}
            join ${tbl(events)} on ${col(events.id)} = ${col(eventTopics.eventId)}
            where ${col(eventTopics.topicId)} = ${col(topics.id)} and ${col(events.eventDate)} >= current_date
          )`,
        })
        .from(topics)
        .orderBy(asc(topics.sortOrder));

      return rows.map((r) => ({
        ...r,
        billCount: Number(r.billCount),
        activeBillCount: Number(r.activeBillCount),
        recentlyChangedCount: Number(r.recentlyChangedCount),
        upcomingEventCount: Number(r.upcomingEventCount),
      }));
    },
    [] as TopicSummary[],
    'listTopicSummaries',
  );
}

export async function getTopicRecord(slug: string) {
  return safeQuery(
    async (db) => {
      const [row] = await db.select().from(topics).where(eq(topics.slug, slug)).limit(1);
      return row ?? null;
    },
    null,
    'getTopicRecord',
  );
}

export interface TopicRecentVote {
  rollCallId: number;
  voteDate: string | null;
  description: string | null;
  chamber: string | null;
  yea: number;
  nay: number;
  passed: boolean | null;
  billSlug: string;
  billNumber: string;
  billTitle: string;
}

export async function getRecentVotesForTopic(
  slug: string,
  limit = 5,
): Promise<TopicRecentVote[]> {
  return safeQuery(
    async (db) => {
      const rows = await db
        .select({
          rollCallId: rollCalls.id,
          voteDate: rollCalls.voteDate,
          description: rollCalls.description,
          chamber: rollCalls.chamber,
          yea: rollCalls.yea,
          nay: rollCalls.nay,
          passed: rollCalls.passed,
          billSlug: bills.slug,
          billNumber: bills.billNumber,
          billTitle: bills.title,
        })
        .from(rollCalls)
        .innerJoin(bills, eq(bills.id, rollCalls.billId))
        .innerJoin(billTopics, eq(billTopics.billId, bills.id))
        .innerJoin(topics, eq(topics.id, billTopics.topicId))
        .where(and(eq(topics.slug, slug), eq(bills.isTracked, true)))
        .orderBy(desc(rollCalls.voteDate))
        .limit(limit);
      return rows;
    },
    [] as TopicRecentVote[],
    'getRecentVotesForTopic',
  );
}

/** Recent roll calls across every tracked water bill. */
export async function getRecentVotes(limit = 5): Promise<TopicRecentVote[]> {
  return safeQuery(
    async (db) => {
      const rows = await db
        .select({
          rollCallId: rollCalls.id,
          voteDate: rollCalls.voteDate,
          description: rollCalls.description,
          chamber: rollCalls.chamber,
          yea: rollCalls.yea,
          nay: rollCalls.nay,
          passed: rollCalls.passed,
          billSlug: bills.slug,
          billNumber: bills.billNumber,
          billTitle: bills.title,
        })
        .from(rollCalls)
        .innerJoin(bills, eq(bills.id, rollCalls.billId))
        .where(eq(bills.isTracked, true))
        .orderBy(desc(rollCalls.voteDate))
        .limit(limit);
      return rows;
    },
    [] as TopicRecentVote[],
    'getRecentVotes',
  );
}
