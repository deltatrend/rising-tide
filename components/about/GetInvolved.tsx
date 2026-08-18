'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';

import { SITE } from '@/config/site';

/**
 * Public contact box. Submitting opens the visitor's own mail app with a draft
 * addressed to Rising Tide — nothing is stored on this site.
 */
export function GetInvolved({ email }: { email: string | null }) {
  const [status, setStatus] = useState<'idle' | 'opened'>('idle');

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email) return;

    const data = new FormData(event.currentTarget);
    const name = String(data.get('name') ?? '').trim();
    const from = String(data.get('from') ?? '').trim();
    const interest = String(data.get('interest') ?? '').trim();
    const message = String(data.get('message') ?? '').trim();

    const lines = [
      name ? `Name: ${name}` : null,
      from ? `Email: ${from}` : null,
      interest ? `I want to: ${interest}` : null,
      '',
      message || '(No message written.)',
    ].filter((line) => line !== null);

    const href = `mailto:${email}?subject=${encodeURIComponent(`Get involved — ${SITE.shortName}`)}&body=${encodeURIComponent(lines.join('\n'))}`;
    window.location.href = href;
    setStatus('opened');
  }

  return (
    <aside className="involve" id="get-involved" aria-labelledby="involve-heading">
      <p className="involve__eyebrow">Get involved</p>
      <h2 id="involve-heading">Get involved!</h2>
      <p>
        {SITE.shortName} is built by and for New York teens. If you want to follow a bill, speak at a
        hearing, bring this work to a school, or help with research and outreach — start here.
      </p>

      <ul className="involve__paths">
        <li>
          <Link href="/bills">Follow the water bills</Link> the Legislature is actually considering.
        </li>
        <li>
          <Link href="/events">Find a hearing</Link> where the public can still get on the record.
        </li>
        <li>
          <Link href="/topics">Pick a topic</Link> and learn it well enough to explain it to someone
          else.
        </li>
      </ul>

      {email ? (
        <form className="involve__form" onSubmit={onSubmit}>
          <p className="involve__form-lede">
            Write to {SITE.shortName}. Your message opens in your own email app — we do not collect it
            here.
          </p>

          <div className="field">
            <label htmlFor="involve-name">Your name</label>
            <input id="involve-name" name="name" type="text" autoComplete="name" />
          </div>

          <div className="field">
            <label htmlFor="involve-from">Your email</label>
            <input id="involve-from" name="from" type="email" autoComplete="email" />
          </div>

          <div className="field">
            <label htmlFor="involve-interest">How do you want to help?</label>
            <select id="involve-interest" name="interest" defaultValue="volunteer">
              <option value="volunteer">Volunteer</option>
              <option value="bring this to my school">Bring Rising Tide to a school</option>
              <option value="research">Help with research</option>
              <option value="outreach">Help with public outreach</option>
              <option value="ask a question">Ask a question</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="involve-message">Message</label>
            <textarea id="involve-message" name="message" rows={4} required />
          </div>

          <button type="submit" className="button">
            Get involved
          </button>

          {status === 'opened' ? (
            <p className="note" style={{ margin: '0.75rem 0 0' }}>
              If a mail window did not open, write directly to{' '}
              <a href={`mailto:${email}`}>{email}</a>.
            </p>
          ) : null}
        </form>
      ) : (
        <p className="note" style={{ marginBottom: 0 }}>
          A public inbox will appear here once {SITE.shortName} publishes one. Until then, the paths
          above are the fastest way to take part.
        </p>
      )}
    </aside>
  );
}
