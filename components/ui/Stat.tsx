import { formatNumber } from '@/lib/utils/format';

export function Stat({
  value,
  label,
  hint,
}: {
  value: number | string;
  label: string;
  hint?: string;
}) {
  return (
    <div className="stat">
      <div className="stat__value">{typeof value === 'number' ? formatNumber(value) : value}</div>
      <div className="stat__label">
        {label}
        {hint ? <span className="visually-hidden"> — {hint}</span> : null}
      </div>
    </div>
  );
}

export function StatGrid({ children }: { children: React.ReactNode }) {
  return <div className="stat-grid">{children}</div>;
}
