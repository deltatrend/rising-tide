import { chamberLabel } from '@/lib/legiscan/enums';
import { formatDate } from '@/lib/utils/format';

export interface TimelineAction {
  id: number;
  sequence: number;
  actionDate: string | null;
  action: string;
  chamber: string | null;
  isMajor: boolean;
}

/**
 * The complete official action history, newest first.
 *
 * Milestone actions — the ones LegiScan flags as advancing the bill — are
 * marked visually and named in the accessible text, so skimming the timeline
 * still surfaces the moments that mattered.
 */
export function BillTimeline({ actions }: { actions: TimelineAction[] }) {
  if (actions.length === 0) {
    return (
      <p className="note">
        No action history has been recorded for this bill yet. That usually means it was only
        recently introduced.
      </p>
    );
  }

  const ordered = [...actions].sort((a, b) => b.sequence - a.sequence);

  return (
    <ol className="timeline">
      {ordered.map((action) => (
        <li
          key={action.id}
          className={`timeline__item${action.isMajor ? ' timeline__item--major' : ''}`}
        >
          <span className="timeline__date">
            {formatDate(action.actionDate)}
            {action.isMajor ? <span className="visually-hidden"> — milestone</span> : null}
          </span>
          <p className="timeline__action">{action.action}</p>
          {action.chamber ? (
            <span className="timeline__chamber">{chamberLabel(action.chamber)}</span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
