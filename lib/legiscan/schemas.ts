/**
 * Runtime validation for LegiScan Pull API payloads.
 *
 * LegiScan is generally consistent but not strictly typed: integers arrive as
 * either numbers or numeric strings, absent dates arrive as "0000-00-00", and
 * optional fields simply disappear. Every coercion below is deliberate, so a
 * surprise from upstream produces a clear parse error instead of a corrupt row.
 *
 * Shapes follow the LegiScan API User Manual v1.91 data dictionary.
 */

import { z } from 'zod';

/* ------------------------------------------------------------------------- */
/* Primitive coercions                                                        */
/* ------------------------------------------------------------------------- */

/** Required positive integer identifier, tolerating "1234" as well as 1234. */
export const idNumber = z
  .union([z.number(), z.string()])
  .transform((value) => (typeof value === 'number' ? value : Number(value.trim())))
  .pipe(z.number().int().positive());

/** Optional integer; anything unparseable becomes null rather than throwing. */
export const optionalNumber = z
  .union([z.number(), z.string(), z.null()])
  .optional()
  .transform((value) => {
    if (value === null || value === undefined) return null;
    const parsed = typeof value === 'number' ? value : Number(String(value).trim());
    return Number.isFinite(parsed) ? parsed : null;
  });

/** LegiScan 0/1 flags, occasionally strings or real booleans. */
export const flag = z
  .union([z.number(), z.string(), z.boolean(), z.null()])
  .optional()
  .transform((value) => {
    if (value === null || value === undefined) return false;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    const normalized = value.trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'y';
  });

export const optionalString = z
  .union([z.string(), z.number(), z.null()])
  .optional()
  .transform((value) => {
    if (value === null || value === undefined) return null;
    const text = String(value).trim();
    return text.length > 0 ? text : null;
  });

export const requiredString = z
  .union([z.string(), z.number()])
  .transform((value) => String(value).trim());

/** "0000-00-00" is LegiScan's way of saying "no date". */
export const legiscanDate = z
  .union([z.string(), z.null()])
  .optional()
  .transform((value) => {
    if (!value) return null;
    const text = value.trim();
    if (text.length === 0 || text.startsWith('0000-00-00')) return null;
    return text;
  });

/* ------------------------------------------------------------------------- */
/* Envelope                                                                   */
/* ------------------------------------------------------------------------- */

export const envelopeSchema = z.object({
  status: z.string(),
  alert: z
    .object({ message: optionalString })
    .optional()
    .nullable(),
});

export type LegiScanEnvelope = z.infer<typeof envelopeSchema>;

/* ------------------------------------------------------------------------- */
/* Sessions                                                                   */
/* ------------------------------------------------------------------------- */

export const sessionSchema = z.object({
  session_id: idNumber,
  state_id: optionalNumber,
  year_start: z.union([z.number(), z.string()]).transform((v) => Number(v)),
  year_end: z.union([z.number(), z.string()]).transform((v) => Number(v)),
  prefile: flag,
  sine_die: flag,
  prior: flag,
  special: flag,
  session_tag: optionalString,
  session_title: optionalString,
  session_name: optionalString,
  dataset_hash: optionalString,
});

export type LegiScanSession = z.infer<typeof sessionSchema>;

export const sessionListResponseSchema = z.object({
  sessions: z.array(sessionSchema),
});

/* ------------------------------------------------------------------------- */
/* Master list                                                                */
/* ------------------------------------------------------------------------- */

export const masterListEntrySchema = z.object({
  bill_id: idNumber,
  number: optionalString,
  change_hash: optionalString,
  url: optionalString,
  status_date: legiscanDate,
  status: optionalNumber,
  last_action_date: legiscanDate,
  last_action: optionalString,
  title: optionalString,
  description: optionalString,
});

export type LegiScanMasterListEntry = z.infer<typeof masterListEntrySchema>;

/**
 * `masterlist` is an object keyed by index, and it also carries a `session`
 * member. Callers get only the entries that actually describe a bill.
 */
export function parseMasterList(payload: unknown): LegiScanMasterListEntry[] {
  const container = z
    .object({ masterlist: z.record(z.string(), z.unknown()) })
    .safeParse(payload);

  if (!container.success) return [];

  const entries: LegiScanMasterListEntry[] = [];
  for (const [key, value] of Object.entries(container.data.masterlist)) {
    if (key === 'session') continue;
    const parsed = masterListEntrySchema.safeParse(value);
    if (parsed.success) entries.push(parsed.data);
  }
  return entries;
}

/* ------------------------------------------------------------------------- */
/* Search                                                                     */
/* ------------------------------------------------------------------------- */

export const searchSummarySchema = z.object({
  page: optionalString,
  range: optionalString,
  relevancy: optionalString,
  count: optionalNumber,
  page_current: optionalNumber,
  page_total: optionalNumber,
});

export const searchResultEntrySchema = z.object({
  relevance: optionalNumber,
  state: optionalString,
  bill_number: optionalString,
  bill_id: idNumber,
  change_hash: optionalString,
  url: optionalString,
  text_url: optionalString,
  research_url: optionalString,
  last_action_date: legiscanDate,
  last_action: optionalString,
  title: optionalString,
});

export type LegiScanSearchResult = z.infer<typeof searchResultEntrySchema>;
export type LegiScanSearchSummary = z.infer<typeof searchSummarySchema>;

export interface ParsedSearchPage {
  summary: LegiScanSearchSummary;
  results: LegiScanSearchResult[];
}

/** `searchresult` mixes a `summary` object with index-keyed result members. */
export function parseSearchPage(payload: unknown): ParsedSearchPage {
  const container = z
    .object({ searchresult: z.record(z.string(), z.unknown()) })
    .safeParse(payload);

  if (!container.success) {
    return { summary: emptySummary(), results: [] };
  }

  const rawSummary = container.data.searchresult['summary'];
  const summaryParsed = searchSummarySchema.safeParse(rawSummary ?? {});
  const summary = summaryParsed.success ? summaryParsed.data : emptySummary();

  const results: LegiScanSearchResult[] = [];
  for (const [key, value] of Object.entries(container.data.searchresult)) {
    if (key === 'summary') continue;
    const parsed = searchResultEntrySchema.safeParse(value);
    if (parsed.success) results.push(parsed.data);
  }

  return { summary, results };
}

function emptySummary(): LegiScanSearchSummary {
  return {
    page: null,
    range: null,
    relevancy: null,
    count: null,
    page_current: null,
    page_total: null,
  };
}

/* ------------------------------------------------------------------------- */
/* Bill detail                                                                */
/* ------------------------------------------------------------------------- */

export const billCommitteeSchema = z.object({
  committee_id: optionalNumber,
  chamber: optionalString,
  chamber_id: optionalNumber,
  name: optionalString,
  committee_name: optionalString,
});

export const referralSchema = z.object({
  date: legiscanDate,
  committee_id: optionalNumber,
  chamber: optionalString,
  chamber_id: optionalNumber,
  name: optionalString,
  committee_name: optionalString,
});

export const historyStepSchema = z.object({
  date: legiscanDate,
  action: requiredString,
  chamber: optionalString,
  chamber_id: optionalNumber,
  importance: flag,
});

export const progressStepSchema = z.object({
  date: legiscanDate,
  event: optionalNumber,
});

export const sponsorSchema = z.object({
  people_id: idNumber,
  person_hash: optionalString,
  party_id: optionalNumber,
  party: optionalString,
  role_id: optionalNumber,
  role: optionalString,
  name: requiredString,
  first_name: optionalString,
  middle_name: optionalString,
  last_name: optionalString,
  suffix: optionalString,
  nickname: optionalString,
  district: optionalString,
  ftm_eid: optionalString,
  votesmart_id: optionalNumber,
  opensecrets_id: optionalString,
  knowwho_pid: optionalNumber,
  ballotpedia: optionalString,
  sponsor_type_id: optionalNumber,
  sponsor_order: optionalNumber,
  committee_sponsor: flag,
  committee_id: optionalNumber,
});

export const sastSchema = z.object({
  type_id: optionalNumber,
  type: optionalString,
  sast_bill_number: optionalString,
  sast_bill_id: optionalNumber,
});

export const subjectSchema = z.object({
  subject_id: optionalNumber,
  subject_name: optionalString,
});

export const billTextSchema = z.object({
  doc_id: idNumber,
  date: legiscanDate,
  type: optionalString,
  type_id: optionalNumber,
  mime: optionalString,
  mime_id: optionalNumber,
  url: optionalString,
  state_link: optionalString,
  text_size: optionalNumber,
  text_hash: optionalString,
});

export const voteSummarySchema = z.object({
  roll_call_id: idNumber,
  date: legiscanDate,
  desc: optionalString,
  yea: optionalNumber,
  nay: optionalNumber,
  nv: optionalNumber,
  absent: optionalNumber,
  total: optionalNumber,
  passed: flag,
  chamber: optionalString,
  chamber_id: optionalNumber,
  url: optionalString,
  state_link: optionalString,
});

export const amendmentSummarySchema = z.object({
  amendment_id: idNumber,
  adopted: flag,
  chamber: optionalString,
  chamber_id: optionalNumber,
  date: legiscanDate,
  title: optionalString,
  description: optionalString,
  mime: optionalString,
  mime_id: optionalNumber,
  url: optionalString,
  state_link: optionalString,
  amendment_size: optionalNumber,
  amendment_hash: optionalString,
});

export const supplementSummarySchema = z.object({
  supplement_id: idNumber,
  date: legiscanDate,
  type_id: optionalNumber,
  type: optionalString,
  title: optionalString,
  description: optionalString,
  mime: optionalString,
  mime_id: optionalNumber,
  url: optionalString,
  state_link: optionalString,
  supplement_size: optionalNumber,
  supplement_hash: optionalString,
});

export const calendarEventSchema = z.object({
  type_id: optionalNumber,
  type: optionalString,
  date: legiscanDate,
  time: optionalString,
  location: optionalString,
  description: optionalString,
});

export const billSchema = z.object({
  bill_id: idNumber,
  change_hash: optionalString,
  session_id: idNumber,
  session: sessionSchema.optional(),
  url: optionalString,
  state_link: optionalString,
  status: optionalNumber,
  status_date: legiscanDate,
  progress: z.array(progressStepSchema).optional().default([]),
  state: optionalString,
  state_id: optionalNumber,
  bill_number: requiredString,
  bill_type: optionalString,
  bill_type_id: optionalNumber,
  body: optionalString,
  body_id: optionalNumber,
  current_body: optionalString,
  current_body_id: optionalNumber,
  title: requiredString,
  description: optionalString,
  pending_committee_id: optionalNumber,
  committee: z.union([billCommitteeSchema, z.array(z.unknown())]).optional(),
  referrals: z.array(referralSchema).optional().default([]),
  history: z.array(historyStepSchema).optional().default([]),
  sponsors: z.array(sponsorSchema).optional().default([]),
  sasts: z.array(sastSchema).optional().default([]),
  subjects: z.array(subjectSchema).optional().default([]),
  texts: z.array(billTextSchema).optional().default([]),
  votes: z.array(voteSummarySchema).optional().default([]),
  amendments: z.array(amendmentSummarySchema).optional().default([]),
  supplements: z.array(supplementSummarySchema).optional().default([]),
  calendar: z.array(calendarEventSchema).optional().default([]),
});

export type LegiScanBill = z.infer<typeof billSchema>;
export type LegiScanHistoryStep = z.infer<typeof historyStepSchema>;
export type LegiScanSponsor = z.infer<typeof sponsorSchema>;
export type LegiScanBillText = z.infer<typeof billTextSchema>;
export type LegiScanVoteSummary = z.infer<typeof voteSummarySchema>;
export type LegiScanAmendmentSummary = z.infer<typeof amendmentSummarySchema>;
export type LegiScanSupplementSummary = z.infer<typeof supplementSummarySchema>;
export type LegiScanCalendarEvent = z.infer<typeof calendarEventSchema>;
export type LegiScanReferral = z.infer<typeof referralSchema>;
export type LegiScanSast = z.infer<typeof sastSchema>;

export const billResponseSchema = z.object({ bill: billSchema });

/**
 * `committee` is an object when a bill is pending in committee and an empty
 * array when it is not. This normalizes both into a single optional shape.
 */
export function normalizeBillCommittee(
  committee: LegiScanBill['committee'],
): { committeeId: number | null; name: string; chamber: string | null; chamberId: number | null } | null {
  if (!committee || Array.isArray(committee)) return null;
  const name = committee.name ?? committee.committee_name ?? null;
  if (!name) return null;
  return {
    committeeId: committee.committee_id ?? null,
    name,
    chamber: committee.chamber ?? null,
    chamberId: committee.chamber_id ?? null,
  };
}

/* ------------------------------------------------------------------------- */
/* Roll calls                                                                 */
/* ------------------------------------------------------------------------- */

export const individualVoteSchema = z.object({
  people_id: idNumber,
  vote_id: optionalNumber,
  vote_text: optionalString,
});

export const rollCallSchema = z.object({
  roll_call_id: idNumber,
  bill_id: idNumber,
  date: legiscanDate,
  desc: optionalString,
  yea: optionalNumber,
  nay: optionalNumber,
  nv: optionalNumber,
  absent: optionalNumber,
  total: optionalNumber,
  passed: flag,
  chamber: optionalString,
  chamber_id: optionalNumber,
  votes: z.array(individualVoteSchema).optional().default([]),
});

export type LegiScanRollCall = z.infer<typeof rollCallSchema>;

export const rollCallResponseSchema = z.object({ roll_call: rollCallSchema });

/* ------------------------------------------------------------------------- */
/* People                                                                     */
/* ------------------------------------------------------------------------- */

export const personSchema = z.object({
  people_id: idNumber,
  person_hash: optionalString,
  state_id: optionalNumber,
  party_id: optionalNumber,
  party: optionalString,
  role_id: optionalNumber,
  role: optionalString,
  name: requiredString,
  first_name: optionalString,
  middle_name: optionalString,
  last_name: optionalString,
  suffix: optionalString,
  nickname: optionalString,
  district: optionalString,
  ftm_eid: optionalString,
  votesmart_id: optionalNumber,
  opensecrets_id: optionalString,
  knowwho_pid: optionalNumber,
  ballotpedia: optionalString,
  committee_sponsor: flag,
  committee_id: optionalNumber,
});

export type LegiScanPerson = z.infer<typeof personSchema>;

export const personResponseSchema = z.object({ person: personSchema });

export const sessionPeopleResponseSchema = z.object({
  sessionpeople: z.object({
    session: sessionSchema.optional(),
    people: z.array(personSchema).optional().default([]),
  }),
});

/* ------------------------------------------------------------------------- */
/* Documents (base64 payloads)                                                */
/* ------------------------------------------------------------------------- */

export const documentTextSchema = z.object({
  doc_id: idNumber,
  bill_id: optionalNumber,
  date: legiscanDate,
  type: optionalString,
  type_id: optionalNumber,
  mime: optionalString,
  mime_id: optionalNumber,
  text_size: optionalNumber,
  text_hash: optionalString,
  doc: z.string(),
});

export const documentAmendmentSchema = z.object({
  amendment_id: idNumber,
  bill_id: optionalNumber,
  chamber: optionalString,
  chamber_id: optionalNumber,
  adopted: flag,
  date: legiscanDate,
  title: optionalString,
  description: optionalString,
  mime: optionalString,
  mime_id: optionalNumber,
  amendment_size: optionalNumber,
  amendment_hash: optionalString,
  doc: z.string(),
});

export const documentSupplementSchema = z.object({
  supplement_id: idNumber,
  bill_id: optionalNumber,
  date: legiscanDate,
  type_id: optionalNumber,
  type: optionalString,
  title: optionalString,
  description: optionalString,
  mime: optionalString,
  mime_id: optionalNumber,
  supplement_size: optionalNumber,
  supplement_hash: optionalString,
  doc: z.string(),
});

export type LegiScanDocumentText = z.infer<typeof documentTextSchema>;
export type LegiScanDocumentAmendment = z.infer<typeof documentAmendmentSchema>;
export type LegiScanDocumentSupplement = z.infer<typeof documentSupplementSchema>;

export const billTextResponseSchema = z.object({ text: documentTextSchema });
export const amendmentResponseSchema = z.object({ amendment: documentAmendmentSchema });
export const supplementResponseSchema = z.object({ supplement: documentSupplementSchema });

/* ------------------------------------------------------------------------- */
/* Datasets (not used for ingestion today, typed for completeness)            */
/* ------------------------------------------------------------------------- */

export const datasetListEntrySchema = z.object({
  state_id: optionalNumber,
  session_id: idNumber,
  special: flag,
  year_start: optionalNumber,
  year_end: optionalNumber,
  session_name: optionalString,
  session_title: optionalString,
  dataset_hash: optionalString,
  dataset_date: legiscanDate,
  dataset_size: optionalNumber,
  access_key: optionalString,
});

export const datasetListResponseSchema = z.object({
  datasetlist: z.array(datasetListEntrySchema),
});
