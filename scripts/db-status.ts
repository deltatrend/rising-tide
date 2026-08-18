/**
 * Prints what is actually stored, so a first run can be verified without
 * opening a SQL client.
 *
 * Usage: npm run db:status
 */

import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local', quiet: true });
loadEnv({ path: '.env', quiet: true });

async function main(): Promise<void> {
  const { getDb, closeDb } = await import('../lib/db/client');
  const { sql } = await import('drizzle-orm');

  const db = getDb();

  const [counts] = await db.execute(sql`
    select
      (select count(*) from sessions) as sessions,
      (select count(*) from bills) as bills,
      (select count(*) from bills where is_tracked) as tracked_bills,
      (select count(*) from topics) as topics,
      (select count(*) from bill_topics) as bill_topics,
      (select count(*) from bill_actions) as actions,
      (select count(*) from people) as people,
      (select count(*) from bill_sponsors) as sponsorships,
      (select count(*) from committees) as committees,
      (select count(*) from events) as events,
      (select count(*) from roll_calls) as roll_calls,
      (select count(*) from individual_votes) as individual_votes,
      (select count(*) from bill_documents) as documents,
      (select count(*) from amendments) as amendments,
      (select count(*) from supplements) as supplements,
      (select count(*) from r2_objects) as r2_objects,
      (select count(*) from sync_runs) as sync_runs,
      (select coalesce(sum(queries_used), 0) from api_usage) as queries_used
  `);

  console.log('');
  console.log('Rising Tide — database contents');
  console.log('─'.repeat(48));
  for (const [key, value] of Object.entries(counts ?? {})) {
    console.log(`${key.replace(/_/g, ' ').padEnd(24)} ${value}`);
  }

  const topics = await db.execute(sql`
    select t.name, count(*)::int as bills
    from bill_topics bt
    join topics t on t.id = bt.topic_id
    join bills b on b.id = bt.bill_id
    where b.is_tracked
    group by t.name
    order by bills desc
  `);

  if (topics.length > 0) {
    console.log('');
    console.log('Tracked bills by topic');
    console.log('─'.repeat(48));
    for (const row of topics) {
      console.log(`${String(row.name).padEnd(28)} ${row.bills}`);
    }
  }

  const sample = await db.execute(sql`
    select b.bill_number, b.relevance_score, c.reason
    from bills b
    join bill_classifications c on c.bill_id = b.id
    where b.is_tracked
    order by b.relevance_score desc
    limit 8
  `);

  if (sample.length > 0) {
    console.log('');
    console.log('Highest-scoring tracked bills');
    console.log('─'.repeat(48));
    for (const row of sample) {
      console.log(`${String(row.bill_number).padEnd(8)} ${row.relevance_score}  ${row.reason}`);
    }
  }

  const rejected = await db.execute(sql`
    select b.bill_number, b.relevance_score, b.title
    from bills b
    where not b.is_tracked
    order by b.relevance_score desc
    limit 8
  `);

  if (rejected.length > 0) {
    console.log('');
    console.log('Highest-scoring bills that were NOT tracked');
    console.log('─'.repeat(48));
    for (const row of rejected) {
      console.log(
        `${String(row.bill_number).padEnd(8)} ${row.relevance_score}  ${String(row.title).slice(0, 70)}`,
      );
    }
  }

  console.log('');
  await closeDb();
}

main().catch(async (error) => {
  console.error('Status check failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
