/**
 * Rising Tide Youth Advocacy — relational schema.
 *
 * Design rules that the rest of the codebase depends on:
 *  - Every entity that originates at LegiScan keeps its LegiScan identifier in a
 *    UNIQUE column so repeated synchronization is idempotent (upsert on conflict).
 *  - Provenance (source system, source URL, source hash, fetched-at) travels with
 *    the record so future non-LegiScan integrations stay safe.
 *  - `raw` JSONB columns retain the original payload alongside normalized fields.
 *  - Nothing here stores document blobs; binaries live in Cloudflare R2 and are
 *    described by `r2_objects`.
 */
import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

import type { RelevanceEvidence } from '@/lib/classification/types';

/* ------------------------------------------------------------------------- */
/* Sessions                                                                   */
/* ------------------------------------------------------------------------- */

export const sessions = pgTable(
  'sessions',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    legiscanSessionId: integer('legiscan_session_id').notNull(),
    state: text('state').notNull().default('NY'),
    stateId: integer('state_id'),
    yearStart: integer('year_start').notNull(),
    yearEnd: integer('year_end').notNull(),
    prefile: boolean('prefile').notNull().default(false),
    sineDie: boolean('sine_die').notNull().default(false),
    prior: boolean('prior').notNull().default(false),
    special: boolean('special').notNull().default(false),
    sessionTag: text('session_tag'),
    sessionTitle: text('session_title'),
    sessionName: text('session_name'),
    datasetHash: text('dataset_hash'),
    raw: jsonb('raw'),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('sessions_legiscan_session_id_key').on(t.legiscanSessionId),
    index('sessions_state_year_idx').on(t.state, t.yearStart),
  ],
);

/* ------------------------------------------------------------------------- */
/* Topics                                                                     */
/* ------------------------------------------------------------------------- */

export const topics = pgTable(
  'topics',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    shortDescription: text('short_description').notNull(),
    longDescription: text('long_description'),
    /** Grouping used for navigation, e.g. "Pollution", "Ecosystems". */
    category: text('category'),
    sortOrder: integer('sort_order').notNull().default(100),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('topics_slug_key').on(t.slug), index('topics_sort_idx').on(t.sortOrder)],
);

/* ------------------------------------------------------------------------- */
/* Committees                                                                 */
/* ------------------------------------------------------------------------- */

export const committees = pgTable(
  'committees',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    legiscanCommitteeId: integer('legiscan_committee_id'),
    name: text('name').notNull(),
    chamber: text('chamber'),
    chamberId: integer('chamber_id'),
    slug: text('slug').notNull(),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('committees_slug_key').on(t.slug),
    uniqueIndex('committees_legiscan_id_key').on(t.legiscanCommitteeId),
    index('committees_chamber_idx').on(t.chamber),
  ],
);

/* ------------------------------------------------------------------------- */
/* People                                                                     */
/* ------------------------------------------------------------------------- */

export const people = pgTable(
  'people',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    legiscanPeopleId: integer('legiscan_people_id').notNull(),
    personHash: text('person_hash'),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    firstName: text('first_name'),
    middleName: text('middle_name'),
    lastName: text('last_name'),
    suffix: text('suffix'),
    nickname: text('nickname'),
    partyId: integer('party_id'),
    party: text('party'),
    roleId: integer('role_id'),
    role: text('role'),
    district: text('district'),
    ballotpedia: text('ballotpedia'),
    votesmartId: integer('votesmart_id'),
    ftmEid: text('ftm_eid'),
    knowwhoPid: integer('knowwho_pid'),
    committeeSponsor: boolean('committee_sponsor').notNull().default(false),
    raw: jsonb('raw'),
    isFixture: boolean('is_fixture').notNull().default(false),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('people_legiscan_people_id_key').on(t.legiscanPeopleId),
    uniqueIndex('people_slug_key').on(t.slug),
    index('people_name_idx').on(t.name),
    index('people_role_party_idx').on(t.role, t.party),
  ],
);

/* ------------------------------------------------------------------------- */
/* Bills                                                                      */
/* ------------------------------------------------------------------------- */

export const bills = pgTable(
  'bills',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    legiscanBillId: integer('legiscan_bill_id').notNull(),
    sessionId: integer('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'restrict' }),

    /** Stable, human readable, e.g. `s1234-2025`. */
    slug: text('slug').notNull(),

    state: text('state').notNull().default('NY'),
    billNumber: text('bill_number').notNull(),
    billType: text('bill_type'),
    billTypeId: integer('bill_type_id'),

    /** Originating chamber, LegiScan `body`. */
    body: text('body'),
    bodyId: integer('body_id'),
    currentBody: text('current_body'),
    currentBodyId: integer('current_body_id'),

    title: text('title').notNull(),
    description: text('description'),

    /** LegiScan status/progress enum (0-12). Translated for display, never shown raw. */
    statusId: integer('status_id'),
    statusDate: date('status_date'),

    lastAction: text('last_action'),
    lastActionDate: date('last_action_date'),
    /** Earliest action date in the bill's history — when it entered the process. */
    introducedOn: date('introduced_on'),

    pendingCommitteeId: integer('pending_committee_id').references(() => committees.id, {
      onDelete: 'set null',
    }),

    legiscanUrl: text('legiscan_url'),
    stateUrl: text('state_url'),

    /** LegiScan change detection. `previousChangeHash` powers "what changed". */
    changeHash: text('change_hash'),
    previousChangeHash: text('previous_change_hash'),

    /** LegiScan `progress[]` — significant steps used to compute status. */
    progress: jsonb('progress'),
    /** LegiScan `subjects[]` — official subject tags. */
    subjects: jsonb('subjects').$type<{ subjectId: number; name: string }[]>(),
    raw: jsonb('raw'),

    /** Derived: is this bill part of the tracked water-policy dataset right now? */
    isTracked: boolean('is_tracked').notNull().default(false),
    relevanceScore: integer('relevance_score'),

    /* Editorial fields — human written, never auto-generated. Null = omit section. */
    plainLanguageSummary: text('plain_language_summary'),
    whyItMatters: text('why_it_matters'),
    advocacyNote: text('advocacy_note'),
    editorialPriority: integer('editorial_priority'),

    isFixture: boolean('is_fixture').notNull().default(false),

    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }).notNull().defaultNow(),
    /**
     * Last time the LegiScan change_hash actually moved. A daily sync that finds
     * no change must NOT touch this column — a refresh is not a legislative event.
     */
    lastSourceChangeAt: timestamp('last_source_change_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('bills_legiscan_bill_id_key').on(t.legiscanBillId),
    uniqueIndex('bills_slug_key').on(t.slug),
    index('bills_session_idx').on(t.sessionId),
    index('bills_tracked_idx').on(t.isTracked),
    index('bills_status_idx').on(t.statusId),
    index('bills_bill_number_idx').on(t.billNumber),
    index('bills_last_action_date_idx').on(t.lastActionDate),
    index('bills_introduced_on_idx').on(t.introducedOn),
    index('bills_source_change_idx').on(t.lastSourceChangeAt),
    index('bills_current_body_idx').on(t.currentBody),
    index('bills_pending_committee_idx').on(t.pendingCommitteeId),
    index('bills_relevance_idx').on(t.relevanceScore),
    // Trigram-free full text search vector over the fields visitors search.
    index('bills_search_idx').using(
      'gin',
      sql`to_tsvector('english', ${t.billNumber} || ' ' || ${t.title} || ' ' || coalesce(${t.description}, ''))`,
    ),
  ],
);

/* ------------------------------------------------------------------------- */
/* Bill ↔ topic (many-to-many)                                                */
/* ------------------------------------------------------------------------- */

export const billTopics = pgTable(
  'bill_topics',
  {
    billId: integer('bill_id')
      .notNull()
      .references(() => bills.id, { onDelete: 'cascade' }),
    topicId: integer('topic_id')
      .notNull()
      .references(() => topics.id, { onDelete: 'cascade' }),
    /** Contribution this topic made to the relevance score. */
    score: real('score').notNull().default(0),
    isPrimary: boolean('is_primary').notNull().default(false),
    assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.billId, t.topicId] }),
    index('bill_topics_topic_idx').on(t.topicId),
  ],
);

/* ------------------------------------------------------------------------- */
/* Legislative history                                                        */
/* ------------------------------------------------------------------------- */

export const billActions = pgTable(
  'bill_actions',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    billId: integer('bill_id')
      .notNull()
      .references(() => bills.id, { onDelete: 'cascade' }),
    /** Position within LegiScan's history array — gives us a stable identity. */
    sequence: integer('sequence').notNull(),
    actionDate: date('action_date'),
    action: text('action').notNull(),
    chamber: text('chamber'),
    chamberId: integer('chamber_id'),
    /** LegiScan `importance` flag — matches a progress condition (a milestone). */
    isMajor: boolean('is_major').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('bill_actions_bill_sequence_key').on(t.billId, t.sequence),
    index('bill_actions_date_idx').on(t.actionDate),
    index('bill_actions_bill_idx').on(t.billId),
  ],
);

/* ------------------------------------------------------------------------- */
/* Sponsors                                                                   */
/* ------------------------------------------------------------------------- */

export const billSponsors = pgTable(
  'bill_sponsors',
  {
    billId: integer('bill_id')
      .notNull()
      .references(() => bills.id, { onDelete: 'cascade' }),
    personId: integer('person_id')
      .notNull()
      .references(() => people.id, { onDelete: 'cascade' }),
    /** 0 generic, 1 primary, 2 co-sponsor, 3 joint (LegiScan sponsor types). */
    sponsorTypeId: integer('sponsor_type_id'),
    sponsorOrder: integer('sponsor_order'),
    committeeSponsor: boolean('committee_sponsor').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.billId, t.personId] }),
    index('bill_sponsors_person_idx').on(t.personId),
    index('bill_sponsors_type_idx').on(t.sponsorTypeId),
  ],
);

/* ------------------------------------------------------------------------- */
/* Committee referrals                                                        */
/* ------------------------------------------------------------------------- */

export const billCommitteeReferrals = pgTable(
  'bill_committee_referrals',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    billId: integer('bill_id')
      .notNull()
      .references(() => bills.id, { onDelete: 'cascade' }),
    committeeId: integer('committee_id')
      .notNull()
      .references(() => committees.id, { onDelete: 'cascade' }),
    referredOn: date('referred_on'),
    sequence: integer('sequence').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('bill_committee_referrals_key').on(t.billId, t.committeeId, t.sequence),
    index('bill_committee_referrals_committee_idx').on(t.committeeId),
  ],
);

/* ------------------------------------------------------------------------- */
/* Events (generic — LegiScan today, other official feeds later)              */
/* ------------------------------------------------------------------------- */

export const events = pgTable(
  'events',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    /** Stable identifier within `source`. */
    externalId: text('external_id').notNull(),
    /** e.g. "legiscan". Future: "nysdec", "nysdoh". */
    source: text('source').notNull(),
    /** e.g. "legislative-calendar", "agency-hearing", "public-comment". */
    sourceType: text('source_type').notNull(),
    sourceUrl: text('source_url'),

    title: text('title').notNull(),
    /** Human label: Hearing, Executive Session, Markup Session, … */
    eventType: text('event_type'),
    eventTypeId: integer('event_type_id'),
    eventDate: date('event_date').notNull(),
    startTime: text('start_time'),
    endTime: text('end_time'),
    location: text('location'),
    description: text('description'),

    raw: jsonb('raw'),
    isFixture: boolean('is_fixture').notNull().default(false),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('events_source_external_id_key').on(t.source, t.externalId),
    index('events_date_idx').on(t.eventDate),
    index('events_source_idx').on(t.source),
  ],
);

export const eventBills = pgTable(
  'event_bills',
  {
    eventId: integer('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    billId: integer('bill_id')
      .notNull()
      .references(() => bills.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.eventId, t.billId] }),
    index('event_bills_bill_idx').on(t.billId),
  ],
);

export const eventTopics = pgTable(
  'event_topics',
  {
    eventId: integer('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    topicId: integer('topic_id')
      .notNull()
      .references(() => topics.id, { onDelete: 'cascade' }),
  },
  (t) => [
    primaryKey({ columns: [t.eventId, t.topicId] }),
    index('event_topics_topic_idx').on(t.topicId),
  ],
);

/* ------------------------------------------------------------------------- */
/* Roll calls and individual votes                                            */
/* ------------------------------------------------------------------------- */

export const rollCalls = pgTable(
  'roll_calls',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    legiscanRollCallId: integer('legiscan_roll_call_id').notNull(),
    billId: integer('bill_id')
      .notNull()
      .references(() => bills.id, { onDelete: 'cascade' }),
    voteDate: date('vote_date'),
    description: text('description'),
    chamber: text('chamber'),
    chamberId: integer('chamber_id'),
    yea: integer('yea').notNull().default(0),
    nay: integer('nay').notNull().default(0),
    notVoting: integer('not_voting').notNull().default(0),
    absent: integer('absent').notNull().default(0),
    total: integer('total').notNull().default(0),
    passed: boolean('passed'),
    legiscanUrl: text('legiscan_url'),
    stateUrl: text('state_url'),
    /** True once individual member votes have been retrieved via getRollCall. */
    hasIndividualVotes: boolean('has_individual_votes').notNull().default(false),
    raw: jsonb('raw'),
    isFixture: boolean('is_fixture').notNull().default(false),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('roll_calls_legiscan_id_key').on(t.legiscanRollCallId),
    index('roll_calls_bill_idx').on(t.billId),
    index('roll_calls_date_idx').on(t.voteDate),
  ],
);

export const individualVotes = pgTable(
  'individual_votes',
  {
    rollCallId: integer('roll_call_id')
      .notNull()
      .references(() => rollCalls.id, { onDelete: 'cascade' }),
    personId: integer('person_id')
      .notNull()
      .references(() => people.id, { onDelete: 'cascade' }),
    /** 1 Yea, 2 Nay, 3 Not Voting/Abstain, 4 Absent/Excused. */
    voteId: integer('vote_id').notNull(),
    voteText: text('vote_text').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.rollCallId, t.personId] }),
    index('individual_votes_person_idx').on(t.personId),
  ],
);

/* ------------------------------------------------------------------------- */
/* Cached document blobs in R2                                                */
/* ------------------------------------------------------------------------- */

export const r2Objects = pgTable(
  'r2_objects',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    /** Deterministic: legiscan/{sessionId}/{billId}/{documentType}/{documentId} */
    objectKey: text('object_key').notNull(),
    bucket: text('bucket').notNull(),
    /** "text" | "amendment" | "supplement" */
    documentKind: text('document_kind').notNull(),
    /** LegiScan doc_id / amendment_id / supplement_id. */
    externalDocumentId: integer('external_document_id').notNull(),
    billId: integer('bill_id').references(() => bills.id, { onDelete: 'set null' }),
    contentType: text('content_type'),
    sizeBytes: integer('size_bytes'),
    /** LegiScan MD5 of the decoded document. */
    checksum: text('checksum'),
    sourceUrl: text('source_url'),
    storedAt: timestamp('stored_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('r2_objects_object_key_key').on(t.objectKey),
    uniqueIndex('r2_objects_document_key').on(t.documentKind, t.externalDocumentId),
    index('r2_objects_bill_idx').on(t.billId),
  ],
);

/* ------------------------------------------------------------------------- */
/* Bill documents / amendments / supplements                                  */
/* ------------------------------------------------------------------------- */

export const billDocuments = pgTable(
  'bill_documents',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    legiscanDocId: integer('legiscan_doc_id').notNull(),
    billId: integer('bill_id')
      .notNull()
      .references(() => bills.id, { onDelete: 'cascade' }),
    /** LegiScan text type, e.g. Introduced, Amended, Enrolled. */
    versionType: text('version_type'),
    versionTypeId: integer('version_type_id'),
    documentDate: date('document_date'),
    mimeType: text('mime_type'),
    mimeId: integer('mime_id'),
    sizeBytes: integer('size_bytes'),
    /** MD5 of the decoded document — used to never re-download the same file. */
    textHash: text('text_hash'),
    legiscanUrl: text('legiscan_url'),
    stateUrl: text('state_url'),
    isCached: boolean('is_cached').notNull().default(false),
    r2ObjectId: integer('r2_object_id').references(() => r2Objects.id, { onDelete: 'set null' }),
    isFixture: boolean('is_fixture').notNull().default(false),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('bill_documents_legiscan_doc_id_key').on(t.legiscanDocId),
    index('bill_documents_bill_idx').on(t.billId),
  ],
);

export const amendments = pgTable(
  'amendments',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    legiscanAmendmentId: integer('legiscan_amendment_id').notNull(),
    billId: integer('bill_id')
      .notNull()
      .references(() => bills.id, { onDelete: 'cascade' }),
    adopted: boolean('adopted').notNull().default(false),
    chamber: text('chamber'),
    chamberId: integer('chamber_id'),
    amendmentDate: date('amendment_date'),
    title: text('title'),
    description: text('description'),
    mimeType: text('mime_type'),
    mimeId: integer('mime_id'),
    sizeBytes: integer('size_bytes'),
    amendmentHash: text('amendment_hash'),
    legiscanUrl: text('legiscan_url'),
    stateUrl: text('state_url'),
    isCached: boolean('is_cached').notNull().default(false),
    r2ObjectId: integer('r2_object_id').references(() => r2Objects.id, { onDelete: 'set null' }),
    isFixture: boolean('is_fixture').notNull().default(false),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('amendments_legiscan_id_key').on(t.legiscanAmendmentId),
    index('amendments_bill_idx').on(t.billId),
  ],
);

export const supplements = pgTable(
  'supplements',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    legiscanSupplementId: integer('legiscan_supplement_id').notNull(),
    billId: integer('bill_id')
      .notNull()
      .references(() => bills.id, { onDelete: 'cascade' }),
    /** 1 Fiscal Note … 8 Veto Letter. */
    supplementTypeId: integer('supplement_type_id'),
    supplementType: text('supplement_type'),
    title: text('title'),
    description: text('description'),
    supplementDate: date('supplement_date'),
    mimeType: text('mime_type'),
    mimeId: integer('mime_id'),
    sizeBytes: integer('size_bytes'),
    supplementHash: text('supplement_hash'),
    legiscanUrl: text('legiscan_url'),
    stateUrl: text('state_url'),
    isCached: boolean('is_cached').notNull().default(false),
    r2ObjectId: integer('r2_object_id').references(() => r2Objects.id, { onDelete: 'set null' }),
    isFixture: boolean('is_fixture').notNull().default(false),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('supplements_legiscan_id_key').on(t.legiscanSupplementId),
    index('supplements_bill_idx').on(t.billId),
  ],
);

/* ------------------------------------------------------------------------- */
/* Related bills (LegiScan SAST)                                              */
/* ------------------------------------------------------------------------- */

export const relatedBills = pgTable(
  'related_bills',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    billId: integer('bill_id')
      .notNull()
      .references(() => bills.id, { onDelete: 'cascade' }),
    relatedLegiscanBillId: integer('related_legiscan_bill_id').notNull(),
    relatedBillNumber: text('related_bill_number'),
    /** LegiScan SAST type: 1 Same As … 9 Carry Over. */
    relationTypeId: integer('relation_type_id').notNull(),
    relationType: text('relation_type'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('related_bills_key').on(t.billId, t.relatedLegiscanBillId, t.relationTypeId),
    index('related_bills_related_idx').on(t.relatedLegiscanBillId),
  ],
);

/* ------------------------------------------------------------------------- */
/* Classification                                                             */
/* ------------------------------------------------------------------------- */

export const billClassifications = pgTable(
  'bill_classifications',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    billId: integer('bill_id')
      .notNull()
      .references(() => bills.id, { onDelete: 'cascade' }),
    classifierVersion: text('classifier_version').notNull(),
    /** "deterministic" | "semantic" */
    provider: text('provider').notNull().default('deterministic'),
    relevant: boolean('relevant').notNull(),
    score: integer('score').notNull(),
    /** Reader-facing single sentence, e.g. "Tracked because …". */
    reason: text('reason').notNull(),
    topics: jsonb('topics').$type<string[]>().notNull(),
    evidence: jsonb('evidence').$type<RelevanceEvidence[]>().notNull(),
    classifiedAt: timestamp('classified_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('bill_classifications_bill_key').on(t.billId),
    index('bill_classifications_score_idx').on(t.score),
  ],
);

export const classificationOverrides = pgTable(
  'classification_overrides',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    billId: integer('bill_id')
      .notNull()
      .references(() => bills.id, { onDelete: 'cascade' }),
    /** "include" | "exclude" */
    decision: text('decision').$type<'include' | 'exclude'>().notNull(),
    reason: text('reason').notNull(),
    createdBy: text('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    /** Set to clear an override without losing the audit trail. */
    clearedAt: timestamp('cleared_at', { withTimezone: true }),
    /** Why the override was withdrawn — kept so the history stays readable. */
    clearedReason: text('cleared_reason'),
  },
  (t) => [
    uniqueIndex('classification_overrides_bill_key').on(t.billId),
    index('classification_overrides_decision_idx').on(t.decision),
  ],
);

/* ------------------------------------------------------------------------- */
/* Synchronization audit                                                      */
/* ------------------------------------------------------------------------- */

export const syncRuns = pgTable(
  'sync_runs',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    /** "cron" | "manual" | "dry-run" | "fixture" */
    triggerType: text('trigger_type').notNull(),
    /** "running" | "success" | "partial" | "failed" */
    status: text('status').notNull().default('running'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    durationMs: integer('duration_ms'),

    sessionId: integer('session_id').references(() => sessions.id, { onDelete: 'set null' }),
    classifierVersion: text('classifier_version'),

    queriesConsumed: integer('queries_consumed').notNull().default(0),
    candidatesDiscovered: integer('candidates_discovered').notNull().default(0),
    billsInserted: integer('bills_inserted').notNull().default(0),
    billsUpdated: integer('bills_updated').notNull().default(0),
    billsUnchanged: integer('bills_unchanged').notNull().default(0),
    billsRejected: integer('bills_rejected').notNull().default(0),
    rollCallsUpdated: integer('roll_calls_updated').notNull().default(0),
    eventsUpserted: integer('events_upserted').notNull().default(0),
    documentsFetched: integer('documents_fetched').notNull().default(0),
    documentsStored: integer('documents_stored').notNull().default(0),

    /** Structured, secret-free. */
    errors: jsonb('errors').$type<{ stage: string; subject?: string; message: string }[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    notes: text('notes'),
  },
  (t) => [
    index('sync_runs_started_idx').on(t.startedAt),
    index('sync_runs_status_idx').on(t.status),
  ],
);

/* ------------------------------------------------------------------------- */
/* Site-level singletons                                                      */
/* ------------------------------------------------------------------------- */

/** One row per calendar month, so budget safeguards never need a table scan. */
export const apiUsage = pgTable(
  'api_usage',
  {
    /** `YYYY-MM` in UTC. */
    periodMonth: text('period_month').primaryKey(),
    provider: text('provider').notNull().default('legiscan'),
    queriesUsed: integer('queries_used').notNull().default(0),
    monthlyLimit: integer('monthly_limit').notNull().default(30000),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('api_usage_provider_idx').on(t.provider)],
);

/* ------------------------------------------------------------------------- */
/* Relations                                                                  */
/* ------------------------------------------------------------------------- */

export const sessionsRelations = relations(sessions, ({ many }) => ({
  bills: many(bills),
}));

export const billsRelations = relations(bills, ({ one, many }) => ({
  session: one(sessions, { fields: [bills.sessionId], references: [sessions.id] }),
  pendingCommittee: one(committees, {
    fields: [bills.pendingCommitteeId],
    references: [committees.id],
  }),
  actions: many(billActions),
  sponsors: many(billSponsors),
  topics: many(billTopics),
  referrals: many(billCommitteeReferrals),
  rollCalls: many(rollCalls),
  documents: many(billDocuments),
  amendments: many(amendments),
  supplements: many(supplements),
  related: many(relatedBills),
  eventLinks: many(eventBills),
  classification: one(billClassifications),
  override: one(classificationOverrides),
}));

export const topicsRelations = relations(topics, ({ many }) => ({
  bills: many(billTopics),
  events: many(eventTopics),
}));

export const billTopicsRelations = relations(billTopics, ({ one }) => ({
  bill: one(bills, { fields: [billTopics.billId], references: [bills.id] }),
  topic: one(topics, { fields: [billTopics.topicId], references: [topics.id] }),
}));

export const billActionsRelations = relations(billActions, ({ one }) => ({
  bill: one(bills, { fields: [billActions.billId], references: [bills.id] }),
}));

export const peopleRelations = relations(people, ({ many }) => ({
  sponsorships: many(billSponsors),
  votes: many(individualVotes),
}));

export const billSponsorsRelations = relations(billSponsors, ({ one }) => ({
  bill: one(bills, { fields: [billSponsors.billId], references: [bills.id] }),
  person: one(people, { fields: [billSponsors.personId], references: [people.id] }),
}));

export const committeesRelations = relations(committees, ({ many }) => ({
  referrals: many(billCommitteeReferrals),
  pendingBills: many(bills),
}));

export const billCommitteeReferralsRelations = relations(billCommitteeReferrals, ({ one }) => ({
  bill: one(bills, { fields: [billCommitteeReferrals.billId], references: [bills.id] }),
  committee: one(committees, {
    fields: [billCommitteeReferrals.committeeId],
    references: [committees.id],
  }),
}));

export const eventsRelations = relations(events, ({ many }) => ({
  billLinks: many(eventBills),
  topicLinks: many(eventTopics),
}));

export const eventBillsRelations = relations(eventBills, ({ one }) => ({
  event: one(events, { fields: [eventBills.eventId], references: [events.id] }),
  bill: one(bills, { fields: [eventBills.billId], references: [bills.id] }),
}));

export const eventTopicsRelations = relations(eventTopics, ({ one }) => ({
  event: one(events, { fields: [eventTopics.eventId], references: [events.id] }),
  topic: one(topics, { fields: [eventTopics.topicId], references: [topics.id] }),
}));

export const rollCallsRelations = relations(rollCalls, ({ one, many }) => ({
  bill: one(bills, { fields: [rollCalls.billId], references: [bills.id] }),
  votes: many(individualVotes),
}));

export const individualVotesRelations = relations(individualVotes, ({ one }) => ({
  rollCall: one(rollCalls, { fields: [individualVotes.rollCallId], references: [rollCalls.id] }),
  person: one(people, { fields: [individualVotes.personId], references: [people.id] }),
}));

export const billDocumentsRelations = relations(billDocuments, ({ one }) => ({
  bill: one(bills, { fields: [billDocuments.billId], references: [bills.id] }),
  r2Object: one(r2Objects, { fields: [billDocuments.r2ObjectId], references: [r2Objects.id] }),
}));

export const amendmentsRelations = relations(amendments, ({ one }) => ({
  bill: one(bills, { fields: [amendments.billId], references: [bills.id] }),
  r2Object: one(r2Objects, { fields: [amendments.r2ObjectId], references: [r2Objects.id] }),
}));

export const supplementsRelations = relations(supplements, ({ one }) => ({
  bill: one(bills, { fields: [supplements.billId], references: [bills.id] }),
  r2Object: one(r2Objects, { fields: [supplements.r2ObjectId], references: [r2Objects.id] }),
}));

export const relatedBillsRelations = relations(relatedBills, ({ one }) => ({
  bill: one(bills, { fields: [relatedBills.billId], references: [bills.id] }),
}));

export const billClassificationsRelations = relations(billClassifications, ({ one }) => ({
  bill: one(bills, { fields: [billClassifications.billId], references: [bills.id] }),
}));

export const classificationOverridesRelations = relations(classificationOverrides, ({ one }) => ({
  bill: one(bills, { fields: [classificationOverrides.billId], references: [bills.id] }),
}));

/* ------------------------------------------------------------------------- */
/* Inferred types                                                             */
/* ------------------------------------------------------------------------- */

export type Session = typeof sessions.$inferSelect;
export type Bill = typeof bills.$inferSelect;
export type NewBill = typeof bills.$inferInsert;
export type BillAction = typeof billActions.$inferSelect;
export type Topic = typeof topics.$inferSelect;
export type Person = typeof people.$inferSelect;
export type Committee = typeof committees.$inferSelect;
export type EventRecord = typeof events.$inferSelect;
export type RollCall = typeof rollCalls.$inferSelect;
export type IndividualVote = typeof individualVotes.$inferSelect;
export type BillDocument = typeof billDocuments.$inferSelect;
export type Amendment = typeof amendments.$inferSelect;
export type Supplement = typeof supplements.$inferSelect;
export type RelatedBill = typeof relatedBills.$inferSelect;
export type BillClassification = typeof billClassifications.$inferSelect;
export type ClassificationOverride = typeof classificationOverrides.$inferSelect;
export type SyncRun = typeof syncRuns.$inferSelect;
export type R2Object = typeof r2Objects.$inferSelect;
