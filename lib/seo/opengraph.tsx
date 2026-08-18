import { ImageResponse } from 'next/og';
import type { ReactElement } from 'react';

import { SITE } from '@/config/site';

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = 'image/png';

/**
 * Shared Open Graph canvas. Satori (used by next/og) only understands a subset
 * of CSS, so this is flexbox and hex colours — no stylesheets, no CSS variables.
 */
export function OgDocument({
  eyebrow,
  title,
  detail,
}: {
  eyebrow: string;
  title: string;
  detail?: string;
}): ReactElement {
  const titleSize = title.length > 110 ? 40 : title.length > 70 ? 48 : 56;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '56px 64px 48px',
        background: 'linear-gradient(180deg, #d7ecee 0%, #fbfaf6 58%)',
        color: '#10242e',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <BrandMark />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div
            style={{
              display: 'flex',
              fontSize: 22,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#093f4a',
              fontWeight: 700,
            }}
          >
            {SITE.shortName}
          </div>
          <div style={{ display: 'flex', fontSize: 20, color: '#5f7684' }}>{eyebrow}</div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          maxWidth: 1000,
        }}
      >
        <div
          style={{
            display: 'flex',
            fontSize: titleSize,
            lineHeight: 1.15,
            fontWeight: 600,
            letterSpacing: '-0.02em',
          }}
        >
          {title}
        </div>
        {detail ? (
          <div style={{ display: 'flex', fontSize: 26, color: '#2f4b58', lineHeight: 1.4 }}>
            {detail}
          </div>
        ) : null}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          color: '#5f7684',
          fontSize: 22,
        }}
      >
        <div style={{ display: 'flex' }}>{SITE.tagline}</div>
        <div style={{ display: 'flex' }}>{SITE.subtitle}</div>
      </div>
    </div>
  );
}

function BrandMark(): ReactElement {
  return (
    <svg width="72" height="72" viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="15.2" fill="#e4f1f2" stroke="#14879b" strokeWidth="1.2" />
      <path
        d="M3.2 19.2c3.2 0 3.2-3.2 6.4-3.2s3.2 3.2 6.4 3.2 3.2-3.2 6.4-3.2 3.2 3.2 6.4 3.2"
        fill="none"
        stroke="#093f4a"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M3.2 24.8c3.2 0 3.2-3.2 6.4-3.2s3.2 3.2 6.4 3.2 3.2-3.2 6.4-3.2 3.2 3.2 6.4 3.2"
        fill="none"
        stroke="#14879b"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.75"
      />
      <circle cx="16" cy="10.4" r="3.6" fill="#c2671f" />
    </svg>
  );
}

export function ogResponse(props: { eyebrow: string; title: string; detail?: string }) {
  return new ImageResponse(<OgDocument {...props} />, OG_SIZE);
}
