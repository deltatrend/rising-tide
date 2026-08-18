/**
 * Development and test fixtures.
 *
 * These are hand-written payloads in LegiScan's response shape. They are
 * realistic — modelled on how New York bills actually read — but they are NOT
 * real bills, and every row they create is flagged `is_fixture` so the interface
 * labels them and production data can never be confused with them.
 *
 * Identifiers live in a reserved 9,000,000+ range that LegiScan does not use,
 * so a fixture can never collide with a real record.
 *
 * The raw objects are deliberately untyped: they pass through the same Zod
 * schemas as live responses, which means the tests exercise the real parser
 * rather than a convenient shortcut around it.
 */

import { billSchema, rollCallSchema, sessionSchema } from '@/lib/legiscan/schemas';

export const FIXTURE_SESSION_RAW = {
  session_id: 9_000_001,
  state_id: 32,
  year_start: 2025,
  year_end: 2026,
  prefile: 0,
  sine_die: 0,
  prior: 0,
  special: 0,
  session_tag: 'Regular Session',
  session_title: '2025-2026 Regular Session (sample data)',
  session_name: '2025-2026 Regular Session',
  dataset_hash: 'fixture-session-hash',
};

/** A strong drinking-water bill: should score high and be tracked. */
const DRINKING_WATER_BILL = {
  bill_id: 9_100_001,
  change_hash: 'fixture-hash-s1001-a',
  session_id: 9_000_001,
  url: 'https://legiscan.com/NY/bill/S1001/2025',
  state_link: 'https://www.nysenate.gov/legislation/bills/2025/S1001',
  status: 10,
  status_date: '2025-03-18',
  progress: [
    { date: '2025-01-08', event: 1 },
    { date: '2025-03-18', event: 9 },
  ],
  state: 'NY',
  state_id: 32,
  bill_number: 'S1001',
  bill_type: 'B',
  bill_type_id: 1,
  body: 'S',
  body_id: 1,
  current_body: 'S',
  current_body_id: 1,
  title:
    'Requires public water systems to test for perfluoroalkyl substances and notify customers of results',
  description:
    'Requires every public water system serving more than five hundred service connections to test for perfluoroalkyl and polyfluoroalkyl substances at least quarterly, to report results to the department of health, and to notify each customer in writing within thirty days of any detection above the maximum contaminant level.',
  pending_committee_id: 9_500_001,
  committee: {
    committee_id: 9_500_001,
    chamber: 'S',
    chamber_id: 1,
    name: 'Environmental Conservation',
    committee_name: 'Senate Environmental Conservation Committee',
  },
  referrals: [
    {
      date: '2025-01-08',
      committee_id: 9_500_001,
      chamber: 'S',
      chamber_id: 1,
      name: 'Environmental Conservation',
      committee_name: 'Senate Environmental Conservation Committee',
    },
    {
      date: '2025-03-18',
      committee_id: 9_500_002,
      chamber: 'S',
      chamber_id: 1,
      name: 'Finance',
      committee_name: 'Senate Finance Committee',
    },
  ],
  history: [
    {
      date: '2025-01-08',
      action: 'REFERRED TO ENVIRONMENTAL CONSERVATION',
      chamber: 'S',
      chamber_id: 1,
      importance: 1,
    },
    {
      date: '2025-02-11',
      action: 'NOTICED FOR COMMITTEE AGENDA',
      chamber: 'S',
      chamber_id: 1,
      importance: 0,
    },
    {
      date: '2025-03-18',
      action: 'REPORTED AND COMMITTED TO FINANCE',
      chamber: 'S',
      chamber_id: 1,
      importance: 1,
    },
  ],
  sponsors: [
    {
      people_id: 9_200_001,
      person_hash: 'fixture-person-1',
      party_id: 2,
      party: 'D',
      role_id: 2,
      role: 'Sen',
      name: 'Maria Delgado',
      first_name: 'Maria',
      last_name: 'Delgado',
      district: 'SD-014',
      ballotpedia: 'Maria_Delgado_(sample)',
      sponsor_type_id: 1,
      sponsor_order: 1,
      committee_sponsor: 0,
    },
    {
      people_id: 9_200_002,
      person_hash: 'fixture-person-2',
      party_id: 1,
      party: 'R',
      role_id: 2,
      role: 'Sen',
      name: 'Thomas Whitfield',
      first_name: 'Thomas',
      last_name: 'Whitfield',
      district: 'SD-041',
      sponsor_type_id: 2,
      sponsor_order: 2,
      committee_sponsor: 0,
    },
  ],
  sasts: [
    { type_id: 5, type: 'Same As', sast_bill_number: 'A2145', sast_bill_id: 9_100_002 },
  ],
  subjects: [
    { subject_id: 9_600_001, subject_name: 'Water Quality' },
    { subject_id: 9_600_002, subject_name: 'Public Health' },
  ],
  texts: [
    {
      doc_id: 9_300_001,
      date: '2025-01-08',
      type: 'Introduced',
      type_id: 1,
      mime: 'application/pdf',
      mime_id: 2,
      url: 'https://legiscan.com/NY/text/S1001/id/9300001',
      state_link: 'https://www.nysenate.gov/legislation/bills/2025/S1001/amendment/original',
      text_size: 48213,
      text_hash: 'fixture-text-hash-1',
    },
  ],
  votes: [
    {
      roll_call_id: 9_400_001,
      date: '2025-03-18',
      desc: 'Committee vote to report the bill to Finance',
      yea: 9,
      nay: 4,
      nv: 1,
      absent: 1,
      total: 15,
      passed: 1,
      chamber: 'S',
      chamber_id: 1,
      url: 'https://legiscan.com/NY/rollcall/S1001/id/9400001',
      state_link: 'https://www.nysenate.gov/legislation/bills/2025/S1001',
    },
  ],
  amendments: [],
  supplements: [
    {
      supplement_id: 9_310_001,
      date: '2025-03-10',
      type_id: 1,
      type: 'Fiscal Note',
      title: 'Fiscal note',
      description: 'Estimated cost to public water systems of quarterly testing.',
      mime: 'application/pdf',
      mime_id: 2,
      url: 'https://legiscan.com/NY/supplement/S1001/id/9310001',
      state_link: null,
      supplement_size: 10240,
      supplement_hash: 'fixture-supplement-hash-1',
    },
  ],
  calendar: [
    {
      type_id: 1,
      type: 'Hearing',
      date: futureDate(9),
      time: '10:00 AM',
      location: 'Hearing Room B, Legislative Office Building, Albany',
      description: 'Public hearing on drinking water contaminant standards',
    },
  ],
};

/** The Assembly companion, so the related-bill relationship is exercised. */
const DRINKING_WATER_COMPANION = {
  bill_id: 9_100_002,
  change_hash: 'fixture-hash-a2145-a',
  session_id: 9_000_001,
  url: 'https://legiscan.com/NY/bill/A2145/2025',
  state_link: 'https://nyassembly.gov/leg/?bn=A2145',
  status: 1,
  status_date: '2025-01-14',
  progress: [{ date: '2025-01-14', event: 1 }],
  state: 'NY',
  state_id: 32,
  bill_number: 'A2145',
  bill_type: 'B',
  bill_type_id: 1,
  body: 'A',
  body_id: 2,
  current_body: 'A',
  current_body_id: 2,
  title:
    'Requires public water systems to test for perfluoroalkyl substances and notify customers of results',
  description:
    'Requires every public water system serving more than five hundred service connections to test for perfluoroalkyl and polyfluoroalkyl substances at least quarterly and to notify each customer of any detection above the maximum contaminant level.',
  committee: {
    committee_id: 9_500_003,
    chamber: 'A',
    chamber_id: 2,
    name: 'Environmental Conservation',
    committee_name: 'Assembly Environmental Conservation Committee',
  },
  referrals: [
    {
      date: '2025-01-14',
      committee_id: 9_500_003,
      chamber: 'A',
      chamber_id: 2,
      name: 'Environmental Conservation',
      committee_name: 'Assembly Environmental Conservation Committee',
    },
  ],
  history: [
    {
      date: '2025-01-14',
      action: 'referred to environmental conservation',
      chamber: 'A',
      chamber_id: 2,
      importance: 1,
    },
  ],
  sponsors: [
    {
      people_id: 9_200_003,
      party_id: 2,
      party: 'D',
      role_id: 1,
      role: 'Rep',
      name: 'Aisha Bennett',
      first_name: 'Aisha',
      last_name: 'Bennett',
      district: 'AD-102',
      sponsor_type_id: 1,
      sponsor_order: 1,
      committee_sponsor: 0,
    },
  ],
  sasts: [{ type_id: 5, type: 'Same As', sast_bill_number: 'S1001', sast_bill_id: 9_100_001 }],
  subjects: [{ subject_id: 9_600_001, subject_name: 'Water Quality' }],
  texts: [],
  votes: [],
  amendments: [],
  supplements: [],
  calendar: [],
};

/** Tidal wetlands: exercises a second topic cluster and an enacted status. */
const WETLANDS_BILL = {
  bill_id: 9_100_003,
  change_hash: 'fixture-hash-s3320-a',
  session_id: 9_000_001,
  url: 'https://legiscan.com/NY/bill/S3320/2025',
  state_link: 'https://www.nysenate.gov/legislation/bills/2025/S3320',
  status: 4,
  status_date: '2025-06-02',
  progress: [
    { date: '2025-01-22', event: 1 },
    { date: '2025-04-30', event: 4 },
    { date: '2025-06-02', event: 8 },
  ],
  state: 'NY',
  state_id: 32,
  bill_number: 'S3320',
  bill_type: 'B',
  bill_type_id: 1,
  body: 'S',
  body_id: 1,
  current_body: 'A',
  current_body_id: 2,
  title: 'Expands protection of tidal wetlands and adjacent coastal buffer areas',
  description:
    'Extends the regulated adjacent area for tidal wetlands from three hundred to five hundred feet in coastal zones, requires the department of environmental conservation to update tidal wetlands maps every ten years, and directs consideration of projected sea level rise in permit decisions.',
  committee: [],
  referrals: [
    {
      date: '2025-01-22',
      committee_id: 9_500_001,
      chamber: 'S',
      chamber_id: 1,
      name: 'Environmental Conservation',
      committee_name: 'Senate Environmental Conservation Committee',
    },
  ],
  history: [
    {
      date: '2025-01-22',
      action: 'REFERRED TO ENVIRONMENTAL CONSERVATION',
      chamber: 'S',
      chamber_id: 1,
      importance: 1,
    },
    { date: '2025-03-04', action: 'REPORTED AND COMMITTED TO FINANCE', chamber: 'S', importance: 1 },
    { date: '2025-04-30', action: 'PASSED SENATE', chamber: 'S', chamber_id: 1, importance: 1 },
    { date: '2025-05-20', action: 'PASSED ASSEMBLY', chamber: 'A', chamber_id: 2, importance: 1 },
    { date: '2025-06-02', action: 'SIGNED CHAP.184', chamber: null, importance: 1 },
  ],
  sponsors: [
    {
      people_id: 9_200_001,
      party_id: 2,
      party: 'D',
      role_id: 2,
      role: 'Sen',
      name: 'Maria Delgado',
      district: 'SD-014',
      sponsor_type_id: 1,
      sponsor_order: 1,
      committee_sponsor: 0,
    },
  ],
  sasts: [],
  subjects: [
    { subject_id: 9_600_003, subject_name: 'Wetlands' },
    { subject_id: 9_600_004, subject_name: 'Coastal Resources' },
  ],
  texts: [
    {
      doc_id: 9_300_002,
      date: '2025-04-30',
      type: 'Engrossed',
      type_id: 4,
      mime: 'application/pdf',
      mime_id: 2,
      url: 'https://legiscan.com/NY/text/S3320/id/9300002',
      state_link: 'https://www.nysenate.gov/legislation/bills/2025/S3320',
      text_size: 62110,
      text_hash: 'fixture-text-hash-2',
    },
  ],
  votes: [
    {
      roll_call_id: 9_400_002,
      date: '2025-04-30',
      desc: 'Senate floor vote on passage',
      yea: 42,
      nay: 19,
      nv: 1,
      absent: 1,
      total: 63,
      passed: 1,
      chamber: 'S',
      chamber_id: 1,
      url: 'https://legiscan.com/NY/rollcall/S3320/id/9400002',
      state_link: null,
    },
  ],
  amendments: [
    {
      amendment_id: 9_320_001,
      adopted: 1,
      chamber: 'S',
      chamber_id: 1,
      date: '2025-04-14',
      title: 'Amendment A',
      description: 'Phases the expanded buffer in over three years.',
      mime: 'application/pdf',
      mime_id: 2,
      url: 'https://legiscan.com/NY/amendment/S3320/id/9320001',
      state_link: null,
      amendment_size: 8422,
      amendment_hash: 'fixture-amendment-hash-1',
    },
  ],
  supplements: [],
  calendar: [],
};

/** Flooding and stormwater: a bill still early in the process. */
const FLOODING_BILL = {
  bill_id: 9_100_004,
  change_hash: 'fixture-hash-a4478-a',
  session_id: 9_000_001,
  url: 'https://legiscan.com/NY/bill/A4478/2025',
  state_link: 'https://nyassembly.gov/leg/?bn=A4478',
  status: 1,
  status_date: '2025-02-05',
  progress: [{ date: '2025-02-05', event: 1 }],
  state: 'NY',
  state_id: 32,
  bill_number: 'A4478',
  bill_type: 'B',
  bill_type_id: 1,
  body: 'A',
  body_id: 2,
  current_body: 'A',
  current_body_id: 2,
  title:
    'Establishes a municipal green stormwater infrastructure grant program to reduce combined sewer overflows',
  description:
    'Creates a grant program administered by the environmental facilities corporation for municipalities to install green stormwater infrastructure, with priority for communities experiencing repeated combined sewer overflow discharges and for disadvantaged communities.',
  committee: {
    committee_id: 9_500_004,
    chamber: 'A',
    chamber_id: 2,
    name: 'Local Governments',
    committee_name: 'Assembly Local Governments Committee',
  },
  referrals: [
    {
      date: '2025-02-05',
      committee_id: 9_500_004,
      chamber: 'A',
      chamber_id: 2,
      name: 'Local Governments',
      committee_name: 'Assembly Local Governments Committee',
    },
  ],
  history: [
    {
      date: '2025-02-05',
      action: 'referred to local governments',
      chamber: 'A',
      chamber_id: 2,
      importance: 1,
    },
  ],
  sponsors: [
    {
      people_id: 9_200_003,
      party_id: 2,
      party: 'D',
      role_id: 1,
      role: 'Rep',
      name: 'Aisha Bennett',
      district: 'AD-102',
      sponsor_type_id: 1,
      sponsor_order: 1,
      committee_sponsor: 0,
    },
    {
      people_id: 9_200_004,
      party_id: 1,
      party: 'R',
      role_id: 1,
      role: 'Rep',
      name: 'Daniel Okafor',
      district: 'AD-006',
      sponsor_type_id: 2,
      sponsor_order: 2,
      committee_sponsor: 0,
    },
  ],
  sasts: [],
  subjects: [{ subject_id: 9_600_005, subject_name: 'Stormwater' }],
  texts: [],
  votes: [],
  amendments: [],
  supplements: [],
  calendar: [
    {
      type_id: 2,
      type: 'Committee Hearing',
      date: futureDate(21),
      time: '1:00 PM',
      location: 'Assembly Parlor, State Capitol, Albany',
      description: 'Assembly Local Governments Committee meeting',
    },
  ],
};

/**
 * A decoy. Mentions "water" only in an idiom and a place name, so the
 * classifier must reject it. Kept as a fixture precisely because a regression
 * here would quietly pollute the whole site.
 */
const DECOY_BILL = {
  bill_id: 9_100_005,
  change_hash: 'fixture-hash-s5590-a',
  session_id: 9_000_001,
  url: 'https://legiscan.com/NY/bill/S5590/2025',
  state_link: null,
  status: 1,
  status_date: '2025-02-19',
  progress: [{ date: '2025-02-19', event: 1 }],
  state: 'NY',
  state_id: 32,
  bill_number: 'S5590',
  bill_type: 'B',
  bill_type_id: 1,
  body: 'S',
  body_id: 1,
  current_body: 'S',
  current_body_id: 1,
  title: 'Relates to the sale of watered stock by domestic business corporations',
  description:
    'Prohibits a domestic business corporation from issuing watered stock and provides remedies for shareholders in the town of Waterford.',
  committee: {
    committee_id: 9_500_005,
    chamber: 'S',
    chamber_id: 1,
    name: 'Corporations, Authorities and Commissions',
    committee_name: 'Senate Corporations Committee',
  },
  referrals: [],
  history: [
    {
      date: '2025-02-19',
      action: 'REFERRED TO CORPORATIONS, AUTHORITIES AND COMMISSIONS',
      chamber: 'S',
      importance: 1,
    },
  ],
  sponsors: [
    {
      people_id: 9_200_002,
      party_id: 1,
      party: 'R',
      role_id: 2,
      role: 'Sen',
      name: 'Thomas Whitfield',
      district: 'SD-041',
      sponsor_type_id: 1,
      sponsor_order: 1,
      committee_sponsor: 0,
    },
  ],
  sasts: [],
  subjects: [{ subject_id: 9_600_006, subject_name: 'Corporations' }],
  texts: [],
  votes: [],
  amendments: [],
  supplements: [],
  calendar: [],
};

export const FIXTURE_BILLS_RAW = [
  DRINKING_WATER_BILL,
  DRINKING_WATER_COMPANION,
  WETLANDS_BILL,
  FLOODING_BILL,
  DECOY_BILL,
];

/** Individual member votes for the two fixture roll calls. */
export const FIXTURE_ROLL_CALLS_RAW = [
  {
    roll_call_id: 9_400_001,
    bill_id: 9_100_001,
    date: '2025-03-18',
    desc: 'Committee vote to report the bill to Finance',
    yea: 2,
    nay: 1,
    nv: 0,
    absent: 0,
    total: 3,
    passed: 1,
    chamber: 'S',
    chamber_id: 1,
    votes: [
      { people_id: 9_200_001, vote_id: 1, vote_text: 'Yea' },
      { people_id: 9_200_002, vote_id: 2, vote_text: 'Nay' },
      { people_id: 9_200_003, vote_id: 1, vote_text: 'Yea' },
    ],
  },
  {
    roll_call_id: 9_400_002,
    bill_id: 9_100_003,
    date: '2025-04-30',
    desc: 'Senate floor vote on passage',
    yea: 2,
    nay: 1,
    nv: 1,
    absent: 0,
    total: 4,
    passed: 1,
    chamber: 'S',
    chamber_id: 1,
    votes: [
      { people_id: 9_200_001, vote_id: 1, vote_text: 'Yea' },
      { people_id: 9_200_002, vote_id: 2, vote_text: 'Nay' },
      { people_id: 9_200_003, vote_id: 1, vote_text: 'Yea' },
      { people_id: 9_200_004, vote_id: 4, vote_text: 'NV' },
    ],
  },
];

/** Dates in fixtures must stay in the future or "upcoming" modules go empty. */
function futureDate(daysFromNow: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + daysFromNow);
  return date.toISOString().slice(0, 10);
}

/* Parsed accessors — these run the real schemas, so a fixture that drifts out
   of shape fails loudly instead of silently seeding nonsense. */

export function fixtureSession() {
  return sessionSchema.parse(FIXTURE_SESSION_RAW);
}

export function fixtureBills() {
  return FIXTURE_BILLS_RAW.map((raw) => billSchema.parse(raw));
}

export function fixtureRollCalls() {
  return FIXTURE_ROLL_CALLS_RAW.map((raw) => rollCallSchema.parse(raw));
}

/** LegiScan ids reserved for fixtures, used by the seed script to clean up. */
export const FIXTURE_BILL_IDS = FIXTURE_BILLS_RAW.map((bill) => bill.bill_id);
