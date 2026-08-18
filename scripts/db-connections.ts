/**
 * Shows who is holding connections to the database. Useful when queries start
 * queueing: leaked connections from crashed dev servers are a common cause.
 *
 *   npm run db:connections
 */

import { config } from 'dotenv';

config({ path: '.env.local', quiet: true });

async function main(): Promise<void> {
  const { closeDb, getSql } = await import('../lib/db/client');
  const sql = getSql();

  const [totals] = await sql<{ total: number; max: number }[]>`
    select
      (select count(*)::int from pg_stat_activity) as total,
      (select setting::int from pg_settings where name = 'max_connections') as max
  `;
  console.log(`connections: ${totals?.total ?? 0} of ${totals?.max ?? 0}`);
  console.log('');

  const rows = await sql<
    { application_name: string; state: string; count: number; oldest: string }[]
  >`
    select
      coalesce(nullif(application_name, ''), '(none)') as application_name,
      coalesce(state, '(unknown)') as state,
      count(*)::int as count,
      to_char(max(now() - state_change), 'HH24:MI:SS') as oldest
    from pg_stat_activity
    group by 1, 2
    order by count desc
  `;

  for (const row of rows) {
    console.log(
      `${String(row.count).padStart(4)}  ${row.state.padEnd(20)} ${row.application_name.padEnd(24)} idle for up to ${row.oldest}`,
    );
  }

  await closeDb();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
