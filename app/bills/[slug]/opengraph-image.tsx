import { SITE } from '@/config/site';
import { getBillBySlug } from '@/lib/db/queries/bills';
import { describeStatus } from '@/lib/legiscan/enums';
import { OG_CONTENT_TYPE, OG_SIZE, ogResponse } from '@/lib/seo/opengraph';
import { displayTitle, officialShortTitle, tidyBillNumber } from '@/lib/utils/format';

export const alt = `${SITE.shortName} bill`;
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function BillOpenGraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const detail = await getBillBySlug(slug);

  if (!detail) {
    return ogResponse({ eyebrow: SITE.shortName, title: 'Bill not found' });
  }

  const number = tidyBillNumber(detail.bill.billNumber);
  const title = displayTitle(officialShortTitle(detail.bill.title), 110);
  const status = describeStatus(detail.bill.statusId).label;

  return ogResponse({
    eyebrow: `${SITE.shortName} · ${number}`,
    title,
    detail: status,
  });
}
