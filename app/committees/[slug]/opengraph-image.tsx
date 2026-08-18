import { SITE } from '@/config/site';
import { getCommitteeBySlug } from '@/lib/db/queries/committees';
import { chamberLabel } from '@/lib/legiscan/enums';
import { OG_CONTENT_TYPE, OG_SIZE, ogResponse } from '@/lib/seo/opengraph';

export const alt = `${SITE.shortName} committee`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function CommitteeOpenGraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const committee = await getCommitteeBySlug(slug);

  if (!committee) {
    return ogResponse({ eyebrow: SITE.shortName, title: 'Committee not found' });
  }

  return ogResponse({
    eyebrow: `${SITE.shortName} · ${chamberLabel(committee.chamber)}`,
    title: committee.name,
    detail: 'Water bills referred to this committee',
  });
}
