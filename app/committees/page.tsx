import type { Metadata } from 'next';
import Link from 'next/link';

import { NotYetSyncedState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/SectionHeader';
import { listCommittees } from '@/lib/db/queries/committees';
import { chamberLabel } from '@/lib/legiscan/enums';
import { listingMetadata } from '@/lib/seo/metadata';
import { formatDateShort } from '@/lib/utils/format';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = listingMetadata(
  'Committees',
  'The New York State Senate and Assembly committees that decide whether water bills move forward.',
  '/committees',
);

export default async function CommitteesPage() {
  const committees = await listCommittees();

  const senate = committees.filter((c) => c.chamber === 'S');
  const assembly = committees.filter((c) => c.chamber === 'A' || c.chamber === 'H');
  const other = committees.filter((c) => !['S', 'A', 'H'].includes(c.chamber ?? ''));

  return (
    <div className="container">
      <PageHeader
        eyebrow="Who decides"
        title="Committees"
        lede="Almost every bill dies in committee. A committee chair decides whether a bill gets a hearing at all, which makes these the most consequential rooms in Albany for water policy."
      />

      {committees.length === 0 ? (
        <NotYetSyncedState what="committees" />
      ) : (
        <div className="stack" style={{ ['--stack-gap' as string]: '2.5rem' }}>
          {[
            { label: 'Senate committees', list: senate },
            { label: 'Assembly committees', list: assembly },
            { label: 'Other bodies', list: other },
          ]
            .filter((group) => group.list.length > 0)
            .map((group) => (
              <section key={group.label} aria-label={group.label}>
                <h2 style={{ fontSize: '1.15rem' }}>{group.label}</h2>
                <div className="grid grid-3">
                  {group.list.map((committee) => (
                    <Link
                      key={committee.slug}
                      className="tile"
                      href={`/committees/${committee.slug}`}
                    >
                      <h3 className="tile__title">{committee.name}</h3>
                      <p className="tile__desc">
                        {chamberLabel(committee.chamber)}
                        {committee.lastActivityAt
                          ? ` · last activity ${formatDateShort(committee.lastActivityAt)}`
                          : ''}
                      </p>
                      <span className="tile__meta">
                        {committee.pendingBillCount} water{' '}
                        {committee.pendingBillCount === 1 ? 'bill' : 'bills'} waiting
                        {committee.referredBillCount > committee.pendingBillCount
                          ? ` · ${committee.referredBillCount} referred in total`
                          : ''}
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
        </div>
      )}
    </div>
  );
}
