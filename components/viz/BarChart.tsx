import Link from 'next/link';

import { formatNumber } from '@/lib/utils/format';

export interface BarChartRow {
  label: string;
  value: number;
  href?: string;
  /** Optional colour family matching a status bucket. */
  tone?: 'early' | 'moving' | 'passed' | 'ended';
}

/**
 * A horizontal bar chart built from HTML and CSS.
 *
 * The numbers are present as text, so the chart is readable without seeing the
 * bars at all — the bars only make the comparison faster.
 */
export function BarChart({
  rows,
  caption,
  emptyMessage = 'No data yet.',
}: {
  rows: BarChartRow[];
  caption: string;
  emptyMessage?: string;
}) {
  if (rows.length === 0) {
    return <p className="note">{emptyMessage}</p>;
  }

  const max = Math.max(...rows.map((r) => r.value), 1);

  return (
    <div className="bar-chart" role="table" aria-label={caption}>
      <span className="visually-hidden" role="rowgroup">
        {caption}
      </span>
      {rows.map((row) => (
        <div className="bar-chart__row" key={row.label} role="row">
          <div className="bar-chart__label" role="rowheader">
            {row.href ? <Link href={row.href}>{row.label}</Link> : row.label}
          </div>
          <div className="bar-chart__track" aria-hidden="true">
            <span
              className={`bar-chart__fill${row.tone ? ` bar-chart__fill--${row.tone}` : ''}`}
              style={{ width: `${Math.max(2, (row.value / max) * 100)}%` }}
            />
          </div>
          <div className="bar-chart__value" role="cell">
            {formatNumber(row.value)}
          </div>
        </div>
      ))}
    </div>
  );
}
