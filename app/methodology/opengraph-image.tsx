import { SITE } from '@/config/site';
import { OG_CONTENT_TYPE, OG_SIZE, ogResponse } from '@/lib/seo/opengraph';

export const alt = `Methodology · ${SITE.shortName}`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function MethodologyOpenGraphImage() {
  return ogResponse({
    eyebrow: SITE.name,
    title: 'Methodology',
    detail: 'Where the data comes from, how bills are selected, and what we do not know.',
  });
}
