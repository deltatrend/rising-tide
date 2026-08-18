/**
 * Loads development fixtures into the database.
 *
 * Fixtures exist so the interface can be built and reviewed without spending
 * LegiScan quota. Every row created here is flagged `is_fixture`, which the UI
 * labels visibly, and the script refuses to run against a production
 * deployment unless explicitly forced.
 *
 * Usage:
 *   npm run db:seed-fixtures
 *   npm run db:seed-fixtures -- --clean     remove fixtures instead of adding
 */

import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local', quiet: true });
loadEnv({ path: '.env', quiet: true });

const args = process.argv.slice(2);
const clean = args.includes('--clean');
const force = args.includes('--force');

function assertNotProduction(): void {
  const onVercel = Boolean(process.env.VERCEL);
  const isProduction =
    process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';

  if ((onVercel || isProduction) && !force) {
    throw new Error(
      'Refusing to seed fixtures into a production environment. ' +
        'Fixtures are sample data and must never appear on the public site. ' +
        'Pass --force only if you are certain this database is disposable.',
    );
  }
}

async function main(): Promise<void> {
  assertNotProduction();

  const { classifyBill, resolveTracking } = await import('../lib/classification');
  const { getDb, closeDb } = await import('../lib/db/client');
  const { bills } = await import('../lib/db/schema');
  const {
    fixtureBills,
    fixtureRollCalls,
    fixtureSession,
    FIXTURE_BILL_IDS,
  } = await import('../lib/fixtures/legiscan');
  const {
    loadPeopleIdMap,
    persistBill,
    persistIndividualVotes,
    upsertSession,
  } = await import('../lib/sync/persist');
  const { normalizeBillCommittee } = await import('../lib/legiscan/schemas');
  const { inArray } = await import('drizzle-orm');

  const db = getDb();

  if (clean) {
    // Cascades remove actions, sponsors, votes, topics and event links.
    const removed = await db
      .delete(bills)
      .where(inArray(bills.legiscanBillId, FIXTURE_BILL_IDS))
      .returning({ id: bills.id });

    console.log(`Removed ${removed.length} fixture bills.`);
    await closeDb();
    return;
  }

  const session = await upsertSession(db, fixtureSession());
  console.log(`Fixture session: ${session.label}`);

  const payloads = fixtureBills();
  let tracked = 0;

  for (const payload of payloads) {
    const classification = await classifyBill({
      billNumber: payload.bill_number,
      title: payload.title,
      description: payload.description,
      subjects: payload.subjects.filter((s) => s.subject_name).map((s) => s.subject_name!),
      committeeName: normalizeBillCommittee(payload.committee)?.name ?? null,
    });

    const tracking = resolveTracking(classification);
    if (tracking.isTracked) tracked += 1;

    const result = await persistBill(db, {
      payload,
      classification,
      session,
      isTracked: tracking.isTracked,
      isFixture: true,
    });

    console.log(
      `  ${payload.bill_number.padEnd(6)} score ${String(classification.score).padStart(3)} ` +
        `${tracking.isTracked ? 'tracked' : 'not tracked'} — ${classification.reason}`,
    );

    // Individual member votes, so the vote roster has something to render.
    const rollCalls = fixtureRollCalls().filter((rc) => rc.bill_id === payload.bill_id);

    for (const rollCall of rollCalls) {
      const stored = result.rollCallSummaries.find(
        (s) => s.legiscanRollCallId === rollCall.roll_call_id,
      );
      if (!stored) continue;

      const peopleMap = await loadPeopleIdMap(
        db,
        rollCall.votes.map((v) => v.people_id),
      );
      await persistIndividualVotes(db, stored.rollCallId, rollCall, peopleMap);
    }
  }

  console.log(
    `\nSeeded ${payloads.length} fixture bills (${tracked} tracked). ` +
      'All are labelled as sample data in the interface.',
  );
  console.log('Remove them with: npm run db:seed-fixtures -- --clean');

  await closeDb();
}

main().catch(async (error) => {
  console.error('Fixture seeding failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
