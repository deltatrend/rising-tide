/**
 * Bill queries.
 *
 * Everything here reads our own Postgres — no page render ever contacts
 * LegiScan. Filters map 1:1 onto URL search parameters so any view is shareable.
 */

import { and, asc, desc, eq, gte, inArray, or, sql, type SQL } from 'drizzle-orm';

import { statusIdsForBucket, type StatusBucket } from '@/lib/legiscan/enums';
import { getDb, safeQuery, type Database } from '../client';
import { col, tbl } from './sql-helpers';
import {
  billActions,
  billClassifications,
  billCommitteeReferrals,
  billDocuments,
  billSponsors,
  billTopics,
  bills,
  amendments,
  classificationOverrides,
  committees,
  eventBills,
  events,
  individualVotes,
  people,
  relatedBills,
  rollCalls,
  sessions,
  supplements,
  topics,
} from '../schema';
import type {
  BillListItem,
  CommitteeRef,
  Paginated,
  PersonRef,
  TopicRef,
} from './types';

/* ------------------------------------------------------------------------- */
/* Filters                                                                    */
/* ------------------------------------------------------------------------- */

export type BillSort = 'updated' | 'introduced' | 'relevance' | 'number';

export interface BillFilters {
  topic?: string;
  status?: StatusBucket;
  chamber?: 'S' | 'A';
  committee?: string;
  sponsor?: string;
  q?: string;
  /** ISO date; keeps bills whose last action is on or after it. */
  since?: string;
  hasUpcomingEvent?: boolean;
  hasVotes?: boolean;
  sort?: BillSort;
  page?: number;
  perPage?: number;
}

export const DEFAULT_PER_PAGE = 20;

function buildWhere(filters: BillFilters): SQL {
  const clauses: (SQL | undefined)[] = [eq(bills.isTracked, true)];

  if (filters.topic) {
    clauses.push(
      sql`exists (
        select 1 from ${tbl(billTopics)}
        join ${tbl(topics)} on ${col(topics.id)} = ${col(billTopics.topicId)}
        where ${col(billTopics.billId)} = ${col(bills.id)} and ${col(topics.slug)} = ${filters.topic}
      )`,
    );
  }

  if (filters.status) {
    const ids = statusIdsForBucket(filters.status);
    if (ids.length > 0) clauses.push(inArray(bills.statusId, ids));
  }

  if (filters.chamber) {
    // Assembly bills appear as A (and occasionally H) in LegiScan payloads.
    const codes = filters.chamber === 'A' ? ['A', 'H'] : ['S'];
    clauses.push(inArray(bills.currentBody, codes));
  }

  if (filters.committee) {
    clauses.push(
      sql`(exists (
        select 1 from ${tbl(billCommitteeReferrals)}
        join ${tbl(committees)} on ${col(committees.id)} = ${col(billCommitteeReferrals.committeeId)}
        where ${col(billCommitteeReferrals.billId)} = ${col(bills.id)} and ${col(committees.slug)} = ${filters.committee}
      ) or exists (
        select 1 from ${tbl(committees)}
        where ${col(committees.id)} = ${col(bills.pendingCommitteeId)} and ${col(committees.slug)} = ${filters.committee}
      ))`,
    );
  }

  if (filters.sponsor) {
    clauses.push(
      sql`exists (
        select 1 from ${tbl(billSponsors)}
        join ${tbl(people)} on ${col(people.id)} = ${col(billSponsors.personId)}
        where ${col(billSponsors.billId)} = ${col(bills.id)} and ${col(people.slug)} = ${filters.sponsor}
      )`,
    );
  }

  if (filters.since) {
    clauses.push(gte(bills.lastActionDate, filters.since));
  }

  if (filters.hasUpcomingEvent) {
    clauses.push(
      sql`exists (
        select 1 from ${tbl(eventBills)}
        join ${tbl(events)} on ${col(events.id)} = ${col(eventBills.eventId)}
        where ${col(eventBills.billId)} = ${col(bills.id)} and ${col(events.eventDate)} >= current_date
      )`,
    );
  }

  if (filters.hasVotes) {
    clauses.push(
      sql`exists (
        select 1 from ${tbl(rollCalls)} where ${col(rollCalls.billId)} = ${col(bills.id)}
      )`,
    );
  }

  if (filters.q && filters.q.trim().length > 0) {
    const term = filters.q.trim();
    const like = `%${term.replace(/[%_]/g, (m) => `\\${m}`)}%`;
    clauses.push(
      or(
        sql`to_tsvector('english', ${bills.billNumber} || ' ' || ${bills.title} || ' ' || coalesce(${bills.description}, '')) @@ plainto_tsquery('english', ${term})`,
        sql`${bills.billNumber} ilike ${like}`,
        sql`${bills.title} ilike ${like}`,
        sql`exists (
          select 1 from ${tbl(billSponsors)}
          join ${tbl(people)} on ${col(people.id)} = ${col(billSponsors.personId)}
          where ${col(billSponsors.billId)} = ${col(bills.id)} and ${col(people.name)} ilike ${like}
        )`,
        sql`exists (
          select 1 from ${tbl(billTopics)}
          join ${tbl(topics)} on ${col(topics.id)} = ${col(billTopics.topicId)}
          where ${col(billTopics.billId)} = ${col(bills.id)} and ${col(topics.name)} ilike ${like}
        )`,
        sql`exists (
          select 1 from ${tbl(committees)}
          where ${col(committees.id)} = ${col(bills.pendingCommitteeId)} and ${col(committees.name)} ilike ${like}
        )`,
      ),
    );
  }

  return and(...clauses.filter(Boolean)) as SQL;
}

function buildOrder(sort: BillSort = 'updated'): SQL[] {
  switch (sort) {
    case 'introduced':
      return [sql`${bills.introducedOn} desc nulls last`, desc(bills.id)];
    case 'relevance':
      return [sql`${bills.relevanceScore} desc nulls last`, desc(bills.lastActionDate)];
    case 'number':
      return [asc(bills.billNumber)];
    case 'updated':
    default:
      return [
        sql`greatest(coalesce(${bills.lastSourceChangeAt}, ${bills.firstSeenAt}), coalesce(${bills.lastActionDate}::timestamptz, ${bills.firstSeenAt})) desc`,
        desc(bills.id),
      ];
  }
}

/* ------------------------------------------------------------------------- */
/* List                                                                       */
/* ------------------------------------------------------------------------- */

const listColumns = {
  id: bills.id,
  slug: bills.slug,
  billNumber: bills.billNumber,
  title: bills.title,
  description: bills.description,
  statusId: bills.statusId,
  statusDate: bills.statusDate,
  lastAction: bills.lastAction,
  lastActionDate: bills.lastActionDate,
  introducedOn: bills.introducedOn,
  body: bills.body,
  currentBody: bills.currentBody,
  relevanceScore: bills.relevanceScore,
  lastSyncedAt: bills.lastSyncedAt,
  lastSourceChangeAt: bills.lastSourceChangeAt,
  isFixture: bills.isFixture,
  sessionLabel: sessions.sessionTitle,
  committeeSlug: committees.slug,
  committeeName: committees.name,
  committeeChamber: committees.chamber,
  sponsorCount: sql<number>`(
    select count(*)::int from ${tbl(billSponsors)}
    where ${col(billSponsors.billId)} = ${col(bills.id)}
  )`,
  rollCallCount: sql<number>`(
    select count(*)::int from ${tbl(rollCalls)}
    where ${col(rollCalls.billId)} = ${col(bills.id)}
  )`,
  upcomingEventCount: sql<number>`(
    select count(*)::int from ${tbl(eventBills)}
    join ${tbl(events)} on ${col(events.id)} = ${col(eventBills.eventId)}
    where ${col(eventBills.billId)} = ${col(bills.id)} and ${col(events.eventDate)} >= current_date
  )`,
};

type ListRow = {
  [K in keyof typeof listColumns]: unknown;
};

async function hydrate(db: Database, rows: ListRow[]): Promise<BillListItem[]> {
  const billIds = rows.map((r) => Number(r.id));
  if (billIds.length === 0) return [];

  const [topicRows, sponsorRows] = await Promise.all([
    db
      .select({
        billId: billTopics.billId,
        slug: topics.slug,
        name: topics.name,
        isPrimary: billTopics.isPrimary,
        score: billTopics.score,
      })
      .from(billTopics)
      .innerJoin(topics, eq(topics.id, billTopics.topicId))
      .where(inArray(billTopics.billId, billIds))
      .orderBy(desc(billTopics.isPrimary), desc(billTopics.score)),
    db
      .select({
        billId: billSponsors.billId,
        slug: people.slug,
        name: people.name,
        party: people.party,
        partyId: people.partyId,
        role: people.role,
        roleId: people.roleId,
        district: people.district,
        sponsorTypeId: billSponsors.sponsorTypeId,
        sponsorOrder: billSponsors.sponsorOrder,
      })
      .from(billSponsors)
      .innerJoin(people, eq(people.id, billSponsors.personId))
      .where(inArray(billSponsors.billId, billIds))
      .orderBy(asc(billSponsors.sponsorOrder)),
  ]);

  const topicsByBill = new Map<number, TopicRef[]>();
  for (const row of topicRows) {
    const list = topicsByBill.get(row.billId) ?? [];
    list.push({ slug: row.slug, name: row.name, isPrimary: row.isPrimary });
    topicsByBill.set(row.billId, list);
  }

  const leadByBill = new Map<number, PersonRef>();
  for (const row of sponsorRows) {
    if (leadByBill.has(row.billId)) continue;
    // Sponsor type 1 is the lead sponsor; otherwise fall back to sponsor order.
    if (row.sponsorTypeId === 1 || !sponsorRows.some((s) => s.billId === row.billId && s.sponsorTypeId === 1)) {
      leadByBill.set(row.billId, {
        slug: row.slug,
        name: row.name,
        party: row.party,
        partyId: row.partyId,
        role: row.role,
        roleId: row.roleId,
        district: row.district,
      });
    }
  }

  return rows.map((row) => {
    const id = Number(row.id);
    const committee: CommitteeRef | null = row.committeeSlug
      ? {
          slug: String(row.committeeSlug),
          name: String(row.committeeName),
          chamber: (row.committeeChamber as string | null) ?? null,
        }
      : null;

    return {
      id,
      slug: String(row.slug),
      billNumber: String(row.billNumber),
      title: String(row.title),
      description: (row.description as string | null) ?? null,
      statusId: (row.statusId as number | null) ?? null,
      statusDate: (row.statusDate as string | null) ?? null,
      lastAction: (row.lastAction as string | null) ?? null,
      lastActionDate: (row.lastActionDate as string | null) ?? null,
      introducedOn: (row.introducedOn as string | null) ?? null,
      body: (row.body as string | null) ?? null,
      currentBody: (row.currentBody as string | null) ?? null,
      relevanceScore: (row.relevanceScore as number | null) ?? null,
      lastSyncedAt: row.lastSyncedAt as Date,
      lastSourceChangeAt: (row.lastSourceChangeAt as Date | null) ?? null,
      isFixture: Boolean(row.isFixture),
      sessionLabel: (row.sessionLabel as string | null) ?? null,
      committee,
      topics: topicsByBill.get(id) ?? [],
      sponsorCount: Number(row.sponsorCount ?? 0),
      leadSponsor: leadByBill.get(id) ?? null,
      rollCallCount: Number(row.rollCallCount ?? 0),
      upcomingEventCount: Number(row.upcomingEventCount ?? 0),
    };
  });
}

export async function listBills(filters: BillFilters = {}): Promise<Paginated<BillListItem>> {
  const page = Math.max(1, filters.page ?? 1);
  const perPage = Math.min(100, Math.max(1, filters.perPage ?? DEFAULT_PER_PAGE));

  return safeQuery<Paginated<BillListItem>>(
    async (db) => {
      const where = buildWhere(filters);

      const [countRow] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(bills)
        .where(where);

      const total = Number(countRow?.total ?? 0);

      const rows = await db
        .select(listColumns)
        .from(bills)
        .leftJoin(sessions, eq(sessions.id, bills.sessionId))
        .leftJoin(committees, eq(committees.id, bills.pendingCommitteeId))
        .where(where)
        .orderBy(...buildOrder(filters.sort))
        .limit(perPage)
        .offset((page - 1) * perPage);

      return {
        items: await hydrate(db, rows as ListRow[]),
        total,
        page,
        perPage,
        totalPages: Math.max(1, Math.ceil(total / perPage)),
      };
    },
    { items: [], total: 0, page, perPage, totalPages: 1 },
    'listBills',
  );
}

/** Small helper for homepage/topic modules that need a handful of bills. */
export async function listBillsCompact(
  filters: BillFilters,
  limit: number,
): Promise<BillListItem[]> {
  const result = await listBills({ ...filters, page: 1, perPage: limit });
  return result.items;
}

/* ------------------------------------------------------------------------- */
/* Facets for the explorer filter UI                                          */
/* ------------------------------------------------------------------------- */

export interface BillFacets {
  topics: { slug: string; name: string; count: number }[];
  committees: { slug: string; name: string; chamber: string | null; count: number }[];
  sponsors: { slug: string; name: string; party: string | null; count: number }[];
  statuses: { bucket: StatusBucket; count: number }[];
  chambers: { code: string; count: number }[];
  totalTracked: number;
}

export async function getBillFacets(): Promise<BillFacets> {
  return safeQuery<BillFacets>(
    async (db) => {
      const [topicRows, committeeRows, sponsorRows, statusRows, chamberRows, totalRow] =
        await Promise.all([
          db
            .select({
              slug: topics.slug,
              name: topics.name,
              count: sql<number>`count(*)::int`,
            })
            .from(billTopics)
            .innerJoin(topics, eq(topics.id, billTopics.topicId))
            .innerJoin(bills, eq(bills.id, billTopics.billId))
            .where(eq(bills.isTracked, true))
            .groupBy(topics.slug, topics.name, topics.sortOrder)
            .orderBy(asc(topics.sortOrder)),
          db
            .select({
              slug: committees.slug,
              name: committees.name,
              chamber: committees.chamber,
              count: sql<number>`count(*)::int`,
            })
            .from(bills)
            .innerJoin(committees, eq(committees.id, bills.pendingCommitteeId))
            .where(eq(bills.isTracked, true))
            .groupBy(committees.slug, committees.name, committees.chamber)
            .orderBy(desc(sql`count(*)`)),
          db
            .select({
              slug: people.slug,
              name: people.name,
              party: people.party,
              count: sql<number>`count(*)::int`,
            })
            .from(billSponsors)
            .innerJoin(people, eq(people.id, billSponsors.personId))
            .innerJoin(bills, eq(bills.id, billSponsors.billId))
            .where(and(eq(bills.isTracked, true), eq(billSponsors.sponsorTypeId, 1)))
            .groupBy(people.slug, people.name, people.party)
            .orderBy(desc(sql`count(*)`))
            .limit(60),
          db
            .select({ statusId: bills.statusId, count: sql<number>`count(*)::int` })
            .from(bills)
            .where(eq(bills.isTracked, true))
            .groupBy(bills.statusId),
          db
            .select({ code: bills.currentBody, count: sql<number>`count(*)::int` })
            .from(bills)
            .where(eq(bills.isTracked, true))
            .groupBy(bills.currentBody),
          db
            .select({ total: sql<number>`count(*)::int` })
            .from(bills)
            .where(eq(bills.isTracked, true)),
        ]);

      const bucketCounts = new Map<StatusBucket, number>();
      for (const row of statusRows) {
        for (const bucket of ['early', 'moving', 'passed', 'ended'] as StatusBucket[]) {
          if (row.statusId !== null && statusIdsForBucket(bucket).includes(row.statusId)) {
            bucketCounts.set(bucket, (bucketCounts.get(bucket) ?? 0) + Number(row.count));
          }
        }
      }

      return {
        topics: topicRows.map((r) => ({ ...r, count: Number(r.count) })),
        committees: committeeRows.map((r) => ({ ...r, count: Number(r.count) })),
        sponsors: sponsorRows.map((r) => ({ ...r, count: Number(r.count) })),
        statuses: [...bucketCounts.entries()].map(([bucket, count]) => ({ bucket, count })),
        chambers: chamberRows
          .filter((r) => r.code)
          .map((r) => ({ code: String(r.code), count: Number(r.count) })),
        totalTracked: Number(totalRow[0]?.total ?? 0),
      };
    },
    {
      topics: [],
      committees: [],
      sponsors: [],
      statuses: [],
      chambers: [],
      totalTracked: 0,
    },
    'getBillFacets',
  );
}

/* ------------------------------------------------------------------------- */
/* Detail                                                                     */
/* ------------------------------------------------------------------------- */

export interface BillDetail {
  bill: {
    id: number;
    slug: string;
    legiscanBillId: number;
    billNumber: string;
    title: string;
    description: string | null;
    billType: string | null;
    billTypeId: number | null;
    body: string | null;
    currentBody: string | null;
    statusId: number | null;
    statusDate: string | null;
    lastAction: string | null;
    lastActionDate: string | null;
    introducedOn: string | null;
    legiscanUrl: string | null;
    stateUrl: string | null;
    relevanceScore: number | null;
    lastSyncedAt: Date;
    lastSourceChangeAt: Date | null;
    firstSeenAt: Date;
    isFixture: boolean;
    plainLanguageSummary: string | null;
    whyItMatters: string | null;
    advocacyNote: string | null;
    subjects: { subjectId: number; name: string }[] | null;
    progress: { date: string | null; event: number | null }[] | null;
  };
  session: { label: string | null; yearStart: number; yearEnd: number } | null;
  committee: CommitteeRef | null;
  topics: TopicRef[];
  classification: {
    reason: string;
    score: number;
    relevant: boolean;
    classifierVersion: string;
    classifiedAt: Date;
  } | null;
  override: { decision: 'include' | 'exclude'; reason: string; createdAt: Date } | null;
  actions: {
    id: number;
    sequence: number;
    actionDate: string | null;
    action: string;
    chamber: string | null;
    isMajor: boolean;
  }[];
  sponsors: (PersonRef & { sponsorTypeId: number | null; sponsorOrder: number | null })[];
  referrals: { committee: CommitteeRef; referredOn: string | null }[];
  rollCalls: {
    id: number;
    legiscanRollCallId: number;
    voteDate: string | null;
    description: string | null;
    chamber: string | null;
    yea: number;
    nay: number;
    notVoting: number;
    absent: number;
    total: number;
    passed: boolean | null;
    legiscanUrl: string | null;
    stateUrl: string | null;
    hasIndividualVotes: boolean;
    votes: { name: string; slug: string; party: string | null; district: string | null; voteId: number; voteText: string }[];
  }[];
  documents: {
    id: number;
    legiscanDocId: number;
    versionType: string | null;
    versionTypeId: number | null;
    documentDate: string | null;
    mimeType: string | null;
    mimeId: number | null;
    sizeBytes: number | null;
    legiscanUrl: string | null;
    stateUrl: string | null;
    isCached: boolean;
  }[];
  amendments: {
    id: number;
    legiscanAmendmentId: number;
    adopted: boolean;
    chamber: string | null;
    amendmentDate: string | null;
    title: string | null;
    description: string | null;
    mimeId: number | null;
    mimeType: string | null;
    legiscanUrl: string | null;
    stateUrl: string | null;
    isCached: boolean;
  }[];
  supplements: {
    id: number;
    legiscanSupplementId: number;
    supplementType: string | null;
    supplementTypeId: number | null;
    title: string | null;
    description: string | null;
    supplementDate: string | null;
    mimeId: number | null;
    mimeType: string | null;
    legiscanUrl: string | null;
    stateUrl: string | null;
    isCached: boolean;
  }[];
  relatedBills: {
    relationTypeId: number;
    relationType: string | null;
    relatedBillNumber: string | null;
    relatedLegiscanBillId: number;
    /** Present when we also track the related bill. */
    slug: string | null;
    title: string | null;
    statusId: number | null;
  }[];
  upcomingEvents: {
    id: number;
    title: string;
    eventType: string | null;
    eventTypeId: number | null;
    eventDate: string;
    startTime: string | null;
    location: string | null;
    source: string;
    sourceUrl: string | null;
  }[];
  pastEvents: {
    id: number;
    title: string;
    eventType: string | null;
    eventTypeId: number | null;
    eventDate: string;
    startTime: string | null;
    location: string | null;
    source: string;
    sourceUrl: string | null;
  }[];
}

export async function getBillBySlug(slug: string): Promise<BillDetail | null> {
  return safeQuery<BillDetail | null>(
    async (db) => {
      const [row] = await db
        .select({
          bill: bills,
          sessionTitle: sessions.sessionTitle,
          yearStart: sessions.yearStart,
          yearEnd: sessions.yearEnd,
          committeeSlug: committees.slug,
          committeeName: committees.name,
          committeeChamber: committees.chamber,
        })
        .from(bills)
        .leftJoin(sessions, eq(sessions.id, bills.sessionId))
        .leftJoin(committees, eq(committees.id, bills.pendingCommitteeId))
        .where(eq(bills.slug, slug))
        .limit(1);

      if (!row) return null;
      const billId = row.bill.id;

      const [
        topicRows,
        classificationRow,
        overrideRow,
        actionRows,
        sponsorRows,
        referralRows,
        rollCallRows,
        documentRows,
        amendmentRows,
        supplementRows,
        relatedRows,
        eventRows,
      ] = await Promise.all([
        db
          .select({
            slug: topics.slug,
            name: topics.name,
            isPrimary: billTopics.isPrimary,
            score: billTopics.score,
          })
          .from(billTopics)
          .innerJoin(topics, eq(topics.id, billTopics.topicId))
          .where(eq(billTopics.billId, billId))
          .orderBy(desc(billTopics.isPrimary), desc(billTopics.score)),
        db
          .select()
          .from(billClassifications)
          .where(eq(billClassifications.billId, billId))
          .limit(1),
        db
          .select()
          .from(classificationOverrides)
          .where(eq(classificationOverrides.billId, billId))
          .limit(1),
        db
          .select()
          .from(billActions)
          .where(eq(billActions.billId, billId))
          .orderBy(asc(billActions.sequence)),
        db
          .select({
            slug: people.slug,
            name: people.name,
            party: people.party,
            partyId: people.partyId,
            role: people.role,
            roleId: people.roleId,
            district: people.district,
            sponsorTypeId: billSponsors.sponsorTypeId,
            sponsorOrder: billSponsors.sponsorOrder,
          })
          .from(billSponsors)
          .innerJoin(people, eq(people.id, billSponsors.personId))
          .where(eq(billSponsors.billId, billId))
          .orderBy(asc(billSponsors.sponsorTypeId), asc(billSponsors.sponsorOrder)),
        db
          .select({
            slug: committees.slug,
            name: committees.name,
            chamber: committees.chamber,
            referredOn: billCommitteeReferrals.referredOn,
          })
          .from(billCommitteeReferrals)
          .innerJoin(committees, eq(committees.id, billCommitteeReferrals.committeeId))
          .where(eq(billCommitteeReferrals.billId, billId))
          .orderBy(asc(billCommitteeReferrals.sequence)),
        db
          .select()
          .from(rollCalls)
          .where(eq(rollCalls.billId, billId))
          .orderBy(desc(rollCalls.voteDate)),
        db
          .select()
          .from(billDocuments)
          .where(eq(billDocuments.billId, billId))
          .orderBy(desc(billDocuments.documentDate)),
        db
          .select()
          .from(amendments)
          .where(eq(amendments.billId, billId))
          .orderBy(desc(amendments.amendmentDate)),
        db
          .select()
          .from(supplements)
          .where(eq(supplements.billId, billId))
          .orderBy(asc(supplements.supplementTypeId)),
        db
          .select({
            relationTypeId: relatedBills.relationTypeId,
            relationType: relatedBills.relationType,
            relatedBillNumber: relatedBills.relatedBillNumber,
            relatedLegiscanBillId: relatedBills.relatedLegiscanBillId,
            slug: bills.slug,
            title: bills.title,
            statusId: bills.statusId,
          })
          .from(relatedBills)
          .leftJoin(bills, eq(bills.legiscanBillId, relatedBills.relatedLegiscanBillId))
          .where(eq(relatedBills.billId, billId)),
        db
          .select({
            id: events.id,
            title: events.title,
            eventType: events.eventType,
            eventTypeId: events.eventTypeId,
            eventDate: events.eventDate,
            startTime: events.startTime,
            location: events.location,
            source: events.source,
            sourceUrl: events.sourceUrl,
          })
          .from(eventBills)
          .innerJoin(events, eq(events.id, eventBills.eventId))
          .where(eq(eventBills.billId, billId))
          .orderBy(asc(events.eventDate)),
      ]);

      const rollCallIds = rollCallRows.map((r) => r.id);
      const voteRows =
        rollCallIds.length > 0
          ? await db
              .select({
                rollCallId: individualVotes.rollCallId,
                voteId: individualVotes.voteId,
                voteText: individualVotes.voteText,
                name: people.name,
                slug: people.slug,
                party: people.party,
                district: people.district,
              })
              .from(individualVotes)
              .innerJoin(people, eq(people.id, individualVotes.personId))
              .where(inArray(individualVotes.rollCallId, rollCallIds))
              .orderBy(asc(people.lastName))
          : [];

      const votesByRollCall = new Map<number, typeof voteRows>();
      for (const vote of voteRows) {
        const list = votesByRollCall.get(vote.rollCallId) ?? [];
        list.push(vote);
        votesByRollCall.set(vote.rollCallId, list);
      }

      const today = new Date().toISOString().slice(0, 10);
      const classification = classificationRow[0];
      const override = overrideRow[0];

      return {
        bill: {
          id: row.bill.id,
          slug: row.bill.slug,
          legiscanBillId: row.bill.legiscanBillId,
          billNumber: row.bill.billNumber,
          title: row.bill.title,
          description: row.bill.description,
          billType: row.bill.billType,
          billTypeId: row.bill.billTypeId,
          body: row.bill.body,
          currentBody: row.bill.currentBody,
          statusId: row.bill.statusId,
          statusDate: row.bill.statusDate,
          lastAction: row.bill.lastAction,
          lastActionDate: row.bill.lastActionDate,
          introducedOn: row.bill.introducedOn,
          legiscanUrl: row.bill.legiscanUrl,
          stateUrl: row.bill.stateUrl,
          relevanceScore: row.bill.relevanceScore,
          lastSyncedAt: row.bill.lastSyncedAt,
          lastSourceChangeAt: row.bill.lastSourceChangeAt,
          firstSeenAt: row.bill.firstSeenAt,
          isFixture: row.bill.isFixture,
          plainLanguageSummary: row.bill.plainLanguageSummary,
          whyItMatters: row.bill.whyItMatters,
          advocacyNote: row.bill.advocacyNote,
          subjects: row.bill.subjects ?? null,
          progress: (row.bill.progress as { date: string | null; event: number | null }[] | null) ?? null,
        },
        session: row.sessionTitle !== undefined
          ? { label: row.sessionTitle, yearStart: row.yearStart ?? 0, yearEnd: row.yearEnd ?? 0 }
          : null,
        committee: row.committeeSlug
          ? { slug: row.committeeSlug, name: row.committeeName!, chamber: row.committeeChamber }
          : null,
        topics: topicRows.map((t) => ({ slug: t.slug, name: t.name, isPrimary: t.isPrimary })),
        classification: classification
          ? {
              reason: classification.reason,
              score: classification.score,
              relevant: classification.relevant,
              classifierVersion: classification.classifierVersion,
              classifiedAt: classification.classifiedAt,
            }
          : null,
        override:
          override && !override.clearedAt
            ? {
                decision: override.decision,
                reason: override.reason,
                createdAt: override.createdAt,
              }
            : null,
        actions: actionRows.map((a) => ({
          id: a.id,
          sequence: a.sequence,
          actionDate: a.actionDate,
          action: a.action,
          chamber: a.chamber,
          isMajor: a.isMajor,
        })),
        sponsors: sponsorRows,
        referrals: referralRows.map((r) => ({
          committee: { slug: r.slug, name: r.name, chamber: r.chamber },
          referredOn: r.referredOn,
        })),
        rollCalls: rollCallRows.map((rc) => ({
          id: rc.id,
          legiscanRollCallId: rc.legiscanRollCallId,
          voteDate: rc.voteDate,
          description: rc.description,
          chamber: rc.chamber,
          yea: rc.yea,
          nay: rc.nay,
          notVoting: rc.notVoting,
          absent: rc.absent,
          total: rc.total,
          passed: rc.passed,
          legiscanUrl: rc.legiscanUrl,
          stateUrl: rc.stateUrl,
          hasIndividualVotes: rc.hasIndividualVotes,
          votes: (votesByRollCall.get(rc.id) ?? []).map((v) => ({
            name: v.name,
            slug: v.slug,
            party: v.party,
            district: v.district,
            voteId: v.voteId,
            voteText: v.voteText,
          })),
        })),
        documents: documentRows.map((d) => ({
          id: d.id,
          legiscanDocId: d.legiscanDocId,
          versionType: d.versionType,
          versionTypeId: d.versionTypeId,
          documentDate: d.documentDate,
          mimeType: d.mimeType,
          mimeId: d.mimeId,
          sizeBytes: d.sizeBytes,
          legiscanUrl: d.legiscanUrl,
          stateUrl: d.stateUrl,
          isCached: d.isCached,
        })),
        amendments: amendmentRows.map((a) => ({
          id: a.id,
          legiscanAmendmentId: a.legiscanAmendmentId,
          adopted: a.adopted,
          chamber: a.chamber,
          amendmentDate: a.amendmentDate,
          title: a.title,
          description: a.description,
          mimeId: a.mimeId,
          mimeType: a.mimeType,
          legiscanUrl: a.legiscanUrl,
          stateUrl: a.stateUrl,
          isCached: a.isCached,
        })),
        supplements: supplementRows.map((s) => ({
          id: s.id,
          legiscanSupplementId: s.legiscanSupplementId,
          supplementType: s.supplementType,
          supplementTypeId: s.supplementTypeId,
          title: s.title,
          description: s.description,
          supplementDate: s.supplementDate,
          mimeId: s.mimeId,
          mimeType: s.mimeType,
          legiscanUrl: s.legiscanUrl,
          stateUrl: s.stateUrl,
          isCached: s.isCached,
        })),
        relatedBills: relatedRows.map((r) => ({
          relationTypeId: r.relationTypeId,
          relationType: r.relationType,
          relatedBillNumber: r.relatedBillNumber,
          relatedLegiscanBillId: r.relatedLegiscanBillId,
          slug: r.slug,
          title: r.title,
          statusId: r.statusId,
        })),
        upcomingEvents: eventRows.filter((e) => e.eventDate >= today),
        pastEvents: eventRows.filter((e) => e.eventDate < today).reverse(),
      };
    },
    null,
    'getBillBySlug',
  );
}

/** Slugs for the sitemap and static params. */
export async function getAllBillSlugs(limit = 5000): Promise<{ slug: string; lastSyncedAt: Date }[]> {
  return safeQuery(
    async (db) =>
      db
        .select({ slug: bills.slug, lastSyncedAt: bills.lastSyncedAt })
        .from(bills)
        .where(eq(bills.isTracked, true))
        .orderBy(desc(bills.lastSyncedAt))
        .limit(limit),
    [] as { slug: string; lastSyncedAt: Date }[],
    'getAllBillSlugs',
  );
}

/* ------------------------------------------------------------------------- */
/* Aggregates used by visualizations                                          */
/* ------------------------------------------------------------------------- */

export interface StatusDistributionRow {
  statusId: number | null;
  count: number;
}

export async function getStatusDistribution(topicSlug?: string): Promise<StatusDistributionRow[]> {
  return safeQuery(
    async (db) => {
      const clauses: SQL[] = [eq(bills.isTracked, true)];
      if (topicSlug) {
        clauses.push(
          sql`exists (
            select 1 from ${tbl(billTopics)}
            join ${tbl(topics)} on ${col(topics.id)} = ${col(billTopics.topicId)}
            where ${col(billTopics.billId)} = ${col(bills.id)} and ${col(topics.slug)} = ${topicSlug}
          )`,
        );
      }

      const rows = await db
        .select({ statusId: bills.statusId, count: sql<number>`count(*)::int` })
        .from(bills)
        .where(and(...clauses))
        .groupBy(bills.statusId);

      return rows.map((r) => ({ statusId: r.statusId, count: Number(r.count) }));
    },
    [] as StatusDistributionRow[],
    'getStatusDistribution',
  );
}

export interface ActivityPoint {
  month: string;
  count: number;
}

/**
 * A complete calendar of the last `months` months, including zeros.
 *
 * The raw GROUP BY only returns months that had at least one action, which
 * makes a fall recess look like a broken axis (Sep sitting next to Dec).
 */
export function fillMonthlySeries(
  rows: ActivityPoint[],
  months = 12,
  now: Date = new Date(),
): ActivityPoint[] {
  const byMonth = new Map(rows.map((row) => [row.month, row.count]));
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));
  const series: ActivityPoint[] = [];

  for (let i = 0; i < months; i += 1) {
    const date = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1));
    const month = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    series.push({ month, count: byMonth.get(month) ?? 0 });
  }

  return series;
}

/** Legislative actions per month on tracked bills — real activity, not sync noise. */
export async function getActivityByMonth(months = 12): Promise<ActivityPoint[]> {
  return safeQuery(
    async (db) => {
      const rows = await db
        .select({
          month: sql<string>`to_char(date_trunc('month', ${billActions.actionDate}), 'YYYY-MM')`,
          count: sql<number>`count(*)::int`,
        })
        .from(billActions)
        .innerJoin(bills, eq(bills.id, billActions.billId))
        .where(
          and(
            eq(bills.isTracked, true),
            sql`${billActions.actionDate} is not null`,
            sql`${billActions.actionDate} >= date_trunc('month', current_date) - (${months - 1} * interval '1 month')`,
          ),
        )
        .groupBy(sql`date_trunc('month', ${billActions.actionDate})`)
        .orderBy(sql`date_trunc('month', ${billActions.actionDate})`);

      return fillMonthlySeries(
        rows.map((r) => ({ month: r.month, count: Number(r.count) })),
        months,
      );
    },
    fillMonthlySeries([], months),
    'getActivityByMonth',
  );
}

export async function getChamberDistribution(): Promise<{ code: string; count: number }[]> {
  return safeQuery(
    async (db) => {
      const rows = await db
        .select({ code: bills.currentBody, count: sql<number>`count(*)::int` })
        .from(bills)
        .where(eq(bills.isTracked, true))
        .groupBy(bills.currentBody);
      return rows
        .filter((r) => r.code)
        .map((r) => ({ code: String(r.code), count: Number(r.count) }));
    },
    [] as { code: string; count: number }[],
    'getChamberDistribution',
  );
}

/** Bills whose LegiScan hash changed recently — "What's changed". */
export async function getRecentlyChanged(limit = 6): Promise<BillListItem[]> {
  return safeQuery(
    async (db) => {
      const rows = await db
        .select(listColumns)
        .from(bills)
        .leftJoin(sessions, eq(sessions.id, bills.sessionId))
        .leftJoin(committees, eq(committees.id, bills.pendingCommitteeId))
        .where(and(eq(bills.isTracked, true), sql`${bills.lastSourceChangeAt} is not null`))
        .orderBy(desc(bills.lastSourceChangeAt))
        .limit(limit);
      return hydrate(getDb(), rows as ListRow[]);
    },
    [] as BillListItem[],
    'getRecentlyChanged',
  );
}
