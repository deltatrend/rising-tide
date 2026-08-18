import Link from 'next/link';

import type { BillFacets, BillFilters as Filters } from '@/lib/db/queries/bills';
import { chamberLabel, STATUS_BUCKET_LABELS, type StatusBucket } from '@/lib/legiscan/enums';
import { formatNumber } from '@/lib/utils/format';
import { buildBillHref, hasActiveFilters } from '@/lib/utils/search-params';

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'updated', label: 'Recently updated' },
  { value: 'introduced', label: 'Newest' },
  { value: 'relevance', label: 'Most relevant to water' },
  { value: 'number', label: 'Bill number' },
];

/**
 * Every filter is a link and search is a plain GET form.
 *
 * That keeps the whole explorer server-rendered: results are shareable and
 * crawlable, the back button behaves, and nothing breaks if JavaScript never
 * loads.
 */
export function BillFilters({
  filters,
  facets,
  basePath = '/bills',
}: {
  filters: Filters;
  facets: BillFacets;
  basePath?: string;
}) {
  const active = hasActiveFilters(filters);

  return (
    <aside className="filters" aria-label="Filter bills">
      <form className="filters__search" action={basePath} method="get" role="search">
        <label htmlFor="bill-search" className="filters__label">
          Search
        </label>
        <input
          id="bill-search"
          type="search"
          name="q"
          defaultValue={filters.q ?? ''}
          placeholder="Bill number, keyword, sponsor…"
          autoComplete="off"
        />
        {/* Preserve the rest of the filter state across a search submission. */}
        {filters.topic ? <input type="hidden" name="topic" value={filters.topic} /> : null}
        {filters.status ? <input type="hidden" name="status" value={filters.status} /> : null}
        {filters.chamber ? <input type="hidden" name="chamber" value={filters.chamber} /> : null}
        {filters.committee ? <input type="hidden" name="committee" value={filters.committee} /> : null}
        {filters.sponsor ? <input type="hidden" name="sponsor" value={filters.sponsor} /> : null}
        {filters.sort && filters.sort !== 'updated' ? (
          <input type="hidden" name="sort" value={filters.sort} />
        ) : null}
        <button type="submit" className="button button--small">
          Search
        </button>
      </form>

      {active ? (
        <p className="filters__clear">
          <Link
            href={buildBillHref(basePath, filters, {
              topic: null,
              status: null,
              chamber: null,
              committee: null,
              sponsor: null,
              q: null,
              since: null,
              hasUpcomingEvent: null,
              hasVotes: null,
            })}
          >
            Clear all filters
          </Link>
        </p>
      ) : null}

      <FilterGroup title="Where it is">
        {(['early', 'moving', 'passed', 'ended'] as StatusBucket[]).map((bucket) => {
          const count = facets.statuses.find((s) => s.bucket === bucket)?.count ?? 0;
          if (count === 0 && filters.status !== bucket) return null;
          const selected = filters.status === bucket;
          return (
            <FilterOption
              key={bucket}
              href={buildBillHref(basePath, filters, { status: selected ? null : bucket })}
              label={STATUS_BUCKET_LABELS[bucket]}
              count={count}
              selected={selected}
            />
          );
        })}
      </FilterGroup>

      {facets.chambers.length > 0 ? (
        <FilterGroup title="Chamber">
          {(['S', 'A'] as const).map((code) => {
            const count = facets.chambers
              .filter((c) => (code === 'A' ? c.code === 'A' || c.code === 'H' : c.code === 'S'))
              .reduce((sum, c) => sum + c.count, 0);
            if (count === 0 && filters.chamber !== code) return null;
            const selected = filters.chamber === code;
            return (
              <FilterOption
                key={code}
                href={buildBillHref(basePath, filters, { chamber: selected ? null : code })}
                label={chamberLabel(code)}
                count={count}
                selected={selected}
              />
            );
          })}
        </FilterGroup>
      ) : null}

      {facets.topics.length > 0 ? (
        <FilterGroup title="Topic">
          {facets.topics.map((topic) => {
            const selected = filters.topic === topic.slug;
            return (
              <FilterOption
                key={topic.slug}
                href={buildBillHref(basePath, filters, { topic: selected ? null : topic.slug })}
                label={topic.name}
                count={topic.count}
                selected={selected}
              />
            );
          })}
        </FilterGroup>
      ) : null}

      <FilterGroup title="Activity">
        <FilterOption
          href={buildBillHref(basePath, filters, {
            hasUpcomingEvent: filters.hasUpcomingEvent ? null : true,
          })}
          label="Has an upcoming hearing"
          selected={Boolean(filters.hasUpcomingEvent)}
        />
        <FilterOption
          href={buildBillHref(basePath, filters, { hasVotes: filters.hasVotes ? null : true })}
          label="Has a recorded vote"
          selected={Boolean(filters.hasVotes)}
        />
      </FilterGroup>

      {facets.committees.length > 0 ? (
        <FilterGroup title="Committee" collapsible defaultOpen={Boolean(filters.committee)}>
          {facets.committees.slice(0, 25).map((committee) => {
            const selected = filters.committee === committee.slug;
            return (
              <FilterOption
                key={committee.slug}
                href={buildBillHref(basePath, filters, {
                  committee: selected ? null : committee.slug,
                })}
                label={committee.name}
                count={committee.count}
                selected={selected}
              />
            );
          })}
        </FilterGroup>
      ) : null}

      {facets.sponsors.length > 0 ? (
        <FilterGroup title="Lead sponsor" collapsible defaultOpen={Boolean(filters.sponsor)}>
          {facets.sponsors.slice(0, 25).map((sponsor) => {
            const selected = filters.sponsor === sponsor.slug;
            return (
              <FilterOption
                key={sponsor.slug}
                href={buildBillHref(basePath, filters, { sponsor: selected ? null : sponsor.slug })}
                label={sponsor.name}
                count={sponsor.count}
                selected={selected}
              />
            );
          })}
        </FilterGroup>
      ) : null}
    </aside>
  );
}

export function BillSortControls({
  filters,
  basePath = '/bills',
}: {
  filters: Filters;
  basePath?: string;
}) {
  return (
    <div className="sort-controls">
      <span className="filters__label" id="sort-label">
        Sort
      </span>
      <ul className="cluster" aria-labelledby="sort-label">
        {SORT_OPTIONS.map((option) => {
          const selected = (filters.sort ?? 'updated') === option.value;
          return (
            <li key={option.value}>
              <Link
                className={`chip${selected ? ' chip--selected' : ''}`}
                href={buildBillHref(basePath, filters, { sort: option.value })}
                aria-current={selected ? 'true' : undefined}
              >
                {option.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function FilterGroup({
  title,
  children,
  collapsible = false,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  if (collapsible) {
    return (
      <details className="filters__group" open={defaultOpen}>
        <summary className="filters__label">{title}</summary>
        <ul className="filters__options">{children}</ul>
      </details>
    );
  }

  return (
    <div className="filters__group">
      <h3 className="filters__label">{title}</h3>
      <ul className="filters__options">{children}</ul>
    </div>
  );
}

function FilterOption({
  href,
  label,
  count,
  selected,
}: {
  href: string;
  label: string;
  count?: number;
  selected: boolean;
}) {
  return (
    <li>
      <Link
        href={href}
        className={`filter-option${selected ? ' filter-option--selected' : ''}`}
        aria-current={selected ? 'true' : undefined}
      >
        <span>{label}</span>
        {typeof count === 'number' ? (
          <span className="filter-option__count">{formatNumber(count)}</span>
        ) : null}
        {selected ? <span className="visually-hidden"> (selected — activate to remove)</span> : null}
      </Link>
    </li>
  );
}
