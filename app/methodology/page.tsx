import type { Metadata } from 'next';
import Link from 'next/link';

import { FreshnessIndicator } from '@/components/ui/FreshnessIndicator';
import { PageHeader } from '@/components/ui/SectionHeader';
import { Stat, StatGrid } from '@/components/ui/Stat';
import { ATTRIBUTION } from '@/config/site';
import { TOPICS } from '@/config/topics';
import { CLASSIFIER_VERSION, SCORING } from '@/config/water-taxonomy';
import {
  getApiUsageThisMonth,
  getDataFreshness,
  getRecentSyncRuns,
  getSiteSnapshot,
} from '@/lib/db/queries/stats';
import { formatNumber, formatTimestamp } from '@/lib/utils/format';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Methodology',
  description:
    'Where Rising Tide gets its data, how often it updates, how bills are selected as water policy, and what we do not know.',
  alternates: { canonical: '/methodology' },
};

export default async function MethodologyPage() {
  const [freshness, snapshot, usage, runs] = await Promise.all([
    getDataFreshness(),
    getSiteSnapshot(),
    getApiUsageThisMonth(),
    getRecentSyncRuns(5),
  ]);

  return (
    <div className="container">
      <PageHeader
        eyebrow="Transparency"
        title="Methodology"
        lede="How this site is built, where every fact comes from, and where our judgment replaces the official record. If you cannot check our work, you should not trust it."
      />

      <div className="split split-sidebar">
        <div className="prose">
          <h2>Where the data comes from</h2>
          <p>
            All legislative information on this site — bill numbers, titles, sponsors, committee
            referrals, actions, roll-call votes, documents and calendar events — comes from{' '}
            <a href={ATTRIBUTION.sourceUrl} rel="noopener noreferrer" target="_blank">
              LegiScan
            </a>
            , which aggregates the official record published by the New York State Legislature.
            LegiScan data is made available under the{' '}
            <a href={ATTRIBUTION.licenseUrl} rel="noopener noreferrer" target="_blank">
              {ATTRIBUTION.licenseName}
            </a>{' '}
            licence.
          </p>
          <p>
            <strong>{ATTRIBUTION.disclaimer}</strong> Where a bill has an official New York State
            page, we link to it directly on the bill page, and that link should be treated as
            authoritative over anything shown here.
          </p>

          <h2>How often it updates</h2>
          <p>
            A scheduled job runs once a day and asks LegiScan what has changed. Nothing on this site
            contacts LegiScan when you load a page — every page you see is served from our own
            database. That keeps the site fast, keeps it free to run, and means our usage stays far
            inside the API quota.
          </p>
          <p>
            LegiScan gives every bill a change hash. If the hash for a bill has not moved since our
            last run, we do not request its details again. This is why the site can follow hundreds
            of bills while making only a few hundred requests a month.
          </p>
          <p>
            <FreshnessIndicator freshness={freshness} detailed />
          </p>

          <h2>How bills are selected</h2>
          <p>
            New York does not publish a category called &ldquo;water bills&rdquo;, so we have to
            decide what counts. The decision is made in two steps, and both are automatic and
            rule-based — there is no AI model involved, and no policy summary on this site is
            machine-generated.
          </p>
          <ol>
            <li>
              <strong>Discovery.</strong> We run a fixed set of searches against the current session
              — terms like <em>drinking water</em>, <em>wetlands</em>, <em>PFAS</em>,{' '}
              <em>stormwater</em>, <em>Long Island Sound</em> — to assemble a candidate list.
            </li>
            <li>
              <strong>Scoring.</strong> Each candidate is scored against a water-policy vocabulary.
              Terms are weighted by how specific they are: <em>drinking water standard</em> counts
              far more than <em>water</em> alone. A term in the title counts more than the same term
              buried in the description. Phrases that look like water but are not — &ldquo;water
              down&rdquo;, &ldquo;watered stock&rdquo;, &ldquo;Waterford&rdquo; as a place name —
              are removed before scoring.
            </li>
          </ol>
          <p>
            The score is normalised to a 0–100 scale. A bill is tracked when it scores{' '}
            <strong>{SCORING.relevanceThreshold} or higher</strong>. One core water concept in the
            title clears that bar; one passing mention of water inside a large budget bill does not.
            The current classifier version is <code>{CLASSIFIER_VERSION}</code>, and it is recorded
            on every bill so past decisions stay auditable.
          </p>
          <p>
            Every bill page shows its score and a plain sentence explaining what matched. If we get
            one wrong, the reasoning is visible rather than hidden.
          </p>

          <h3>Manual corrections</h3>
          <p>
            Automatic rules make mistakes in both directions. A person can override the classifier
            for any individual bill, in either direction, and every override stores a written reason
            and a timestamp. Where an override is in effect, the bill page says so and shows the
            reason. Overrides always win over the automatic result.
          </p>

          <h3>Topics</h3>
          <p>
            The {TOPICS.length} topics on this site are our own editorial categories, not official
            classifications. A bill is attached to a topic when its text matches that topic&rsquo;s
            vocabulary strongly enough, and it can belong to several. A bill is never assigned more
            than {SCORING.maxTopicsPerBill} topics, so the strongest connections stay meaningful.
          </p>

          <h2>What we show, and who wrote it</h2>
          <p>Every piece of information on this site is one of three things:</p>
          <ul>
            <li>
              <strong>Official.</strong> Taken directly from the legislative record: titles, status,
              actions, sponsors, votes, documents, hearing notices. We translate status codes into
              readable labels but never change their meaning.
            </li>
            <li>
              <strong>Derived.</strong> Computed by us from official data: relevance scores, topic
              assignments, stage summaries, counts and charts.
            </li>
            <li>
              <strong>Editorial.</strong> Written by people at Rising Tide: topic explanations, the
              wording of this page, and any plain-language bill summary. Editorial text is always
              labelled as ours where it appears alongside official text.
            </li>
          </ul>
          <p>
            We do not generate policy summaries automatically. Where a bill has no plain-language
            summary, the page says so instead of inventing one.
          </p>

          <h2>Events and hearings</h2>
          <p>
            The calendar covers legislative events attached to bills we track: committee agendas,
            floor sessions and scheduled hearings, as published through LegiScan. It is not a
            complete list of public meetings about water in New York — local water board meetings,
            agency listening sessions and regional planning meetings are not included yet. The
            software is built so additional event sources can be added later without changing how
            existing events work.
          </p>

          <h2>What we do not know</h2>
          <ul>
            <li>
              Committee membership and chair assignments are not currently included, so we cannot
              tell you who sits on a committee.
            </li>
            <li>
              Most legislative decisions never produce a recorded vote. An absence of votes on a
              bill page means no roll call was recorded, not that nothing happened.
            </li>
            <li>
              Amendments and analyses are only shown when the legislative record publishes them.
            </li>
            <li>
              Hearing notices can change or be cancelled after we record them. Always confirm with
              the official notice before travelling.
            </li>
          </ul>

          <h2>Corrections</h2>
          <p>
            If something here is wrong, the official source linked on the page takes precedence. We
            would rather show a gap than fill it with a guess, so anywhere the record is silent, this
            site says so.
          </p>
        </div>

        <aside className="stack" style={{ ['--stack-gap' as string]: '1.5rem' }}>
          <div className="card">
            <h2 style={{ fontSize: '1rem' }}>Current coverage</h2>
            <StatGrid>
              <Stat value={snapshot.trackedBills} label="Bills tracked" />
              <Stat value={snapshot.activeTopics} label="Topics in use" />
              <Stat value={snapshot.upcomingEvents} label="Upcoming events" />
              <Stat value={snapshot.trackedLegislators} label="Legislators" />
            </StatGrid>
            {snapshot.currentSessionLabel ? (
              <p className="note" style={{ marginTop: '0.85rem', marginBottom: 0 }}>
                {snapshot.currentSessionLabel}
              </p>
            ) : null}
          </div>

          {usage ? (
            <div className="card">
              <h2 style={{ fontSize: '1rem' }}>API usage this month</h2>
              <p className="text-small" style={{ marginBottom: '0.5rem' }}>
                {formatNumber(usage.used)} of {formatNumber(usage.limit)} LegiScan queries used in{' '}
                {usage.period}.
              </p>
              <div className="bar-chart__track" aria-hidden="true">
                <span
                  className="bar-chart__fill"
                  style={{ width: `${Math.min(100, (usage.used / usage.limit) * 100)}%` }}
                />
              </div>
              <p className="note" style={{ marginTop: '0.6rem', marginBottom: 0 }}>
                Page views consume none of this. Only the daily synchronization does.
              </p>
            </div>
          ) : null}

          {runs.length > 0 ? (
            <div className="card card--quiet">
              <h2 style={{ fontSize: '1rem' }}>Recent synchronizations</h2>
              <ul className="list-plain text-small" style={{ display: 'grid', gap: '0.6rem' }}>
                {runs.map((run) => (
                  <li key={run.id}>
                    <strong>{formatTimestamp(run.startedAt)}</strong>{' '}
                    <span
                      className={`badge badge--${
                        run.status === 'success' ? 'passed' : run.status === 'failed' ? 'ended' : 'moving'
                      }`}
                    >
                      {run.status}
                    </span>
                    <br />
                    <span className="text-muted">
                      {run.queriesConsumed} queries · {run.billsInserted} new ·{' '}
                      {run.billsUpdated} updated · {run.billsUnchanged} unchanged
                      {run.errorCount > 0 ? ` · ${run.errorCount} errors` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="card card--quiet">
            <h2 style={{ fontSize: '1rem' }}>Attribution</h2>
            <p className="text-small" style={{ marginBottom: 0 }}>
              Legislative data provided by{' '}
              <a href={ATTRIBUTION.sourceUrl} rel="noopener noreferrer" target="_blank">
                LegiScan
              </a>{' '}
              under{' '}
              <a href={ATTRIBUTION.licenseUrl} rel="noopener noreferrer" target="_blank">
                CC BY 4.0
              </a>
              . Rising Tide is an independent youth project and is not affiliated with LegiScan or the
              State of New York. Read <Link href="/about">about this project</Link>.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
