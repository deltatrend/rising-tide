/**
 * Server-only LegiScan integration.
 *
 * Import from here rather than from individual modules. Nothing in this folder
 * may be imported by a Client Component — it reads the API key from the
 * environment and would leak credentials into the browser bundle.
 */

export { LegiScanClient, LegiScanError, LEGISCAN_BASE_URL } from './client';
export type { LegiScanClientOptions, LegiScanErrorCode, FetchLike } from './client';

export {
  QueryBudget,
  QueryBudgetExceededError,
  LEGISCAN_MONTHLY_LIMIT,
  MONTHLY_RESERVE,
} from './budget';

export {
  fetchSessionList,
  selectCurrentSession,
  describeSession,
  NY_STATE_ABBREVIATION,
} from './sessions';

export {
  searchSession,
  searchSessionPaged,
  deduplicateSearchResults,
} from './search';
export type { SearchOptions, SearchPageResult, PagedSearchOptions } from './search';

export {
  fetchBill,
  fetchMasterList,
  fetchMasterListRaw,
  needsDetailFetch,
  partitionByChangeHash,
} from './bills';

export { fetchPerson, fetchSessionPeople } from './people';
export { fetchRollCall, summarizeVotes } from './rollcalls';
export type { VoteTotals } from './rollcalls';

export {
  fetchDocument,
  fetchBillTextDocument,
  fetchAmendmentDocument,
  fetchSupplementDocument,
  decodeBase64Document,
  shouldFetchDocument,
  md5,
} from './documents';
export type { DocumentKind, DecodedDocument } from './documents';

export { fetchDatasetList, datasetChanged } from './datasets';

export * from './schemas';
export * from './enums';
