import Link from 'next/link';

import { ATTRIBUTION, SITE } from '@/config/site';

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="container">
        <div className="site-footer__grid">
          <div>
            <h2>{SITE.name}</h2>
            <p style={{ maxWidth: '36ch' }}>{SITE.mission}</p>
          </div>

          <div>
            <h2>Explore</h2>
            <ul className="site-footer__links">
              <li>
                <Link href="/bills">Bills</Link>
              </li>
              <li>
                <Link href="/topics">Topics</Link>
              </li>
              <li>
                <Link href="/events">Hearings &amp; events</Link>
              </li>
              <li>
                <Link href="/committees">Committees</Link>
              </li>
              <li>
                <Link href="/legislators">Legislators</Link>
              </li>
            </ul>
          </div>

          <div>
            <h2>How this works</h2>
            <ul className="site-footer__links">
              <li>
                <Link href="/methodology">Methodology &amp; sources</Link>
              </li>
              <li>
                <Link href="/about">About &amp; contact</Link>
              </li>
              <li>
                <a href="https://www.nysenate.gov/" rel="noopener noreferrer">
                  New York State Senate
                </a>
              </li>
              <li>
                <a href="https://nyassembly.gov/" rel="noopener noreferrer">
                  New York State Assembly
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="site-footer__base">
          <p style={{ margin: 0 }}>
            Legislative data from{' '}
            <a href={ATTRIBUTION.sourceUrl} rel="noopener noreferrer">
              {ATTRIBUTION.sourceName}
            </a>
            , used under the{' '}
            <a href={ATTRIBUTION.licenseUrl} rel="noopener noreferrer">
              {ATTRIBUTION.licenseName} (CC BY 4.0)
            </a>{' '}
            licence. LegiScan does not endorse {SITE.name}.
          </p>
          <p style={{ margin: 0 }}>{ATTRIBUTION.disclaimer}</p>
          <p style={{ margin: 0 }}>
            © {year} {SITE.name}. Built as a public-interest project for {SITE.region}.
          </p>
        </div>
      </div>
    </footer>
  );
}
