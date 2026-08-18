import Link from 'next/link';

import { FixtureBadge, StatusBadge } from '@/components/ui/Badge';
import { StatusTrack } from '@/components/viz/StatusTrack';
import type { BillListItem } from '@/lib/db/queries/types';
import { chamberLabel, partyLabel, roleLabel } from '@/lib/legiscan/enums';
import { asSentence, displayTitle, formatDateShort, tidyBillNumber, truncate } from '@/lib/utils/format';

export function BillCard({
  bill,
  compact = false,
  showTrack = true,
}: {
  bill: BillListItem;
  compact?: boolean;
  showTrack?: boolean;
}) {
  return (
    <article className={`bill-card${compact ? ' bill-card--compact' : ''}`}>
      <div className="bill-card__head">
        <span className="bill-number">{tidyBillNumber(bill.billNumber)}</span>
        <StatusBadge statusId={bill.statusId} />
        {bill.isFixture ? <FixtureBadge /> : null}
        {bill.upcomingEventCount > 0 ? (
          <span className="badge badge--tide" title="Scheduled at an upcoming hearing or meeting">
            Upcoming hearing
          </span>
        ) : null}
      </div>

      <h3 className="bill-card__title">
        <Link href={`/bills/${bill.slug}`} title={asSentence(bill.title)}>
          {displayTitle(bill.title, compact ? 120 : 180)}
        </Link>
      </h3>

      {!compact && bill.description && bill.description !== bill.title ? (
        <p className="text-small text-muted" style={{ margin: 0 }}>
          {truncate(asSentence(bill.description), 210)}
        </p>
      ) : null}

      {showTrack ? (
        <div style={{ marginTop: '0.75rem' }}>
          <StatusTrack statusId={bill.statusId} showLabels={!compact} />
        </div>
      ) : null}

      {bill.topics.length > 0 ? (
        <div className="cluster" style={{ marginTop: '0.7rem' }}>
          {bill.topics.slice(0, compact ? 2 : 4).map((topic) => (
            <Link key={topic.slug} className="pill-link" href={`/topics/${topic.slug}`}>
              {topic.name}
            </Link>
          ))}
        </div>
      ) : null}

      {!compact && bill.lastAction ? (
        <p className="bill-card__action">
          <strong>{formatDateShort(bill.lastActionDate)}:</strong> {bill.lastAction}
        </p>
      ) : null}

      <div className="bill-card__meta">
        {bill.leadSponsor ? (
          <span>
            Sponsored by{' '}
            <Link href={`/legislators/${bill.leadSponsor.slug}`}>{bill.leadSponsor.name}</Link>
            {bill.leadSponsor.party
              ? ` (${partyLabel(bill.leadSponsor.party, bill.leadSponsor.partyId).charAt(0)})`
              : ''}
            {bill.sponsorCount > 1 ? ` + ${bill.sponsorCount - 1} more` : ''}
          </span>
        ) : null}

        {bill.committee ? (
          <span>
            In <Link href={`/committees/${bill.committee.slug}`}>{bill.committee.name}</Link>
          </span>
        ) : null}

        {bill.currentBody ? <span>{chamberLabel(bill.currentBody)}</span> : null}

        {bill.rollCallCount > 0 ? (
          <span>
            {bill.rollCallCount} recorded {bill.rollCallCount === 1 ? 'vote' : 'votes'}
          </span>
        ) : null}
      </div>
    </article>
  );
}

/** Minimal one-line reference used inside dense modules. */
export function BillLine({
  slug,
  billNumber,
  title,
  statusId,
  trailing,
}: {
  slug: string;
  billNumber: string;
  title: string;
  statusId?: number | null;
  trailing?: React.ReactNode;
}) {
  return (
    <li>
      <div className="cluster" style={{ gap: '0.45rem' }}>
        <span className="bill-number">{tidyBillNumber(billNumber)}</span>
        {statusId !== undefined ? <StatusBadge statusId={statusId} /> : null}
      </div>
      <div style={{ marginTop: '0.25rem' }}>
        <Link href={`/bills/${slug}`} title={asSentence(title)}>
          {displayTitle(title, 140)}
        </Link>
      </div>
      {trailing ? <div className="text-small text-muted">{trailing}</div> : null}
    </li>
  );
}

export function SponsorLine({
  person,
  sponsorTypeLabel: label,
}: {
  person: { slug: string; name: string; party: string | null; partyId: number | null; role: string | null; roleId: number | null; district: string | null };
  sponsorTypeLabel?: string;
}) {
  return (
    <li>
      <Link href={`/legislators/${person.slug}`}>{person.name}</Link>{' '}
      <span className="text-small text-muted">
        {roleLabel(person.role, person.roleId)}
        {person.district ? `, District ${person.district}` : ''} ·{' '}
        {partyLabel(person.party, person.partyId)}
        {label ? ` · ${label}` : ''}
      </span>
    </li>
  );
}
