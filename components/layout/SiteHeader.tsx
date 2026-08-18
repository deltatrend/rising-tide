'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { NAV_LINKS, SITE } from '@/config/site';

/**
 * The only client component in the layout — it needs the current path to mark
 * the active navigation item for both sighted users and screen readers.
 */
export function SiteHeader() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link href="/" className="brand">
          <WaveMark />
          <span className="brand__text">
            <span className="brand__name">{SITE.shortName}</span>
            <span className="brand__sub">{SITE.subtitle}</span>
          </span>
        </Link>

        <nav className="site-nav" aria-label="Main">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href) ? 'page' : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

function WaveMark() {
  return (
    <svg
      className="brand__mark"
      viewBox="0 0 40 40"
      role="img"
      aria-label=""
      focusable="false"
      aria-hidden="true"
    >
      <circle cx="20" cy="20" r="19" fill="var(--tide-soft)" stroke="var(--tide)" strokeWidth="1.5" />
      <path
        d="M4 24c4 0 4-4 8-4s4 4 8 4 4-4 8-4 4 4 8 4"
        fill="none"
        stroke="var(--tide-deep)"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M4 31c4 0 4-4 8-4s4 4 8 4 4-4 8-4 4 4 8 4"
        fill="none"
        stroke="var(--tide-mid)"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.75"
      />
      <circle cx="20" cy="13" r="4.5" fill="var(--sun)" opacity="0.9" />
    </svg>
  );
}
