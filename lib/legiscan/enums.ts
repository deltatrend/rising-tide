/**
 * LegiScan static value translations.
 *
 * Source: LegiScan API User Manual v1.91, "Static Values". Visitors must never
 * see a bare numeric code, so every enum here has a human label and, where the
 * meaning is not obvious, a short explanation written for a general reader.
 *
 * This module is pure data — safe to import from client components.
 */

/* ------------------------------------------------------------------------- */
/* Chambers                                                                   */
/* ------------------------------------------------------------------------- */

/**
 * New York's lower chamber is the Assembly. LegiScan uses `A` for it in NY, but
 * also emits the generic `H` (House) in some payloads, so both map to Assembly
 * for this New York-only project.
 */
export function chamberLabel(code: string | null | undefined): string {
  if (!code) return 'Unknown chamber';
  switch (code.toUpperCase()) {
    case 'S':
      return 'Senate';
    case 'A':
    case 'H':
      return 'Assembly';
    case 'J':
      return 'Joint';
    default:
      return code;
  }
}

export function chamberShortLabel(code: string | null | undefined): string {
  const label = chamberLabel(code);
  return label === 'Unknown chamber' ? 'Unknown' : label;
}

/* ------------------------------------------------------------------------- */
/* Status / progress                                                          */
/* ------------------------------------------------------------------------- */

export interface StatusDefinition {
  id: number;
  label: string;
  /** Plain-language explanation shown alongside the label. */
  explanation: string;
  /** Broad bucket used for filtering and charts. */
  bucket: 'early' | 'moving' | 'passed' | 'ended';
}

export const BILL_STATUSES: Record<number, StatusDefinition> = {
  0: {
    id: 0,
    label: 'Pre-filed',
    explanation: 'Submitted before the session formally began; it has not been introduced yet.',
    bucket: 'early',
  },
  1: {
    id: 1,
    label: 'Introduced',
    explanation: 'Formally introduced in its originating chamber and referred for consideration.',
    bucket: 'early',
  },
  2: {
    id: 2,
    label: 'Passed one chamber',
    explanation:
      'Engrossed — it passed the chamber where it started and moved to the other chamber.',
    bucket: 'moving',
  },
  3: {
    id: 3,
    label: 'Passed both chambers',
    explanation: 'Enrolled — both the Senate and the Assembly approved it. Next stop: the Governor.',
    bucket: 'moving',
  },
  4: {
    id: 4,
    label: 'Signed into law',
    explanation: 'Passed the Legislature and was approved by the Governor.',
    bucket: 'passed',
  },
  5: {
    id: 5,
    label: 'Vetoed',
    explanation: 'Passed the Legislature but the Governor rejected it.',
    bucket: 'ended',
  },
  6: {
    id: 6,
    label: 'Failed',
    explanation: 'It did not advance and is no longer moving.',
    bucket: 'ended',
  },
  7: {
    id: 7,
    label: 'Veto overridden',
    explanation: 'The Legislature voted to enact it despite the Governor\u2019s veto.',
    bucket: 'passed',
  },
  8: {
    id: 8,
    label: 'Chaptered',
    explanation: 'Assigned a chapter number in state law.',
    bucket: 'passed',
  },
  9: {
    id: 9,
    label: 'Referred to committee',
    explanation: 'Sent to a committee, which decides whether it moves forward.',
    bucket: 'early',
  },
  10: {
    id: 10,
    label: 'Reported favorably',
    explanation: 'A committee voted to advance it.',
    bucket: 'moving',
  },
  11: {
    id: 11,
    label: 'Reported unfavorably',
    explanation: 'A committee voted not to advance it.',
    bucket: 'ended',
  },
  12: {
    id: 12,
    label: 'Draft',
    explanation: 'An early draft that has not been formally introduced.',
    bucket: 'early',
  },
};

export function describeStatus(statusId: number | null | undefined): StatusDefinition {
  if (statusId === null || statusId === undefined) {
    return {
      id: -1,
      label: 'Status unavailable',
      explanation: 'The source data does not currently include a status for this bill.',
      bucket: 'early',
    };
  }
  return (
    BILL_STATUSES[statusId] ?? {
      id: statusId,
      label: 'Status unavailable',
      explanation: 'The source data does not currently include a status for this bill.',
      bucket: 'early',
    }
  );
}

/** Filter buckets offered in the bills explorer. */
export const STATUS_BUCKETS = [
  { value: 'early', label: 'Introduced or in committee' },
  { value: 'moving', label: 'Advancing' },
  { value: 'passed', label: 'Enacted' },
  { value: 'ended', label: 'Stopped' },
] as const;

export type StatusBucket = (typeof STATUS_BUCKETS)[number]['value'];

export const STATUS_BUCKET_LABELS: Record<StatusBucket, string> = Object.fromEntries(
  STATUS_BUCKETS.map((b) => [b.value, b.label]),
) as Record<StatusBucket, string>;

export function statusIdsForBucket(bucket: StatusBucket): number[] {
  return Object.values(BILL_STATUSES)
    .filter((s) => s.bucket === bucket)
    .map((s) => s.id);
}

/* ------------------------------------------------------------------------- */
/* Bill types                                                                 */
/* ------------------------------------------------------------------------- */

export const BILL_TYPES: Record<number, string> = {
  1: 'Bill',
  2: 'Resolution',
  3: 'Concurrent Resolution',
  4: 'Joint Resolution',
  5: 'Joint Resolution Constitutional Amendment',
  6: 'Executive Order',
  7: 'Constitutional Amendment',
  8: 'Memorial',
  9: 'Claim',
  10: 'Commendation',
  11: 'Committee Study Request',
  12: 'Joint Memorial',
  13: 'Proclamation',
  14: 'Study Request',
  15: 'Address',
  16: 'Concurrent Memorial',
  17: 'Initiative',
  18: 'Petition',
  19: 'Study Bill',
  20: 'Initiative Petition',
  21: 'Repeal Bill',
  22: 'Remonstration',
  23: 'Committee Bill',
};

export function billTypeLabel(id: number | null | undefined, fallback?: string | null): string {
  if (id && BILL_TYPES[id]) return BILL_TYPES[id]!;
  return fallback ?? 'Bill';
}

/* ------------------------------------------------------------------------- */
/* Events                                                                     */
/* ------------------------------------------------------------------------- */

export const EVENT_TYPES: Record<number, string> = {
  1: 'Hearing',
  2: 'Executive Session',
  3: 'Markup Session',
};

export const EVENT_TYPE_EXPLANATIONS: Record<string, string> = {
  Hearing: 'A public meeting where a committee takes testimony about legislation.',
  'Executive Session':
    'A committee meeting where members debate and vote on whether bills advance.',
  'Markup Session': 'A working meeting where committee members revise a bill\u2019s text.',
};

export function eventTypeLabel(id: number | null | undefined, fallback?: string | null): string {
  if (id && EVENT_TYPES[id]) return EVENT_TYPES[id]!;
  return fallback ?? 'Scheduled event';
}

/* ------------------------------------------------------------------------- */
/* MIME types                                                                 */
/* ------------------------------------------------------------------------- */

export const MIME_TYPES: Record<number, { mime: string; label: string; extension: string }> = {
  1: { mime: 'text/html', label: 'Web page', extension: 'html' },
  2: { mime: 'application/pdf', label: 'PDF', extension: 'pdf' },
  3: { mime: 'application/vnd.wordperfect', label: 'WordPerfect', extension: 'wpd' },
  4: { mime: 'application/msword', label: 'Word document', extension: 'doc' },
  5: { mime: 'application/rtf', label: 'Rich text', extension: 'rtf' },
  6: {
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    label: 'Word document',
    extension: 'docx',
  },
};

export function mimeLabel(mimeId: number | null | undefined, mime?: string | null): string {
  if (mimeId && MIME_TYPES[mimeId]) return MIME_TYPES[mimeId]!.label;
  if (mime === 'application/pdf') return 'PDF';
  if (mime === 'text/html') return 'Web page';
  return 'Document';
}

export function mimeExtension(mimeId: number | null | undefined, mime?: string | null): string {
  if (mimeId && MIME_TYPES[mimeId]) return MIME_TYPES[mimeId]!.extension;
  if (mime === 'application/pdf') return 'pdf';
  if (mime === 'text/html') return 'html';
  return 'bin';
}

/* ------------------------------------------------------------------------- */
/* People                                                                     */
/* ------------------------------------------------------------------------- */

export const PARTIES: Record<number, string> = {
  1: 'Democrat',
  2: 'Republican',
  3: 'Independent',
  4: 'Green Party',
  5: 'Libertarian',
  6: 'Nonpartisan',
};

const PARTY_ABBREVIATIONS: Record<string, string> = {
  D: 'Democrat',
  R: 'Republican',
  I: 'Independent',
  G: 'Green Party',
  L: 'Libertarian',
  N: 'Nonpartisan',
};

export function partyLabel(party: string | null | undefined, partyId?: number | null): string {
  if (partyId && PARTIES[partyId]) return PARTIES[partyId]!;
  if (party && PARTY_ABBREVIATIONS[party.toUpperCase()]) {
    return PARTY_ABBREVIATIONS[party.toUpperCase()]!;
  }
  return party ?? 'Party not listed';
}

export const ROLES: Record<number, string> = {
  1: 'Assemblymember',
  2: 'Senator',
  3: 'Joint Conference',
};

export function roleLabel(role: string | null | undefined, roleId?: number | null): string {
  if (roleId && ROLES[roleId]) return ROLES[roleId]!;
  if (role === 'Rep') return 'Assemblymember';
  if (role === 'Sen') return 'Senator';
  return role ?? 'Legislator';
}

/* ------------------------------------------------------------------------- */
/* Sponsors                                                                   */
/* ------------------------------------------------------------------------- */

export const SPONSOR_TYPES: Record<number, string> = {
  0: 'Sponsor',
  1: 'Lead sponsor',
  2: 'Co-sponsor',
  3: 'Joint sponsor',
};

export function sponsorTypeLabel(id: number | null | undefined): string {
  if (id === null || id === undefined) return 'Sponsor';
  return SPONSOR_TYPES[id] ?? 'Sponsor';
}

export function isPrimarySponsor(id: number | null | undefined): boolean {
  return id === 1;
}

/* ------------------------------------------------------------------------- */
/* Related bills (SAST)                                                       */
/* ------------------------------------------------------------------------- */

export const SAST_TYPES: Record<number, string> = {
  1: 'Same as',
  2: 'Similar to',
  3: 'Replaced by',
  4: 'Replaces',
  5: 'Cross-filed',
  6: 'Enabling for',
  7: 'Enabled by',
  8: 'Related',
  9: 'Carry over',
};

export const SAST_EXPLANATIONS: Record<number, string> = {
  1: 'The same legislation introduced in the other chamber — a companion bill.',
  2: 'Different text, but covering closely related ground.',
  3: 'This bill was superseded by the related bill.',
  4: 'This bill supersedes the related bill.',
  5: 'Introduced in both chambers at the same time as a matched pair.',
  6: 'This bill makes the related bill possible.',
  7: 'The related bill makes this one possible.',
  8: 'The source identifies a relationship between these bills.',
  9: 'Carried over from a previous legislative session.',
};

export function sastLabel(id: number | null | undefined, fallback?: string | null): string {
  if (id && SAST_TYPES[id]) return SAST_TYPES[id]!;
  return fallback ?? 'Related';
}

/** Companion legislation deserves prominent treatment on a bill page. */
export function isCompanionRelation(id: number | null | undefined): boolean {
  return id === 1 || id === 5;
}

/* ------------------------------------------------------------------------- */
/* Documents                                                                  */
/* ------------------------------------------------------------------------- */

export const TEXT_TYPES: Record<number, string> = {
  1: 'Introduced',
  2: 'Committee Substitute',
  3: 'Amended',
  4: 'Engrossed',
  5: 'Enrolled',
  6: 'Chaptered',
  7: 'Fiscal Note',
  8: 'Analysis',
  9: 'Draft',
  10: 'Conference Substitute',
  11: 'Prefiled',
  12: 'Veto Message',
  13: 'Veto Response',
  14: 'Substitute',
};

export function textTypeLabel(id: number | null | undefined, fallback?: string | null): string {
  if (id && TEXT_TYPES[id]) return TEXT_TYPES[id]!;
  return fallback ?? 'Bill text';
}

export const SUPPLEMENT_TYPES: Record<number, string> = {
  1: 'Fiscal Note',
  2: 'Analysis',
  3: 'Fiscal Note/Analysis',
  4: 'Vote Image',
  5: 'Local Mandate',
  6: 'Corrections Impact',
  7: 'Miscellaneous',
  8: 'Veto Letter',
};

export const SUPPLEMENT_EXPLANATIONS: Record<number, string> = {
  1: 'An estimate of what the bill would cost or raise.',
  2: 'An official written analysis of the bill.',
  3: 'A combined cost estimate and analysis.',
  4: 'A scanned image of a recorded committee vote.',
  5: 'An assessment of costs imposed on local governments.',
  6: 'An assessment of effects on the corrections system.',
  7: 'Other supporting material filed with the bill.',
  8: 'The Governor\u2019s written explanation for rejecting the bill.',
};

export function supplementTypeLabel(id: number | null | undefined, fallback?: string | null): string {
  if (id && SUPPLEMENT_TYPES[id]) return SUPPLEMENT_TYPES[id]!;
  return fallback ?? 'Supporting document';
}

/* ------------------------------------------------------------------------- */
/* Votes                                                                      */
/* ------------------------------------------------------------------------- */

export const VOTE_VALUES: Record<number, { label: string; short: string }> = {
  1: { label: 'Yes', short: 'Y' },
  2: { label: 'No', short: 'N' },
  3: { label: 'Not voting', short: 'NV' },
  4: { label: 'Absent', short: 'A' },
};

export function voteLabel(voteId: number | null | undefined, fallback?: string | null): string {
  if (voteId && VOTE_VALUES[voteId]) return VOTE_VALUES[voteId]!.label;
  return fallback ?? 'Not recorded';
}
