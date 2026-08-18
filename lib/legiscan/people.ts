/** getPerson and getSessionPeople. */

import type { LegiScanClient } from './client';
import {
  personResponseSchema,
  sessionPeopleResponseSchema,
  type LegiScanPerson,
} from './schemas';

/** One API query. Recommended refresh frequency: weekly. */
export async function fetchPerson(
  client: LegiScanClient,
  peopleId: number,
): Promise<LegiScanPerson> {
  const body = await client.call('getPerson', { id: peopleId });
  return personResponseSchema.parse(body).person;
}

/**
 * One API query for every legislator active in a session. Far cheaper than
 * calling getPerson per sponsor, so the sync uses this when it needs to fill in
 * legislator details.
 */
export async function fetchSessionPeople(
  client: LegiScanClient,
  sessionId: number,
): Promise<LegiScanPerson[]> {
  const body = await client.call('getSessionPeople', { id: sessionId });
  return sessionPeopleResponseSchema.parse(body).sessionpeople.people;
}
