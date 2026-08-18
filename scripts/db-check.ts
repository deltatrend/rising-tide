/**
 * Connectivity probe. Reports whether DATABASE_URL points at a reachable
 * database, how long a trivial query takes, and whether the schema is present.
 *
 *   npm run db:check
 */

import { config } from 'dotenv';

config({ path: '.env.local', quiet: true });

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set in .env.local');
    process.exitCode = 1;
    return;
  }

  const parsed = new URL(url);
  console.log(`host      ${parsed.host}`);
  console.log(`user      ${parsed.username}`);
  console.log(`database  ${parsed.pathname.slice(1)}`);
  console.log('');

  const { default: postgres } = await import('postgres');
  const sql = postgres(url, {
    prepare: false,
    ssl: 'require',
    max: 1,
    connect_timeout: 20,
    onnotice: () => {},
  });

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const started = Date.now();
    try {
      await sql`select 1 as ok`;
      console.log(`attempt ${attempt}: ok (${Date.now() - started}ms)`);
    } catch (error) {
      const err = error as { code?: string; message?: string };
      console.log(
        `attempt ${attempt}: FAILED ${err.code ?? ''} ${err.message ?? ''} (${Date.now() - started}ms)`,
      );
    }
  }

  try {
    const tables = await sql<{ table_name: string }[]>`
      select table_name from information_schema.tables
      where table_schema = 'public' order by table_name
    `;
    console.log('');
    console.log(
      tables.length ? `tables: ${tables.map((t) => t.table_name).join(', ')}` : 'tables: none',
    );
  } catch (error) {
    console.log('');
    console.log(`table listing failed: ${(error as Error).message}`);
  }

  await sql.end({ timeout: 5 });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
