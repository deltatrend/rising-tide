import Link from 'next/link';

import { BillCard, BillLine } from '@/components/bills/BillCard';
import { EventCard } from '@/components/events/EventCard';
import { LiveBoard, toStageSlices } from '@/components/home/LiveBoard';
import { WaterLine } from '@/components/home/WaterLine';
import { Callout } from '@/components/ui/Callout';
import { EmptyState, NotYetSyncedState } from '@/components/ui/EmptyState';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { BarChart, type BarChartRow } from '@/components/viz/BarChart';
import { ColumnChart, type ColumnPoint } from '@/components/viz/ColumnChart';
import { VoteBar } from '@/components/viz/VoteBar';
import { SITE } from '@/config/site';
import {
  getActivityByMonth,
  getRecentlyChanged,
  getStatusDistribution,
  listBillsCompact,
} from '@/lib/db/queries/bills';
import { getUpcomingEvents } from '@/lib/db/queries/events';
import {
  getDataFreshness,
  getMostActiveTopics,
  getSiteSnapshot,
} from '@/lib/db/queries/stats';
import { getRecentVotes, listTopicSummaries } from '@/lib/db/queries/topics';
import { displayTitle, formatDateShort, formatRelative, truncate } from '@/lib/utils/format';

// Rendered per request against our own Postgres — never LegiScan. Dynamic
// rendering keeps "upcoming", "recently changed" and freshness honest, and it
// means a deployment never depends on the database being reachable at build.
export const dynamic = 'force-dynamic';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Four topics on the homepage, in this order. The rest live on /topics. */
const FEATURED_TOPIC_SLUGS = [
  'oceans-coasts',
  'pfas-contaminants',
  'water-quality',
  'drinking-water',
] as const;

export default async function HomePage() {
  const [
    snapshot,
    freshness,
    activeBills,
    recentlyChanged,
    upcomingEvents,
    recentlyIntroduced,
    topics,
    statusDistribution,
    activity,
    recentVotes,
    activeTopics,
  ] = await Promise.all([
    getSiteSnapshot(),
    getDataFreshness(),
    listBillsCompact({ status: 'moving', sort: 'updated' }, 3),
    getRecentlyChanged(5),
    getUpcomingEvents(3),
    listBillsCompact({ sort: 'introduced' }, 5),
    listTopicSummaries(),
    getStatusDistribution(),
    getActivityByMonth(12),
    getRecentVotes(4),
    getMostActiveTopics(365, 6),
  ]);

  const empty = snapshot.trackedBills === 0;
  const stages = toStageSlices(statusDistribution);

  return (
    <>
      <section className="hero">
        <div className="container hero__inner">
          <div>
            <p className="hero__eyebrow">
              {SITE.shortName} · {SITE.subtitle}
              {snapshot.currentSessionLabel ? ` · ${snapshot.currentSessionLabel}` : ''}
            </p>
            <h1 className="hero__title">
              New York decides your water&rsquo;s future in public.{' '}
              <span className="hero__title-turn">Almost nobody is watching.</span>
            </h1>
            <p className="hero__lede">
              We watch. Every water bill in the Legislature, checked daily against the official
              record and explained in plain language — so the people who will live with these
              decisions can act on them while there is still time.
            </p>
            <div className="cluster" style={{ marginTop: '1.35rem' }}>
              <Link className="button" href="/bills">
                See what&rsquo;s moving
              </Link>
              <Link className="button button--secondary" href="/about">
                Get involved
              </Link>
            </div>
          </div>

          <LiveBoard
            snapshot={snapshot}
            freshness={freshness}
            stages={stages}
            activity={activity}
          />
        </div>

        <WaterLine />
      </section>

      <div className="container">
        <ul className="pitch">
          <li>
            <h2>Tracked, not remembered</h2>
            <p>
              Every bill is re-read from the official state record on a schedule. Nothing here is
              typed from memory or left to go stale.
            </p>
          </li>
          <li>
            <h2>Written to be understood</h2>
            <p>
              Where a bill stands, who is behind it and what happened last — without the procedural
              shorthand. The official wording is always one click away.
            </p>
          </li>
          <li>
            <h2>Pointed at what you can change</h2>
            <p>
              Hearings, committee chairs and sponsors, so you can tell the difference between a bill
              that is already decided and one that is still open.
            </p>
          </li>
        </ul>
      </div>

      <div className="container" style={{ paddingTop: '2.5rem' }}>
        {empty ? (
          <NotYetSyncedState what="legislation" />
        ) : (
          <div className="stack" style={{ ['--stack-gap' as string]: '3rem' }}>
            <section aria-labelledby="active-heading">
              <SectionHeader
                title="Moving right now"
                description="Bills that have cleared a committee or a chamber — the ones closest to becoming law."
                action={{ href: '/bills?status=moving', label: 'See all' }}
              />
              <div id="active-heading" className="visually-hidden">
                Active legislation
              </div>
              {activeBills.length > 0 ? (
                <div className="grid grid-2">
                  {activeBills.map((bill) => (
                    <BillCard key={bill.slug} bill={bill} compact />
                  ))}
                </div>
              ) : (
                <EmptyState title="Nothing is advancing at the moment">
                  <p>
                    Every tracked bill is currently awaiting committee action. That is normal
                    outside of the busiest weeks of session.
                  </p>
                </EmptyState>
              )}
            </section>

            <div className="split split-sidebar">
              <section aria-labelledby="changed-heading">
                <SectionHeader
                  title="What's changed"
                  description="Bills whose official record changed since our last synchronization."
                  action={{ href: '/bills?sort=updated', label: 'All recent activity' }}
                />
                <h2 id="changed-heading" className="visually-hidden">
                  Recently changed bills
                </h2>
                {recentlyChanged.length > 0 ? (
                  <ul className="list-divided">
                    {recentlyChanged.map((bill) => (
                      <BillLine
                        key={bill.slug}
                        slug={bill.slug}
                        billNumber={bill.billNumber}
                        title={bill.title}
                        statusId={bill.statusId}
                        trailing={
                          <>
                            {bill.lastAction ? `${truncate(bill.lastAction, 90)} · ` : ''}
                            {bill.lastSourceChangeAt
                              ? `updated ${formatRelative(bill.lastSourceChangeAt)}`
                              : ''}
                          </>
                        }
                      />
                    ))}
                  </ul>
                ) : (
                  <p className="note">
                    No changes have been recorded yet. This fills in after the second daily
                    synchronization.
                  </p>
                )}
              </section>

              <aside className="stack" style={{ ['--stack-gap' as string]: '2rem' }}>
                <section aria-labelledby="events-heading">
                  <SectionHeader
                    title="Coming up"
                    action={{ href: '/events', label: 'All events' }}
                    level={3}
                  />
                  <h2 id="events-heading" className="visually-hidden">
                    Upcoming hearings and events
                  </h2>
                  {upcomingEvents.length > 0 ? (
                    <div className="stack">
                      {upcomingEvents.map((event) => (
                        <EventCard key={event.id} event={event} />
                      ))}
                    </div>
                  ) : (
                    <Callout tone="quiet">
                      <p style={{ margin: 0 }}>
                        No hearings involving tracked water bills are scheduled. Session runs from
                        January into June, and agendas are usually posted only days ahead. The{' '}
                        <Link href="/events?when=past">recorded hearings</Link> show which
                        committees have taken these bills up before.
                      </p>
                    </Callout>
                  )}
                </section>

                {activeTopics.length > 0 ? (
                  <section aria-labelledby="hot-topics-heading">
                    <SectionHeader title="Most active topics" level={3} />
                    <h2 id="hot-topics-heading" className="visually-hidden">
                      Topics with the most activity
                    </h2>
                    <BarChart
                      caption="Official actions on tracked bills in the last 12 months, by topic"
                      rows={activeTopics.map(
                        (topic): BarChartRow => ({
                          label: topic.name,
                          value: topic.count,
                          href: `/topics/${topic.slug}`,
                        }),
                      )}
                    />
                  </section>
                ) : null}
              </aside>
            </div>

            <section aria-labelledby="where-heading">
              <SectionHeader
                title="A year of activity"
                description="Official actions — introductions, committee votes, floor votes and amendments — on the bills we track. Empty months are months with no recorded action, usually when the Legislature is out of session."
                action={{ href: '/methodology', label: 'How we count' }}
              />
              <h2 id="where-heading" className="visually-hidden">
                Legislative activity by month
              </h2>
              <div className="card">
                <ColumnChart
                  caption="Official actions recorded on tracked bills, by month"
                  points={activity.map((point, index): ColumnPoint => {
                    const [year, month] = point.month.split('-').map(Number);
                    const name = MONTH_NAMES[(month ?? 1) - 1] ?? '';
                    const yearTurn = month === 1 || index === 0;
                    return {
                      label: `${name} ${year}`,
                      shortLabel: yearTurn ? `${name} ’${String(year).slice(-2)}` : name,
                      value: point.count,
                    };
                  })}
                />
              </div>
            </section>

            <div className="split split-sidebar">
              <section aria-labelledby="new-heading">
                <SectionHeader
                  title="Recently introduced"
                  description="The newest water bills to enter the process."
                  action={{ href: '/bills?sort=introduced', label: 'See all' }}
                />
                <h2 id="new-heading" className="visually-hidden">
                  Recently introduced bills
                </h2>
                <ul className="list-divided">
                  {recentlyIntroduced.map((bill) => (
                    <BillLine
                      key={bill.slug}
                      slug={bill.slug}
                      billNumber={bill.billNumber}
                      title={bill.title}
                      statusId={bill.statusId}
                      trailing={
                        bill.introducedOn
                          ? `Introduced ${formatDateShort(bill.introducedOn)}`
                          : undefined
                      }
                    />
                  ))}
                </ul>
              </section>

              <section aria-labelledby="votes-heading">
                <SectionHeader title="Recent votes" level={3} />
                <h2 id="votes-heading" className="visually-hidden">
                  Recent recorded votes
                </h2>
                {recentVotes.length > 0 ? (
                  <ul className="list-divided">
                    {recentVotes.map((vote) => (
                      <li key={vote.rollCallId}>
                        <Link href={`/bills/${vote.billSlug}`}>
                          {vote.billNumber} — {displayTitle(vote.billTitle, 70)}
                        </Link>
                        <p className="note" style={{ margin: '0.2rem 0 0.4rem' }}>
                          {formatDateShort(vote.voteDate)}
                          {vote.description ? ` · ${truncate(vote.description, 60)}` : ''}
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
                ) : (
                  <p className="note">
                    No recorded votes on tracked bills yet. Most bills never reach a floor vote.
                  </p>
                )}
              </section>
            </div>

            <section aria-labelledby="topics-heading">
              <SectionHeader
                title="Browse by topic"
                description="Four places to start. Every other topic we track is on the full list."
                action={{ href: '/topics', label: 'View all topics' }}
              />
              <h2 id="topics-heading" className="visually-hidden">
                Topics
              </h2>
              <div className="grid grid-2">
                {FEATURED_TOPIC_SLUGS.map((slug) => topics.find((topic) => topic.slug === slug))
                  .filter((topic): topic is (typeof topics)[number] => topic !== undefined)
                  .map((topic) => (
                    <Link key={topic.slug} className="tile" href={`/topics/${topic.slug}`}>
                      <h3 className="tile__title">{topic.name}</h3>
                      <p className="tile__desc">{topic.shortDescription}</p>
                      <span className="tile__meta">
                        {topic.billCount} {topic.billCount === 1 ? 'bill' : 'bills'}
                        {topic.upcomingEventCount > 0
                          ? ` · ${topic.upcomingEventCount} upcoming`
                          : ''}
                      </span>
                    </Link>
                  ))}
              </div>
            </section>

            <Callout title="How to read this site">
              <p style={{ marginBottom: 0 }}>
                Bill text, sponsors, votes and hearing notices come from the official legislative
                record through LegiScan. Which bills count as water bills, and which topics they
                belong to, is our judgment — and we show the reasoning on every bill page. Read the{' '}
                <Link href="/methodology">methodology</Link> for the full explanation.
              </p>
            </Callout>
          </div>
        )}
      </div>
    </>
  );
}
