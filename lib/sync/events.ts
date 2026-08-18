/**
 * Public event sources.
 *
 * V1 ingests the legislative calendar entries LegiScan attaches to bills we
 * track. That is genuinely not every public water meeting in New York, and the
 * UI says so.
 *
 * The interface below is the extension point: an official DEC hearing feed, a
 * regulatory comment calendar, or a water authority meeting feed can be added as
 * another implementation without touching the schema, the queries or any page.
 * Unofficial scraping of agency websites is explicitly out of scope.
 */

import { eq } from 'drizzle-orm';

import type { Database } from '@/lib/db/client';
import { bills } from '@/lib/db/schema';
import { billSchema } from '@/lib/legiscan/schemas';
import { upsertBillEvents } from './persist';
import type { SyncError } from './types';

export interface PublicEventSyncResult {
  source: string;
  eventsUpserted: number;
  errors: SyncError[];
}

export interface PublicEventSource {
  /** Stable identifier stored in `events.source`. */
  readonly id: string;
  readonly label: string;
  /** Shown on the events page so coverage is never overstated. */
  readonly coverageNote: string;
  sync(): Promise<PublicEventSyncResult>;
}

/**
 * Rebuilds events from the LegiScan bill payloads already stored locally.
 *
 * During a normal run events are written as each bill is persisted, so this
 * costs zero API queries. It exists as a repair path — for example after the
 * topic taxonomy changes and event topic links need rebuilding.
 */
export class LegiScanLegislativeEventSource implements PublicEventSource {
  readonly id = 'legiscan';
  readonly label = 'LegiScan legislative calendar';
  readonly coverageNote =
    'Committee hearings and calendar entries that LegiScan associates with the bills Rising Tide tracks.';

  constructor(private readonly db: Database) {}

  async sync(): Promise<PublicEventSyncResult> {
    const result: PublicEventSyncResult = { source: this.id, eventsUpserted: 0, errors: [] };

    const rows = await this.db
      .select({ id: bills.id, raw: bills.raw })
      .from(bills)
      .where(eq(bills.isTracked, true));

    for (const row of rows) {
      if (!row.raw) continue;
      const parsed = billSchema.safeParse(row.raw);
      if (!parsed.success) {
        result.errors.push({
          stage: 'events',
          subject: `bill:${row.id}`,
          message: 'Stored LegiScan payload could not be re-parsed.',
        });
        continue;
      }

      try {
        result.eventsUpserted += await upsertBillEvents(this.db, row.id, parsed.data, true);
      } catch (error) {
        result.errors.push({
          stage: 'events',
          subject: `bill:${row.id}`,
          message: error instanceof Error ? error.message : 'Unknown event error',
        });
      }
    }

    return result;
  }
}

/** Sources that currently contribute events, for display on the events page. */
export const ACTIVE_EVENT_SOURCES = [
  {
    id: 'legiscan',
    label: 'LegiScan legislative calendar',
    coverageNote:
      'Committee hearings and calendar entries that LegiScan associates with the bills Rising Tide tracks.',
  },
] as const;

/**
 * Sources a future developer could add. Listed so the gap in coverage is
 * documented rather than implied.
 */
export const PLANNED_EVENT_SOURCES = [
  'New York State Department of Environmental Conservation hearings',
  'State regulatory public comment meetings',
  'Regional water authority and watershed board meetings',
] as const;
