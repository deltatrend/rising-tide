import { describe, expect, it } from 'vitest';

import { needsDetailFetch, partitionByChangeHash } from '@/lib/legiscan/bills';
import {
  LEGISCAN_MONTHLY_LIMIT,
  MONTHLY_RESERVE,
  QueryBudget,
  QueryBudgetExceededError,
} from '@/lib/legiscan/budget';
import { buildLegiScanEventId } from '@/lib/sync/persist';
import { SYNC_DEFAULTS } from '@/lib/sync/types';

describe('incremental fetch decisions', () => {
  it('fetches a bill we have never stored', () => {
    expect(needsDetailFetch(null, 'abc')).toBe(true);
    expect(needsDetailFetch(undefined, 'abc')).toBe(true);
  });

  it('skips a bill whose change hash has not moved', () => {
    expect(needsDetailFetch('abc', 'abc')).toBe(false);
  });

  it('fetches a bill whose change hash moved', () => {
    expect(needsDetailFetch('abc', 'def')).toBe(true);
  });

  it('does not refetch when the incoming hash is missing', () => {
    // No hash means no evidence of change; spending a query would be a guess.
    expect(needsDetailFetch('abc', null)).toBe(false);
  });

  it('partitions candidates without any network access', () => {
    const candidates = [
      { billId: 1, changeHash: 'a' },
      { billId: 2, changeHash: 'b-new' },
      { billId: 3, changeHash: 'c' },
    ];

    const stored = new Map<number, string | null>([
      [1, 'a'],
      [2, 'b-old'],
    ]);

    const { changed, unchanged } = partitionByChangeHash(candidates, stored);

    expect(unchanged.map((c) => c.billId)).toEqual([1]);
    expect(changed.map((c) => c.billId)).toEqual([2, 3]);
  });
});

describe('query budget', () => {
  it('counts every consumed query', () => {
    const budget = new QueryBudget({ maxQueriesPerRun: 10 });
    budget.consume();
    budget.consume(3);
    expect(budget.used).toBe(4);
    expect(budget.remainingThisRun).toBe(6);
  });

  it('stops the run before exceeding the per-run cap', () => {
    const budget = new QueryBudget({ maxQueriesPerRun: 2 });
    budget.consume(2);

    expect(() => budget.consume()).toThrow(QueryBudgetExceededError);
    expect(budget.used).toBe(2);
  });

  it('stops before consuming the monthly reserve', () => {
    const budget = new QueryBudget({
      maxQueriesPerRun: 1000,
      monthlyUsed: LEGISCAN_MONTHLY_LIMIT - MONTHLY_RESERVE - 1,
    });

    budget.consume();
    expect(() => budget.consume()).toThrow(QueryBudgetExceededError);
  });

  it('reports affordability without consuming anything', () => {
    const budget = new QueryBudget({ maxQueriesPerRun: 3 });
    expect(budget.canAfford(3)).toBe(true);
    expect(budget.canAfford(4)).toBe(false);
    expect(budget.used).toBe(0);
  });

  it('keeps the default daily ceiling inside the monthly allowance', () => {
    // Even running every day of a long month must stay well under the limit.
    expect(SYNC_DEFAULTS.maxQueries * 31).toBeLessThan(LEGISCAN_MONTHLY_LIMIT - MONTHLY_RESERVE);
  });
});

describe('event identity', () => {
  const entry = {
    date: '2025-04-01',
    time: '10:00 AM',
    type_id: 1,
    description: 'Public hearing on drinking water standards',
  };

  it('derives the same id for the same calendar entry', () => {
    expect(buildLegiScanEventId(500, entry)).toBe(buildLegiScanEventId(500, entry));
  });

  it('derives different ids for different bills or times', () => {
    expect(buildLegiScanEventId(500, entry)).not.toBe(buildLegiScanEventId(501, entry));
    expect(buildLegiScanEventId(500, entry)).not.toBe(
      buildLegiScanEventId(500, { ...entry, time: '2:00 PM' }),
    );
  });

  it('handles an undated entry without throwing', () => {
    expect(buildLegiScanEventId(500, { ...entry, date: null })).toContain('undated');
  });
});
