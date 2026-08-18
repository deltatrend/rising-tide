import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

/**
 * iOS home-screen icon. Same mark as the header and favicon, drawn on a
 * solid tide field so it does not disappear against a light wallpaper.
 */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#093f4a',
        }}
      >
        <svg width="148" height="148" viewBox="0 0 32 32">
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
      </div>
    ),
    size,
  );
}
