import { SITE } from '@/config/site';
import { getTopicDefinition } from '@/config/topics';
import { OG_CONTENT_TYPE, OG_SIZE, ogResponse } from '@/lib/seo/opengraph';

export const alt = `${SITE.shortName} topic`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function TopicOpenGraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const topic = getTopicDefinition(slug);

  if (!topic) {
    return ogResponse({ eyebrow: SITE.shortName, title: 'Topic not found' });
  }

  return ogResponse({
    eyebrow: `${SITE.shortName} · ${topic.category}`,
    title: topic.name,
    detail: topic.shortDescription,
  });
}
