/**
 * URL <-> filter translation for the legislator directory.
 *
 * The whole directory is ~180 rows and already arrives in a single query, so
 * searching and sorting happen in memory here rather than in SQL. Filters still
 * live in the query string, which keeps every view shareable and crawlable.
 */

import type { LegislatorSummary } from '@/lib/db/queries/legislators';

import type { RawSearchParams } from './search-params';

export type LegislatorSort = 'bills' | 'name';

export interface LegislatorFilters {
  q?: string;
  chamber?: 'S' | 'A';
  sort: LegislatorSort;
}

function single(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export function parseLegislatorFilters(params: RawSearchParams): LegislatorFilters {
  const chamber = single(params.chamber)?.toUpperCase();
  const sort = single(params.sort);

  return {
    q: single(params.q)?.trim().slice(0, 120) || undefined,
    chamber: chamber === 'S' || chamber === 'A' ? chamber : undefined,
    sort: sort === 'name' ? 'name' : 'bills',
  };
}

export function buildLegislatorHref(
  basePath: string,
  filters: LegislatorFilters,
  overrides: Partial<Record<keyof LegislatorFilters, string | null>> = {},
): string {
  const current: Record<string, string | undefined> = {
    q: filters.q,
    chamber: filters.chamber,
    sort: filters.sort === 'name' ? 'name' : undefined,
  };

  for (const [key, value] of Object.entries(overrides)) {
    current[key] = value === null || value === '' ? undefined : value;
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(current)) {
    if (value) params.set(key, value);
  }

  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function hasActiveLegislatorFilters(filters: LegislatorFilters): boolean {
  return Boolean(filters.q || filters.chamber);
}

/** LegiScan reports the chamber as either a role id or a short role string. */
export function legislatorChamber(
  person: Pick<LegislatorSummary, 'role' | 'roleId'>,
): 'S' | 'A' | null {
  if (person.roleId === 2) return 'S';
  if (person.roleId === 1) return 'A';
  if (person.role === 'Sen') return 'S';
  if (person.role === 'Rep') return 'A';
  return null;
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Digits only, with the chamber prefix and zero padding removed: SD-040 -> 40. */
function districtNumber(value: string): string {
  return normalize(value).replace(/^[a-z]+/, '').replace(/^0+/, '');
}

/**
 * Districts read as "SD-040", but people look up "40" or "senate district 40".
 * A bare number is compared as a number so that searching 40 does not also
 * return district 140, which a plain substring match would.
 */
export function districtMatches(district: string | null, query: string): boolean {
  if (!district) return false;
  const q = normalize(query);
  if (!q) return false;

  const d = normalize(district);
  if (/^\d+$/.test(q)) return districtNumber(d) === q.replace(/^0+/, '');
  if (/^[a-z]+\d+$/.test(q)) {
    const queryPrefix = /^[a-z]+/.exec(q)?.[0] ?? '';
    const districtPrefix = /^[a-z]+/.exec(d)?.[0] ?? '';
    return districtPrefix.startsWith(queryPrefix) && districtNumber(d) === districtNumber(q);
  }
  return d.includes(q);
}

export function applyLegislatorFilters(
  legislators: LegislatorSummary[],
  filters: LegislatorFilters,
): LegislatorSummary[] {
  const query = filters.q?.toLowerCase();

  const matched = legislators.filter((person) => {
    if (filters.chamber && legislatorChamber(person) !== filters.chamber) return false;
    if (!query) return true;
    return person.name.toLowerCase().includes(query) || districtMatches(person.district, query);
  });

  const byName = (a: LegislatorSummary, b: LegislatorSummary) =>
    (a.lastName ?? a.name).localeCompare(b.lastName ?? b.name) || a.name.localeCompare(b.name);

  return matched.sort((a, b) =>
    filters.sort === 'name'
      ? byName(a, b)
      : b.sponsoredCount - a.sponsoredCount ||
        b.cosponsoredCount - a.cosponsoredCount ||
        byName(a, b),
  );
}
