/**
 * LegiScan query budget accounting.
 *
 * The Public API allows 30,000 queries per month. Every HTTP attempt counts,
 * including retries, so this counter is incremented by the client before each
 * request rather than after a successful one.
 *
 * Two independent limits are enforced:
 *   - a per-run cap, so a bug cannot drain the month in a single job
 *   - the remaining monthly allowance, read from the database before a run
 */

export const LEGISCAN_MONTHLY_LIMIT = 30_000;

/** Leave headroom so an automated job can never consume the final queries. */
export const MONTHLY_RESERVE = 500;

export class QueryBudgetExceededError extends Error {
  readonly used: number;
  readonly limit: number;
  readonly scope: 'run' | 'month';

  constructor(scope: 'run' | 'month', used: number, limit: number) {
    super(
      scope === 'run'
        ? `LegiScan per-run query limit reached (${used}/${limit}). Stopping safely before consuming more of the monthly budget.`
        : `LegiScan monthly query budget would be exceeded (${used}/${limit}). Stopping safely.`,
    );
    this.name = 'QueryBudgetExceededError';
    this.used = used;
    this.limit = limit;
    this.scope = scope;
  }
}

export interface QueryBudgetOptions {
  /** Hard cap for this single synchronization run. */
  maxQueriesPerRun: number;
  /** Queries already consumed this calendar month, if known. */
  monthlyUsed?: number;
  monthlyLimit?: number;
}

export class QueryBudget {
  private consumed = 0;
  readonly maxQueriesPerRun: number;
  readonly monthlyUsedAtStart: number;
  readonly monthlyLimit: number;

  constructor(options: QueryBudgetOptions) {
    this.maxQueriesPerRun = Math.max(0, options.maxQueriesPerRun);
    this.monthlyUsedAtStart = Math.max(0, options.monthlyUsed ?? 0);
    this.monthlyLimit = options.monthlyLimit ?? LEGISCAN_MONTHLY_LIMIT;
  }

  get used(): number {
    return this.consumed;
  }

  get remainingThisRun(): number {
    return Math.max(0, this.maxQueriesPerRun - this.consumed);
  }

  get remainingThisMonth(): number {
    return Math.max(
      0,
      this.monthlyLimit - MONTHLY_RESERVE - (this.monthlyUsedAtStart + this.consumed),
    );
  }

  canAfford(count = 1): boolean {
    return this.remainingThisRun >= count && this.remainingThisMonth >= count;
  }

  /** Called immediately before an HTTP attempt. Throws rather than overspending. */
  consume(count = 1): void {
    if (this.consumed + count > this.maxQueriesPerRun) {
      throw new QueryBudgetExceededError('run', this.consumed + count, this.maxQueriesPerRun);
    }
    const monthlyTotal = this.monthlyUsedAtStart + this.consumed + count;
    if (monthlyTotal > this.monthlyLimit - MONTHLY_RESERVE) {
      throw new QueryBudgetExceededError('month', monthlyTotal, this.monthlyLimit);
    }
    this.consumed += count;
  }

  summary(): {
    used: number;
    maxQueriesPerRun: number;
    monthlyUsedAtStart: number;
    monthlyRemaining: number;
  } {
    return {
      used: this.consumed,
      maxQueriesPerRun: this.maxQueriesPerRun,
      monthlyUsedAtStart: this.monthlyUsedAtStart,
      monthlyRemaining: this.remainingThisMonth,
    };
  }
}
