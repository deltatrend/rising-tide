/**
 * getSearch — candidate discovery.
 *
 * getSearch is preferred over getSearchRaw here even though it returns fewer
 * rows per query, because it includes the bill title. A title lets us decide
 * whether a candidate deserves a getBill call without spending one first, which
 * is the single biggest saving available against the 30,000/month budget.
 */

import type { LegiScanClient } from './client';
import { LegiScanError } from './client';
import { parseSearchPage, type LegiScanSearchResult } from './schemas';

export interface SearchOptions {
  sessionId: number;
  query: string;
  /** 1-based. LegiScan returns 50 results per page. */
  page?: number;
}

export interface SearchPageResult {
  results: LegiScanSearchResult[];
  pageCurrent: number;
  pageTotal: number;
  count: number;
}

/** One API query per page. */
export async function searchSession(
  client: LegiScanClient,
  options: SearchOptions,
): Promise<SearchPageResult> {
  const body = await client.call('getSearch', {
    id: options.sessionId,
    query: options.query,
    page: options.page ?? 1,
  });

  const { summary, results } = parseSearchPage(body);

  return {
    results,
    pageCurrent: summary.page_current ?? options.page ?? 1,
    pageTotal: summary.page_total ?? 1,
    count: summary.count ?? results.length,
  };
}

export interface PagedSearchOptions extends SearchOptions {
  /** Hard cap on pages retrieved for this query. */
  maxPages: number;
  /** Stop paging once results fall below this LegiScan relevance score. */
  minRelevance: number;
  onError?: (error: LegiScanError) => void;
}

/**
 * Walks pages until the cap, the last page, or the relevance floor — whichever
 * comes first. Returns whatever was gathered even if a later page fails, so one
 * bad response cannot lose an entire search.
 */
export async function searchSessionPaged(
  client: LegiScanClient,
  options: PagedSearchOptions,
): Promise<{ results: LegiScanSearchResult[]; pagesFetched: number; truncated: boolean }> {
  const collected: LegiScanSearchResult[] = [];
  let pagesFetched = 0;
  let truncated = false;

  for (let page = 1; page <= options.maxPages; page += 1) {
    let pageResult: SearchPageResult;

    try {
      pageResult = await searchSession(client, {
        sessionId: options.sessionId,
        query: options.query,
        page,
      });
    } catch (error) {
      if (error instanceof LegiScanError) {
        options.onError?.(error);
        // A budget stop must propagate; anything else just ends this query.
        if (error.code === 'budget') throw error;
        truncated = true;
        break;
      }
      throw error;
    }

    pagesFetched += 1;

    const aboveFloor = pageResult.results.filter(
      (r) => (r.relevance ?? 0) >= options.minRelevance,
    );
    collected.push(...aboveFloor);

    // Results are relevance-ordered, so the first page containing anything
    // below the floor is the last page worth requesting.
    const reachedFloor = aboveFloor.length < pageResult.results.length;
    if (reachedFloor || page >= pageResult.pageTotal) break;

    // `truncated` means "the cap stopped us", not "the floor stopped us" —
    // only the former suggests the configuration may need widening.
    if (page === options.maxPages && page < pageResult.pageTotal) {
      truncated = true;
    }
  }

  return { results: collected, pagesFetched, truncated };
}

/** Removes duplicate bill_ids across searches, keeping the highest relevance. */
export function deduplicateSearchResults(
  results: LegiScanSearchResult[],
): LegiScanSearchResult[] {
  const byBillId = new Map<number, LegiScanSearchResult>();

  for (const result of results) {
    const existing = byBillId.get(result.bill_id);
    if (!existing || (result.relevance ?? 0) > (existing.relevance ?? 0)) {
      byBillId.set(result.bill_id, result);
    }
  }

  return [...byBillId.values()].sort((a, b) => (b.relevance ?? 0) - (a.relevance ?? 0));
}
