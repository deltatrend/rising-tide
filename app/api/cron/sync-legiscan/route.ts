import { NextResponse, type NextRequest } from 'next/server';

import { getCronSecret, hasDatabaseUrl, hasLegiscanApiKey } from '@/lib/env';
import { runLegiScanSync } from '@/lib/sync/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Long enough for a full incremental run; Vercel caps this per plan in vercel.json.
export const maxDuration = 300;

/**
 * The only endpoint that talks to LegiScan.
 *
 * Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. Without a matching
 * secret this returns 401 and does nothing — the route must never be a way for
 * an anonymous visitor to burn our monthly query budget.
 */
function isAuthorized(request: NextRequest): boolean {
  const secret = getCronSecret();

  // Refusing to run without a configured secret is safer than running openly.
  if (!secret) return false;

  const header = request.headers.get('authorization');
  if (header === `Bearer ${secret}`) return true;

  // Vercel also signs cron invocations with this header on some plans.
  return request.headers.get('x-vercel-cron-secret') === secret;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!hasDatabaseUrl() || !hasLegiscanApiKey()) {
    return NextResponse.json(
      {
        status: 'skipped',
        reason: 'DATABASE_URL and LEGISCAN_API_KEY must both be configured.',
      },
      { status: 503 },
    );
  }

  try {
    const result = await runLegiScanSync({ trigger: 'cron' });

    return NextResponse.json(result, {
      status: result.status === 'failed' ? 500 : 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    // Never echo the error object: it can contain the request URL, which
    // carries the API key.
    const message = error instanceof Error ? error.message : 'Unknown synchronization failure';
    console.error('Scheduled synchronization failed:', message);

    return NextResponse.json({ status: 'failed', error: message }, { status: 500 });
  }
}

/** Vercel Cron uses GET; POST is accepted so the job can be triggered manually. */
export const POST = GET;
