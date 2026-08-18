/**
 * Runs every read query the site uses against the configured database and
 * reports which ones execute cleanly.
 *
 * Page queries are wrapped in `safeQuery`, which deliberately degrades a broken
 * query to an empty result so visitors never see a stack trace. That safety net
 * also hides SQL mistakes, so this script re-runs the same queries with error
 * logging in view and fails loudly if any of them error.
 *
 *   npm run db:smoke
 */

import { config } from 'dotenv';

config({ path: '.env.local', quiet: true });

async function main(): Promise<void> {
  const { closeDb, isDatabaseConfigured } = await import('../lib/db/client');

  if (!isDatabaseConfigured()) {
    console.error('DATABASE_URL is not set — nothing to smoke test.');
    process.exitCode = 1;
    return;
  }

  const bills = await import('../lib/db/queries/bills');
  const topics = await import('../lib/db/queries/topics');
  const events = await import('../lib/db/queries/events');
  const committees = await import('../lib/db/queries/committees');
  const legislators = await import('../lib/db/queries/legislators');
  const stats = await import('../lib/db/queries/stats');

  // Slugs are resolved first so detail queries run against real rows when the
  // database has data, and against a miss when it does not. Both must succeed.
  const [billSlugs, committeeSlugs, legislatorSlugs] = await Promise.all([
    bills.getAllBillSlugs(1),
    committees.getAllCommitteeSlugs(),
    legislators.getAllLegislatorSlugs(),
  ]);

  const aBill = billSlugs[0]?.slug ?? 'no-such-bill';
  const aCommittee = committeeSlugs[0] ?? 'no-such-committee';
  const aLegislator = legislatorSlugs[0] ?? 'no-such-legislator';

  const checks: [string, () => Promise<unknown>][] = [
    ['getSiteSnapshot', () => stats.getSiteSnapshot()],
    ['getDataFreshness', () => stats.getDataFreshness()],
    ['getRecentSyncRuns', () => stats.getRecentSyncRuns(5)],
    ['getApiUsageThisMonth', () => stats.getApiUsageThisMonth()],
    ['getMostActiveTopics', () => stats.getMostActiveTopics()],

    ['listBills (defaults)', () => bills.listBills()],
    ['listBills (topic)', () => bills.listBills({ topic: 'drinking-water' })],
    ['listBills (status)', () => bills.listBills({ status: 'moving' })],
    ['listBills (chamber)', () => bills.listBills({ chamber: 'S' })],
    ['listBills (committee)', () => bills.listBills({ committee: aCommittee })],
    ['listBills (sponsor)', () => bills.listBills({ sponsor: aLegislator })],
    ['listBills (search)', () => bills.listBills({ q: 'lead service line' })],
    ['listBills (since)', () => bills.listBills({ since: '2025-01-01' })],
    ['listBills (has event)', () => bills.listBills({ hasUpcomingEvent: true })],
    ['listBills (has votes)', () => bills.listBills({ hasVotes: true })],
    ['listBills (sort=relevance)', () => bills.listBills({ sort: 'relevance' })],
    ['listBills (sort=introduced)', () => bills.listBills({ sort: 'introduced' })],
    ['listBills (sort=number)', () => bills.listBills({ sort: 'number' })],
    ['listBills (combined)', () =>
      bills.listBills({ topic: 'flooding-resilience', chamber: 'A', q: 'flood', sort: 'relevance' })],
    ['listBillsCompact', () => bills.listBillsCompact({ topic: 'wetlands' }, 5)],
    ['getBillFacets', () => bills.getBillFacets()],
    ['getBillBySlug', () => bills.getBillBySlug(aBill)],
    ['getStatusDistribution', () => bills.getStatusDistribution()],
    ['getStatusDistribution (topic)', () => bills.getStatusDistribution('stormwater')],
    ['getActivityByMonth', () => bills.getActivityByMonth()],
    ['getChamberDistribution', () => bills.getChamberDistribution()],
    ['getRecentlyChanged', () => bills.getRecentlyChanged()],

    ['listTopicSummaries', () => topics.listTopicSummaries()],
    ['getTopicRecord', () => topics.getTopicRecord('drinking-water')],
    ['getRecentVotesForTopic', () => topics.getRecentVotesForTopic('drinking-water')],
    ['getRecentVotes', () => topics.getRecentVotes()],

    ['listEvents (upcoming)', () => events.listEvents()],
    ['listEvents (past)', () => events.listEvents({ when: 'past' })],
    ['listEvents (topic)', () => events.listEvents({ topic: 'wetlands', when: 'all' })],
    ['getUpcomingEvents', () => events.getUpcomingEvents()],
    ['getEventFacets', () => events.getEventFacets()],
    ['getUpcomingEventsForTopic', () => events.getUpcomingEventsForTopic('wetlands')],
    ['getUpcomingEventsForCommittee', () => events.getUpcomingEventsForCommittee(aCommittee)],

    ['listCommittees', () => committees.listCommittees()],
    ['getCommitteeBySlug', () => committees.getCommitteeBySlug(aCommittee)],

    ['listLegislators', () => legislators.listLegislators()],
    ['getLegislatorBySlug', () => legislators.getLegislatorBySlug(aLegislator)],
  ];

  // safeQuery reports failures through console.error; capturing them is the only
  // way to tell "empty database" apart from "broken query".
  const originalError = console.error;
  let failures: string[] = [];
  console.error = (...args: unknown[]) => {
    failures.push(args.map(String).join(' '));
  };

  const broken: { name: string; reason: string }[] = [];

  for (const [name, run] of checks) {
    failures = [];
    let outcome: string;

    try {
      const result = await run();
      outcome = describe(result);
    } catch (error) {
      outcome = `threw: ${(error as Error).message}`;
      failures.push(outcome);
    }

    if (failures.length > 0) {
      broken.push({ name, reason: failures.join(' | ') });
      originalError(`FAIL  ${name}\n      ${failures.join('\n      ')}`);
    } else {
      console.log(`ok    ${name}  ${outcome}`);
    }
  }

  console.error = originalError;
  await closeDb();

  console.log('');
  if (broken.length > 0) {
    console.log(`${broken.length} of ${checks.length} queries failed.`);
    process.exitCode = 1;
  } else {
    console.log(`All ${checks.length} queries executed cleanly.`);
  }
}

function describe(result: unknown): string {
  if (result === null || result === undefined) return '(no row)';
  if (Array.isArray(result)) return `${result.length} row(s)`;
  if (typeof result === 'object' && 'items' in result && Array.isArray(result.items)) {
    return `${result.items.length} row(s)`;
  }
  return '1 row';
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
