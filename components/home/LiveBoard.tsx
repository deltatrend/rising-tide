import Link from 'next/link';

import type { DataFreshness } from '@/lib/db/queries/types';
import type { SiteSnapshot } from '@/lib/db/queries/stats';
import { describeStatus, STATUS_BUCKETS, type StatusBucket } from '@/lib/legiscan/enums';
import { formatNumber, formatRelative, isOlderThan } from '@/lib/utils/format';

const STALE_AFTER_HOURS = 48;

export interface StageSlice {
  bucket: StatusBucket;
  label: string;
  count: number;
}

/** Collapses raw LegiScan status codes into the four stages we show publicly. */
export function toStageSlices(
  distribution: { statusId: number | null; count: number }[],
): StageSlice[] {
  return STATUS_BUCKETS.map((bucket) => ({
    bucket: bucket.value,
    label: bucket.label,
    count: distribution
      .filter((row) => describeStatus(row.statusId).bucket === bucket.value)
      .reduce((sum, row) => sum + row.count, 0),
  }));
}

/**
 * The panel a visitor sees first: how much is being tracked, where it stands,
 * and how recently the record was checked. It reads from the same tables as the
 * rest of the site, so it can never show a number the pages disagree with.
 */
export function LiveBoard({
  snapshot,
  freshness,
  stages,
  activity,
}: {
  snapshot: SiteSnapshot;
  freshness: DataFreshness;
  stages: StageSlice[];
  activity: { month: string; count: number }[];
}) {
  const total = stages.reduce((sum, stage) => sum + stage.count, 0);
  const synced = freshness.lastSuccessfulSyncAt;
  const stale = isOlderThan(synced, STALE_AFTER_HOURS);

  return (
    <div className="board">
      <p className="board__live">
        <span
          className={`board__pulse${stale || !synced ? ' board__pulse--stale' : ''}`}
          aria-hidden="true"
        />
        {synced ? (
          <>
            <strong>Live</strong> · Updated {formatRelative(synced)}
          </>
        ) : (
          'Not yet updated'
        )}
      </p>

      <p className="board__headline">
        <span className="board__count">{formatNumber(snapshot.trackedBills)}</span>
        <span className="board__caption">
          water bills moving through the New York State Legislature right now
        </span>
      </p>

      {total > 0 ? (
        <div className="board__stages">
          <div
            className="flowbar"
            role="img"
            aria-label={`Where the bills stand: ${stages
              .map((stage) => `${stage.count} ${stage.label.toLowerCase()}`)
              .join(', ')}.`}
          >
            {stages
              .filter((stage) => stage.count > 0)
              .map((stage) => (
                <span
                  key={stage.bucket}
                  className={`flowbar__seg flowbar__seg--${stage.bucket}`}
                  style={{ flexGrow: stage.count }}
                />
              ))}
          </div>

          <ul className="flowbar__key">
            {stages.map((stage) => (
              <li key={stage.bucket}>
                <Link href={`/bills?status=${stage.bucket}`}>
                  <span
                    className={`flowbar__dot flowbar__dot--${stage.bucket}`}
                    aria-hidden="true"
                  />
                  {stage.label}
                  <strong>{formatNumber(stage.count)}</strong>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Sparkline points={activity} />

      <ul className="board__facts">
        <li>
          <Link href="/bills?sort=updated">
            <strong>{formatNumber(snapshot.updatedInLast30Days)}</strong> changed this month
          </Link>
        </li>
        <li>
          <Link href="/topics">
            <strong>{formatNumber(snapshot.activeTopics)}</strong> topics in play
          </Link>
        </li>
        {/* Hearings matter most, but "0 hearings ahead" is a dead fact — outside
            of session there often are none, so recorded votes take the slot. */}
        <li>
          {snapshot.upcomingEvents > 0 ? (
            <Link href="/events">
              <strong>{formatNumber(snapshot.upcomingEvents)}</strong> hearings ahead
            </Link>
          ) : (
            <Link href="/bills?sort=updated">
              <strong>{formatNumber(snapshot.recentVotes)}</strong> votes in 90 days
            </Link>
          )}
        </li>
      </ul>
    </div>
  );
}

/**
 * Twelve months of legislative action, drawn as one line. It exists to answer
 * "is anything actually happening?" at a glance, not to be read precisely —
 * the full chart lives further down the page.
 */
function Sparkline({ points }: { points: { month: string; count: number }[] }) {
  const values = points.map((point) => point.count);
  const max = Math.max(...values, 1);

  if (values.length < 2) return null;

  const step = 100 / (values.length - 1);
  const coords = values.map((value, index) => {
    const x = index * step;
    const y = 26 - (value / max) * 22;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  const busiest = points.reduce((best, point) => (point.count > best.count ? point : best));

  return (
    <figure className="spark">
      <svg
        viewBox="0 0 100 30"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Official actions on tracked bills over the last ${values.length} months. Busiest month: ${busiest.month}, with ${busiest.count} actions.`}
      >
        <polygon className="spark__area" points={`0,30 ${coords.join(' ')} 100,30`} />
        <polyline className="spark__line" points={coords.join(' ')} />
      </svg>
      <figcaption>Official actions per month · last {values.length} months</figcaption>
    </figure>
  );
}
