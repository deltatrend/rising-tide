/** Stable, human-readable slug helpers used for public URLs. */

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/**
 * e.g. ("S1234", 2025) -> "s1234-2025" — unique within a session, readable.
 *
 * Internal whitespace is removed rather than hyphenated so "S 1234" and "S1234"
 * can never produce two different URLs for the same bill.
 */
export function billSlug(billNumber: string, sessionYearStart: number): string {
  return `${slugify(billNumber.replace(/\s+/g, ''))}-${sessionYearStart}`;
}

export function personSlug(name: string): string {
  return slugify(name);
}

/** Committee names repeat across chambers, so the chamber is part of the slug. */
export function committeeSlug(name: string, chamber: string | null | undefined): string {
  const chamberPart =
    chamber === 'S' ? 'senate' : chamber === 'A' || chamber === 'H' ? 'assembly' : 'joint';
  return `${chamberPart}-${slugify(name)}`;
}
