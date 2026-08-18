import type { MetadataRoute } from 'next';

import { SITE } from '@/config/site';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE.name,
    short_name: SITE.shortName,
    description: SITE.description,
    start_url: '/',
    display: 'browser',
    background_color: '#fbfaf6',
    theme_color: '#093f4a',
    lang: 'en-US',
    categories: ['education', 'government', 'news'],
  };
}
