/** Synchronization contracts shared by the cron route, the CLI and the service. */

export type SyncTrigger = 'cron' | 'manual' | 'dry-run' | 'fixture';

export interface SyncOptions {
  trigger: SyncTrigger;
  /**
   * Hard per-run ceiling on LegiScan queries. The default leaves the daily job
   * comfortably inside 30,000/month even if it runs every day of the month.
   */
  maxQueries?: number;
  /** Cap on getBill calls, the most expensive part of a run. */
  maxBillFetches?: number;
  /** Cap on getRollCall calls. */
  maxRollCallFetches?: number;
  /** Cap on document blob downloads cached to R2. 0 disables caching. */
  maxDocumentFetches?: number;
  /** Discovery only, no writes and no detail fetches. */
  dryRun?: boolean;
  /** Restrict to specific LegiScan bill ids — used for targeted repair. */
  onlyBillIds?: number[];
  /** Receives progress lines. Never receives secrets. */
  logger?: (message: string) => void;
}

export interface SyncError {
  stage: string;
  subject?: string;
  message: string;
}

export interface SyncResult {
  runId: number | null;
  status: 'success' | 'partial' | 'failed' | 'skipped';
  trigger: SyncTrigger;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  sessionLabel: string | null;
  legiscanSessionId: number | null;
  classifierVersion: string;
  queriesConsumed: number;
  queryBudget: {
    maxQueriesPerRun: number;
    monthlyUsedBefore: number;
    monthlyRemainingAfter: number;
  };
  candidatesDiscovered: number;
  billsInserted: number;
  billsUpdated: number;
  billsUnchanged: number;
  billsRejected: number;
  rollCallsUpdated: number;
  eventsUpserted: number;
  documentsFetched: number;
  documentsStored: number;
  errors: SyncError[];
  notes: string[];
}

export const SYNC_DEFAULTS = {
  /**
   * ~24 searches x 2 pages = ~48, plus 1 session list, plus up to 150 bill
   * detail fetches, plus roll calls and documents. 400 gives headroom while
   * keeping a runaway loop impossible: 400/day x 31 = 12,400/month.
   */
  maxQueries: 400,
  maxBillFetches: 150,
  maxRollCallFetches: 40,
  maxDocumentFetches: 10,
} as const;
