/**
 * Requests every public route against a running server and reports status codes
 * and response sizes. Detail routes are discovered from the sitemap so the run
 * exercises real slugs rather than guesses.
 *
 * A route that renders the error boundary still returns 200, so the HTML is
 * also checked for the boundary's text.
 *
 *   npm run start          # in one terminal
 *   npm run smoke:routes   # in another
 */

const BASE = process.env.SMOKE_BASE_URL ?? 'http://localhost:3000';

interface Route {
  path: string;
  expect?: number;
}

const STATIC_ROUTES: Route[] = [
  { path: '/' },
  { path: '/bills' },
  { path: '/bills?topic=drinking-water' },
  { path: '/bills?status=moving&chamber=S' },
  { path: '/bills?q=lead+service+line&sort=relevance' },
  { path: '/bills?page=2' },
  { path: '/bills?committee=nonexistent-committee' },
  { path: '/topics' },
  { path: '/topics/drinking-water' },
  { path: '/topics/flooding-resilience' },
  { path: '/topics/not-a-topic', expect: 404 },
  { path: '/events' },
  { path: '/events?when=past' },
  { path: '/committees' },
  { path: '/legislators' },
  { path: '/methodology' },
  { path: '/about' },
  { path: '/sitemap.xml' },
  { path: '/robots.txt' },
  { path: '/no-such-page', expect: 404 },
];

/** Picks the first sitemap URL under each detail prefix. */
async function discoverDetailRoutes(): Promise<Route[]> {
  const response = await fetch(`${BASE}/sitemap.xml`);
  if (!response.ok) return [];

  const xml = await response.text();
  const paths = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]!).pathname);

  const found: Route[] = [];
  for (const prefix of ['/bills/', '/committees/', '/legislators/']) {
    const match = paths.find((p) => p.startsWith(prefix) && p.length > prefix.length);
    if (match) found.push({ path: match });
  }
  return found;
}

async function main(): Promise<void> {
  const routes = [...STATIC_ROUTES, ...(await discoverDetailRoutes())];
  let failures = 0;

  for (const route of routes) {
    const expected = route.expect ?? 200;

    try {
      const started = Date.now();
      const response = await fetch(`${BASE}${route.path}`);
      const body = await response.text();
      const elapsed = Date.now() - started;

      const boundary = body.includes('Something went wrong');
      const ok = response.status === expected && !boundary;
      if (!ok) failures += 1;

      const size = `${(body.length / 1024).toFixed(1)}kb`.padStart(8);
      console.log(
        `${ok ? 'ok  ' : 'FAIL'} ${response.status} ${size} ${String(elapsed).padStart(5)}ms  ` +
          `${route.path}${boundary ? '  [error boundary rendered]' : ''}`,
      );
    } catch (error) {
      failures += 1;
      console.log(`FAIL request failed  ${route.path}  ${(error as Error).message}`);
    }
  }

  console.log('');
  if (failures > 0) {
    console.log(`${failures} of ${routes.length} routes failed.`);
    process.exitCode = 1;
  } else {
    console.log(`All ${routes.length} routes responded as expected.`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
