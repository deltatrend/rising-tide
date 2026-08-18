import type { Metadata } from 'next';
import Link from 'next/link';

import { EmptyState, NotYetSyncedState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/SectionHeader';
import { listLegislators } from '@/lib/db/queries/legislators';
import { partyLabel, roleLabel } from '@/lib/legiscan/enums';
import { listingMetadata } from '@/lib/seo/metadata';
import { formatNumber } from '@/lib/utils/format';
import {
  applyLegislatorFilters,
  buildLegislatorHref,
  hasActiveLegislatorFilters,
  legislatorChamber,
  parseLegislatorFilters,
} from '@/lib/utils/legislator-params';
import type { RawSearchParams } from '@/lib/utils/search-params';

export const dynamic = 'force-dynamic';

const BASE_METADATA = listingMetadata(
  'Legislators',
  'New York State senators and assembly members who sponsor or co-sponsor the water bills we track. Search by name or district.',
  '/legislators',
);

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}): Promise<Metadata> {
  const filters = parseLegislatorFilters(await searchParams);

  return {
    ...BASE_METADATA,
    robots: hasActiveLegislatorFilters(filters)
      ? { index: false, follow: true }
      : BASE_METADATA.robots,
  };
}

const CHAMBERS = [
  { code: 'S' as const, label: 'Senate' },
  { code: 'A' as const, label: 'Assembly' },
];

const SORTS = [
  { value: 'bills' as const, label: 'Most bills' },
  { value: 'name' as const, label: 'Name (A–Z)' },
];

export default async function LegislatorsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const filters = parseLegislatorFilters(await searchParams);
  const legislators = await listLegislators();
  const ranked = applyLegislatorFilters(legislators, filters);

  const chamberCounts = new Map<string, number>();
  for (const person of legislators) {
    const chamber = legislatorChamber(person);
    if (chamber) chamberCounts.set(chamber, (chamberCounts.get(chamber) ?? 0) + 1);
  }

  const active = hasActiveLegislatorFilters(filters);
  const clearHref = buildLegislatorHref('/legislators', filters, { q: null, chamber: null });

  return (
    <div className="container">
      <PageHeader
        eyebrow="Who is involved"
        title="Legislators"
        lede="Only legislators connected to the water bills we track appear here, ranked by how many they have introduced. This is a record of sponsorship, not an endorsement or a score."
      />

      {legislators.length === 0 ? (
        <NotYetSyncedState what="legislators" />
      ) : (
        <>
          <form className="search-bar" action="/legislators" method="get" role="search">
            <label htmlFor="legislator-search" className="visually-hidden">
              Search legislators
            </label>
            <input
              id="legislator-search"
              type="search"
              name="q"
              defaultValue={filters.q ?? ''}
              placeholder="Name or district, e.g. 40"
              autoComplete="off"
            />
            {filters.chamber ? (
              <input type="hidden" name="chamber" value={filters.chamber} />
            ) : null}
            {filters.sort === 'name' ? <input type="hidden" name="sort" value="name" /> : null}
            <button type="submit" className="button">
              Search
            </button>
          </form>

          <div className="cluster" style={{ marginBottom: '1.25rem' }}>
            {CHAMBERS.map((chamber) => {
              const selected = filters.chamber === chamber.code;
              return (
                <Link
                  key={chamber.code}
                  className={`chip${selected ? ' chip--selected' : ''}`}
                  href={buildLegislatorHref('/legislators', filters, {
                    chamber: selected ? null : chamber.code,
                  })}
                  aria-current={selected ? 'true' : undefined}
                >
                  {chamber.label} ({formatNumber(chamberCounts.get(chamber.code) ?? 0)})
                </Link>
              );
            })}
            {active ? (
              <Link className="chip" href={clearHref}>
                Clear
              </Link>
            ) : null}
          </div>

          <div className="cluster-between" style={{ marginBottom: '1rem' }}>
            <p className="text-muted" style={{ margin: 0 }}>
              {formatNumber(ranked.length)}{' '}
              {ranked.length === 1 ? 'legislator' : 'legislators'}
              {active ? ` of ${formatNumber(legislators.length)}` : ''}
            </p>

            <div className="sort-controls">
              <span className="filters__label" id="sort-label">
                Sort
              </span>
              <ul className="cluster" aria-labelledby="sort-label">
                {SORTS.map((option) => {
                  const selected = filters.sort === option.value;
                  return (
                    <li key={option.value}>
                      <Link
                        className={`chip${selected ? ' chip--selected' : ''}`}
                        href={buildLegislatorHref('/legislators', filters, {
                          sort: option.value,
                        })}
                        aria-current={selected ? 'true' : undefined}
                      >
                        {option.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          {ranked.length === 0 ? (
            <EmptyState title="No legislator matches that search">
              <p style={{ marginBottom: 0 }}>
                Try a surname or a district number such as 40.{' '}
                <Link href={clearHref}>Show all legislators</Link>.
              </p>
            </EmptyState>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <caption className="visually-hidden">
                  Legislators sponsoring tracked water bills
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Legislator</th>
                    <th scope="col">Chamber</th>
                    <th scope="col">Party</th>
                    <th scope="col">District</th>
                    <th scope="col">Lead sponsor</th>
                    <th scope="col">Co-sponsor</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((person) => (
                    <tr key={person.slug} className="row-link">
                      <th scope="row" style={{ fontWeight: 400 }}>
                        <Link className="row-link__target" href={`/legislators/${person.slug}`}>
                          {person.name}
                        </Link>
                      </th>
                      <td>{roleLabel(person.role, person.roleId)}</td>
                      <td>{partyLabel(person.party, person.partyId)}</td>
                      <td>{person.district ?? '—'}</td>
                      <td>{person.sponsoredCount}</td>
                      <td>{person.cosponsoredCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
