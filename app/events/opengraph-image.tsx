import { SITE } from '@/config/site';
import { OG_CONTENT_TYPE, OG_SIZE, ogResponse } from '@/lib/seo/opengraph';

export const alt = `Hearings & events · ${SITE.shortName}`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function EventsOpenGraphImage() {
  return ogResponse({
    eyebrow: SITE.name,
    title: 'Hearings & events',
    detail: 'Committee hearings, floor sessions and public meetings on the water bills we track.',
  });
}
