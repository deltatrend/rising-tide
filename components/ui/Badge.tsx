import { describeStatus } from '@/lib/legiscan/enums';

export type BadgeTone = 'early' | 'moving' | 'passed' | 'ended' | 'neutral' | 'tide' | 'fixture';

export function Badge({
  tone = 'neutral',
  children,
  title,
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <span className={`badge badge--${tone}`} title={title}>
      {children}
    </span>
  );
}

/**
 * Shows a bill's stage using its plain-language label. The LegiScan numeric code
 * is never displayed; the explanation is exposed as a tooltip and, for assistive
 * technology, as visually hidden text.
 */
export function StatusBadge({ statusId }: { statusId: number | null | undefined }) {
  const status = describeStatus(statusId);

  return (
    <span className={`badge badge--${status.bucket}`} title={status.explanation}>
      {status.label}
      <span className="visually-hidden">. {status.explanation}</span>
    </span>
  );
}

/** Marks demonstration data so it can never be mistaken for the official record. */
export function FixtureBadge() {
  return (
    <span className="badge badge--fixture" title="Sample data used for local development only">
      Sample data
    </span>
  );
}
