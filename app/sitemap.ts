import type { MetadataRoute } from 'next';

import { getSiteUrl } from '@/config/site';
import { TOPIC_SLUGS } from '@/config/topics';
import { getAllBillSlugs } from '@/lib/db/queries/bills';
import { getAllCommitteeSlugs } from '@/lib/db/queries/committees';
import { getAllLegislatorSlugs } from '@/lib/db/queries/legislators';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();
  const now = new Date();

  const [billSlugs, committeeSlugs, legislatorSlugs] = await Promise.all([
    getAllBillSlugs(),
    getAllCommitteeSlugs(),
    getAllLegislatorSlugs(),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${base}/bills`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/topics`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${base}/events`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${base}/committees`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${base}/legislators`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${base}/methodology`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/about`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
  ];

  return [
    ...staticRoutes,
    ...TOPIC_SLUGS.map((slug) => ({
      url: `${base}/topics/${slug}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    ...billSlugs.map((bill) => ({
      url: `${base}/bills/${bill.slug}`,
      lastModified: bill.lastSyncedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    ...committeeSlugs.map((slug) => ({
      url: `${base}/committees/${slug}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.4,
    })),
    ...legislatorSlugs.map((slug) => ({
      url: `${base}/legislators/${slug}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.4,
    })),
  ];
}
