import { SITE } from '@/config/site';
import { OG_CONTENT_TYPE, OG_SIZE, ogResponse } from '@/lib/seo/opengraph';

export const alt = `Water bills · ${SITE.shortName}`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function BillsOpenGraphImage() {
  return ogResponse({
    eyebrow: SITE.name,
    title: 'Water bills',
    detail:
      'Every New York State bill we track on oceans, drinking water, wetlands, flooding and water quality.',
  });
}
