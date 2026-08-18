/**
 * Event queries.
 *
 * The events table is source-agnostic by design. Today every row comes from
 * LegiScan's legislative calendar for bills we track; the same queries will
 * serve additional official meeting feeds without modification.
 */

import { and, asc, desc, eq, gte, inArray, lt, sql, type SQL } from 'drizzle-orm';

import { safeQuery, type Database } from '../client';
import { bills, committees, eventBills, eventTopics, events, topics } from '../schema';
import { col, tbl } from './sql-helpers';
import type { EventListItem, TopicRef } from './types';

export interface EventFilters {
  topic?: string;
  eventType?: string;
  source?: string;
  /** ISO dates bounding the event date. */
  from?: string;
  to?: string;
  when?: 'upcoming' | 'past' | 'all';
  limit?: number;
}

function buildEventWhere(filters: EventFilters, today: string): SQL {
  const clauses: (SQL | undefined)[] = [];

  if (filters.when === 'upcoming' || filters.when === undefined) {
    clauses.push(gte(events.eventDate, today));
  } else if (filters.when === 'past') {
    clauses.push(lt(events.eventDate, today));
  }

  if (filters.from) clauses.push(gte(events.eventDate, filters.from));
  if (filters.to) clauses.push(sql`${events.eventDate} <= ${filters.to}`);
  if (filters.eventType) clauses.push(eq(events.eventType, filters.eventType));
  if (filters.source) clauses.push(eq(events.source, filters.source));

  if (filters.topic) {
    clauses.push(
      sql`exists (
        select 1 from ${tbl(eventTopics)}
        join ${tbl(topics)} on ${col(topics.id)} = ${col(eventTopics.topicId)}
        where ${col(eventTopics.eventId)} = ${col(events.id)} and ${col(topics.slug)} = ${filters.topic}
      )`,
    );
  }

  const filtered = clauses.filter(Boolean) as SQL[];
  return filtered.length > 0 ? (and(...filtered) as SQL) : sql`true`;
}

async function hydrateEvents(
  db: Database,
  rows: {
    id: number;
    title: string;
    eventType: string | null;
    eventTypeId: number | null;
    eventDate: string;
    startTime: string | null;
    endTime: string | null;
    location: string | null;
    description: string | null;
    source: string;
    sourceType: string;
    sourceUrl: string | null;
    isFixture: boolean;
  }[],
): Promise<EventListItem[]> {
  if (rows.length === 0) return [];
  const eventIds = rows.map((r) => r.id);

  const [billRows, topicRows] = await Promise.all([
    db
      .select({
        eventId: eventBills.eventId,
        slug: bills.slug,
        billNumber: bills.billNumber,
        title: bills.title,
      })
      .from(eventBills)
      .innerJoin(bills, eq(bills.id, eventBills.billId))
      .where(inArray(eventBills.eventId, eventIds)),
    db
      .select({ eventId: eventTopics.eventId, slug: topics.slug, name: topics.name })
      .from(eventTopics)
      .innerJoin(topics, eq(topics.id, eventTopics.topicId))
      .where(inArray(eventTopics.eventId, eventIds))
      .orderBy(asc(topics.sortOrder)),
  ]);

  const billsByEvent = new Map<number, { slug: string; billNumber: string; title: string }[]>();
  for (const row of billRows) {
    const list = billsByEvent.get(row.eventId) ?? [];
    list.push({ slug: row.slug, billNumber: row.billNumber, title: row.title });
    billsByEvent.set(row.eventId, list);
  }

  const topicsByEvent = new Map<number, TopicRef[]>();
  for (const row of topicRows) {
    const list = topicsByEvent.get(row.eventId) ?? [];
    list.push({ slug: row.slug, name: row.name });
    topicsByEvent.set(row.eventId, list);
  }

  return rows.map((row) => ({
    ...row,
    bills: billsByEvent.get(row.id) ?? [],
    topics: topicsByEvent.get(row.id) ?? [],
  }));
}

const eventColumns = {
  id: events.id,
  title: events.title,
  eventType: events.eventType,
  eventTypeId: events.eventTypeId,
  eventDate: events.eventDate,
  startTime: events.startTime,
  endTime: events.endTime,
  location: events.location,
  description: events.description,
  source: events.source,
  sourceType: events.sourceType,
  sourceUrl: events.sourceUrl,
  isFixture: events.isFixture,
};

export async function listEvents(filters: EventFilters = {}): Promise<EventListItem[]> {
  const today = new Date().toISOString().slice(0, 10);
  const limit = Math.min(200, filters.limit ?? 50);

  return safeQuery(
    async (db) => {
      const rows = await db
        .select(eventColumns)
        .from(events)
        .where(buildEventWhere(filters, today))
        .orderBy(
          filters.when === 'past' ? desc(events.eventDate) : asc(events.eventDate),
          asc(events.startTime),
        )
        .limit(limit);

      return hydrateEvents(db, rows);
    },
    [] as EventListItem[],
    'listEvents',
  );
}

export async function getUpcomingEvents(limit = 5): Promise<EventListItem[]> {
  return listEvents({ when: 'upcoming', limit });
}

export interface EventFacets {
  eventTypes: { value: string; count: number }[];
  sources: { value: string; count: number }[];
  topics: { slug: string; name: string; count: number }[];
  /** Window totals, so the page can say plainly why a list is empty. */
  upcomingCount: number;
  pastCount: number;
}

/**
 * Counts are scoped to the same time window as the list they sit above.
 * Counting every event ever recorded produces a filter labelled "Hearing (46)"
 * that leads to an empty page whenever the Legislature is out of session.
 */
export async function getEventFacets(when: EventFilters['when'] = 'all'): Promise<EventFacets> {
  const today = new Date().toISOString().slice(0, 10);
  const window = buildEventWhere({ when }, today);

  return safeQuery(
    async (db) => {
      const [typeRows, sourceRows, topicRows, totals] = await Promise.all([
        db
          .select({ value: events.eventType, count: sql<number>`count(*)::int` })
          .from(events)
          .where(window)
          .groupBy(events.eventType),
        db
          .select({ value: events.source, count: sql<number>`count(*)::int` })
          .from(events)
          .where(window)
          .groupBy(events.source),
        db
          .select({ slug: topics.slug, name: topics.name, count: sql<number>`count(*)::int` })
          .from(eventTopics)
          .innerJoin(topics, eq(topics.id, eventTopics.topicId))
          .innerJoin(events, eq(events.id, eventTopics.eventId))
          .where(window)
          .groupBy(topics.slug, topics.name, topics.sortOrder)
          .orderBy(asc(topics.sortOrder)),
        db
          .select({
            upcoming: sql<number>`count(*) filter (where ${events.eventDate} >= ${today})::int`,
            past: sql<number>`count(*) filter (where ${events.eventDate} < ${today})::int`,
          })
          .from(events),
      ]);

      return {
        eventTypes: typeRows
          .filter((r) => r.value)
          .map((r) => ({ value: String(r.value), count: Number(r.count) })),
        sources: sourceRows.map((r) => ({ value: String(r.value), count: Number(r.count) })),
        topics: topicRows.map((r) => ({ ...r, count: Number(r.count) })),
        upcomingCount: Number(totals[0]?.upcoming ?? 0),
        pastCount: Number(totals[0]?.past ?? 0),
      };
    },
    { eventTypes: [], sources: [], topics: [], upcomingCount: 0, pastCount: 0 } as EventFacets,
    'getEventFacets',
  );
}

/** Upcoming events tied to bills in one topic. */
export async function getUpcomingEventsForTopic(
  slug: string,
  limit = 5,
): Promise<EventListItem[]> {
  return listEvents({ topic: slug, when: 'upcoming', limit });
}

/** Upcoming events for bills currently referred to one committee. */
export async function getUpcomingEventsForCommittee(
  committeeSlug: string,
  limit = 5,
): Promise<EventListItem[]> {
  const today = new Date().toISOString().slice(0, 10);

  return safeQuery(
    async (db) => {
      const rows = await db
        .selectDistinct(eventColumns)
        .from(events)
        .innerJoin(eventBills, eq(eventBills.eventId, events.id))
        .innerJoin(bills, eq(bills.id, eventBills.billId))
        .innerJoin(committees, eq(committees.id, bills.pendingCommitteeId))
        .where(
          and(
            gte(events.eventDate, today),
            eq(bills.isTracked, true),
            eq(committees.slug, committeeSlug),
          ),
        )
        .orderBy(asc(events.eventDate))
        .limit(limit);

      return hydrateEvents(db, rows);
    },
    [] as EventListItem[],
    'getUpcomingEventsForCommittee',
  );
}
