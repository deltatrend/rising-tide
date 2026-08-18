/**
 * Public site configuration. Everything here is safe to ship to the browser.
 * The production origin is resolved from configuration, never hard-coded, so the
 * custom domain can be attached in Vercel without a code change.
 */

export const SITE = {
  name: 'Rising Tide Youth Advocacy',
  shortName: 'Rising Tide',
  subtitle: 'Youth Advocacy',
  tagline: 'New York water policy, made understandable.',
  description:
    'A free, youth-led civic education project tracking New York State legislation on oceans, drinking water, wetlands, flooding and water quality — with no account required.',
  mission:
    'Our mission is to get NY teens informed and talking about sustainable water systems, so we can become advocates to ensure our waterways and water supplies are healthy and plentiful for the future.',
  missionHow:
    'We fulfill our mission through public outreach, advocacy and research to engage youth as stakeholders in the future of New York’s water systems.',
  founder: 'Phoebe Skinner',
  founderSchool: 'Fox Lane High School',
  founderPlace: 'Bedford, New York',
  locale: 'en-US',
  /** Used for structured data and the footer. */
  region: 'New York State',
} as const;

/** Public inbox for the Get involved form. Safe to expose; never a secret. */
export function getContactEmail(): string | null {
  const value = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim();
  return value && value.includes('@') ? value : null;
}

/**
 * Resolution order:
 *   1. NEXT_PUBLIC_SITE_URL — set this once the custom domain is attached.
 *   2. VERCEL_PROJECT_PRODUCTION_URL — the stable production vercel.app host.
 *   3. VERCEL_URL — the current preview deployment.
 *   4. localhost for development.
 */
export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit && explicit.trim().length > 0) {
    return explicit.trim().replace(/\/+$/, '');
  }

  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (production) return `https://${production.replace(/\/+$/, '')}`;

  const preview = process.env.VERCEL_URL;
  if (preview) return `https://${preview.replace(/\/+$/, '')}`;

  return 'http://localhost:3000';
}

export function absoluteUrl(path: string): string {
  const base = getSiteUrl();
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Whether this deployment should be indexed by search engines. */
export function shouldIndex(): boolean {
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') return false;
  return process.env.NODE_ENV === 'production';
}

export const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/bills', label: 'Bills' },
  { href: '/topics', label: 'Topics' },
  { href: '/events', label: 'Hearings & Events' },
  { href: '/committees', label: 'Committees' },
  { href: '/legislators', label: 'Legislators' },
  { href: '/methodology', label: 'Methodology' },
  { href: '/about', label: 'About & Contact' },
] as const;

export const ATTRIBUTION = {
  sourceName: 'LegiScan',
  sourceUrl: 'https://legiscan.com/',
  licenseName: 'Creative Commons Attribution 4.0 International',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  /** Shown wherever we need to be explicit that we are not the official record. */
  disclaimer:
    'Rising Tide is not the official legislative record. Verify legal and authoritative details with the New York State Legislature.',
} as const;
