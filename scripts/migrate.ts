/**
 * Applies versioned Drizzle migrations.
 *
 * Only ever moves forward — it never drops or recreates tables, so it is safe to
 * point at production. Generate new migrations with `npm run db:generate` and
 * review the SQL before applying it.
 *
 * Usage: npm run db:migrate
 */

import { config as loadEnv } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

loadEnv({ path: '.env.local', quiet: true });
loadEnv({ path: '.env', quiet: true });

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;

  if (!url) {
    console.error('DATABASE_URL is not set. Copy .env.example to .env.local first.');
    process.exit(1);
  }

  const pooled = url.includes(':6543') || url.includes('pooler.supabase.com');

  console.log('Applying migrations from ./drizzle');
  console.log(pooled ? 'Connection: Supabase pooler (prepared statements disabled)' : 'Connection: direct');

  const sql = postgres(url, {
    max: 1,
    prepare: !pooled,
    ssl: url.includes('localhost') ? false : 'require',
    onnotice: () => {},
  });

  try {
    await migrate(drizzle(sql), { migrationsFolder: './drizzle' });
    console.log('Migrations applied successfully.');
  } catch (error) {
    console.error('Migration failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

void main();
