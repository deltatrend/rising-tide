/**
 * Decorative waterline closing the hero. Purely visual: it carries no data and
 * is hidden from assistive technology.
 */
export function WaterLine() {
  return (
    <svg
      className="waterline"
      viewBox="0 0 1440 90"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M0 46c120-26 240-26 360 0s240 26 360 0 240-26 360 0 240 26 360 0v44H0z"
        fill="var(--tide-soft)"
        opacity="0.85"
      />
      <path
        d="M0 62c120-22 240-22 360 0s240 22 360 0 240-22 360 0 240 22 360 0v28H0z"
        fill="var(--paper)"
      />
    </svg>
  );
}
