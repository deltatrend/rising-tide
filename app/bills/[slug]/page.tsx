import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { BillTimeline } from '@/components/bills/BillTimeline';
import { SponsorLine } from '@/components/bills/BillCard';
import { Callout } from '@/components/ui/Callout';
import { FixtureBadge, StatusBadge } from '@/components/ui/Badge';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { ShareControls } from '@/components/ui/ShareControls';
import { StatusTrack } from '@/components/viz/StatusTrack';
import { VoteBar, VoteRoster } from '@/components/viz/VoteBar';
import { absoluteUrl, ATTRIBUTION, SITE } from '@/config/site';
import { getBillBySlug } from '@/lib/db/queries/bills';
import {
  billTypeLabel,
  chamberLabel,
  describeStatus,
  isCompanionRelation,
  mimeLabel,
  SAST_EXPLANATIONS,
  sastLabel,
  sponsorTypeLabel,
  supplementTypeLabel,
  textTypeLabel,
} from '@/lib/legiscan/enums';
import {
  asSentence,
  displayTitle,
  officialShortTitle,
  formatBytes,
  formatDate,
  formatDateShort,
  formatEventTime,
  formatRelative,
  formatTimestamp,
  tidyBillNumber,
  truncate,
} from '@/lib/utils/format';
import { describeProgress } from '@/lib/utils/stages';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const detail = await getBillBySlug(slug);

  if (!detail) {
    return { title: 'Bill not found' };
  }

  const number = tidyBillNumber(detail.bill.billNumber);
  const title = `${number}: ${truncate(asSentence(detail.bill.title), 70)}`;
  const description = truncate(
    asSentence(detail.bill.description ?? detail.bill.title),
    180,
  );

  return {
    title,
    description,
    alternates: { canonical: `/bills/${slug}` },
    openGraph: {
      type: 'article',
      title: `${title} · ${SITE.shortName}`,
      description,
      url: `/bills/${slug}`,
    },
    twitter: { card: 'summary', title, description },
  };
}

export default async function BillPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const detail = await getBillBySlug(slug);

  if (!detail) notFound();

  const { bill } = detail;
  const status = describeStatus(bill.statusId);
  const number = tidyBillNumber(bill.billNumber);
  const shareUrl = absoluteUrl(`/bills/${slug}`);
  const companions = detail.relatedBills.filter((r) => isCompanionRelation(r.relationTypeId));
  const otherRelated = detail.relatedBills.filter((r) => !isCompanionRelation(r.relationTypeId));

  return (
    <div className="container">
      <nav aria-label="Breadcrumb" className="text-small text-muted" style={{ marginBottom: '1rem' }}>
        <Link href="/bills">All water bills</Link> <span aria-hidden="true">›</span> {number}
      </nav>

      <article>
        <header className="page-header" style={{ maxWidth: '70ch' }}>
          <div className="cluster" style={{ marginBottom: '0.6rem' }}>
            <span className="bill-number">{number}</span>
            <StatusBadge statusId={bill.statusId} />
            {bill.billTypeId ? (
              <span className="badge badge--neutral">
                {billTypeLabel(bill.billTypeId, bill.billType)}
              </span>
            ) : null}
            {bill.isFixture ? <FixtureBadge /> : null}
          </div>

          <h1 style={{ fontSize: 'clamp(1.6rem, 1.2rem + 1.6vw, 2.3rem)' }}>
            {displayTitle(bill.title, 220)}
          </h1>

          <p className="page-header__lede">{describeProgress(bill.statusId)}</p>

          <div style={{ marginTop: '1.25rem', maxWidth: '34rem' }}>
            <StatusTrack statusId={bill.statusId} />
          </div>
        </header>

        <div className="split split-sidebar">
          <div className="stack" style={{ ['--stack-gap' as string]: '2.5rem' }}>
            {/* ------------------------------------------------- What it does */}
            <section aria-labelledby="what-heading">
              <SectionHeader title="What this bill does" />
              <h2 id="what-heading" className="visually-hidden">
                What this bill does
              </h2>

              {bill.plainLanguageSummary ? (
                <>
                  <p>{bill.plainLanguageSummary}</p>
                  <p className="note">
                    Written by Rising Tide. The official description from the legislative record is
                    below.
                  </p>
                </>
              ) : null}

              {bill.description && bill.description !== bill.title ? (
                <blockquote
                  style={{
                    margin: 0,
                    paddingLeft: '1rem',
                    borderLeft: '3px solid var(--line)',
                    color: 'var(--ink-soft)',
                  }}
                >
                  <p style={{ marginBottom: '0.4rem' }}>{asSentence(bill.description)}</p>
                  <footer className="note">Official description, from the legislative record.</footer>
                </blockquote>
              ) : officialShortTitle(bill.title) !== bill.title.trim() ? (
                <blockquote
                  style={{
                    margin: 0,
                    paddingLeft: '1rem',
                    borderLeft: '3px solid var(--line)',
                    color: 'var(--ink-soft)',
                  }}
                >
                  <p style={{ marginBottom: '0.4rem' }}>{asSentence(bill.title)}</p>
                  <footer className="note">
                    Official title from the legislative record. Budget and omnibus bills list every
                    Part in this field; the heading above is the opening clause.
                  </footer>
                </blockquote>
              ) : (
                <p className="note">
                  The legislative record does not include a longer description for this bill beyond
                  its title.
                </p>
              )}

              {bill.whyItMatters ? (
                <Callout title="Why it matters">
                  <p style={{ marginBottom: 0 }}>{bill.whyItMatters}</p>
                </Callout>
              ) : null}
            </section>

            {/* --------------------------------------------------- Why tracked */}
            <section aria-labelledby="why-tracked-heading">
              <SectionHeader title="Why we track this bill" />
              <h2 id="why-tracked-heading" className="visually-hidden">
                Why we track this bill
              </h2>

              {detail.override ? (
                <Callout tone="warn" title="Reviewed by a person">
                  <p style={{ marginBottom: 0 }}>
                    This bill was manually{' '}
                    {detail.override.decision === 'include' ? 'included in' : 'excluded from'} our
                    tracking on {formatDate(detail.override.createdAt.toISOString().slice(0, 10))}.
                    Reason: {detail.override.reason}
                  </p>
                </Callout>
              ) : null}

              {detail.classification ? (
                <p>
                  {detail.classification.reason} Our relevance score for this bill is{' '}
                  <strong>{detail.classification.score} out of 100</strong>. Scoring is automatic
                  and rule-based — see the <Link href="/methodology">methodology</Link> for how it
                  is calculated.
                </p>
              ) : (
                <p className="note">
                  No classification record has been stored for this bill yet.
                </p>
              )}

              {detail.topics.length > 0 ? (
                <div className="cluster">
                  {detail.topics.map((topic) => (
                    <Link key={topic.slug} className="pill-link" href={`/topics/${topic.slug}`}>
                      {topic.name}
                      {topic.isPrimary ? <span className="visually-hidden"> (primary topic)</span> : null}
                    </Link>
                  ))}
                </div>
              ) : null}

              {bill.subjects && bill.subjects.length > 0 ? (
                <p className="note" style={{ marginTop: '0.85rem' }}>
                  Official subject tags: {bill.subjects.map((s) => s.name).join(', ')}.
                </p>
              ) : null}
            </section>

            {/* ------------------------------------------------------- Timeline */}
            <section aria-labelledby="timeline-heading">
              <SectionHeader
                title="What has happened so far"
                description="The complete official action history, newest first."
              />
              <h2 id="timeline-heading" className="visually-hidden">
                Legislative history
              </h2>
              <BillTimeline actions={detail.actions} />
            </section>

            {/* ---------------------------------------------------------- Votes */}
            {detail.rollCalls.length > 0 ? (
              <section aria-labelledby="votes-heading">
                <SectionHeader
                  title="Recorded votes"
                  description="Every roll call the legislative record includes for this bill."
                />
                <h2 id="votes-heading" className="visually-hidden">
                  Recorded votes
                </h2>

                <div className="stack" style={{ ['--stack-gap' as string]: '1.25rem' }}>
                  {detail.rollCalls.map((rollCall) => (
                    <div className="card" key={rollCall.id}>
                      <div className="cluster-between" style={{ marginBottom: '0.6rem' }}>
                        <div>
                          <h3 style={{ margin: 0, fontSize: '1rem' }}>
                            {rollCall.description ?? 'Recorded vote'}
                          </h3>
                          <p className="note" style={{ margin: '0.15rem 0 0' }}>
                            {formatDate(rollCall.voteDate)}
                            {rollCall.chamber ? ` · ${chamberLabel(rollCall.chamber)}` : ''}
                          </p>
                        </div>
                        <span
                          className={`badge badge--${rollCall.passed ? 'passed' : 'ended'}`}
                        >
                          {rollCall.passed ? 'Passed' : 'Did not pass'}
                        </span>
                      </div>

                      <VoteBar
                        totals={{
                          yea: rollCall.yea,
                          nay: rollCall.nay,
                          notVoting: rollCall.notVoting,
                          absent: rollCall.absent,
                          total: rollCall.total,
                        }}
                        passed={rollCall.passed}
                      />

                      {rollCall.votes.length > 0 ? (
                        <details style={{ marginTop: '0.85rem' }}>
                          <summary className="text-small">
                            How each legislator voted ({rollCall.votes.length} members)
                          </summary>
                          <VoteRoster votes={rollCall.votes} />
                        </details>
                      ) : (
                        <p className="note" style={{ marginTop: '0.6rem', marginBottom: 0 }}>
                          Individual member votes are not available for this roll call.
                        </p>
                      )}

                      {rollCall.stateUrl || rollCall.legiscanUrl ? (
                        <p className="note" style={{ marginTop: '0.6rem', marginBottom: 0 }}>
                          <a
                            href={rollCall.stateUrl ?? rollCall.legiscanUrl ?? '#'}
                            rel="noopener noreferrer"
                            target="_blank"
                          >
                            Official record of this vote
                          </a>
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {/* ------------------------------------------------------ Documents */}
            {detail.documents.length > 0 ||
            detail.amendments.length > 0 ||
            detail.supplements.length > 0 ? (
              <section aria-labelledby="documents-heading">
                <SectionHeader
                  title="Documents"
                  description="Official bill text, amendments and analyses. Links go to the authoritative source wherever one is published."
                />
                <h2 id="documents-heading" className="visually-hidden">
                  Documents
                </h2>

                {detail.documents.length > 0 ? (
                  <>
                    <h3 style={{ fontSize: '0.95rem' }}>Bill text</h3>
                    <ul className="doc-list">
                      {detail.documents.map((doc) => (
                        <li key={doc.id}>
                          <span>
                            <strong>{textTypeLabel(doc.versionTypeId, doc.versionType)}</strong>
                            {doc.documentDate ? ` · ${formatDateShort(doc.documentDate)}` : ''}
                          </span>
                          <span className="doc-list__meta">
                            {mimeLabel(doc.mimeId, doc.mimeType)}
                            {doc.sizeBytes ? ` · ${formatBytes(doc.sizeBytes)}` : ''}
                            {' · '}
                            {doc.stateUrl ? (
                              <a href={doc.stateUrl} rel="noopener noreferrer" target="_blank">
                                Official copy
                              </a>
                            ) : doc.legiscanUrl ? (
                              <a href={doc.legiscanUrl} rel="noopener noreferrer" target="_blank">
                                View on LegiScan
                              </a>
                            ) : (
                              'No public link recorded'
                            )}
                            {doc.isCached ? (
                              <>
                                {' · '}
                                <a href={`/api/documents/text/${doc.legiscanDocId}`}>Cached copy</a>
                              </>
                            ) : null}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}

                {detail.amendments.length > 0 ? (
                  <>
                    <h3 style={{ fontSize: '0.95rem', marginTop: '1.25rem' }}>Amendments</h3>
                    <ul className="doc-list">
                      {detail.amendments.map((amendment) => (
                        <li key={amendment.id}>
                          <span>
                            <strong>{amendment.title ?? 'Amendment'}</strong>
                            {amendment.chamber ? ` · ${chamberLabel(amendment.chamber)}` : ''}
                            {amendment.amendmentDate
                              ? ` · ${formatDateShort(amendment.amendmentDate)}`
                              : ''}
                            {amendment.adopted ? ' · Adopted' : ' · Not adopted'}
                          </span>
                          <span className="doc-list__meta">
                            {amendment.stateUrl ? (
                              <a href={amendment.stateUrl} rel="noopener noreferrer" target="_blank">
                                Official copy
                              </a>
                            ) : amendment.legiscanUrl ? (
                              <a
                                href={amendment.legiscanUrl}
                                rel="noopener noreferrer"
                                target="_blank"
                              >
                                View on LegiScan
                              </a>
                            ) : (
                              'No public link recorded'
                            )}
                            {amendment.isCached ? (
                              <>
                                {' · '}
                                <a href={`/api/documents/amendment/${amendment.legiscanAmendmentId}`}>
                                  Cached copy
                                </a>
                              </>
                            ) : null}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}

                {detail.supplements.length > 0 ? (
                  <>
                    <h3 style={{ fontSize: '0.95rem', marginTop: '1.25rem' }}>
                      Analyses and supporting documents
                    </h3>
                    <ul className="doc-list">
                      {detail.supplements.map((supplement) => (
                        <li key={supplement.id}>
                          <span>
                            <strong>
                              {supplementTypeLabel(
                                supplement.supplementTypeId,
                                supplement.supplementType,
                              )}
                            </strong>
                            {supplement.supplementDate
                              ? ` · ${formatDateShort(supplement.supplementDate)}`
                              : ''}
                          </span>
                          <span className="doc-list__meta">
                            {supplement.stateUrl ? (
                              <a
                                href={supplement.stateUrl}
                                rel="noopener noreferrer"
                                target="_blank"
                              >
                                Official copy
                              </a>
                            ) : supplement.legiscanUrl ? (
                              <a
                                href={supplement.legiscanUrl}
                                rel="noopener noreferrer"
                                target="_blank"
                              >
                                View on LegiScan
                              </a>
                            ) : (
                              'No public link recorded'
                            )}
                            {supplement.isCached ? (
                              <>
                                {' · '}
                                <a
                                  href={`/api/documents/supplement/${supplement.legiscanSupplementId}`}
                                >
                                  Cached copy
                                </a>
                              </>
                            ) : null}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </section>
            ) : null}

            {/* --------------------------------------------------- Related bills */}
            {detail.relatedBills.length > 0 ? (
              <section aria-labelledby="related-heading">
                <SectionHeader
                  title="Related bills"
                  description={
                    companions.length > 0
                      ? 'New York bills are usually introduced in both chambers at once. Companion bills must both pass in identical form.'
                      : undefined
                  }
                />
                <h2 id="related-heading" className="visually-hidden">
                  Related bills
                </h2>
                <ul className="list-divided">
                  {[...companions, ...otherRelated].map((related) => (
                    <li key={`${related.relatedLegiscanBillId}-${related.relationTypeId}`}>
                      <div className="cluster" style={{ gap: '0.45rem' }}>
                        <span className="bill-number">
                          {tidyBillNumber(related.relatedBillNumber ?? 'Unknown')}
                        </span>
                        <span
                          className="badge badge--neutral"
                          title={SAST_EXPLANATIONS[related.relationTypeId]}
                        >
                          {sastLabel(related.relationTypeId, related.relationType)}
                        </span>
                      </div>
                      <div style={{ marginTop: '0.25rem' }}>
                        {related.slug ? (
                          <Link href={`/bills/${related.slug}`}>
                            {asSentence(related.title ?? 'View bill')}
                          </Link>
                        ) : (
                          <span className="text-small text-muted">
                            Not tracked by Rising Tide — it does not meet our water-policy criteria.
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>

          {/* ================================================== Sidebar ======= */}
          <aside className="stack" style={{ ['--stack-gap' as string]: '1.5rem' }}>
            <div className="card">
              <h2 style={{ fontSize: '1rem' }}>Key facts</h2>
              <dl className="detail-list">
                <div>
                  <dt>Status</dt>
                  <dd>
                    {status.label}
                    {bill.statusDate ? ` since ${formatDateShort(bill.statusDate)}` : ''}
                  </dd>
                </div>
                {bill.introducedOn ? (
                  <div>
                    <dt>Introduced</dt>
                    <dd>{formatDate(bill.introducedOn)}</dd>
                  </div>
                ) : null}
                {bill.lastAction ? (
                  <div>
                    <dt>Latest action</dt>
                    <dd>
                      {bill.lastAction}
                      {bill.lastActionDate ? ` (${formatDateShort(bill.lastActionDate)})` : ''}
                    </dd>
                  </div>
                ) : null}
                <div>
                  <dt>Chamber</dt>
                  <dd>
                    {chamberLabel(bill.currentBody ?? bill.body)}
                    {bill.body && bill.currentBody && bill.body !== bill.currentBody
                      ? ` (originated in the ${chamberLabel(bill.body)})`
                      : ''}
                  </dd>
                </div>
                {detail.committee ? (
                  <div>
                    <dt>Currently in committee</dt>
                    <dd>
                      <Link href={`/committees/${detail.committee.slug}`}>
                        {detail.committee.name}
                      </Link>
                    </dd>
                  </div>
                ) : null}
                {detail.session?.label ? (
                  <div>
                    <dt>Session</dt>
                    <dd>{detail.session.label}</dd>
                  </div>
                ) : null}
              </dl>
            </div>

            {detail.sponsors.length > 0 ? (
              <div className="card">
                <h2 style={{ fontSize: '1rem' }}>
                  {detail.sponsors.length === 1 ? 'Sponsor' : `Sponsors (${detail.sponsors.length})`}
                </h2>
                <ul className="list-plain text-small" style={{ display: 'grid', gap: '0.5rem' }}>
                  {detail.sponsors.slice(0, 12).map((sponsor) => (
                    <SponsorLine
                      key={sponsor.slug}
                      person={sponsor}
                      sponsorTypeLabel={sponsorTypeLabel(sponsor.sponsorTypeId)}
                    />
                  ))}
                </ul>
                {detail.sponsors.length > 12 ? (
                  <p className="note" style={{ marginTop: '0.6rem', marginBottom: 0 }}>
                    and {detail.sponsors.length - 12} more co-sponsors.
                  </p>
                ) : null}
              </div>
            ) : null}

            {detail.upcomingEvents.length > 0 ? (
              <div className="card card--accent">
                <h2 style={{ fontSize: '1rem' }}>Scheduled</h2>
                <ul className="list-plain text-small" style={{ display: 'grid', gap: '0.65rem' }}>
                  {detail.upcomingEvents.map((event) => (
                    <li key={event.id}>
                      <strong>{formatDate(event.eventDate)}</strong>
                      {formatEventTime(event.startTime)
                        ? ` at ${formatEventTime(event.startTime)}`
                        : ''}
                      <br />
                      {event.title}
                      {event.location ? (
                        <>
                          <br />
                          <span className="text-muted">{event.location}</span>
                        </>
                      ) : null}
                      {event.sourceUrl ? (
                        <>
                          <br />
                          <a href={event.sourceUrl} rel="noopener noreferrer" target="_blank">
                            Official notice
                          </a>
                        </>
                      ) : null}
                    </li>
                  ))}
                </ul>
                <p className="note" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
                  Public hearings in New York usually accept written testimony. Check the official
                  notice for instructions and deadlines.
                </p>
              </div>
            ) : null}

            <div className="card">
              <h2 style={{ fontSize: '1rem' }}>Follow this bill</h2>
              <p className="text-small">
                Rising Tide has no accounts and no mailing list. Use the official sources below to
                read the bill in full, contact its sponsor, or check for a hearing.
              </p>
              <ul className="list-plain text-small" style={{ display: 'grid', gap: '0.45rem' }}>
                {bill.stateUrl ? (
                  <li>
                    <a href={bill.stateUrl} rel="noopener noreferrer" target="_blank">
                      Official New York State page for {number}
                    </a>
                  </li>
                ) : null}
                {bill.legiscanUrl ? (
                  <li>
                    <a href={bill.legiscanUrl} rel="noopener noreferrer" target="_blank">
                      LegiScan record
                    </a>
                  </li>
                ) : null}
                {detail.sponsors[0] ? (
                  <li>
                    <Link href={`/legislators/${detail.sponsors[0].slug}`}>
                      About the lead sponsor
                    </Link>
                  </li>
                ) : null}
                <li>
                  <Link href="/events">Upcoming hearings and meetings</Link>
                </li>
              </ul>
              <div style={{ marginTop: '0.85rem' }}>
                <ShareControls title={`${number}: ${truncate(bill.title, 80)}`} url={shareUrl} />
              </div>
            </div>

            <div className="card card--quiet">
              <h2 style={{ fontSize: '1rem' }}>Where this comes from</h2>
              <dl className="detail-list text-small">
                <div>
                  <dt>Source</dt>
                  <dd>
                    <a href={ATTRIBUTION.sourceUrl} rel="noopener noreferrer" target="_blank">
                      {ATTRIBUTION.sourceName}
                    </a>{' '}
                    · LegiScan bill ID {bill.legiscanBillId}
                  </dd>
                </div>
                <div>
                  <dt>First recorded here</dt>
                  <dd>{formatDate(bill.firstSeenAt.toISOString().slice(0, 10))}</dd>
                </div>
                <div>
                  <dt>Last checked</dt>
                  <dd>
                    {formatRelative(bill.lastSyncedAt)}{' '}
                    <span className="text-muted">({formatTimestamp(bill.lastSyncedAt)} UTC)</span>
                  </dd>
                </div>
                {bill.lastSourceChangeAt ? (
                  <div>
                    <dt>Source last changed</dt>
                    <dd>{formatRelative(bill.lastSourceChangeAt)}</dd>
                  </div>
                ) : null}
              </dl>
              <p className="note" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
                {ATTRIBUTION.disclaimer}
              </p>
            </div>
          </aside>
        </div>
      </article>
    </div>
  );
}
