import { describe, expect, it } from 'vitest';

import { fillMonthlySeries } from '@/lib/db/queries/bills';
import { describeStatus, statusIdsForBucket, voteLabel } from '@/lib/legiscan/enums';
import { buildObjectKey } from '@/lib/r2/objects';
import { billSlug, committeeSlug, personSlug } from '@/lib/utils/slug';
import { deriveStages, describeProgress } from '@/lib/utils/stages';
import {
  displayTitle,
  formatBytes,
  formatDate,
  formatDateShort,
  formatEventTime,
  officialShortTitle,
  tidyBillNumber,
} from '@/lib/utils/format';

describe('status translation', () => {
  it('never shows a raw LegiScan code', () => {
    for (let id = 0; id <= 12; id += 1) {
      const status = describeStatus(id);
      expect(status.label).not.toMatch(/^\d+$/);
      expect(status.explanation.length).toBeGreaterThan(10);
    }
  });

  it('degrades gracefully when a status is missing', () => {
    expect(describeStatus(null).label).toBe('Status unavailable');
    expect(describeStatus(999).label).toBe('Status unavailable');
  });

  it('groups statuses into non-overlapping filter buckets', () => {
    const buckets = ['early', 'moving', 'passed', 'ended'] as const;
    const seen = new Set<number>();

    for (const bucket of buckets) {
      for (const id of statusIdsForBucket(bucket)) {
        expect(seen.has(id), `status ${id} appears in two buckets`).toBe(false);
        seen.add(id);
      }
    }

    expect(seen.size).toBeGreaterThan(8);
  });

  it('labels vote values in words', () => {
    expect(voteLabel(1)).toMatch(/yea|yes/i);
    expect(voteLabel(2)).toMatch(/nay|no/i);
  });
});

describe('legislative stages', () => {
  it('marks an introduced bill as waiting in committee', () => {
    const stages = deriveStages(1);
    expect(stages[0]!.state).toBe('done');
    expect(stages[1]!.state).toBe('current');
    expect(stages[4]!.state).toBe('todo');
  });

  it('marks every stage complete once a bill is signed', () => {
    expect(deriveStages(4).every((stage) => stage.state === 'done')).toBe(true);
  });

  it('marks a vetoed bill as stopped at the final step', () => {
    const stages = deriveStages(5);
    expect(stages[4]!.state).toBe('stopped');
    expect(describeProgress(5)).toMatch(/Governor/);
  });

  it('marks a failed bill as stopped rather than in progress', () => {
    expect(deriveStages(6).some((stage) => stage.state === 'stopped')).toBe(true);
  });

  it('always returns the same five stages', () => {
    for (const status of [null, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
      expect(deriveStages(status)).toHaveLength(5);
    }
  });
});

describe('slugs', () => {
  it('builds a stable, readable bill slug', () => {
    expect(billSlug('S1001', 2025)).toBe('s1001-2025');
    expect(billSlug('A 2145', 2025)).toBe('a2145-2025');
  });

  it('builds distinct committee slugs per chamber', () => {
    expect(committeeSlug('Environmental Conservation', 'S')).not.toBe(
      committeeSlug('Environmental Conservation', 'A'),
    );
  });

  it('handles punctuation and accents in names', () => {
    expect(personSlug("Maria O'Neill-Vásquez")).toMatch(/^[a-z0-9-]+$/);
  });
});

describe('R2 object keys', () => {
  it('is deterministic for the same document', () => {
    const parts = {
      sessionId: 2000,
      billId: 12,
      documentKind: 'text' as const,
      documentId: 555,
      mimeId: 2,
    };

    expect(buildObjectKey(parts)).toBe(buildObjectKey(parts));
    expect(buildObjectKey(parts)).toContain('legiscan/2000/12/text/555');
  });

  it('separates document kinds so ids can never collide', () => {
    const base = { sessionId: 1, billId: 2, documentId: 3, mimeId: 2 };
    const text = buildObjectKey({ ...base, documentKind: 'text' });
    const amendment = buildObjectKey({ ...base, documentKind: 'amendment' });

    expect(text).not.toBe(amendment);
  });
});

describe('formatting', () => {
  it('formats a date-only value without time-zone drift', () => {
    expect(formatDate('2025-01-01')).toBe('January 1, 2025');
    expect(formatDateShort('2025-12-31')).toBe('Dec 31, 2025');
  });

  it('says so when a date is missing instead of showing a placeholder date', () => {
    expect(formatDate(null)).toMatch(/not recorded/i);
    expect(formatDateShort(undefined)).toBe('—');
  });

  it('formats byte sizes readably', () => {
    expect(formatBytes(1024)).toMatch(/1(\.0)? KB/);
    expect(formatBytes(null)).toBeTypeOf('string');
  });

  it('strips padding zeros from bill numbers for display', () => {
    expect(tidyBillNumber('S08503')).toBe('S8503');
    expect(tidyBillNumber('S1001')).toBe('S1001');
  });

  it('takes the first clause of an omnibus title and leaves ordinary titles alone', () => {
    const omnibus =
      'Enacts into law major components of legislation necessary to implement the state transportation, economic development and environmental conservation budget for the 2025-2026 state fiscal year; relates to the waterfront commission act (Part A); adds Cortland county to a transit district (Part B)';

    expect(officialShortTitle(omnibus)).toBe(
      'Enacts into law major components of legislation necessary to implement the state transportation, economic development and environmental conservation budget for the 2025-2026 state fiscal year',
    );
    expect(officialShortTitle(omnibus)).not.toContain('Part A');

    const ordinary = 'Relates to lead service line replacement in public water systems';
    expect(officialShortTitle(ordinary)).toBe(ordinary);
    expect(displayTitle(ordinary)).toMatch(/^Relates to lead service line/);
  });

  it('treats a calendar entry with no published time as unknown, not midnight', () => {
    // LegiScan writes "00:00" when the calendar carries no time, and a hearing
    // announced for midnight would send someone to a locked building.
    expect(formatEventTime('00:00')).toBeNull();
    expect(formatEventTime(null)).toBeNull();
    expect(formatEventTime('10:30')).toBe('10:30 a.m.');
    expect(formatEventTime('12:30')).toBe('12:30 p.m.');
    expect(formatEventTime('15:00')).toBe('3:00 p.m.');
  });

  it('still truncates a long title that has no clause break', () => {
    const long = `${'Requires public water systems to test for contaminants '.repeat(8)}.`;
    const shown = displayTitle(long, 80);
    expect(shown.endsWith('…')).toBe(true);
    expect(shown.length).toBeLessThan(long.length);
  });
});

describe('monthly activity series', () => {
  it('fills empty months so a recess cannot hide on the axis', () => {
    const filled = fillMonthlySeries(
      [
        { month: '2025-09', count: 2 },
        { month: '2025-12', count: 2 },
        { month: '2026-01', count: 67 },
      ],
      12,
      new Date('2026-08-18T12:00:00Z'),
    );

    expect(filled).toHaveLength(12);
    expect(filled[0]).toEqual({ month: '2025-09', count: 2 });
    expect(filled.find((point) => point.month === '2025-10')).toEqual({
      month: '2025-10',
      count: 0,
    });
    expect(filled.find((point) => point.month === '2025-11')).toEqual({
      month: '2025-11',
      count: 0,
    });
    expect(filled.at(-1)).toEqual({ month: '2026-08', count: 0 });
  });
});
