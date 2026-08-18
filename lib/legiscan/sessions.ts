/** getSessionList and New York session selection. */

import type { LegiScanClient } from './client';
import { sessionListResponseSchema, type LegiScanSession } from './schemas';

export const NY_STATE_ABBREVIATION = 'NY';

/** One API query. Recommended refresh frequency: daily. */
export async function fetchSessionList(
  client: LegiScanClient,
  state: string = NY_STATE_ABBREVIATION,
): Promise<LegiScanSession[]> {
  const body = await client.call('getSessionList', { state });
  return sessionListResponseSchema.parse(body).sessions;
}

/**
 * Picks the session New York is legislating in right now.
 *
 * Preference order, so a session is never hard-coded:
 *   1. an active regular session (not archived, not adjourned sine die)
 *   2. any non-archived session
 *   3. the most recent session on record
 *
 * Special sessions are only chosen when nothing else is active, because New
 * York's regular two-year session is where water legislation actually moves.
 */
export function selectCurrentSession(sessions: LegiScanSession[]): LegiScanSession | null {
  if (sessions.length === 0) return null;

  const byRecency = [...sessions].sort((a, b) => {
    if (b.year_start !== a.year_start) return b.year_start - a.year_start;
    return b.session_id - a.session_id;
  });

  const activeRegular = byRecency.find((s) => !s.prior && !s.sine_die && !s.special);
  if (activeRegular) return activeRegular;

  const active = byRecency.find((s) => !s.prior && !s.sine_die);
  if (active) return active;

  const notArchived = byRecency.find((s) => !s.prior);
  if (notArchived) return notArchived;

  return byRecency[0] ?? null;
}

export function describeSession(session: LegiScanSession): string {
  return (
    session.session_title ??
    session.session_name ??
    `${session.year_start}-${session.year_end} Session`
  );
}
