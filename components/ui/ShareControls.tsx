'use client';

import { useState } from 'react';

/**
 * Sharing without accounts or third-party embeds.
 *
 * No social SDKs, no tracking pixels: the native share sheet where it exists,
 * a clipboard copy where it does not, and a plain mailto link as a fallback
 * that works everywhere including with JavaScript disabled.
 */
export function ShareControls({ title, url }: { title: string; url: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);

  async function share() {
    setError(false);

    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // The visitor dismissed the sheet, or sharing is unavailable — fall
        // through to copying instead of showing an error.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError(true);
    }
  }

  const mailto = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${title}\n\n${url}`)}`;

  return (
    <div className="cluster">
      <button type="button" className="button button--secondary button--small" onClick={share}>
        {copied ? 'Link copied' : 'Share this page'}
      </button>
      <a className="button button--secondary button--small" href={mailto}>
        Email it
      </a>
      <span aria-live="polite" className="visually-hidden">
        {copied ? 'Link copied to clipboard' : ''}
      </span>
      {error ? (
        <span className="note">
          Copying was blocked by your browser — you can copy the address bar instead.
        </span>
      ) : null}
    </div>
  );
}
