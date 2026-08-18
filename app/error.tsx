'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The digest is the only safe way to correlate this with a server log.
    console.error('Page render failed', error.digest ?? error.message);
  }, [error]);

  return (
    <div className="container container-narrow">
      <header className="page-header">
        <p className="page-header__eyebrow">Something went wrong</p>
        <h1>This page could not be loaded</h1>
        <p className="page-header__lede">
          The legislative data behind this page is temporarily unavailable. Nothing you did caused
          this, and no information has been lost.
        </p>
      </header>

      <div className="cluster">
        <button type="button" className="button" onClick={reset}>
          Try again
        </button>
        <Link className="button button--secondary" href="/">
          Go to the homepage
        </Link>
      </div>

      {error.digest ? (
        <p className="note" style={{ marginTop: '1.5rem' }}>
          Reference: <code>{error.digest}</code>
        </p>
      ) : null}
    </div>
  );
}
