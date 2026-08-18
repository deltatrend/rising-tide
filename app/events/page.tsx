import type { Metadata } from 'next';
import Link from 'next/link';

import { EventCard } from '@/components/events/EventCard';
import { Callout } from '@/components/ui/Callout';
import { EmptyState } from '@/components/ui/EmptyState';
import { FreshnessIndicator } from '@/components/ui/FreshnessIndicator';
import { PageHeader } from '@/components/ui/SectionHeader';
import { getEventFacets, listEvents } from '@/lib/db/queries/events';
import { getDataFreshness } from '@/lib/db/queries/stats';
import { listingMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const raw = await searchParams;
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const past = first(raw.when) === 'past';
  const filtered = Boolean(first(raw.type) || first(raw.topic));
  const base = listingMetadata(
    past ? 'Past hearings & events' : 'Hearings & events',
    past
      ? 'Recorded committee hearings and calendar entries for the New York water bills we track.'
      : 'Committee hearings, floor sessions and public meetings involving the New York water bills we track.',
    past ? '/events?when=past' : '/events',
  );

  return {
    ...base,
    robots: filtered ? { index: false, follow: true } : base.robots,
  };
}

type EventSearchParams = { when?: string; type?: string; topic?: string };

function buildHref(current: EventSearchParams, changes: Partial<EventSearchParams>): string {
  const params = new URLSearchParams();
  const merged = { ...current, ...changes };
  for (const [key, value] of Object.entries(merged)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `/events?${query}` : '/events';
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  const rawWhen = first(raw.when);
  const explicitWhen = rawWhen === 'past' ? 'past' : rawWhen === 'upcoming' ? 'upcoming' : undefined;
  const eventType = first(raw.type);
  const topic = first(raw.topic);

  const [firstPass, firstPassFacets, freshness] = await Promise.all([
    listEvents({ when: explicitWhen ?? 'upcoming', eventType, topic, limit: 100 }),
    getEventFacets(explicitWhen ?? 'upcoming'),
    getDataFreshness(),
  ]);

  // Out of session there is nothing upcoming, and an empty default tab reads as
  // a broken page. Land on Past instead — but only when the visitor did not ask
  // for a window themselves, so an explicit ?when=upcoming still holds.
  const fellBackToPast =
    !explicitWhen && firstPassFacets.upcomingCount === 0 && firstPassFacets.pastCount > 0;
  const when = fellBackToPast ? 'past' : (explicitWhen ?? 'upcoming');

  const [events, facets] = fellBackToPast
    ? await Promise.all([
        listEvents({ when, eventType, topic, limit: 100 }),
        getEventFacets(when),
      ])
    : [firstPass, firstPassFacets];

  const current: EventSearchParams = { when, type: eventType, topic };

  // A filter that cannot change the result is noise: when every event in this
  // window is a hearing, "Hearing (46)" just re-renders the same 46 rows. An
  // active filter still shows, whatever its count, or there would be no way to
  // clear it except by editing the address bar.
  const availableTypes = facets.eventTypes.filter((type) => type.value);
  const typeChips = availableTypes.length > 1 ? [...availableTypes] : [];
  if (eventType && !typeChips.some((type) => type.value === eventType)) {
    typeChips.push(
      availableTypes.find((type) => type.value === eventType) ?? { value: eventType, count: 0 },
    );
  }

  return (
    <div className="container">
      <PageHeader
        eyebrow="Calendar"
        title="Hearings & events"
        lede="Where water bills are actually discussed. Committee hearings are usually the first point where the public can weigh in — and they are often announced only days ahead."
      >
        <p style={{ marginTop: '0.85rem', marginBottom: 0 }}>
          <FreshnessIndicator freshness={freshness} />
        </p>
      </PageHeader>

      <div className="cluster" style={{ marginBottom: fellBackToPast ? '0.85rem' : '1.5rem' }}>
        <Link
          className={`chip${when === 'upcoming' ? ' chip--selected' : ''}`}
          href={buildHref(current, { when: 'upcoming' })}
          aria-current={when === 'upcoming' ? 'true' : undefined}
        >
          Upcoming ({facets.upcomingCount})
        </Link>
        <Link
          className={`chip${when === 'past' ? ' chip--selected' : ''}`}
          href={buildHref(current, { when: 'past' })}
          aria-current={when === 'past' ? 'true' : undefined}
        >
          Past ({facets.pastCount})
        </Link>

        {typeChips.map((type) => (
          <Link
            key={type.value}
            className={`chip${eventType === type.value ? ' chip--selected' : ''}`}
            href={buildHref(current, {
              type: eventType === type.value ? undefined : type.value,
            })}
            aria-current={eventType === type.value ? 'true' : undefined}
          >
            {type.value} ({type.count})
          </Link>
        ))}

        {topic ? (
          <Link className="chip chip--selected" href={buildHref(current, { topic: undefined })}>
            Topic: {facets.topics.find((t) => t.slug === topic)?.name ?? topic} ×
          </Link>
        ) : null}
      </div>

      {fellBackToPast ? (
        <p className="text-muted" style={{ marginTop: 0, marginBottom: '1.5rem' }}>
          No tracked water bill is on the legislative calendar right now, so this is showing past
          hearings.
        </p>
      ) : null}

      {events.length > 0 ? (
        <div className="stack">
          {events.map((event) => (
            <EventCard key={event.id} event={event} past={when === 'past'} />
          ))}
        </div>
      ) : (
        <EmptyState
          title={when === 'past' ? 'No past events recorded' : 'Nothing is scheduled right now'}
        >
          {when === 'past' ? (
            <p>
              We have not recorded any past hearings or meetings involving tracked water bills.
            </p>
          ) : (
            <>
              <p>
                No tracked water bill is on the legislative calendar today. That is the normal state
                between sessions: New York&rsquo;s regular session runs from January into June, and
                committee agendas are usually posted only a few days ahead.
              </p>
              {facets.pastCount > 0 ? (
                <p style={{ marginBottom: 0 }}>
                  We have recorded{' '}
                  <Link href={buildHref(current, { when: 'past' })}>
                    {facets.pastCount} past {facets.pastCount === 1 ? 'hearing' : 'hearings'}
                  </Link>{' '}
                  involving these bills, which show which committees have taken them up before.
                </p>
              ) : null}
            </>
          )}
        </EmptyState>
      )}

      <Callout tone="quiet" title="What this calendar covers">
        <p>
          Events here come from the legislative calendar attached to the bills we track — committee
          agendas, floor sessions and scheduled hearings. It is not a complete list of every public
          meeting about water in New York. Local water board meetings, agency listening sessions and
          regional planning meetings are not included yet.
        </p>
        <p style={{ marginBottom: 0 }}>
          Always confirm the time and place with the official notice before travelling. Read more on
          the <Link href="/methodology">methodology page</Link>.
        </p>
      </Callout>
    </div>
  );
}
