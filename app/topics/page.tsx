import type { Metadata } from 'next';
import Link from 'next/link';

import { NotYetSyncedState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/SectionHeader';
import { TOPIC_CATEGORIES } from '@/config/topics';
import { listTopicSummaries } from '@/lib/db/queries/topics';
import { listingMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = listingMetadata(
  'Topics',
  'Water policy in New York, grouped into topics: drinking water, PFAS, wetlands, flooding, fisheries, Long Island Sound, the Great Lakes and more.',
  '/topics',
);

export default async function TopicsPage() {
  const topics = await listTopicSummaries();

  if (topics.length === 0) {
    return (
      <div className="container">
        <PageHeader
          eyebrow="Explore"
          title="Topics"
          lede="Water policy covers a lot of ground. These topics break it into areas you can follow one at a time."
        />
        <NotYetSyncedState what="topics" />
        <p className="note" style={{ marginTop: '1rem' }}>
          Topics are seeded with <code>npm run db:seed-topics</code>.
        </p>
      </div>
    );
  }

  return (
    <div className="container">
      <PageHeader
        eyebrow="Explore"
        title="Topics"
        lede="Water policy covers a lot of ground. These topics break it into areas you can follow one at a time. They are our own categories, not official state classifications."
      />

      <div className="stack" style={{ ['--stack-gap' as string]: '2.5rem' }}>
        {TOPIC_CATEGORIES.map((category) => {
          const inCategory = topics.filter((topic) => topic.category === category);
          if (inCategory.length === 0) return null;

          return (
            <section key={category} aria-label={category}>
              <h2 style={{ fontSize: '1.15rem' }}>{category}</h2>
              <div className="grid grid-3">
                {inCategory.map((topic) => (
                  <Link key={topic.slug} className="tile" href={`/topics/${topic.slug}`}>
                    <h3 className="tile__title">{topic.name}</h3>
                    <p className="tile__desc">{topic.shortDescription}</p>
                    <span className="tile__meta">
                      {topic.billCount === 0
                        ? 'No bills tracked yet'
                        : `${topic.billCount} ${topic.billCount === 1 ? 'bill' : 'bills'}`}
                      {topic.recentlyChangedCount > 0
                        ? ` · ${topic.recentlyChangedCount} changed recently`
                        : ''}
                      {topic.upcomingEventCount > 0
                        ? ` · ${topic.upcomingEventCount} upcoming`
                        : ''}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
