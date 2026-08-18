/**
 * Structured data for search engines. These objects are rendered as
 * application/ld+json. They describe the project and each public page; they
 * never invent facts that are not already on the page.
 */

import { SITE, absoluteUrl, getSiteUrl } from '@/config/site';

export function siteGraph() {
  const url = getSiteUrl();

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'NGO',
        '@id': `${url}/#org`,
        name: SITE.name,
        alternateName: SITE.shortName,
        url,
        description: SITE.description,
        founder: { '@type': 'Person', name: SITE.founder },
        areaServed: { '@type': 'AdministrativeArea', name: SITE.region },
        knowsAbout: [
          'New York water policy',
          'drinking water',
          'wetlands',
          'PFAS',
          'coastal resilience',
          'New York State legislation',
        ],
      },
      {
        '@type': 'WebSite',
        '@id': `${url}/#website`,
        url,
        name: SITE.name,
        description: SITE.description,
        inLanguage: 'en-US',
        publisher: { '@id': `${url}/#org` },
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${url}/bills?q={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      },
    ],
  };
}

export function breadcrumbList(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function billJsonLd(input: {
  slug: string;
  billNumber: string;
  title: string;
  description: string;
  introducedOn?: string | null;
  statusLabel?: string;
  sponsorName?: string | null;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Legislation',
    name: `${input.billNumber}: ${input.title}`,
    legislationIdentifier: input.billNumber,
    description: input.description,
    url: absoluteUrl(`/bills/${input.slug}`),
    inLanguage: 'en-US',
    legislationJurisdiction: {
      '@type': 'AdministrativeArea',
      name: 'New York',
    },
    ...(input.introducedOn ? { dateIntroduced: input.introducedOn } : {}),
    ...(input.statusLabel ? { legislationLegalStatus: input.statusLabel } : {}),
    ...(input.sponsorName
      ? { author: { '@type': 'Person', name: input.sponsorName } }
      : {}),
    publisher: { '@id': `${getSiteUrl()}/#org` },
    isPartOf: { '@id': `${getSiteUrl()}/#website` },
  };
}

export function topicJsonLd(input: { slug: string; name: string; description: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: input.name,
    description: input.description,
    url: absoluteUrl(`/topics/${input.slug}`),
    isPartOf: { '@id': `${getSiteUrl()}/#website` },
    about: { '@type': 'Thing', name: `${input.name} policy in New York` },
  };
}

export function personJsonLd(input: { slug: string; name: string; description: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: input.name,
    description: input.description,
    url: absoluteUrl(`/legislators/${input.slug}`),
    jobTitle: 'New York State legislator',
    affiliation: {
      '@type': 'GovernmentOrganization',
      name: 'New York State Legislature',
    },
  };
}

export function aboutPageJsonLd() {
  const url = getSiteUrl();

  return {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: `About ${SITE.name}`,
    description: SITE.mission,
    url: absoluteUrl('/about'),
    isPartOf: { '@id': `${url}/#website` },
    about: { '@id': `${url}/#org` },
  };
}

export function committeeJsonLd(input: { slug: string; name: string; description: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'GovernmentOrganization',
    name: input.name,
    description: input.description,
    url: absoluteUrl(`/committees/${input.slug}`),
    parentOrganization: {
      '@type': 'GovernmentOrganization',
      name: 'New York State Legislature',
    },
  };
}
