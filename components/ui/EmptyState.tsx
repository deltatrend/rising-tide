import Link from 'next/link';

/**
 * Empty states explain *why* something is empty. A brand-new database and a
 * filter that matched nothing are different situations and should never share a
 * message.
 */
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: React.ReactNode;
  action?: { href: string; label: string };
}) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      {children}
      {action ? (
        <p style={{ marginTop: '1rem' }}>
          <Link className="button button--secondary button--small" href={action.href}>
            {action.label}
          </Link>
        </p>
      ) : null}
    </div>
  );
}

/** Shown when nothing has been synchronized yet — a setup state, not an error. */
export function NotYetSyncedState({ what = 'data' }: { what?: string }) {
  return (
    <EmptyState title={`No ${what} yet`}>
      <p>
        This site shows New York legislation collected from LegiScan. Nothing has been
        synchronized into this deployment yet, so there is nothing to display.
      </p>
      <p className="text-small">
        If you are running Rising Tide locally, run <code>npm run sync:legiscan</code> to load the
        current session.
      </p>
    </EmptyState>
  );
}

export function NoResultsState({ resetHref }: { resetHref: string }) {
  return (
    <EmptyState title="No bills match these filters" action={{ href: resetHref, label: 'Clear all filters' }}>
      <p>
        Try removing a filter or searching for a broader term — for example a topic name like
        &ldquo;drinking water&rdquo; rather than a specific bill number.
      </p>
    </EmptyState>
  );
}
