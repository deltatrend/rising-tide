import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { BillCard } from '@/components/bills/BillCard';
import { EventCard } from '@/components/events/EventCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader, SectionHeader } from '@/components/ui/SectionHeader';
import { Stat, StatGrid } from '@/components/ui/Stat';
import { BarChart, type BarChartRow } from '@/components/viz/BarChart';
import { VoteBar } from '@/components/viz/VoteBar';
import { JsonLd } from '@/components/seo/JsonLd';
import { getTopicDefinition } from '@/config/topics';
import { getStatusDistribution, listBillsCompact } from '@/lib/db/queries/bills';
import { getUpcomingEventsForTopic } from '@/lib/db/queries/events';
import { getRecentVotesForTopic, listTopicSummaries } from '@/lib/db/queries/topics';
import { describeStatus, STATUS_BUCKETS } from '@/lib/legiscan/enums';
import { breadcrumbList, topicJsonLd } from '@/lib/seo/json-ld';
import { shareImage, shareImagePath } from '@/lib/seo/metadata';
import { formatDateShort, truncate } from '@/lib/utils/format';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const topic = getTopicDefinition(slug);

  if (!topic) return { title: 'Topic not found' };

  return {
    title: topic.name,
    description: topic.shortDescription,
    alternates: { canonical: `/topics/${slug}` },
    openGraph: {
      type: 'article',
      title: topic.name,
      description: topic.shortDescription,
      url: `/topics/${slug}`,
      images: [shareImage(`/topics/${slug}`, topic.name)],
    },
    twitter: {
      card: 'summary_large_image',
      title: topic.name,
      description: topic.shortDescription,
      images: [shareImagePath(`/topics/${slug}`)],
    },
  };
}

export default async function TopicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const topic = getTopicDefinition(slug);

  if (!topic) notFound();

  const [bills, events, votes, distribution, summaries] = await Promise.all([
    listBillsCompact({ topic: slug, sort: 'updated' }, 8),
    getUpcomingEventsForTopic(slug, 3),
    getRecentVotesForTopic(slug, 4),
    getStatusDistribution(slug),
    listTopicSummaries(),
  ]);

  const summary = summaries.find((s) => s.slug === slug);
  const related = topic.related
    .map((relatedSlug) => getTopicDefinition(relatedSlug))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));

  return (
    <div className="container">
      <JsonLd
        data={[
          topicJsonLd({ slug, name: topic.name, description: topic.shortDescription }),
          breadcrumbList([
            { name: 'Home', path: '/' },
            { name: 'Topics', path: '/topics' },
            { name: topic.name, path: `/topics/${slug}` },
          ]),
        ]}
      />
      <nav aria-label="Breadcrumb" className="text-small text-muted" style={{ marginBottom: '1rem' }}>
        <Link href="/topics">All topics</Link> <span aria-hidden="true">›</span> {topic.name}
      </nav>

      <PageHeader eyebrow={topic.category} title={topic.name} lede={topic.shortDescription} />

      <div className="split split-sidebar">
        <div className="stack" style={{ ['--stack-gap' as string]: '2.5rem' }}>
          <section aria-labelledby="explainer-heading">
            <h2 id="explainer-heading" style={{ fontSize: '1.15rem' }}>
              What this covers
            </h2>
            <p className="prose" style={{ maxWidth: '68ch' }}>
              {topic.longDescription}
            </p>
          </section>

          <section aria-labelledby="bills-heading">
            <SectionHeader
              title="Bills in this topic"
              description="Ordered by most recent activity."
              action={{ href: `/bills?topic=${slug}`, label: 'See all' }}
            />
            <h2 id="bills-heading" className="visually-hidden">
              Bills in this topic
            </h2>

            {bills.length > 0 ? (
              <ul className="bill-list">
                {bills.map((bill) => (
                  <li key={bill.slug}>
                    <BillCard bill={bill} compact />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No bills in this topic yet">
                <p>
                  Nothing in the current session has been classified under {topic.name}. That can
                  change at any point in the session — bills are introduced continuously.
                </p>
              </EmptyState>
            )}
          </section>

          {votes.length > 0 ? (
            <section aria-labelledby="topic-votes-heading">
              <SectionHeader title="Recent votes in this topic" />
              <h2 id="topic-votes-heading" className="visually-hidden">
                Recent votes
              </h2>
              <ul className="list-divided">
                {votes.map((vote) => (
                  <li key={vote.rollCallId}>
                    <Link href={`/bills/${vote.billSlug}`}>
                      {vote.billNumber} — {truncate(vote.billTitle, 80)}
                    </Link>
                    <p className="note" style={{ margin: '0.2rem 0 0.4rem' }}>
                      {formatDateShort(vote.voteDate)}
                      {vote.description ? ` · ${truncate(vote.description, 70)}` : ''}
                    </p>
                    <VoteBar
                      compact
                      passed={vote.passed}
                      totals={{
                        yea: vote.yea,
                        nay: vote.nay,
                        notVoting: 0,
                        absent: 0,
                        total: vote.yea + vote.nay,
                      }}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {events.length > 0 ? (
            <section aria-labelledby="topic-events-heading">
              <SectionHeader title="Upcoming hearings" action={{ href: '/events', label: 'All events' }} />
              <h2 id="topic-events-heading" className="visually-hidden">
                Upcoming hearings
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
            <h2 style={{ fontSize: '1rem' }}>At a glance</h2>
            <StatGrid>
              <Stat value={summary?.billCount ?? 0} label="Bills tracked" />
              <Stat value={summary?.activeBillCount ?? 0} label="Still active" />
              <Stat value={summary?.recentlyChangedCount ?? 0} label="Changed recently" />
              <Stat value={summary?.upcomingEventCount ?? 0} label="Upcoming events" />
            </StatGrid>
          </div>

          <div className="card">
            <h2 style={{ fontSize: '1rem' }}>Where these bills are</h2>
            <BarChart
              caption={`${topic.name} bills by stage`}
              rows={STATUS_BUCKETS.map((bucket): BarChartRow => ({
                label: bucket.label,
                value: distribution
                  .filter((row) => describeStatus(row.statusId).bucket === bucket.value)
                  .reduce((sum, row) => sum + row.count, 0),
                href: `/bills?topic=${slug}&status=${bucket.value}`,
                tone: bucket.value,
              }))}
              emptyMessage="No bills to chart in this topic yet."
            />
          </div>

          {related.length > 0 ? (
            <div className="card card--quiet">
              <h2 style={{ fontSize: '1rem' }}>Related topics</h2>
              <ul className="list-plain text-small" style={{ display: 'grid', gap: '0.5rem' }}>
                {related.map((relatedTopic) => (
                  <li key={relatedTopic.slug}>
                    <Link href={`/topics/${relatedTopic.slug}`}>{relatedTopic.name}</Link>
                    <br />
                    <span className="text-muted">
                      {truncate(relatedTopic.shortDescription, 90)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="card card--quiet">
            <h2 style={{ fontSize: '1rem' }}>About these categories</h2>
            <p className="text-small" style={{ marginBottom: 0 }}>
              Topics are Rising Tide&rsquo;s own categories, assigned automatically from the words
              used in each bill. They are not official state classifications. Every bill page shows
              why it was placed where it was — see the{' '}
              <Link href="/methodology">methodology</Link>.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
