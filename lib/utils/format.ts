/** Presentation helpers shared by server and client components. */

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * Formats a `YYYY-MM-DD` date without constructing a Date, so a date-only value
 * never shifts by a day because of the viewer's time zone.
 */
export function formatDate(value: string | null | undefined): string {
  if (!value) return 'Date not recorded';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;

  const [, year, month, day] = match;
  const monthName = MONTHS[Number(month) - 1] ?? month;
  return `${monthName} ${Number(day)}, ${year}`;
}

export function formatDateShort(value: string | null | undefined): string {
  if (!value) return '—';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  const [, year, month, day] = match;
  const monthName = (MONTHS[Number(month) - 1] ?? month ?? '').slice(0, 3);
  return `${monthName} ${Number(day)}, ${year}`;
}

/**
 * A calendar entry with no published time arrives from LegiScan as "00:00", so
 * a literal midnight means "not stated" rather than a hearing at midnight.
 * Returns null when there is no time worth showing.
 */
export function formatEventTime(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour > 23 || minute > 59) return null;
  if (hour === 0 && minute === 0) return null;

  const suffix = hour < 12 ? 'a.m.' : 'p.m.';
  const twelveHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelveHour}:${String(minute).padStart(2, '0')} ${suffix}`;
}

export function formatTimestamp(value: Date | string | null | undefined): string {
  if (!value) return 'Never';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

/** "3 days ago", "in 2 weeks" — always relative to now. */
export function formatRelative(value: Date | string | null | undefined): string {
  if (!value) return 'never';
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return 'unknown';

  const diffMs = Date.now() - date.getTime();
  const future = diffMs < 0;
  const seconds = Math.abs(diffMs) / 1000;

  const units: [number, string][] = [
    [60, 'second'],
    [3600, 'minute'],
    [86400, 'hour'],
    [604800, 'day'],
    [2629800, 'week'],
    [31557600, 'month'],
  ];

  let label = 'year';
  let amount = seconds / 31557600;

  for (let i = 0; i < units.length; i += 1) {
    const [limit, unit] = units[i]!;
    if (seconds < limit) {
      const divisor = i === 0 ? 1 : units[i - 1]![0];
      amount = seconds / divisor;
      label = unit;
      break;
    }
  }

  const rounded = Math.max(1, Math.round(amount));
  const plural = rounded === 1 ? label : `${label}s`;
  return future ? `in ${rounded} ${plural}` : `${rounded} ${plural} ago`;
}

/** Days between a date-only string and today. Negative means in the past. */
/** True when a timestamp is older than `hours`. Used for freshness warnings. */
export function isOlderThan(value: Date | string | null | undefined, hours: number): boolean {
  if (!value) return false;
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return false;
  return (Date.now() - date.getTime()) / 3_600_000 > hours;
}

export function daysUntil(dateString: string): number {
  const target = Date.parse(`${dateString.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(target)) return 0;
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((target - todayUtc) / 86_400_000);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return 'Size unknown';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Trims to a whole word, adding an ellipsis only when text was removed. */
export function truncate(text: string | null | undefined, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 40 ? lastSpace : maxLength).trimEnd()}…`;
}

/**
 * The first clause of a New York bill title — the text before the first
 * semicolon — is the conventional short title. Budget and omnibus bills paste
 * every Part into the same official field, so the stored title can run to
 * thousands of characters even though people only ever quote the opening clause.
 *
 * Returns the original title when there is no useful clause break. Does not
 * invent wording.
 */
export function officialShortTitle(title: string | null | undefined): string {
  if (!title) return '';
  const trimmed = title.trim();
  const firstClause = trimmed.split(';')[0]?.trim() ?? trimmed;
  if (firstClause.length >= 40 && firstClause.length + 20 < trimmed.length) {
    return firstClause;
  }
  return trimmed;
}

/**
 * Title for cards, lists and headings: first clause when that is a real short
 * title, then a word-boundary truncate so a single long sentence cannot blow
 * out a layout.
 */
export function displayTitle(title: string | null | undefined, maxLength = 180): string {
  return truncate(asSentence(officialShortTitle(title)), maxLength);
}

/**
 * New York bill descriptions are written in legislative shorthand starting with
 * a lowercase verb ("relates to the protection of..."). Capitalizing the first
 * letter makes them read as sentences without altering any wording.
 */
export function asSentence(text: string | null | undefined): string {
  if (!text) return '';
  const trimmed = text.trim();
  if (trimmed.length === 0) return '';
  const capitalized = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  return /[.!?]$/.test(capitalized) ? capitalized : `${capitalized}.`;
}

/** "S1234" -> "Senate Bill 1234" for screen readers and page titles. */
export function expandBillNumber(billNumber: string): string {
  const match = /^([A-Za-z]+)0*(\d+)$/.exec(billNumber.trim());
  if (!match) return billNumber;
  const [, prefix, digits] = match;

  const prefixes: Record<string, string> = {
    S: 'Senate Bill',
    A: 'Assembly Bill',
    K: 'Assembly Resolution',
    J: 'Senate Resolution',
    R: 'Resolution',
    B: 'Bill',
  };

  const label = prefixes[prefix!.toUpperCase()] ?? `${prefix} `;
  return `${label} ${digits}`;
}

/** Removes leading zeros for display: "S08503" -> "S8503". */
export function tidyBillNumber(billNumber: string): string {
  return billNumber.replace(/^([A-Za-z]+)0+(\d)/, '$1$2');
}
