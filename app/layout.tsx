import type { Metadata, Viewport } from 'next';

import { SiteFooter } from '@/components/layout/SiteFooter';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { JsonLd } from '@/components/seo/JsonLd';
import { getSiteUrl, shouldIndex, SITE } from '@/config/site';
import { siteGraph } from '@/lib/seo/json-ld';
import { shareImage } from '@/lib/seo/metadata';

import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s · ${SITE.shortName}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  authors: [{ name: SITE.founder }, { name: SITE.name }],
  creator: SITE.founder,
  publisher: SITE.name,
  keywords: [
    'New York water policy',
    'New York State legislation',
    'drinking water',
    'wetlands',
    'coastal resilience',
    'youth advocacy',
    'civic education',
  ],
  openGraph: {
    type: 'website',
    siteName: SITE.name,
    locale: 'en_US',
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    images: [shareImage('/', `${SITE.name} — ${SITE.tagline}`)],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    images: [shareImage('/', `${SITE.name} — ${SITE.tagline}`).url],
  },
  robots: shouldIndex()
    ? {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
          'max-image-preview': 'large',
          'max-snippet': -1,
          'max-video-preview': -1,
        },
      }
    : { index: false, follow: false, nocache: true },
  category: 'government',
};

export const viewport: Viewport = {
  themeColor: '#093f4a',
  colorScheme: 'light',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to main content
        </a>
        <SiteHeader />
        <JsonLd data={siteGraph()} />
        <main id="main" className="site-main">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
