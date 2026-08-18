import { voteLabel } from '@/lib/legiscan/enums';

export interface VoteTotals {
  yea: number;
  nay: number;
  notVoting: number;
  absent: number;
  total: number;
}

/**
 * Shows the balance of a recorded vote. Numbers are printed inside the bar
 * whenever the segment is wide enough, and always in the legend beneath it, so
 * the result never depends on interpreting colour or width.
 */
export function VoteBar({
  totals,
  passed,
  compact = false,
}: {
  totals: VoteTotals;
  passed?: boolean | null;
  compact?: boolean;
}) {
  const other = totals.notVoting + totals.absent;
  const denominator = Math.max(1, totals.yea + totals.nay + other);

  const percent = (value: number) => (value / denominator) * 100;
  const outcome =
    passed === true ? 'Passed' : passed === false ? 'Did not pass' : 'Outcome not recorded';

  return (
    <div>
      <div
        className="vote-bar"
        role="img"
        aria-label={`${outcome}. ${totals.yea} voted yes, ${totals.nay} voted no, ${other} did not vote or were absent.`}
      >
        {totals.yea > 0 ? (
          <span className="vote-bar__part vote-bar__part--yea" style={{ width: `${percent(totals.yea)}%` }}>
            {percent(totals.yea) > 12 ? totals.yea : ''}
          </span>
        ) : null}
        {totals.nay > 0 ? (
          <span className="vote-bar__part vote-bar__part--nay" style={{ width: `${percent(totals.nay)}%` }}>
            {percent(totals.nay) > 12 ? totals.nay : ''}
          </span>
        ) : null}
        {other > 0 ? (
          <span className="vote-bar__part vote-bar__part--other" style={{ width: `${percent(other)}%` }}>
            {percent(other) > 12 ? other : ''}
          </span>
        ) : null}
      </div>

      {compact ? null : (
        <p className="vote-legend">
          <span className="yea">{totals.yea} yes</span>
          <span className="nay">{totals.nay} no</span>
          <span className="other">
            {totals.notVoting} not voting · {totals.absent} absent
          </span>
        </p>
      )}
    </div>
  );
}

/** Individual member votes, grouped so the roster is scannable. */
export function VoteRoster({
  votes,
}: {
  votes: { name: string; slug: string; party: string | null; district: string | null; voteId: number; voteText: string }[];
}) {
  if (votes.length === 0) return null;

  const groups: { id: number; label: string; members: typeof votes }[] = [1, 2, 3, 4].map((id) => ({
    id,
    label: voteLabel(id),
    members: votes.filter((v) => v.voteId === id),
  }));

  return (
    <div className="stack" style={{ ['--stack-gap' as string]: '1rem' }}>
      {groups
        .filter((group) => group.members.length > 0)
        .map((group) => (
          <div key={group.id}>
            <h4 style={{ marginBottom: '0.35rem' }}>
              {group.label} · {group.members.length}
            </h4>
            <ul className="vote-roster">
              {group.members.map((member) => (
                <li key={`${group.id}-${member.slug}`}>
                  <a href={`/legislators/${member.slug}`}>{member.name}</a>
                  <span
                    className={`vote-value vote-value--${
                      member.voteId === 1 ? 'yea' : member.voteId === 2 ? 'nay' : 'other'
                    }`}
                  >
                    {member.party ?? ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
    </div>
  );
}
