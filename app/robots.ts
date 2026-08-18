import type { MetadataRoute } from 'next';

import { getSiteUrl, shouldIndex } from '@/config/site';

export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl();

  // Preview deployments must never compete with production in search results.
  if (!shouldIndex()) {
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Cached blobs are large and duplicate the official source.
        disallow: ['/api/'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
