import { describe, expect, it } from 'vitest';

import {
  buildBillHref,
  describeFilters,
  hasActiveFilters,
  listActiveFilters,
  parseBillFilters,
} from '@/lib/utils/search-params';

describe('bill filter parsing', () => {
  it('defaults to the first page sorted by recent activity', () => {
    const filters = parseBillFilters({});
    expect(filters.page).toBe(1);
    expect(filters.sort).toBe('updated');
    expect(hasActiveFilters(filters)).toBe(false);
  });

  it('reads every supported filter from the query string', () => {
    const filters = parseBillFilters({
      topic: 'wetlands',
      status: 'moving',
      chamber: 's',
      committee: 'senate-environmental-conservation',
      sponsor: 'maria-delgado',
      q: 'PFAS',
      event: 'upcoming',
      votes: 'recorded',
      sort: 'relevance',
      page: '3',
    });

    expect(filters).toMatchObject({
      topic: 'wetlands',
      status: 'moving',
      chamber: 'S',
      committee: 'senate-environmental-conservation',
      sponsor: 'maria-delgado',
      q: 'PFAS',
      hasUpcomingEvent: true,
      hasVotes: true,
      sort: 'relevance',
      page: 3,
    });
  });

  it('ignores values that are not valid options', () => {
    const filters = parseBillFilters({
      status: 'exploded',
      chamber: 'Z',
      sort: 'random',
      page: '-4',
      since: 'yesterday',
    });

    expect(filters.status).toBeUndefined();
    expect(filters.chamber).toBeUndefined();
    expect(filters.sort).toBe('updated');
    expect(filters.page).toBe(1);
    expect(filters.since).toBeUndefined();
  });

  it('takes the first value when a parameter is repeated', () => {
    expect(parseBillFilters({ topic: ['wetlands', 'fisheries'] }).topic).toBe('wetlands');
  });

  it('caps an over-long search term', () => {
    const filters = parseBillFilters({ q: 'a'.repeat(500) });
    expect(filters.q!.length).toBeLessThanOrEqual(120);
  });
});

describe('bill filter URLs', () => {
  const base = parseBillFilters({ topic: 'wetlands', status: 'moving', page: '4' });

  it('round-trips through a URL unchanged', () => {
    const href = buildBillHref('/bills', base);
    const query = Object.fromEntries(new URL(href, 'https://example.org').searchParams);

    expect(parseBillFilters(query)).toMatchObject({
      topic: 'wetlands',
      status: 'moving',
      page: 4,
    });
  });

  it('omits defaults so shared links stay short', () => {
    expect(buildBillHref('/bills', parseBillFilters({}))).toBe('/bills');
  });

  it('removes a filter when the override is null', () => {
    const href = buildBillHref('/bills', base, { topic: null });
    expect(href).not.toContain('topic=');
    expect(href).toContain('status=moving');
  });

  it('returns to page one whenever a filter changes', () => {
    expect(buildBillHref('/bills', base, { status: 'passed' })).not.toContain('page=');
  });

  it('keeps filters when only the page changes', () => {
    const href = buildBillHref('/bills', base, { page: 2 });
    expect(href).toContain('topic=wetlands');
    expect(href).toContain('page=2');
  });

  it('encodes search terms safely', () => {
    const href = buildBillHref('/bills', parseBillFilters({ q: 'lead & copper' }));
    expect(href).not.toContain(' ');
    expect(href).toContain('q=lead');
  });
});

describe('filter descriptions', () => {
  it('describes an unfiltered view plainly', () => {
    expect(describeFilters(parseBillFilters({}))).toBe('All tracked water bills');
  });

  it('names the topic and stage in readable English', () => {
    const description = describeFilters(parseBillFilters({ status: 'early', chamber: 'S' }), {
      topicName: 'Wetlands',
    });

    expect(description).toContain('Wetlands');
    expect(description).toContain('in committee');
    expect(description).toContain('Senate');
  });

  it('lists removable chips for each active filter', () => {
    const chips = listActiveFilters(
      parseBillFilters({ q: 'PFAS', status: 'early', chamber: 'S', topic: 'wetlands' }),
      { topicName: 'Wetlands' },
    );

    expect(chips.map((chip) => chip.key)).toEqual(['q', 'status', 'chamber', 'topic']);
    expect(chips.find((chip) => chip.key === 'topic')?.label).toBe('Wetlands');
    expect(chips.find((chip) => chip.key === 'q')?.href).not.toContain('q=PFAS');
    expect(chips.find((chip) => chip.key === 'q')?.href).toContain('topic=wetlands');
  });
});
