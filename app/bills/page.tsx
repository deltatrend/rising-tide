import type { Metadata } from 'next';

import { BillCard } from '@/components/bills/BillCard';
import { BillFilters, BillSortControls } from '@/components/bills/BillFilters';
import { NoResultsState, NotYetSyncedState } from '@/components/ui/EmptyState';
import { FreshnessIndicator } from '@/components/ui/FreshnessIndicator';
import { PageHeader } from '@/components/ui/SectionHeader';
import { Pagination } from '@/components/ui/Pagination';
import { getBillFacets, listBills, DEFAULT_PER_PAGE } from '@/lib/db/queries/bills';
import { getDataFreshness } from '@/lib/db/queries/stats';
import { formatNumber } from '@/lib/utils/format';
import {
  buildBillHref,
  describeFilters,
  hasActiveFilters,
  parseBillFilters,
  type RawSearchParams,
} from '@/lib/utils/search-params';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Water bills',
  description:
    'Every New York State bill we track on oceans, drinking water, wetlands, flooding and water quality — filter by topic, stage, chamber, committee or sponsor.',
  alternates: { canonical: '/bills' },
};

export default async function BillsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const filters = parseBillFilters(await searchParams);

  const [result, facets, freshness] = await Promise.all([
    listBills({ ...filters, perPage: DEFAULT_PER_PAGE }),
    getBillFacets(),
    getDataFreshness(),
  ]);

  const topicName = facets.topics.find((t) => t.slug === filters.topic)?.name;
  const committeeName = facets.committees.find((c) => c.slug === filters.committee)?.name;
  const sponsorName = facets.sponsors.find((s) => s.slug === filters.sponsor)?.name;
  const summary = describeFilters(filters, { topicName, committeeName, sponsorName });

  const resetHref = buildBillHref('/bills', filters, {
    topic: null,
    status: null,
    chamber: null,
    committee: null,
    sponsor: null,
    q: null,
    since: null,
    hasUpcomingEvent: null,
    hasVotes: null,
  });

  return (
    <div className="container">
      <PageHeader
        eyebrow="Legislation"
        title="Water bills"
        lede="Every bill in the current New York State session that we identify as water policy. Nothing here requires an account, and each bill page shows exactly why it is tracked."
      >
        <p style={{ marginTop: '0.85rem', marginBottom: 0 }}>
          <FreshnessIndicator freshness={freshness} />
        </p>
      </PageHeader>

      {!freshness.hasSyncedEver && result.total === 0 ? (
        <NotYetSyncedState what="bills" />
      ) : (
        <div className="split split-filters">
          <BillFilters filters={filters} facets={facets} />

          <div>
            <div className="cluster-between" style={{ marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.1rem' }}>
                {summary}
                <span className="text-muted" style={{ fontWeight: 400 }}>
                  {' '}
                  · {formatNumber(result.total)} {result.total === 1 ? 'bill' : 'bills'}
                </span>
              </h2>
            </div>

            <BillSortControls filters={filters} />

            {result.items.length === 0 ? (
              hasActiveFilters(filters) ? (
                <NoResultsState resetHref={resetHref} />
              ) : (
                <NotYetSyncedState what="bills" />
              )
            ) : (
              <>
                <ul className="bill-list">
                  {result.items.map((bill) => (
                    <li key={bill.slug}>
                      <BillCard bill={bill} />
                    </li>
                  ))}
                </ul>

                <Pagination
                  page={result.page}
                  totalPages={result.totalPages}
                  total={result.total}
                  perPage={result.perPage}
                  buildHref={(page) => buildBillHref('/bills', filters, { page })}
                />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
