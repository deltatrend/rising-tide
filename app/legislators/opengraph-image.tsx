import { SITE } from '@/config/site';
import { OG_CONTENT_TYPE, OG_SIZE, ogResponse } from '@/lib/seo/opengraph';

export const alt = `Legislators · ${SITE.shortName}`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function LegislatorsOpenGraphImage() {
  return ogResponse({
    eyebrow: SITE.name,
    title: 'Legislators',
    detail: 'Senators and assembly members who sponsor the water bills we track.',
  });
}
