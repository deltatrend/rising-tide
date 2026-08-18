/**
 * URL <-> filter translation for the bills explorer.
 *
 * Filters live entirely in the query string so every view is shareable,
 * bookmarkable, crawlable and reachable with the browser back button. Nothing
 * here depends on client-side state.
 */

import type { BillFilters, BillSort } from '@/lib/db/queries/bills';
import type { StatusBucket } from '@/lib/legiscan/enums';

export type RawSearchParams = Record<string, string | string[] | undefined>;

const STATUS_VALUES: StatusBucket[] = ['early', 'moving', 'passed', 'ended'];
const SORT_VALUES: BillSort[] = ['updated', 'introduced', 'relevance', 'number'];

function single(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export function parseBillFilters(params: RawSearchParams): BillFilters {
  const status = single(params.status);
  const sort = single(params.sort);
  const chamber = single(params.chamber)?.toUpperCase();
  const page = Number(single(params.page) ?? '1');

  return {
    topic: single(params.topic) || undefined,
    committee: single(params.committee) || undefined,
    sponsor: single(params.sponsor) || undefined,
    q: single(params.q)?.slice(0, 120) || undefined,
    since: /^\d{4}-\d{2}-\d{2}$/.test(single(params.since) ?? '') ? single(params.since) : undefined,
    status: STATUS_VALUES.includes(status as StatusBucket) ? (status as StatusBucket) : undefined,
    chamber: chamber === 'S' || chamber === 'A' ? (chamber as 'S' | 'A') : undefined,
    hasUpcomingEvent: single(params.event) === 'upcoming' ? true : undefined,
    hasVotes: single(params.votes) === 'recorded' ? true : undefined,
    sort: SORT_VALUES.includes(sort as BillSort) ? (sort as BillSort) : 'updated',
    page: Number.isFinite(page) && page > 0 ? Math.floor(page) : 1,
  };
}

/**
 * Builds a filter URL. Passing `null` for a key removes it, which is what makes
 * "clear this filter" links work without any JavaScript.
 */
export function buildBillHref(
  basePath: string,
  filters: BillFilters,
  overrides: Partial<Record<keyof BillFilters, string | number | boolean | null>> = {},
): string {
  const params = new URLSearchParams();

  const current: Record<string, string | undefined> = {
    topic: filters.topic,
    committee: filters.committee,
    sponsor: filters.sponsor,
    q: filters.q,
    since: filters.since,
    status: filters.status,
    chamber: filters.chamber,
    event: filters.hasUpcomingEvent ? 'upcoming' : undefined,
    votes: filters.hasVotes ? 'recorded' : undefined,
    sort: filters.sort && filters.sort !== 'updated' ? filters.sort : undefined,
    page: filters.page && filters.page > 1 ? String(filters.page) : undefined,
  };

  const keyMap: Partial<Record<keyof BillFilters, string>> = {
    hasUpcomingEvent: 'event',
    hasVotes: 'votes',
  };

  for (const [key, value] of Object.entries(overrides)) {
    const paramKey = keyMap[key as keyof BillFilters] ?? key;

    if (value === null || value === undefined || value === false || value === '') {
      current[paramKey] = undefined;
    } else if (value === true) {
      current[paramKey] = paramKey === 'event' ? 'upcoming' : 'recorded';
    } else {
      current[paramKey] = String(value);
    }
  }

  // Any filter change returns to the first page — page 7 of a different filter
  // set is meaningless.
  if (Object.keys(overrides).some((key) => key !== 'page')) {
    current.page = undefined;
  }

  for (const [key, value] of Object.entries(current)) {
    if (value) params.set(key, value);
  }

  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function hasActiveFilters(filters: BillFilters): boolean {
  return Boolean(
    filters.topic ||
      filters.committee ||
      filters.sponsor ||
      filters.q ||
      filters.status ||
      filters.chamber ||
      filters.since ||
      filters.hasUpcomingEvent ||
      filters.hasVotes,
  );
}

/** Human summary of the current filters, used in headings and page titles. */
export function describeFilters(
  filters: BillFilters,
  lookups: {
    topicName?: string;
    committeeName?: string;
    sponsorName?: string;
  } = {},
): string {
  const parts: string[] = [];

  if (lookups.topicName) parts.push(lookups.topicName);
  if (filters.status === 'early') parts.push('in committee');
  if (filters.status === 'moving') parts.push('advancing');
  if (filters.status === 'passed') parts.push('enacted');
  if (filters.status === 'ended') parts.push('stopped');
  if (filters.chamber === 'S') parts.push('in the Senate');
  if (filters.chamber === 'A') parts.push('in the Assembly');
  if (lookups.committeeName) parts.push(`referred to ${lookups.committeeName}`);
  if (lookups.sponsorName) parts.push(`sponsored by ${lookups.sponsorName}`);
  if (filters.hasUpcomingEvent) parts.push('with an upcoming hearing');
  if (filters.hasVotes) parts.push('with a recorded vote');
  if (filters.q) parts.push(`matching “${filters.q}”`);

  if (parts.length === 0) return 'All tracked water bills';
  return `Water bills ${parts.join(', ')}`;
}
