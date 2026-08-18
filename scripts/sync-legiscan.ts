/**
 * Runs the LegiScan synchronization from the command line.
 *
 * This calls exactly the same service the Vercel cron route calls — there is no
 * second ingestion implementation to drift out of sync.
 *
 * Usage:
 *   npm run sync:legiscan                 normal run with safe defaults
 *   npm run sync:legiscan:dry             discovery only, no writes, no detail fetches
 *   npm run sync:legiscan -- --max-bills=25
 *   npm run sync:legiscan -- --bill=1234567
 *   npm run sync:legiscan -- --max-docs=0 disable document caching for this run
 */

import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local', quiet: true });
loadEnv({ path: '.env', quiet: true });

interface CliArgs {
  dryRun: boolean;
  maxQueries?: number;
  maxBills?: number;
  maxRollCalls?: number;
  maxDocuments?: number;
  onlyBillIds?: number[];
  quiet: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { dryRun: false, quiet: false };

  for (const arg of argv) {
    if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--quiet') args.quiet = true;
    else if (arg.startsWith('--max-queries=')) args.maxQueries = Number(arg.split('=')[1]);
    else if (arg.startsWith('--max-bills=')) args.maxBills = Number(arg.split('=')[1]);
    else if (arg.startsWith('--max-rollcalls=')) args.maxRollCalls = Number(arg.split('=')[1]);
    else if (arg.startsWith('--max-docs=')) args.maxDocuments = Number(arg.split('=')[1]);
    else if (arg.startsWith('--bill=')) {
      args.onlyBillIds = arg
        .split('=')[1]!
        .split(',')
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isFinite(value));
    }
  }

  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Run `npm run db:migrate` setup first.');
    process.exit(1);
  }

  if (!process.env.LEGISCAN_API_KEY && !process.env.LEGISCAN_KEY) {
    console.error('LEGISCAN_API_KEY is not set. Add it to .env.local before synchronizing.');
    process.exit(1);
  }

  const { runLegiScanSync } = await import('../lib/sync/service');
  const { closeDb } = await import('../lib/db/client');

  console.log('');
  console.log('Rising Tide — LegiScan synchronization');
  console.log(args.dryRun ? 'Mode: DRY RUN (discovery only, no writes)' : 'Mode: full run');
  console.log('');

  const result = await runLegiScanSync({
    trigger: args.dryRun ? 'dry-run' : 'manual',
    dryRun: args.dryRun,
    maxQueries: args.maxQueries,
    maxBillFetches: args.maxBills,
    maxRollCallFetches: args.maxRollCalls,
    maxDocumentFetches: args.maxDocuments,
    onlyBillIds: args.onlyBillIds,
    logger: args.quiet ? undefined : (message) => console.log(`  ${message}`),
  });

  console.log('');
  console.log('─'.repeat(64));
  console.log(`Status                 ${result.status}`);
  console.log(`Session                ${result.sessionLabel ?? 'unknown'}`);
  console.log(`Duration               ${(result.durationMs / 1000).toFixed(1)}s`);
  console.log('');
  console.log(`LegiScan queries used  ${result.queriesConsumed}`);
  console.log(`  per-run cap          ${result.queryBudget.maxQueriesPerRun}`);
  console.log(`  used this month      ${result.queryBudget.monthlyUsedBefore} before this run`);
  console.log(`  remaining this month ${result.queryBudget.monthlyRemainingAfter}`);
  console.log('');
  console.log(`Candidates discovered  ${result.candidatesDiscovered}`);
  console.log(`Bills inserted         ${result.billsInserted}`);
  console.log(`Bills updated          ${result.billsUpdated}`);
  console.log(`Bills unchanged        ${result.billsUnchanged}`);
  console.log(`Bills not water-policy ${result.billsRejected}`);
  console.log(`Roll calls updated     ${result.rollCallsUpdated}`);
  console.log(`Events upserted        ${result.eventsUpserted}`);
  console.log(`Documents fetched      ${result.documentsFetched}`);
  console.log(`Documents stored in R2 ${result.documentsStored}`);
  console.log('─'.repeat(64));

  if (result.notes.length > 0) {
    console.log('');
    console.log('Notes:');
    for (const note of result.notes) console.log(`  • ${note}`);
  }

  if (result.errors.length > 0) {
    console.log('');
    console.log(`Errors (${result.errors.length}):`);
    for (const error of result.errors.slice(0, 20)) {
      console.log(`  • [${error.stage}] ${error.subject ?? ''} ${error.message}`);
    }
  }

  console.log('');
  await closeDb();

  if (result.status === 'failed') process.exitCode = 1;
}

main().catch(async (error) => {
  console.error('Synchronization crashed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
