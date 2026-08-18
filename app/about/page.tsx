import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { GetInvolved } from '@/components/about/GetInvolved';
import { JsonLd } from '@/components/seo/JsonLd';
import { Callout } from '@/components/ui/Callout';
import { PageHeader } from '@/components/ui/SectionHeader';
import { ATTRIBUTION, getContactEmail, SITE } from '@/config/site';
import { aboutPageJsonLd } from '@/lib/seo/json-ld';
import { listingMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = listingMetadata(
  'About & contact',
  `${SITE.name} is a youth-led project that gets New York teens informed and talking about sustainable water systems.`,
  '/about',
);

export default function AboutPage() {
  return (
    <div className="container">
      <JsonLd data={aboutPageJsonLd()} />
      <PageHeader eyebrow="About & contact" title={SITE.name} lede={SITE.tagline} />

      <div className="split split-sidebar">
        <div className="prose">
          <div className="founder">
            <Image
              className="founder__photo"
              src="/phoebe-skinner.png"
              alt={`${SITE.founder}, founder of ${SITE.name}`}
              width={72}
              height={72}
            />
            <div>
              <h2 className="founder__name">{SITE.founder}</h2>
              <p className="founder__lede">
                Founder of {SITE.shortName}. A senior at {SITE.founderSchool} in {SITE.founderPlace}.
              </p>
              <p>
                She started this as a youth-led effort to put New York teens in the conversation
                about the water they will inherit. The tracker is one part of that work — alongside
                public outreach, advocacy and research.
              </p>
            </div>
          </div>

          <h2>Our mission</h2>
          <p>{SITE.mission}</p>
          <p>{SITE.missionHow}</p>

          <h2>Why this exists</h2>
          <p>
            Decisions about New York&rsquo;s water — what can be discharged into a river, which
            wetlands are protected, who pays to replace a lead pipe, how a coastal town prepares for
            a storm — are made in bills most people never see. Those bills are public. They are also
            nearly unreadable unless you already know how the Legislature works.
          </p>
          <p>
            Water policy decided this year sets the conditions of the next fifty. The people with
            the longest stake in those decisions are usually the least equipped to follow them, not
            because the information is secret, but because it is written for insiders.{' '}
            {SITE.shortName} exists so New York teens can become those insiders — and then
            advocates.
          </p>

          <h2>What this site does</h2>
          <ul>
            <li>
              Follows every bill in the current New York State session that we identify as water
              policy, and explains in plain language where each one actually stands.
            </li>
            <li>
              Groups bills into topics — drinking water, PFAS, wetlands, flooding, fisheries and
              more — so you can follow one area at a time.
            </li>
            <li>
              Shows the full official history of each bill: who introduced it, which committee has
              it, what has happened, and how legislators voted where a vote was recorded.
            </li>
            <li>
              Lists upcoming hearings, which are usually the first point at which a member of the
              public can say something on the record.
            </li>
          </ul>

          <h2>What this site does not do</h2>
          <p>
            It does not tell you what to think about a bill. It does not rate or grade legislators.
            It does not generate summaries with an AI model, and it does not publish claims it
            cannot trace to the official record. Where information is missing, the site says so
            instead of filling the gap.
          </p>

          <Callout title="No accounts, ever">
            <p style={{ marginBottom: 0 }}>
              There is no sign-up, no login, no mailing list, no paywall and no advertising. Nothing
              on this site is gated, and we do not collect personal information in order to show you
              legislation that is already public.
            </p>
          </Callout>

          <h2>How to use the tracker</h2>
          <p>
            Start with a <Link href="/topics">topic</Link> if you know what you care about, or the{' '}
            <Link href="/bills">bill explorer</Link> if you want to search. Every view is a plain
            web address, so any filtered list can be copied, shared or bookmarked. If you want to
            know how a conclusion on this site was reached, the{' '}
            <Link href="/methodology">methodology page</Link> explains it in full.
          </p>

          <h2>Taking action without an account</h2>
          <p>
            Advocacy does not require a platform. Every bill page links to the official state
            record, names the sponsor and the committee holding it, and lists any scheduled hearing.
            Public hearings in New York generally accept written testimony, and committee chairs
            decide which bills get heard at all — which makes contacting them, in your own words,
            one of the few points where an individual can measurably matter.
          </p>

          <h2>Data and credit</h2>
          <p>
            Legislative data is provided by{' '}
            <a href={ATTRIBUTION.sourceUrl} rel="noopener noreferrer" target="_blank">
              LegiScan
            </a>{' '}
            under the{' '}
            <a href={ATTRIBUTION.licenseUrl} rel="noopener noreferrer" target="_blank">
              {ATTRIBUTION.licenseName}
            </a>{' '}
            licence. {SITE.shortName} is an independent youth project. It is not affiliated with
            LegiScan, the New York State Legislature, or any state agency, and it is not the
            official legislative record.
          </p>
        </div>

        <GetInvolved email={getContactEmail()} />
      </div>
    </div>
  );
}
