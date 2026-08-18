import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { EventCard } from '@/components/events/EventCard';
import { JsonLd } from '@/components/seo/JsonLd';
import { StatusBadge } from '@/components/ui/Badge';
import { Callout } from '@/components/ui/Callout';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader, SectionHeader } from '@/components/ui/SectionHeader';
import { getCommitteeBySlug } from '@/lib/db/queries/committees';
import { breadcrumbList, committeeJsonLd } from '@/lib/seo/json-ld';
import { shareImage, shareImagePath } from '@/lib/seo/metadata';
import { getUpcomingEventsForCommittee } from '@/lib/db/queries/events';
import { chamberLabel } from '@/lib/legiscan/enums';
import { asSentence, formatDate, formatDateShort, tidyBillNumber, truncate } from '@/lib/utils/format';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const committee = await getCommitteeBySlug(slug);

  if (!committee) return { title: 'Committee not found' };

  const description = `Water bills currently before the ${committee.name} committee in the New York State Legislature.`;

  return {
    title: committee.name,
    description,
    alternates: { canonical: `/committees/${slug}` },
    openGraph: {
      title: committee.name,
      description,
      url: `/committees/${slug}`,
      images: [shareImage(`/committees/${slug}`, committee.name)],
    },
    twitter: {
      card: 'summary_large_image',
      title: committee.name,
      description,
      images: [shareImagePath(`/committees/${slug}`)],
    },
  };
}

export default async function CommitteePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [committee, events] = await Promise.all([
    getCommitteeBySlug(slug),
    getUpcomingEventsForCommittee(slug, 3),
  ]);

  if (!committee) notFound();

  return (
    <div className="container">
      <JsonLd
        data={[
          committeeJsonLd({
            slug,
            name: committee.name,
            description: `Water bills referred to the ${committee.name}.`,
          }),
          breadcrumbList([
            { name: 'Home', path: '/' },
            { name: 'Committees', path: '/committees' },
            { name: committee.name, path: `/committees/${slug}` },
          ]),
        ]}
      />
      <nav aria-label="Breadcrumb" className="text-small text-muted" style={{ marginBottom: '1rem' }}>
        <Link href="/committees">All committees</Link> <span aria-hidden="true">›</span>{' '}
        {committee.name}
      </nav>

      <PageHeader
        eyebrow={chamberLabel(committee.chamber)}
        title={committee.name}
        lede={`Water bills referred to this committee, and what it has done with them. A bill sitting here has not been rejected — most simply never come up for a vote.`}
      />

      <div className="split split-sidebar">
        <div className="stack" style={{ ['--stack-gap' as string]: '2.5rem' }}>
          <section aria-labelledby="pending-heading">
            <SectionHeader
              title="Water bills waiting here"
              action={{ href: `/bills?committee=${slug}`, label: 'Open in explorer' }}
            />
            <h2 id="pending-heading" className="visually-hidden">
              Water bills currently before this committee
            </h2>

            {committee.pendingBills.length > 0 ? (
              <ul className="list-divided">
                {committee.pendingBills.map((bill) => (
                  <li key={bill.slug}>
                    <div className="cluster" style={{ gap: '0.45rem' }}>
                      <span className="bill-number">{tidyBillNumber(bill.billNumber)}</span>
                      <StatusBadge statusId={bill.statusId} />
                    </div>
                    <div style={{ marginTop: '0.25rem' }}>
                      <Link href={`/bills/${bill.slug}`}>{asSentence(truncate(bill.title, 140))}</Link>
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
              <EmptyState title="No water bills are currently before this committee">
                <p>
                  Bills we track have been referred here in the past, but none are waiting at the
                  moment.
                </p>
              </EmptyState>
            )}
          </section>

          {committee.recentActions.length > 0 ? (
            <section aria-labelledby="activity-heading">
              <SectionHeader
                title="Recent activity"
                description="The most recent official actions on water bills before this committee."
              />
              <h2 id="activity-heading" className="visually-hidden">
                Recent activity
              </h2>
              <ul className="list-divided text-small">
                {committee.recentActions.map((action, index) => (
                  <li key={`${action.billSlug}-${index}`}>
                    <strong>{formatDate(action.actionDate)}</strong> ·{' '}
                    <Link href={`/bills/${action.billSlug}`}>
                      {tidyBillNumber(action.billNumber)}
                    </Link>
                    <br />
                    {action.action}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {events.length > 0 ? (
            <section aria-labelledby="committee-events-heading">
              <SectionHeader title="Scheduled hearings" />
              <h2 id="committee-events-heading" className="visually-hidden">
                Scheduled hearings
              </h2>
              <div className="stack">
                {events.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <aside className="stack" style={{ ['--stack-gap' as string]: '1.5rem' }}>
          <div className="card">
            <h2 style={{ fontSize: '1rem' }}>Referral history</h2>
            {committee.recentReferrals.length > 0 ? (
              <ul className="list-plain text-small" style={{ display: 'grid', gap: '0.6rem' }}>
                {committee.recentReferrals.slice(0, 12).map((referral) => (
                  <li key={`${referral.slug}-${referral.referredOn}`}>
                    <Link href={`/bills/${referral.slug}`}>
                      {tidyBillNumber(referral.billNumber)}
                    </Link>{' '}
                    <span className="text-muted">
                      {referral.referredOn ? `referred ${formatDateShort(referral.referredOn)}` : ''}
                    </span>
                    <br />
                    <span className="text-muted">{truncate(asSentence(referral.title), 80)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="note" style={{ marginBottom: 0 }}>
                No referrals to this committee have been recorded for tracked bills.
              </p>
            )}
          </div>

          <Callout tone="quiet" title="What a committee does">
            <p style={{ marginBottom: 0 }}>
              A committee reviews bills in its subject area and votes on whether to send them to the
              full chamber. Chairs control the agenda, so a bill can sit for an entire session
              without ever being voted on. Committee membership is not currently included in our
              data.
            </p>
          </Callout>
        </aside>
      </div>
    </div>
  );
}
