/**
 * Mapping and persistence for LegiScan payloads.
 *
 * Idempotency rules:
 *   - parent rows upsert on their LegiScan identifier
 *   - child collections (actions, sponsors, referrals, topics, relations) are
 *     replaced wholesale, because LegiScan sends the complete current set
 *   - documents, roll calls and events upsert and never lose locally derived
 *     state such as `is_cached` or previously downloaded individual votes
 *
 * Running the same payload twice must produce the same database, and must not
 * move `last_source_change_at` — a re-sync is not a legislative event.
 */

import { createHash } from 'node:crypto';
import { and, eq, inArray, sql } from 'drizzle-orm';

import { getTopicDefinition } from '@/config/topics';
import type { Database } from '@/lib/db/client';
import {
  amendments,
  billActions,
  billClassifications,
  billCommitteeReferrals,
  billDocuments,
  billSponsors,
  billTopics,
  bills,
  committees,
  eventBills,
  eventTopics,
  events,
  individualVotes,
  people,
  relatedBills,
  rollCalls,
  sessions,
  supplements,
  topics,
} from '@/lib/db/schema';
import { eventTypeLabel, sastLabel, supplementTypeLabel, textTypeLabel } from '@/lib/legiscan/enums';
import {
  normalizeBillCommittee,
  type LegiScanBill,
  type LegiScanPerson,
  type LegiScanRollCall,
  type LegiScanSession,
} from '@/lib/legiscan/schemas';
import type { WaterRelevanceResult } from '@/lib/classification/types';
import { billSlug, committeeSlug, personSlug } from '@/lib/utils/slug';

/* ------------------------------------------------------------------------- */
/* Sessions                                                                   */
/* ------------------------------------------------------------------------- */

export interface SessionRow {
  id: number;
  yearStart: number;
  legiscanSessionId: number;
  label: string;
}

export async function upsertSession(
  db: Database,
  session: LegiScanSession,
  state = 'NY',
): Promise<SessionRow> {
  const label =
    session.session_title ??
    session.session_name ??
    `${session.year_start}-${session.year_end} Session`;

  const [row] = await db
    .insert(sessions)
    .values({
      legiscanSessionId: session.session_id,
      state,
      stateId: session.state_id,
      yearStart: session.year_start,
      yearEnd: session.year_end,
      prefile: session.prefile,
      sineDie: session.sine_die,
      prior: session.prior,
      special: session.special,
      sessionTag: session.session_tag,
      sessionTitle: label,
      sessionName: session.session_name,
      datasetHash: session.dataset_hash,
      raw: session,
    })
    .onConflictDoUpdate({
      target: sessions.legiscanSessionId,
      set: {
        yearStart: session.year_start,
        yearEnd: session.year_end,
        prefile: session.prefile,
        sineDie: session.sine_die,
        prior: session.prior,
        special: session.special,
        sessionTag: session.session_tag,
        sessionTitle: label,
        sessionName: session.session_name,
        datasetHash: session.dataset_hash,
        raw: session,
        lastSyncedAt: new Date(),
      },
    })
    .returning({ id: sessions.id, yearStart: sessions.yearStart });

  return {
    id: row!.id,
    yearStart: row!.yearStart,
    legiscanSessionId: session.session_id,
    label,
  };
}

/* ------------------------------------------------------------------------- */
/* Committees                                                                 */
/* ------------------------------------------------------------------------- */

export async function upsertCommittee(
  db: Database,
  input: {
    legiscanCommitteeId: number | null;
    name: string;
    chamber: string | null;
    chamberId: number | null;
  },
): Promise<number> {
  const slug = committeeSlug(input.name, input.chamber);

  const [row] = await db
    .insert(committees)
    .values({
      legiscanCommitteeId: input.legiscanCommitteeId ?? null,
      name: input.name,
      chamber: input.chamber,
      chamberId: input.chamberId,
      slug,
    })
    .onConflictDoUpdate({
      target: committees.slug,
      set: {
        name: input.name,
        chamber: input.chamber,
        chamberId: input.chamberId,
        legiscanCommitteeId: sql`coalesce(${committees.legiscanCommitteeId}, excluded.legiscan_committee_id)`,
        lastSyncedAt: new Date(),
      },
    })
    .returning({ id: committees.id });

  return row!.id;
}

/* ------------------------------------------------------------------------- */
/* People                                                                     */
/* ------------------------------------------------------------------------- */

type PersonLike = Pick<
  LegiScanPerson,
  | 'people_id'
  | 'person_hash'
  | 'name'
  | 'first_name'
  | 'middle_name'
  | 'last_name'
  | 'suffix'
  | 'nickname'
  | 'party_id'
  | 'party'
  | 'role_id'
  | 'role'
  | 'district'
  | 'ballotpedia'
  | 'votesmart_id'
  | 'ftm_eid'
  | 'knowwho_pid'
  | 'committee_sponsor'
>;

/** Slugs prefer the readable name and fall back to a suffixed form on collision. */
async function resolvePersonSlug(
  db: Database,
  name: string,
  legiscanPeopleId: number,
): Promise<string> {
  const base = personSlug(name) || `legislator-${legiscanPeopleId}`;

  const [existing] = await db
    .select({ legiscanPeopleId: people.legiscanPeopleId })
    .from(people)
    .where(eq(people.slug, base))
    .limit(1);

  if (!existing || existing.legiscanPeopleId === legiscanPeopleId) return base;
  return `${base}-${legiscanPeopleId}`;
}

export async function upsertPerson(db: Database, person: PersonLike): Promise<number> {
  const slug = await resolvePersonSlug(db, person.name, person.people_id);

  const [row] = await db
    .insert(people)
    .values({
      legiscanPeopleId: person.people_id,
      personHash: person.person_hash ?? null,
      slug,
      name: person.name,
      firstName: person.first_name ?? null,
      middleName: person.middle_name ?? null,
      lastName: person.last_name ?? null,
      suffix: person.suffix ?? null,
      nickname: person.nickname ?? null,
      partyId: person.party_id ?? null,
      party: person.party ?? null,
      roleId: person.role_id ?? null,
      role: person.role ?? null,
      district: person.district ?? null,
      ballotpedia: person.ballotpedia ?? null,
      votesmartId: person.votesmart_id ?? null,
      ftmEid: person.ftm_eid ?? null,
      knowwhoPid: person.knowwho_pid ?? null,
      committeeSponsor: person.committee_sponsor,
      raw: person,
    })
    .onConflictDoUpdate({
      target: people.legiscanPeopleId,
      set: {
        personHash: person.person_hash ?? null,
        name: person.name,
        firstName: person.first_name ?? null,
        middleName: person.middle_name ?? null,
        lastName: person.last_name ?? null,
        suffix: person.suffix ?? null,
        nickname: person.nickname ?? null,
        partyId: person.party_id ?? null,
        party: person.party ?? null,
        roleId: person.role_id ?? null,
        role: person.role ?? null,
        district: person.district ?? null,
        ballotpedia: person.ballotpedia ?? null,
        raw: person,
        lastSyncedAt: new Date(),
      },
    })
    .returning({ id: people.id });

  return row!.id;
}

/* ------------------------------------------------------------------------- */
/* Bills                                                                      */
/* ------------------------------------------------------------------------- */

export interface PersistBillResult {
  billRowId: number;
  inserted: boolean;
  /** True when the LegiScan change hash moved since our last copy. */
  sourceChanged: boolean;
  eventsUpserted: number;
  rollCallSummaries: { rollCallId: number; legiscanRollCallId: number; hasVotes: boolean }[];
}

export interface PersistBillInput {
  payload: LegiScanBill;
  classification: WaterRelevanceResult;
  session: SessionRow;
  /** Effective tracking after manual overrides are applied. */
  isTracked: boolean;
  isFixture?: boolean;
}

export async function persistBill(
  db: Database,
  input: PersistBillInput,
): Promise<PersistBillResult> {
  const { payload, classification, session } = input;

  const [existing] = await db
    .select({
      id: bills.id,
      changeHash: bills.changeHash,
      lastSourceChangeAt: bills.lastSourceChangeAt,
    })
    .from(bills)
    .where(eq(bills.legiscanBillId, payload.bill_id))
    .limit(1);

  const incomingHash = payload.change_hash ?? null;
  const sourceChanged = !existing || (incomingHash !== null && existing.changeHash !== incomingHash);
  const now = new Date();

  const history = [...payload.history].sort(compareHistory);
  const firstAction = history.find((h) => h.date);
  const lastAction = [...history].reverse().find((h) => h.date);

  const committee = normalizeBillCommittee(payload.committee);
  const pendingCommitteeId = committee
    ? await upsertCommittee(db, {
        legiscanCommitteeId: committee.committeeId,
        name: committee.name,
        chamber: committee.chamber,
        chamberId: committee.chamberId,
      })
    : null;

  const slug = billSlug(payload.bill_number, session.yearStart);

  const values = {
    legiscanBillId: payload.bill_id,
    sessionId: session.id,
    slug,
    state: payload.state ?? 'NY',
    billNumber: payload.bill_number,
    billType: payload.bill_type ?? null,
    billTypeId: payload.bill_type_id ?? null,
    body: payload.body ?? null,
    bodyId: payload.body_id ?? null,
    currentBody: payload.current_body ?? payload.body ?? null,
    currentBodyId: payload.current_body_id ?? null,
    // Stored verbatim. New York budget bills put the entire enacting clause —
    // every Part — in both fields, which is why a title can be thousands of
    // characters. Cards use `displayTitle`; the bill page keeps the full text.
    title: payload.title,
    description: payload.description ?? null,
    statusId: payload.status ?? null,
    statusDate: payload.status_date ?? null,
    lastAction: lastAction?.action ?? null,
    lastActionDate: lastAction?.date ?? null,
    introducedOn: firstAction?.date ?? null,
    pendingCommitteeId,
    legiscanUrl: payload.url ?? null,
    stateUrl: payload.state_link ?? null,
    changeHash: incomingHash,
    progress: payload.progress,
    subjects: payload.subjects
      .filter((s) => s.subject_name)
      .map((s) => ({ subjectId: s.subject_id ?? 0, name: s.subject_name! })),
    raw: payload,
    isTracked: input.isTracked,
    relevanceScore: classification.score,
    isFixture: input.isFixture ?? false,
    lastSyncedAt: now,
  };

  const [billRow] = await db
    .insert(bills)
    .values({
      ...values,
      lastSourceChangeAt: now,
    })
    .onConflictDoUpdate({
      target: bills.legiscanBillId,
      set: {
        ...values,
        previousChangeHash: sourceChanged ? (existing?.changeHash ?? null) : undefined,
        // Only advances when the source itself changed.
        lastSourceChangeAt: sourceChanged ? now : (existing?.lastSourceChangeAt ?? null),
      },
    })
    .returning({ id: bills.id });

  const billRowId = billRow!.id;

  await Promise.all([
    replaceActions(db, billRowId, history),
    replaceSponsors(db, billRowId, payload),
    replaceReferrals(db, billRowId, payload),
    replaceRelatedBills(db, billRowId, payload),
    replaceTopics(db, billRowId, classification),
    upsertClassification(db, billRowId, classification),
    upsertDocuments(db, billRowId, payload),
  ]);

  const rollCallSummaries = await upsertRollCallSummaries(db, billRowId, payload);
  const eventsUpserted = await upsertBillEvents(db, billRowId, payload, input.isTracked);

  return {
    billRowId,
    inserted: !existing,
    sourceChanged,
    eventsUpserted,
    rollCallSummaries,
  };
}

function compareHistory(
  a: { date: string | null },
  b: { date: string | null },
): number {
  if (!a.date && !b.date) return 0;
  if (!a.date) return -1;
  if (!b.date) return 1;
  return a.date.localeCompare(b.date);
}

async function replaceActions(
  db: Database,
  billRowId: number,
  history: LegiScanBill['history'],
): Promise<void> {
  await db.delete(billActions).where(eq(billActions.billId, billRowId));
  if (history.length === 0) return;

  await db.insert(billActions).values(
    history.map((step, index) => ({
      billId: billRowId,
      sequence: index,
      actionDate: step.date,
      action: step.action,
      chamber: step.chamber ?? null,
      chamberId: step.chamber_id ?? null,
      isMajor: step.importance,
    })),
  );
}

async function replaceSponsors(
  db: Database,
  billRowId: number,
  payload: LegiScanBill,
): Promise<void> {
  await db.delete(billSponsors).where(eq(billSponsors.billId, billRowId));
  if (payload.sponsors.length === 0) return;

  const seen = new Set<number>();
  for (const sponsor of payload.sponsors) {
    if (seen.has(sponsor.people_id)) continue;
    seen.add(sponsor.people_id);

    const personId = await upsertPerson(db, sponsor);
    await db
      .insert(billSponsors)
      .values({
        billId: billRowId,
        personId,
        sponsorTypeId: sponsor.sponsor_type_id ?? null,
        sponsorOrder: sponsor.sponsor_order ?? null,
        committeeSponsor: sponsor.committee_sponsor,
      })
      .onConflictDoNothing();
  }
}

async function replaceReferrals(
  db: Database,
  billRowId: number,
  payload: LegiScanBill,
): Promise<void> {
  await db.delete(billCommitteeReferrals).where(eq(billCommitteeReferrals.billId, billRowId));
  if (payload.referrals.length === 0) return;

  let sequence = 0;
  for (const referral of payload.referrals) {
    const name = referral.name ?? referral.committee_name;
    if (!name) continue;

    const committeeId = await upsertCommittee(db, {
      legiscanCommitteeId: referral.committee_id ?? null,
      name,
      chamber: referral.chamber ?? null,
      chamberId: referral.chamber_id ?? null,
    });

    await db
      .insert(billCommitteeReferrals)
      .values({
        billId: billRowId,
        committeeId,
        referredOn: referral.date,
        sequence,
      })
      .onConflictDoNothing();

    sequence += 1;
  }
}

async function replaceRelatedBills(
  db: Database,
  billRowId: number,
  payload: LegiScanBill,
): Promise<void> {
  await db.delete(relatedBills).where(eq(relatedBills.billId, billRowId));

  const rows = payload.sasts
    .filter((s) => s.sast_bill_id)
    .map((s) => ({
      billId: billRowId,
      relatedLegiscanBillId: s.sast_bill_id!,
      relatedBillNumber: s.sast_bill_number ?? null,
      relationTypeId: s.type_id ?? 8,
      relationType: sastLabel(s.type_id, s.type),
    }));

  if (rows.length === 0) return;
  await db.insert(relatedBills).values(rows).onConflictDoNothing();
}

export async function replaceTopics(
  db: Database,
  billRowId: number,
  classification: WaterRelevanceResult,
): Promise<void> {
  await db.delete(billTopics).where(eq(billTopics.billId, billRowId));
  if (classification.topics.length === 0) return;

  const slugs = classification.topics.filter((slug) => getTopicDefinition(slug));
  if (slugs.length === 0) return;

  const topicRows = await db
    .select({ id: topics.id, slug: topics.slug })
    .from(topics)
    .where(inArray(topics.slug, slugs));

  const topicScores = new Map<string, number>();
  for (const item of classification.evidence) {
    for (const slug of item.topics) {
      topicScores.set(slug, (topicScores.get(slug) ?? 0) + item.points);
    }
  }

  const rows = topicRows.map((topic) => ({
    billId: billRowId,
    topicId: topic.id,
    score: topicScores.get(topic.slug) ?? 0,
    isPrimary: classification.topics[0] === topic.slug,
  }));

  if (rows.length > 0) await db.insert(billTopics).values(rows).onConflictDoNothing();
}

export async function upsertClassification(
  db: Database,
  billRowId: number,
  classification: WaterRelevanceResult,
): Promise<void> {
  await db
    .insert(billClassifications)
    .values({
      billId: billRowId,
      classifierVersion: classification.classifierVersion,
      provider: classification.provider,
      relevant: classification.relevant,
      score: classification.score,
      reason: classification.reason,
      topics: classification.topics,
      evidence: classification.evidence,
    })
    .onConflictDoUpdate({
      target: billClassifications.billId,
      set: {
        classifierVersion: classification.classifierVersion,
        provider: classification.provider,
        relevant: classification.relevant,
        score: classification.score,
        reason: classification.reason,
        topics: classification.topics,
        evidence: classification.evidence,
        classifiedAt: new Date(),
      },
    });
}

/* ------------------------------------------------------------------------- */
/* Documents                                                                  */
/* ------------------------------------------------------------------------- */

async function upsertDocuments(
  db: Database,
  billRowId: number,
  payload: LegiScanBill,
): Promise<void> {
  const now = new Date();

  for (const text of payload.texts) {
    await db
      .insert(billDocuments)
      .values({
        legiscanDocId: text.doc_id,
        billId: billRowId,
        versionType: textTypeLabel(text.type_id, text.type),
        versionTypeId: text.type_id ?? null,
        documentDate: text.date,
        mimeType: text.mime ?? null,
        mimeId: text.mime_id ?? null,
        sizeBytes: text.text_size ?? null,
        textHash: text.text_hash ?? null,
        legiscanUrl: text.url ?? null,
        stateUrl: text.state_link ?? null,
      })
      .onConflictDoUpdate({
        target: billDocuments.legiscanDocId,
        set: {
          versionType: textTypeLabel(text.type_id, text.type),
          versionTypeId: text.type_id ?? null,
          documentDate: text.date,
          mimeType: text.mime ?? null,
          mimeId: text.mime_id ?? null,
          sizeBytes: text.text_size ?? null,
          textHash: text.text_hash ?? null,
          legiscanUrl: text.url ?? null,
          stateUrl: text.state_link ?? null,
          lastSyncedAt: now,
        },
      });
  }

  for (const amendment of payload.amendments) {
    await db
      .insert(amendments)
      .values({
        legiscanAmendmentId: amendment.amendment_id,
        billId: billRowId,
        adopted: amendment.adopted,
        chamber: amendment.chamber ?? null,
        chamberId: amendment.chamber_id ?? null,
        amendmentDate: amendment.date,
        title: amendment.title ?? null,
        description: amendment.description ?? null,
        mimeType: amendment.mime ?? null,
        mimeId: amendment.mime_id ?? null,
        sizeBytes: amendment.amendment_size ?? null,
        amendmentHash: amendment.amendment_hash ?? null,
        legiscanUrl: amendment.url ?? null,
        stateUrl: amendment.state_link ?? null,
      })
      .onConflictDoUpdate({
        target: amendments.legiscanAmendmentId,
        set: {
          adopted: amendment.adopted,
          title: amendment.title ?? null,
          description: amendment.description ?? null,
          amendmentDate: amendment.date,
          amendmentHash: amendment.amendment_hash ?? null,
          lastSyncedAt: now,
        },
      });
  }

  for (const supplement of payload.supplements) {
    await db
      .insert(supplements)
      .values({
        legiscanSupplementId: supplement.supplement_id,
        billId: billRowId,
        supplementTypeId: supplement.type_id ?? null,
        supplementType: supplementTypeLabel(supplement.type_id, supplement.type),
        title: supplement.title ?? null,
        description: supplement.description ?? null,
        supplementDate: supplement.date,
        mimeType: supplement.mime ?? null,
        mimeId: supplement.mime_id ?? null,
        sizeBytes: supplement.supplement_size ?? null,
        supplementHash: supplement.supplement_hash ?? null,
        legiscanUrl: supplement.url ?? null,
        stateUrl: supplement.state_link ?? null,
      })
      .onConflictDoUpdate({
        target: supplements.legiscanSupplementId,
        set: {
          supplementTypeId: supplement.type_id ?? null,
          supplementType: supplementTypeLabel(supplement.type_id, supplement.type),
          title: supplement.title ?? null,
          description: supplement.description ?? null,
          supplementDate: supplement.date,
          supplementHash: supplement.supplement_hash ?? null,
          lastSyncedAt: now,
        },
      });
  }
}

/* ------------------------------------------------------------------------- */
/* Roll calls                                                                 */
/* ------------------------------------------------------------------------- */

async function upsertRollCallSummaries(
  db: Database,
  billRowId: number,
  payload: LegiScanBill,
): Promise<{ rollCallId: number; legiscanRollCallId: number; hasVotes: boolean }[]> {
  const results: { rollCallId: number; legiscanRollCallId: number; hasVotes: boolean }[] = [];

  for (const vote of payload.votes) {
    const [row] = await db
      .insert(rollCalls)
      .values({
        legiscanRollCallId: vote.roll_call_id,
        billId: billRowId,
        voteDate: vote.date,
        description: vote.desc ?? null,
        chamber: vote.chamber ?? null,
        chamberId: vote.chamber_id ?? null,
        yea: vote.yea ?? 0,
        nay: vote.nay ?? 0,
        notVoting: vote.nv ?? 0,
        absent: vote.absent ?? 0,
        total: vote.total ?? 0,
        passed: vote.passed,
        legiscanUrl: vote.url ?? null,
        stateUrl: vote.state_link ?? null,
        raw: vote,
      })
      .onConflictDoUpdate({
        target: rollCalls.legiscanRollCallId,
        set: {
          voteDate: vote.date,
          description: vote.desc ?? null,
          yea: vote.yea ?? 0,
          nay: vote.nay ?? 0,
          notVoting: vote.nv ?? 0,
          absent: vote.absent ?? 0,
          total: vote.total ?? 0,
          passed: vote.passed,
          raw: vote,
          lastSyncedAt: new Date(),
        },
      })
      .returning({ id: rollCalls.id, hasIndividualVotes: rollCalls.hasIndividualVotes });

    results.push({
      rollCallId: row!.id,
      legiscanRollCallId: vote.roll_call_id,
      hasVotes: row!.hasIndividualVotes,
    });
  }

  return results;
}

/** Stores the individual member votes retrieved by getRollCall. */
export async function persistIndividualVotes(
  db: Database,
  rollCallRowId: number,
  rollCall: LegiScanRollCall,
  knownPeople: Map<number, number>,
): Promise<number> {
  await db.delete(individualVotes).where(eq(individualVotes.rollCallId, rollCallRowId));

  const rows: { rollCallId: number; personId: number; voteId: number; voteText: string }[] = [];

  for (const vote of rollCall.votes) {
    const personId = knownPeople.get(vote.people_id);
    // A legislator we have never seen is skipped rather than invented.
    if (!personId) continue;
    rows.push({
      rollCallId: rollCallRowId,
      personId,
      voteId: vote.vote_id ?? 0,
      voteText: vote.vote_text ?? 'Not recorded',
    });
  }

  if (rows.length > 0) {
    await db.insert(individualVotes).values(rows).onConflictDoNothing();
  }

  await db
    .update(rollCalls)
    .set({ hasIndividualVotes: rows.length > 0, lastSyncedAt: new Date() })
    .where(eq(rollCalls.id, rollCallRowId));

  return rows.length;
}

/* ------------------------------------------------------------------------- */
/* Events                                                                     */
/* ------------------------------------------------------------------------- */

/**
 * LegiScan calendar entries carry no identifier, so a deterministic one is
 * derived from the immutable parts of the entry. The same hearing therefore
 * upserts to the same row on every run instead of duplicating.
 */
export function buildLegiScanEventId(
  legiscanBillId: number,
  event: { date: string | null; time: string | null; type_id: number | null; description: string | null },
): string {
  const digest = createHash('sha1')
    .update(
      [legiscanBillId, event.date ?? '', event.time ?? '', event.type_id ?? '', event.description ?? '']
        .join('|'),
    )
    .digest('hex')
    .slice(0, 12);
  return `bill-${legiscanBillId}-${event.date ?? 'undated'}-${digest}`;
}

export async function upsertBillEvents(
  db: Database,
  billRowId: number,
  payload: LegiScanBill,
  isTracked: boolean,
): Promise<number> {
  if (!isTracked) return 0;

  let upserted = 0;

  for (const entry of payload.calendar) {
    if (!entry.date) continue;

    const externalId = buildLegiScanEventId(payload.bill_id, {
      date: entry.date,
      time: entry.time,
      type_id: entry.type_id,
      description: entry.description,
    });

    const typeLabel = eventTypeLabel(entry.type_id, entry.type);
    const title = entry.description?.trim()
      ? entry.description.trim()
      : `${typeLabel} — ${payload.bill_number}`;

    const [row] = await db
      .insert(events)
      .values({
        externalId,
        source: 'legiscan',
        sourceType: 'legislative-calendar',
        sourceUrl: payload.url ?? null,
        title,
        eventType: typeLabel,
        eventTypeId: entry.type_id ?? null,
        eventDate: entry.date,
        startTime: entry.time ?? null,
        location: entry.location ?? null,
        description: entry.description ?? null,
        raw: entry,
      })
      .onConflictDoUpdate({
        target: [events.source, events.externalId],
        set: {
          title,
          eventType: typeLabel,
          eventTypeId: entry.type_id ?? null,
          eventDate: entry.date,
          startTime: entry.time ?? null,
          location: entry.location ?? null,
          description: entry.description ?? null,
          raw: entry,
          lastSyncedAt: new Date(),
        },
      })
      .returning({ id: events.id });

    const eventId = row!.id;
    upserted += 1;

    await db
      .insert(eventBills)
      .values({ eventId, billId: billRowId })
      .onConflictDoNothing();

    // Event topics mirror the topics of the bills the event concerns.
    const billTopicRows = await db
      .select({ topicId: billTopics.topicId })
      .from(billTopics)
      .where(eq(billTopics.billId, billRowId));

    if (billTopicRows.length > 0) {
      await db
        .insert(eventTopics)
        .values(billTopicRows.map((t) => ({ eventId, topicId: t.topicId })))
        .onConflictDoNothing();
    }
  }

  return upserted;
}

/* ------------------------------------------------------------------------- */
/* Lookups used by the sync service                                           */
/* ------------------------------------------------------------------------- */

export async function loadStoredChangeHashes(
  db: Database,
  legiscanBillIds: number[],
): Promise<Map<number, string | null>> {
  if (legiscanBillIds.length === 0) return new Map();

  const rows = await db
    .select({ legiscanBillId: bills.legiscanBillId, changeHash: bills.changeHash })
    .from(bills)
    .where(inArray(bills.legiscanBillId, legiscanBillIds));

  return new Map(rows.map((r) => [r.legiscanBillId, r.changeHash]));
}

export async function loadPeopleIdMap(
  db: Database,
  legiscanPeopleIds: number[],
): Promise<Map<number, number>> {
  if (legiscanPeopleIds.length === 0) return new Map();

  const rows = await db
    .select({ id: people.id, legiscanPeopleId: people.legiscanPeopleId })
    .from(people)
    .where(inArray(people.legiscanPeopleId, legiscanPeopleIds));

  return new Map(rows.map((r) => [r.legiscanPeopleId, r.id]));
}

export async function loadActiveOverride(
  db: Database,
  legiscanBillId: number,
): Promise<{ decision: 'include' | 'exclude'; reason: string } | null> {
  const rows = await db
    .select({
      decision: sql<'include' | 'exclude'>`o.decision`,
      reason: sql<string>`o.reason`,
    })
    .from(sql`classification_overrides o join bills b on b.id = o.bill_id`)
    .where(sql`b.legiscan_bill_id = ${legiscanBillId} and o.cleared_at is null`)
    .limit(1);

  return rows[0] ?? null;
}

/** Roll calls we already have individual votes for should never be re-fetched. */
export async function findRollCallsNeedingVotes(
  db: Database,
  billRowIds: number[],
): Promise<{ id: number; legiscanRollCallId: number }[]> {
  if (billRowIds.length === 0) return [];

  return db
    .select({ id: rollCalls.id, legiscanRollCallId: rollCalls.legiscanRollCallId })
    .from(rollCalls)
    .where(and(inArray(rollCalls.billId, billRowIds), eq(rollCalls.hasIndividualVotes, false)));
}
