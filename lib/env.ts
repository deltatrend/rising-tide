/**
 * Server-side environment access.
 *
 * Nothing in this file may ever be imported from a Client Component. Secrets are
 * read lazily so that a missing optional credential (R2, for example) never
 * breaks the build or a page render — it only disables the feature that needs it.
 */

if (typeof window !== 'undefined') {
  throw new Error(
    'lib/env.ts was imported into browser code. Server credentials must never reach the client bundle.',
  );
}

function optional(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

function required(name: string): string {
  const value = optional(name);
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
}

/* ------------------------------------------------------------------------- */
/* Database                                                                   */
/* ------------------------------------------------------------------------- */

export function getDatabaseUrl(): string {
  return required('DATABASE_URL');
}

export function hasDatabaseUrl(): boolean {
  return optional('DATABASE_URL') !== undefined;
}

/* ------------------------------------------------------------------------- */
/* LegiScan                                                                   */
/* ------------------------------------------------------------------------- */

/**
 * The developer's existing variable name is LEGISCAN_API_KEY; LEGISCAN_KEY is
 * accepted as a fallback so an existing deployment does not need a duplicate
 * secret.
 */
export function getLegiscanApiKey(): string {
  const key = optional('LEGISCAN_API_KEY') ?? optional('LEGISCAN_KEY');
  if (!key) {
    throw new Error(
      'Missing LEGISCAN_API_KEY. Synchronization cannot run without a LegiScan Public API key.',
    );
  }
  return key;
}

export function hasLegiscanApiKey(): boolean {
  return (optional('LEGISCAN_API_KEY') ?? optional('LEGISCAN_KEY')) !== undefined;
}

/* ------------------------------------------------------------------------- */
/* Cron                                                                       */
/* ------------------------------------------------------------------------- */

export function getCronSecret(): string | undefined {
  return optional('CRON_SECRET');
}

/* ------------------------------------------------------------------------- */
/* Cloudflare R2 (entirely optional)                                          */
/* ------------------------------------------------------------------------- */

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  endpoint: string;
  region: string;
}

export function getR2Config(): R2Config | null {
  const accountId = optional('R2_ACCOUNT_ID');
  const accessKeyId = optional('R2_ACCESS_KEY_ID');
  const secretAccessKey = optional('R2_SECRET_ACCESS_KEY');
  const bucket = optional('R2_BUCKET') ?? optional('R2_BUCKET_NAME');
  const endpoint =
    optional('R2_ENDPOINT') ??
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined);
  const region = optional('R2_REGION') ?? 'auto';

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !endpoint) {
    return null;
  }

  return { accountId, accessKeyId, secretAccessKey, bucket, endpoint, region };
}

export function isR2Configured(): boolean {
  return getR2Config() !== null;
}

/* ------------------------------------------------------------------------- */
/* Runtime flags                                                              */
/* ------------------------------------------------------------------------- */

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function isFixtureMode(): boolean {
  return process.env.NEXT_PUBLIC_FIXTURE_MODE === 'true';
}
