import { deriveStages, describeProgress } from '@/lib/utils/stages';

/**
 * A five-segment track showing how far a bill has travelled.
 *
 * Built from CSS boxes rather than a charting library, and every state is
 * conveyed in text as well as colour so it survives colour-blindness, high
 * contrast modes and screen readers.
 */
export function StatusTrack({
  statusId,
  showLabels = true,
}: {
  statusId: number | null | undefined;
  showLabels?: boolean;
}) {
  const stages = deriveStages(statusId);
  const summary = describeProgress(statusId);

  const reachedLabel =
    stages.find((s) => s.state === 'current' || s.state === 'stopped')?.label ??
    stages[stages.length - 1]!.label;

  return (
    <div className="track">
      <div className="track__rail" role="img" aria-label={`Progress: ${reachedLabel}. ${summary}`}>
        {stages.map((stage) => (
          <span
            key={stage.key}
            className={`track__segment${
              stage.state === 'done'
                ? ' track__segment--done'
                : stage.state === 'current'
                  ? ' track__segment--current'
                  : stage.state === 'stopped'
                    ? ' track__segment--stopped'
                    : ''
            }`}
          />
        ))}
      </div>

      {showLabels ? (
        <div className="track__labels" aria-hidden="true">
          {stages.map((stage) => (
            <span key={stage.key} data-state={stage.state} title={stage.description}>
              {stage.label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
