import { SITE } from '@/config/site';
import { OG_CONTENT_TYPE, OG_SIZE, ogResponse } from '@/lib/seo/opengraph';

export const alt = `About · ${SITE.shortName}`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function AboutOpenGraphImage() {
  return ogResponse({
    eyebrow: SITE.name,
    title: 'About & contact',
    detail: SITE.mission,
  });
}
