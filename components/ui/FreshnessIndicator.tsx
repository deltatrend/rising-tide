import { formatRelative, formatTimestamp, isOlderThan } from '@/lib/utils/format';
import type { DataFreshness } from '@/lib/db/queries/types';

const STALE_AFTER_HOURS = 48;

/**
 * Says plainly how current the data is. "Updated recently" is not good enough:
 * a visitor deciding whether to testify at a hearing needs to know whether this
 * page could be two days behind.
 */
export function FreshnessIndicator({
  freshness,
  detailed = false,
}: {
  freshness: DataFreshness;
  detailed?: boolean;
}) {
  const last = freshness.lastSuccessfulSyncAt;

  if (!last) {
    return (
      <span className="freshness">
        <span className="freshness__dot freshness__dot--none" aria-hidden="true" />
        <span>Not yet synchronized with LegiScan</span>
      </span>
    );
  }

  const stale = isOlderThan(last, STALE_AFTER_HOURS);

  return (
    <span className="freshness">
      <span
        className={`freshness__dot${stale ? ' freshness__dot--stale' : ''}`}
        aria-hidden="true"
      />
      <span>
        Legislative data last updated {formatRelative(last)}
        {detailed ? ` (${formatTimestamp(last)}, UTC)` : ''}
        {stale ? ' — later than the daily schedule expects' : ''}
      </span>
    </span>
  );
}
