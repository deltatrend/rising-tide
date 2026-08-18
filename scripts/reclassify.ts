/**
 * Re-runs the water-relevance classifier over stored LegiScan payloads.
 * Uses zero LegiScan queries. Run this after editing config/water-taxonomy.ts.
 *
 * Usage: npm run classify:rerun
 */

import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local', quiet: true });
loadEnv({ path: '.env', quiet: true });

async function main(): Promise<void> {
  const { getDb, closeDb } = await import('../lib/db/client');
  const { reclassifyStoredBills } = await import('../lib/sync/reclassify');
  const { CLASSIFIER_VERSION } = await import('../config/water-taxonomy');

  console.log('');
  console.log(`Reclassifying stored bills with ${CLASSIFIER_VERSION} (0 LegiScan queries).`);
  console.log('');

  const result = await reclassifyStoredBills(getDb(), {
    logger: (message) => console.log(`  ${message}`),
  });

  console.log('');
  console.log('─'.repeat(48));
  console.log(`Examined            ${result.examined}`);
  console.log(`Updated             ${result.updated}`);
  console.log(`Newly tracked       ${result.nowTracked}`);
  console.log(`No longer tracked   ${result.noLongerTracked}`);
  console.log(`Unparseable         ${result.unparseable}`);
  console.log('─'.repeat(48));

  if (result.errors.length > 0) {
    console.log('');
    for (const error of result.errors.slice(0, 20)) {
      console.log(`  • [${error.stage}] ${error.subject ?? ''} ${error.message}`);
    }
  }

  console.log('');
  await closeDb();
}

main().catch(async (error) => {
  console.error('Reclassification failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
