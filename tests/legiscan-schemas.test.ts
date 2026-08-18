import { describe, expect, it } from 'vitest';

import {
  billSchema,
  normalizeBillCommittee,
  parseMasterList,
  parseSearchPage,
  rollCallSchema,
  sessionSchema,
} from '@/lib/legiscan/schemas';
import { FIXTURE_BILLS_RAW, fixtureBills, fixtureRollCalls } from '@/lib/fixtures/legiscan';

describe('LegiScan payload parsing', () => {
  it('parses every fixture bill without loss', () => {
    const bills = fixtureBills();
    expect(bills).toHaveLength(FIXTURE_BILLS_RAW.length);

    const first = bills[0]!;
    expect(first.bill_number).toBe('S1001');
    expect(first.status).toBe(10);
    expect(first.history.length).toBeGreaterThan(0);
    expect(first.sponsors[0]?.name).toBe('Maria Delgado');
  });

  it('parses roll calls with their individual votes', () => {
    const [rollCall] = fixtureRollCalls();
    expect(rollCall!.votes).toHaveLength(3);
    expect(rollCall!.passed).toBe(true);
  });

  it('coerces numeric strings that LegiScan sometimes sends', () => {
    const parsed = billSchema.parse({
      bill_id: '4321',
      session_id: '99',
      bill_number: 'S9',
      title: 'A bill',
      status: '4',
      body_id: '1',
    });

    expect(parsed.bill_id).toBe(4321);
    expect(parsed.session_id).toBe(99);
    expect(parsed.status).toBe(4);
    expect(parsed.body_id).toBe(1);
  });

  it('treats 0000-00-00 as a missing date rather than a real one', () => {
    const parsed = billSchema.parse({
      bill_id: 1,
      session_id: 1,
      bill_number: 'S1',
      title: 'A bill',
      status_date: '0000-00-00',
      history: [{ date: '0000-00-00', action: 'Filed', importance: 0 }],
    });

    expect(parsed.status_date).toBeNull();
    expect(parsed.history[0]?.date).toBeNull();
  });

  it('reads 0/1 flags, string flags and booleans identically', () => {
    const session = sessionSchema.parse({
      session_id: 1,
      year_start: 2025,
      year_end: 2026,
      prior: '1',
      special: 0,
      sine_die: true,
    });

    expect(session.prior).toBe(true);
    expect(session.special).toBe(false);
    expect(session.sine_die).toBe(true);
  });

  it('defaults every collection so callers never guard for undefined', () => {
    const parsed = billSchema.parse({
      bill_id: 1,
      session_id: 1,
      bill_number: 'S1',
      title: 'A bill',
    });

    expect(parsed.history).toEqual([]);
    expect(parsed.sponsors).toEqual([]);
    expect(parsed.votes).toEqual([]);
    expect(parsed.calendar).toEqual([]);
    expect(parsed.subjects).toEqual([]);
  });

  it('normalizes the committee field whether it is an object or an empty array', () => {
    const withCommittee = normalizeBillCommittee({
      committee_id: 7,
      chamber: 'S',
      chamber_id: 1,
      name: 'Environmental Conservation',
      committee_name: 'Senate Environmental Conservation Committee',
    });

    expect(withCommittee?.name).toBe('Environmental Conservation');
    expect(withCommittee?.committeeId).toBe(7);

    // LegiScan sends [] when a bill is not pending in committee.
    expect(normalizeBillCommittee([])).toBeNull();
    expect(normalizeBillCommittee(undefined)).toBeNull();
  });

  it('falls back to committee_name when name is absent', () => {
    const normalized = normalizeBillCommittee({
      committee_id: null,
      chamber: 'A',
      chamber_id: 2,
      name: null,
      committee_name: 'Assembly Ways and Means',
    });

    expect(normalized?.name).toBe('Assembly Ways and Means');
  });

  it('extracts master list entries and ignores the session member', () => {
    const entries = parseMasterList({
      masterlist: {
        session: { session_id: 2000, session_name: 'Regular Session' },
        '0': { bill_id: 11, number: 'S11', change_hash: 'aaa' },
        '1': { bill_id: 12, number: 'A12', change_hash: 'bbb' },
      },
    });

    expect(entries.map((e) => e.bill_id)).toEqual([11, 12]);
    expect(entries[0]?.change_hash).toBe('aaa');
  });

  it('extracts search results and the paging summary', () => {
    const page = parseSearchPage({
      searchresult: {
        summary: { page: 'Page 1 of 3', count: 57, page_current: 1, page_total: 3 },
        '0': { bill_id: 21, bill_number: 'S21', relevance: 92, change_hash: 'ccc' },
        '1': { bill_id: 22, bill_number: 'A22', relevance: 61, change_hash: 'ddd' },
      },
    });

    expect(page.summary.page_total).toBe(3);
    expect(page.results).toHaveLength(2);
    expect(page.results[0]?.relevance).toBe(92);
  });

  it('returns an empty page instead of throwing on an unexpected shape', () => {
    const page = parseSearchPage({ unexpected: true });
    expect(page.results).toEqual([]);
    expect(page.summary.page_total).toBeNull();
  });

  it('rejects a roll call without an identifier', () => {
    expect(() => rollCallSchema.parse({ bill_id: 1, votes: [] })).toThrow();
  });
});
