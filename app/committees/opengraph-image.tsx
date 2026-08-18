import { SITE } from '@/config/site';
import { OG_CONTENT_TYPE, OG_SIZE, ogResponse } from '@/lib/seo/opengraph';

export const alt = `Committees · ${SITE.shortName}`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function CommitteesOpenGraphImage() {
  return ogResponse({
    eyebrow: SITE.name,
    title: 'Committees',
    detail: 'Senate and Assembly committees that decide whether water bills move forward.',
  });
}
