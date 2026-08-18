import type { Metadata } from 'next';
import Link from 'next/link';

import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/SectionHeader';

export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <div className="container container-narrow">
      <PageHeader
        eyebrow="404"
        title="We could not find that page"
        lede="The address may be mistyped, or a bill may have been renumbered between sessions."
      />
      <EmptyState title="Try one of these instead" action={{ href: '/bills', label: 'Browse all water bills' }}>
        <p>
          You can search every tracked bill by number, keyword or sponsor from the{' '}
          <Link href="/bills">bill explorer</Link>, or start from a{' '}
          <Link href="/topics">topic</Link>.
        </p>
      </EmptyState>
    </div>
  );
}
