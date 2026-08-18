import { SITE } from '@/config/site';
import { OG_CONTENT_TYPE, OG_SIZE, ogResponse } from '@/lib/seo/opengraph';

export const alt = `Topics · ${SITE.shortName}`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function TopicsOpenGraphImage() {
  return ogResponse({
    eyebrow: SITE.name,
    title: 'Water policy topics',
    detail: 'Drinking water, PFAS, wetlands, flooding, fisheries, Long Island Sound and more.',
  });
}
