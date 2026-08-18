import { describe, expect, it } from 'vitest';

import { SITE } from '@/config/site';
import { aboutPageJsonLd, billJsonLd, breadcrumbList, siteGraph } from '@/lib/seo/json-ld';
import { listingMetadata, shareImagePath } from '@/lib/seo/metadata';

describe('listing metadata', () => {
  it('sets a canonical so filtered copies do not become the official URL', () => {
    const meta = listingMetadata('Water bills', 'Every New York water bill we track.', '/bills');

    expect(meta.alternates?.canonical).toBe('/bills');
    expect(meta.openGraph?.url).toBe('/bills');
    expect(JSON.stringify(meta.twitter)).toContain('summary_large_image');
    expect(JSON.stringify(meta.openGraph?.images)).toContain('/bills/opengraph-image');
    expect(JSON.stringify(meta.twitter)).toContain('/bills/opengraph-image');
  });

  it('points share images at the Next.js file-convention routes', () => {
    expect(shareImagePath('/')).toBe('/opengraph-image');
    expect(shareImagePath('/bills')).toBe('/bills/opengraph-image');
    expect(shareImagePath('/bills/s1234-example')).toBe('/bills/s1234-example/opengraph-image');
    expect(shareImagePath('/events?when=past')).toBe('/events/opengraph-image');
  });
});

describe('structured data', () => {
  it('describes the project as a searchable website', () => {
    const graph = siteGraph();
    const types = graph['@graph'].map((node) => node['@type']);

    expect(types).toContain('NGO');
    expect(types).toContain('WebSite');
    expect(JSON.stringify(graph)).toContain('/bills?q={search_term_string}');
    expect(JSON.stringify(graph)).toContain(SITE.name);
  });

  it('keeps breadcrumbs on the same origin as the page', () => {
    const crumbs = breadcrumbList([
      { name: 'Home', path: '/' },
      { name: 'Bills', path: '/bills' },
    ]);

    expect(crumbs.itemListElement).toHaveLength(2);
    expect(crumbs.itemListElement[0]?.item).toMatch(/\/$/);
    expect(crumbs.itemListElement[1]?.item).toMatch(/\/bills$/);
  });

  it('does not invent a sponsor when none is known', () => {
    const json = billJsonLd({
      slug: 's1234-example',
      billNumber: 'S1234',
      title: 'Relates to drinking water',
      description: 'Requires testing of public water systems.',
    });

    expect(json.author).toBeUndefined();
    expect(json.legislationIdentifier).toBe('S1234');
  });

  it('marks the about page as being about the organization', () => {
    const json = aboutPageJsonLd();

    expect(json['@type']).toBe('AboutPage');
    expect(json.about['@id']).toMatch(/#org$/);
  });
});
