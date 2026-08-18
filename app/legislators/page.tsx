import type { Metadata } from 'next';
import Link from 'next/link';

import { NotYetSyncedState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/SectionHeader';
import { listLegislators } from '@/lib/db/queries/legislators';
import { partyLabel, roleLabel } from '@/lib/legiscan/enums';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Legislators',
  description:
    'New York State senators and assembly members who sponsor or co-sponsor the water bills we track.',
  alternates: { canonical: '/legislators' },
};

export default async function LegislatorsPage() {
  const legislators = await listLegislators();

  const ranked = [...legislators].sort(
    (a, b) =>
      b.sponsoredCount - a.sponsoredCount ||
      b.cosponsoredCount - a.cosponsoredCount ||
      a.name.localeCompare(b.name),
  );

  return (
    <div className="container">
      <PageHeader
        eyebrow="Who is involved"
        title="Legislators"
        lede="Only legislators connected to the water bills we track appear here, ranked by how many they have introduced. This is a record of sponsorship, not an endorsement or a score."
      />

      {ranked.length === 0 ? (
        <NotYetSyncedState what="legislators" />
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
    </div>
  );
}
