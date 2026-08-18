import type { Metadata } from 'next';

import { SITE } from '@/config/site';
import { OG_CONTENT_TYPE, OG_SIZE } from '@/lib/seo/opengraph';

/** File-convention image Next.js serves next to the page. */
export function shareImagePath(pagePath: string): string {
  const clean = (pagePath.split('?')[0] ?? '').replace(/\/+$/, '');
  return !clean || clean === '/' ? '/opengraph-image' : `${clean}/opengraph-image`;
}

export function shareImage(pagePath: string, alt: string) {
  return {
    url: shareImagePath(pagePath),
    width: OG_SIZE.width,
    height: OG_SIZE.height,
    alt,
    type: OG_CONTENT_TYPE,
  };
}

/** Consistent titles, descriptions and share cards for listing pages. */
export function listingMetadata(title: string, description: string, path: string): Metadata {
  const image = shareImage(path, `${title} · ${SITE.shortName}`);

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      title: `${title} · ${SITE.shortName}`,
      description,
      url: path,
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image.url],
    },
  };
}
