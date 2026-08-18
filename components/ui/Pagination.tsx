import Link from 'next/link';

import { formatNumber } from '@/lib/utils/format';

/**
 * Server-rendered pagination using plain links, so results stay shareable,
 * crawlable and usable without JavaScript.
 */
export function Pagination({
  page,
  totalPages,
  total,
  perPage,
  buildHref,
}: {
  page: number;
  totalPages: number;
  total: number;
  perPage: number;
  buildHref: (page: number) => string;
}) {
  if (total === 0) return null;

  const first = (page - 1) * perPage + 1;
  const last = Math.min(total, page * perPage);

  return (
    <nav className="pagination" aria-label="Pagination">
      {page > 1 ? (
        <Link className="button button--secondary button--small" href={buildHref(page - 1)} rel="prev">
          ← Previous
        </Link>
      ) : (
        <span className="button button--secondary button--small" aria-disabled="true">
          ← Previous
        </span>
      )}

      <p className="pagination__status">
        Showing {formatNumber(first)}–{formatNumber(last)} of {formatNumber(total)}
        {totalPages > 1 ? ` · page ${page} of ${totalPages}` : ''}
      </p>

      {page < totalPages ? (
        <Link className="button button--secondary button--small" href={buildHref(page + 1)} rel="next">
          Next →
        </Link>
      ) : (
        <span className="button button--secondary button--small" aria-disabled="true">
          Next →
        </span>
      )}
    </nav>
  );
}
