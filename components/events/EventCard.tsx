import Link from 'next/link';

import { FixtureBadge } from '@/components/ui/Badge';
import type { EventListItem } from '@/lib/db/queries/types';
import { EVENT_TYPE_EXPLANATIONS, eventTypeLabel } from '@/lib/legiscan/enums';
import { asSentence, daysUntil, formatDate, formatEventTime, truncate } from '@/lib/utils/format';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function EventCard({ event, past = false }: { event: EventListItem; past?: boolean }) {
  const [year, month, day] = event.eventDate.split('-').map(Number);
  const typeLabel = eventTypeLabel(event.eventTypeId, event.eventType);
  const explanation = EVENT_TYPE_EXPLANATIONS[typeLabel];
  const days = past ? null : daysUntil(event.eventDate);
  const startTime = formatEventTime(event.startTime);

  return (
    <article className={`event-card${past ? ' event-card--past' : ''}`}>
      <div className="event-card__date">
        <span className="event-card__month">{MONTHS[(month ?? 1) - 1]}</span>
        <span className="event-card__day">{day}</span>
        <span className="event-card__year">{year}</span>
      </div>

      <div>
        <div className="cluster" style={{ marginBottom: '0.35rem' }}>
          <span className="badge badge--neutral">{typeLabel}</span>
          {days !== null && days <= 7 ? (
            <span className="badge badge--moving">
              {days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`}
            </span>
          ) : null}
          {event.isFixture ? <FixtureBadge /> : null}
        </div>

        <h3 className="event-card__title">{asSentence(event.title)}</h3>

        <div className="event-card__meta">
          <span>
            <span className="visually-hidden">Date: </span>
            {formatDate(event.eventDate)}
          </span>
          {startTime ? <span>{startTime}</span> : <span>Time not published</span>}
          {event.location ? <span>{event.location}</span> : null}
        </div>

        {explanation ? <p className="note" style={{ margin: '0.45rem 0 0' }}>{explanation}</p> : null}

        {event.description && event.description !== event.title ? (
          <p className="text-small text-muted" style={{ margin: '0.45rem 0 0' }}>
            {truncate(asSentence(event.description), 180)}
          </p>
        ) : null}

        {event.bills.length > 0 ? (
          <ul className="event-card__bills">
            {event.bills.slice(0, 6).map((bill) => (
              <li key={bill.slug}>
                <Link href={`/bills/${bill.slug}`}>
                  {bill.billNumber} — {truncate(asSentence(bill.title), 90)}
                </Link>
              </li>
            ))}
            {event.bills.length > 6 ? (
              <li className="note">and {event.bills.length - 6} more tracked bills</li>
            ) : null}
          </ul>
        ) : null}

        {event.topics.length > 0 ? (
          <div className="cluster" style={{ marginTop: '0.6rem' }}>
            {event.topics.slice(0, 3).map((topic) => (
              <Link key={topic.slug} className="pill-link" href={`/topics/${topic.slug}`}>
                {topic.name}
              </Link>
            ))}
          </div>
        ) : null}

        {event.sourceUrl ? (
          <p className="note" style={{ margin: '0.6rem 0 0' }}>
            <a href={event.sourceUrl} rel="noopener noreferrer" target="_blank">
              Official listing
            </a>{' '}
            · Source: {event.source}
          </p>
        ) : (
          <p className="note" style={{ margin: '0.6rem 0 0' }}>
            Source: {event.source}
          </p>
        )}
      </div>
    </article>
  );
}
