/**
 * Times the queries that back the heaviest pages, so slow ones are visible
 * before they show up as a stalled request in production.
 *
 *   npm run db:timings
 */

import { config } from 'dotenv';

config({ path: '.env.local', quiet: true });

async function main(): Promise<void> {
  const bills = await import('../lib/db/queries/bills');
  const committees = await import('../lib/db/queries/committees');
  const legislators = await import('../lib/db/queries/legislators');
  const topics = await import('../lib/db/queries/topics');
  const events = await import('../lib/db/queries/events');
  const stats = await import('../lib/db/queries/stats');
  const { closeDb, getSql } = await import('../lib/db/client');

  const sql = getSql();
  const settings = await sql<{ name: string; setting: string }[]>`
    select name, setting from pg_settings
    where name in ('statement_timeout', 'idle_in_transaction_session_timeout', 'max_connections')
  `;
  for (const { name, setting } of settings) console.log(`${name.padStart(38)} = ${setting}`);
  console.log('');

  const checks: [string, () => Promise<unknown>][] = [
    ['getAllBillSlugs (sitemap, 5000)', () => bills.getAllBillSlugs()],
    ['getAllCommitteeSlugs', () => committees.getAllCommitteeSlugs()],
    ['getAllLegislatorSlugs', () => legislators.getAllLegislatorSlugs()],
    ['listBills (page 1)', () => bills.listBills()],
    ['getBillFacets', () => bills.getBillFacets()],
    ['listTopicSummaries', () => topics.listTopicSummaries()],
    ['listCommittees', () => committees.listCommittees()],
    ['listLegislators', () => legislators.listLegislators()],
    ['listEvents', () => events.listEvents({ when: 'all' })],
    ['getSiteSnapshot', () => stats.getSiteSnapshot()],
    ['getActivityByMonth', () => bills.getActivityByMonth()],
  ];

  for (const [name, run] of checks) {
    const started = Date.now();
    try {
      const result = await run();
      const elapsed = Date.now() - started;
      const rows = Array.isArray(result) ? `${result.length} rows` : '';
      const flag = elapsed > 1000 ? '  <-- slow' : '';
      console.log(`${String(elapsed).padStart(6)}ms  ${name.padEnd(34)} ${rows}${flag}`);
    } catch (error) {
      console.log(
        `${String(Date.now() - started).padStart(6)}ms  ${name.padEnd(34)} threw: ${(error as Error).message}`,
      );
    }
  }

  await closeDb();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
