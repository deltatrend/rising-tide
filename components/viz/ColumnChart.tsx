import { formatNumber } from '@/lib/utils/format';

export interface ColumnPoint {
  label: string;
  shortLabel: string;
  value: number;
}

/**
 * Activity over time. Deliberately small and unlabelled on the y-axis: the
 * shape is the point, and the exact figures are available on hover and to
 * screen readers through the accompanying table semantics.
 */
export function ColumnChart({
  points,
  caption,
  emptyMessage = 'Not enough activity recorded yet to chart.',
}: {
  points: ColumnPoint[];
  caption: string;
  emptyMessage?: string;
}) {
  if (points.length === 0) {
    return <p className="note">{emptyMessage}</p>;
  }

  const max = Math.max(...points.map((p) => p.value), 1);

  return (
    <figure style={{ margin: 0 }}>
      <ul className="column-chart" aria-hidden="true">
        {points.map((point) => {
          const empty = point.value === 0;
          const height = empty ? 0 : Math.max(8, (point.value / max) * 100);
          return (
            <li key={point.label} title={`${point.label}: ${point.value}`}>
              <span
                className={`column${empty ? ' column--empty' : ''}`}
                style={{ height: `${height}%` }}
              />
            </li>
          );
        })}
      </ul>
      <ul className="column-chart__axis" aria-hidden="true">
        {points.map((point) => (
          <li key={`${point.label}-axis`}>{point.shortLabel}</li>
        ))}
      </ul>
      <figcaption className="visually-hidden">
        {caption}:{' '}
        {points.map((point) => `${point.label}, ${formatNumber(point.value)}`).join('; ')}.
      </figcaption>
    </figure>
  );
}
