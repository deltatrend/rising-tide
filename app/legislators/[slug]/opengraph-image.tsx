import { SITE } from '@/config/site';
import { getLegislatorBySlug } from '@/lib/db/queries/legislators';
import { partyLabel, roleLabel } from '@/lib/legiscan/enums';
import { OG_CONTENT_TYPE, OG_SIZE, ogResponse } from '@/lib/seo/opengraph';

export const alt = `${SITE.shortName} legislator`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function LegislatorOpenGraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const person = await getLegislatorBySlug(slug);

  if (!person) {
    return ogResponse({ eyebrow: SITE.shortName, title: 'Legislator not found' });
  }

  const detail = [
    roleLabel(person.role, person.roleId),
    person.district ? `District ${person.district}` : null,
    partyLabel(person.party, person.partyId),
  ]
    .filter(Boolean)
    .join(' · ');

  return ogResponse({
    eyebrow: `${SITE.shortName} · Legislator`,
    title: person.name,
    detail,
  });
}
