import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { JsonLd } from '@/components/seo/JsonLd';
import { StatusBadge } from '@/components/ui/Badge';
import { Callout } from '@/components/ui/Callout';
import { PageHeader, SectionHeader } from '@/components/ui/SectionHeader';
import { Stat, StatGrid } from '@/components/ui/Stat';
import { getLegislatorBySlug } from '@/lib/db/queries/legislators';
import { breadcrumbList, personJsonLd } from '@/lib/seo/json-ld';
import { shareImage, shareImagePath } from '@/lib/seo/metadata';
import { partyLabel, roleLabel, voteLabel } from '@/lib/legiscan/enums';
import {
  asSentence,
  formatDateShort,
  formatRelative,
  tidyBillNumber,
  truncate,
} from '@/lib/utils/format';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const person = await getLegislatorBySlug(slug);

  if (!person) return { title: 'Legislator not found' };

  const description = `Water bills sponsored, co-sponsored and voted on by ${person.name} in the New York State Legislature.`;

  return {
    title: person.name,
    description,
    alternates: { canonical: `/legislators/${slug}` },
    openGraph: {
      title: person.name,
      description,
      url: `/legislators/${slug}`,
      images: [shareImage(`/legislators/${slug}`, person.name)],
    },
    twitter: {
      card: 'summary_large_image',
      title: person.name,
      description,
      images: [shareImagePath(`/legislators/${slug}`)],
    },
  };
}

export default async function LegislatorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const person = await getLegislatorBySlug(slug);

  if (!person) notFound();

  const yesVotes = person.votes.filter((v) => v.voteId === 1).length;
  const noVotes = person.votes.filter((v) => v.voteId === 2).length;

  return (
    <div className="container">
      <JsonLd
        data={[
          personJsonLd({
            slug,
            name: person.name,
            description: `Water bills sponsored, co-sponsored and voted on by ${person.name}.`,
          }),
          breadcrumbList([
            { name: 'Home', path: '/' },
            { name: 'Legislators', path: '/legislators' },
            { name: person.name, path: `/legislators/${slug}` },
          ]),
        ]}
      />
      <nav aria-label="Breadcrumb" className="text-small text-muted" style={{ marginBottom: '1rem' }}>
        <Link href="/legislators">All legislators</Link> <span aria-hidden="true">›</span>{' '}
        {person.name}
      </nav>

      <PageHeader
        eyebrow={`${roleLabel(person.role, person.roleId)}${
          person.district ? ` · District ${person.district}` : ''
        } · ${partyLabel(person.party, person.partyId)}`}
        title={person.name}
        lede="This page covers only this legislator's involvement with the water bills Rising Tide tracks. It is not a complete record of their work."
      />

      <div className="split split-sidebar">
        <div className="stack" style={{ ['--stack-gap' as string]: '2.5rem' }}>
          <section aria-labelledby="sponsored-heading">
            <SectionHeader
              title="Water bills introduced"
              description="Bills where this legislator is the lead sponsor."
              action={{ href: `/bills?sponsor=${slug}`, label: 'Open in explorer' }}
            />
            <h2 id="sponsored-heading" className="visually-hidden">
              Water bills introduced
            </h2>

            {person.sponsored.length > 0 ? (
              <ul className="list-divided">
                {person.sponsored.map((bill) => (
                  <li key={bill.slug}>
                    <div className="cluster" style={{ gap: '0.45rem' }}>
                      <span className="bill-number">{tidyBillNumber(bill.billNumber)}</span>
                      <StatusBadge statusId={bill.statusId} />
                    </div>
                    <div style={{ marginTop: '0.25rem' }}>
                      <Link href={`/bills/${bill.slug}`}>
                        {asSentence(truncate(bill.title, 140))}
                      </Link>
                    </div>
                    {bill.lastActionDate ? (
                      <p className="note" style={{ margin: '0.15rem 0 0' }}>
                        Last action {formatDateShort(bill.lastActionDate)}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="note">
                This legislator has not introduced any of the water bills we track in the current
                session.
              </p>
            )}
          </section>

          {person.cosponsored.length > 0 ? (
            <section aria-labelledby="cosponsored-heading">
              <SectionHeader
                title="Water bills co-sponsored"
                description="Adding a name to a bill signals support; it does not mean the legislator wrote it."
              />
              <h2 id="cosponsored-heading" className="visually-hidden">
                Water bills co-sponsored
              </h2>
              <ul className="list-divided text-small">
                {person.cosponsored.slice(0, 40).map((bill) => (
                  <li key={bill.slug}>
                    <Link href={`/bills/${bill.slug}`}>
                      {tidyBillNumber(bill.billNumber)} — {truncate(asSentence(bill.title), 110)}
                    </Link>
                  </li>
                ))}
              </ul>
              {person.cosponsored.length > 40 ? (
                <p className="note">and {person.cosponsored.length - 40} more.</p>
              ) : null}
            </section>
          ) : null}

          {person.votes.length > 0 ? (
            <section aria-labelledby="votes-heading">
              <SectionHeader
                title="Votes on water bills"
                description="Recorded roll-call votes only. Most legislative decisions never produce one."
              />
              <h2 id="votes-heading" className="visually-hidden">
                Votes on water bills
              </h2>
              <div className="table-wrap">
                <table className="data">
                  <caption className="visually-hidden">
                    Recorded votes cast by {person.name} on tracked water bills
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Date</th>
                      <th scope="col">Bill</th>
                      <th scope="col">Vote</th>
                      <th scope="col">Outcome</th>
                    </tr>
                  </thead>
                  <tbody>
                    {person.votes.slice(0, 40).map((vote, index) => (
                      <tr key={`${vote.billSlug}-${index}`}>
                        <td>{formatDateShort(vote.voteDate)}</td>
                        <th scope="row" style={{ fontWeight: 400 }}>
                          <Link href={`/bills/${vote.billSlug}`}>
                            {tidyBillNumber(vote.billNumber)}
                          </Link>
                          <br />
                          <span className="text-muted text-small">
                            {truncate(asSentence(vote.billTitle), 70)}
                          </span>
                        </th>
                        <td>
                          <span
                            className={`vote-value vote-value--${
                              vote.voteId === 1 ? 'yea' : vote.voteId === 2 ? 'nay' : 'other'
                            }`}
                          >
                            {voteLabel(vote.voteId, vote.voteText)}
                          </span>
                        </td>
                        <td>{vote.passed === null ? '—' : vote.passed ? 'Passed' : 'Failed'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </div>

        <aside className="stack" style={{ ['--stack-gap' as string]: '1.5rem' }}>
          <div className="card">
            <h2 style={{ fontSize: '1rem' }}>On water bills</h2>
            <StatGrid>
              <Stat value={person.sponsored.length} label="Introduced" />
              <Stat value={person.cosponsored.length} label="Co-sponsored" />
              <Stat value={yesVotes} label="Votes in favour" />
              <Stat value={noVotes} label="Votes against" />
            </StatGrid>
            <p className="note" style={{ marginTop: '0.85rem', marginBottom: 0 }}>
              Counts cover the water bills Rising Tide tracks in the current session only.
            </p>
          </div>

          {person.ballotpedia ? (
            <div className="card">
              <h2 style={{ fontSize: '1rem' }}>Learn more</h2>
              <p className="text-small" style={{ marginBottom: 0 }}>
                <a
                  href={`https://ballotpedia.org/${person.ballotpedia}`}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {person.name} on Ballotpedia
                </a>
                <br />
                <span className="text-muted">
                  Contact details and district maps are published by the New York State Senate and
                  Assembly.
                </span>
              </p>
            </div>
          ) : null}

          <Callout tone="quiet" title="What this page is not">
            <p style={{ marginBottom: 0 }}>
              We do not rate, grade or rank legislators. This page shows what the official record
              says about their involvement with water bills — nothing more. Data last checked{' '}
              {formatRelative(person.lastSyncedAt)}.
            </p>
          </Callout>
        </aside>
      </div>
    </div>
  );
}
