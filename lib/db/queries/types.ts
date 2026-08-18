/** Shapes returned by the query layer and consumed by pages/components. */

export interface TopicRef {
  slug: string;
  name: string;
  isPrimary?: boolean;
}

export interface PersonRef {
  slug: string;
  name: string;
  party: string | null;
  partyId: number | null;
  role: string | null;
  roleId: number | null;
  district: string | null;
}

export interface CommitteeRef {
  slug: string;
  name: string;
  chamber: string | null;
}

export interface BillListItem {
  id: number;
  slug: string;
  billNumber: string;
  title: string;
  description: string | null;
  statusId: number | null;
  statusDate: string | null;
  lastAction: string | null;
  lastActionDate: string | null;
  introducedOn: string | null;
  body: string | null;
  currentBody: string | null;
  relevanceScore: number | null;
  lastSyncedAt: Date;
  lastSourceChangeAt: Date | null;
  isFixture: boolean;
  sessionLabel: string | null;
  committee: CommitteeRef | null;
  topics: TopicRef[];
  sponsorCount: number;
  leadSponsor: PersonRef | null;
  rollCallCount: number;
  upcomingEventCount: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export interface EventListItem {
  id: number;
  title: string;
  eventType: string | null;
  eventTypeId: number | null;
  eventDate: string;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  description: string | null;
  source: string;
  sourceType: string;
  sourceUrl: string | null;
  isFixture: boolean;
  bills: { slug: string; billNumber: string; title: string }[];
  topics: TopicRef[];
}

export interface RollCallListItem {
  id: number;
  legiscanRollCallId: number;
  voteDate: string | null;
  description: string | null;
  chamber: string | null;
  yea: number;
  nay: number;
  notVoting: number;
  absent: number;
  total: number;
  passed: boolean | null;
  legiscanUrl: string | null;
  stateUrl: string | null;
  hasIndividualVotes: boolean;
  bill: { slug: string; billNumber: string; title: string } | null;
}

export interface DataFreshness {
  lastSuccessfulSyncAt: Date | null;
  lastAttemptedSyncAt: Date | null;
  lastSyncStatus: string | null;
  trackedBillCount: number;
  hasSyncedEver: boolean;
}
