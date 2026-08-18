import { describe, expect, it } from 'vitest';

import type { LegislatorSummary } from '@/lib/db/queries/legislators';
import {
  applyLegislatorFilters,
  buildLegislatorHref,
  districtMatches,
  hasActiveLegislatorFilters,
  legislatorChamber,
  parseLegislatorFilters,
} from '@/lib/utils/legislator-params';

function person(overrides: Partial<LegislatorSummary>): LegislatorSummary {
  return {
    slug: 'x',
    name: 'Jane Doe',
    lastName: 'Doe',
    party: 'D',
    partyId: 1,
    role: 'Sen',
    roleId: 2,
    district: 'SD-040',
    sponsoredCount: 0,
    cosponsoredCount: 0,
    ...overrides,
  };
}

describe('parseLegislatorFilters', () => {
  it('defaults to the bill ranking with no filters', () => {
    expect(parseLegislatorFilters({})).toEqual({ q: undefined, chamber: undefined, sort: 'bills' });
  });

  it('accepts a chamber in either case and rejects anything else', () => {
    expect(parseLegislatorFilters({ chamber: 's' }).chamber).toBe('S');
    expect(parseLegislatorFilters({ chamber: 'A' }).chamber).toBe('A');
    expect(parseLegislatorFilters({ chamber: 'X' }).chamber).toBeUndefined();
  });

  it('trims and caps the query, and takes the first repeated param', () => {
    expect(parseLegislatorFilters({ q: '  harckham  ' }).q).toBe('harckham');
    expect(parseLegislatorFilters({ q: 'a'.repeat(500) }).q).toHaveLength(120);
    expect(parseLegislatorFilters({ chamber: ['S', 'A'] }).chamber).toBe('S');
  });

  it('only honours a known sort', () => {
    expect(parseLegislatorFilters({ sort: 'name' }).sort).toBe('name');
    expect(parseLegislatorFilters({ sort: 'nonsense' }).sort).toBe('bills');
  });
});

describe('buildLegislatorHref', () => {
  it('omits defaults so the canonical URL stays clean', () => {
    expect(buildLegislatorHref('/legislators', parseLegislatorFilters({}))).toBe('/legislators');
    expect(buildLegislatorHref('/legislators', parseLegislatorFilters({ sort: 'bills' }))).toBe(
      '/legislators',
    );
  });

  it('keeps other filters when one changes', () => {
    const filters = parseLegislatorFilters({ q: 'may', chamber: 'S' });
    expect(buildLegislatorHref('/legislators', filters, { sort: 'name' })).toBe(
      '/legislators?q=may&chamber=S&sort=name',
    );
  });

  it('removes a filter when passed null', () => {
    const filters = parseLegislatorFilters({ q: 'may', chamber: 'S' });
    expect(buildLegislatorHref('/legislators', filters, { chamber: null })).toBe(
      '/legislators?q=may',
    );
  });
});

describe('hasActiveLegislatorFilters', () => {
  // Drives the noindex decision: a sort is a view of the same set, so on its own
  // it must not mark the page as filtered.
  it('counts search and chamber but not sort', () => {
    expect(hasActiveLegislatorFilters(parseLegislatorFilters({}))).toBe(false);
    expect(hasActiveLegislatorFilters(parseLegislatorFilters({ sort: 'name' }))).toBe(false);
    expect(hasActiveLegislatorFilters(parseLegislatorFilters({ q: 'may' }))).toBe(true);
    expect(hasActiveLegislatorFilters(parseLegislatorFilters({ chamber: 'S' }))).toBe(true);
  });
});

describe('districtMatches', () => {
  it('matches a bare number without matching a longer district', () => {
    expect(districtMatches('SD-040', '40')).toBe(true);
    expect(districtMatches('HD-040', '40')).toBe(true);
    expect(districtMatches('HD-140', '40')).toBe(false);
  });

  it('matches a chamber-qualified district', () => {
    expect(districtMatches('SD-040', 'sd40')).toBe(true);
    expect(districtMatches('SD-040', 'SD-40')).toBe(true);
    expect(districtMatches('HD-040', 'sd40')).toBe(false);
  });

  it('matches a chamber prefix on its own', () => {
    expect(districtMatches('SD-040', 'sd')).toBe(true);
    expect(districtMatches('HD-040', 'sd')).toBe(false);
  });

  it('is safe on missing or empty input', () => {
    expect(districtMatches(null, '40')).toBe(false);
    expect(districtMatches('SD-040', '  ')).toBe(false);
  });
});

describe('legislatorChamber', () => {
  it('reads the role id first, then the role string', () => {
    expect(legislatorChamber({ role: null, roleId: 2 })).toBe('S');
    expect(legislatorChamber({ role: null, roleId: 1 })).toBe('A');
    expect(legislatorChamber({ role: 'Sen', roleId: null })).toBe('S');
    expect(legislatorChamber({ role: 'Rep', roleId: null })).toBe('A');
    expect(legislatorChamber({ role: null, roleId: null })).toBeNull();
  });
});

describe('applyLegislatorFilters', () => {
  const list = [
    person({ slug: 'a', name: 'Peter Harckham', lastName: 'Harckham', sponsoredCount: 8 }),
    person({ slug: 'b', name: 'Rachel May', lastName: 'May', sponsoredCount: 7 }),
    person({
      slug: 'c',
      name: 'Anna Kelles',
      lastName: 'Kelles',
      role: 'Rep',
      roleId: 1,
      district: 'HD-125',
      sponsoredCount: 4,
    }),
  ];

  it('ranks by lead sponsorships by default', () => {
    const result = applyLegislatorFilters(list, parseLegislatorFilters({}));
    expect(result.map((p) => p.slug)).toEqual(['a', 'b', 'c']);
  });

  it('sorts by surname when asked', () => {
    const result = applyLegislatorFilters(list, parseLegislatorFilters({ sort: 'name' }));
    expect(result.map((p) => p.lastName)).toEqual(['Harckham', 'Kelles', 'May']);
  });

  it('filters by chamber', () => {
    const result = applyLegislatorFilters(list, parseLegislatorFilters({ chamber: 'A' }));
    expect(result.map((p) => p.slug)).toEqual(['c']);
  });

  it('searches by name, case insensitively', () => {
    const result = applyLegislatorFilters(list, parseLegislatorFilters({ q: 'HARCK' }));
    expect(result.map((p) => p.slug)).toEqual(['a']);
  });

  it('searches by district number', () => {
    const result = applyLegislatorFilters(list, parseLegislatorFilters({ q: '125' }));
    expect(result.map((p) => p.slug)).toEqual(['c']);
  });

  it('combines search and chamber', () => {
    const result = applyLegislatorFilters(
      list,
      parseLegislatorFilters({ q: '40', chamber: 'A' }),
    );
    expect(result).toHaveLength(0);
  });

  it('does not mutate the array it is given', () => {
    const original = [...list];
    applyLegislatorFilters(list, parseLegislatorFilters({ sort: 'name' }));
    expect(list).toEqual(original);
  });
});
