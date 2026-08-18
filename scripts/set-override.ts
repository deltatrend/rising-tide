/**
 * Manually include or exclude a bill, overriding the classifier.
 *
 * Automatic rules get things wrong in both directions. An override is a
 * deliberate, attributed, reversible decision: it stores a written reason and a
 * timestamp, it is shown on the bill page, and clearing it keeps the audit
 * trail rather than deleting the record.
 *
 * Usage:
 *   npm run override -- --bill S1001 --include --reason "Water main funding"
 *   npm run override -- --bill S5590 --exclude --reason "Corporate finance, not water"
 *   npm run override -- --bill S5590 --clear   --reason "Classifier corrected"
 *   npm run override -- --list
 */

import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local', quiet: true });
loadEnv({ path: '.env', quiet: true });

interface Args {
  bill?: string;
  reason?: string;
  decision?: 'include' | 'exclude';
  clear: boolean;
  list: boolean;
  author?: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { clear: false, list: false };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    switch (token) {
      case '--bill':
        args.bill = argv[++i];
        break;
      case '--reason':
        args.reason = argv[++i];
        break;
      case '--author':
        args.author = argv[++i];
        break;
      case '--include':
        args.decision = 'include';
        break;
      case '--exclude':
        args.decision = 'exclude';
        break;
      case '--clear':
        args.clear = true;
        break;
      case '--list':
        args.list = true;
        break;
      default:
        break;
    }
  }

  return args;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const { getDb, closeDb } = await import('../lib/db/client');
  const { bills, classificationOverrides } = await import('../lib/db/schema');
  const { and, eq, isNull, sql } = await import('drizzle-orm');

  const db = getDb();

  if (args.list) {
    const rows = await db
      .select({
        billNumber: bills.billNumber,
        slug: bills.slug,
        decision: classificationOverrides.decision,
        reason: classificationOverrides.reason,
        createdAt: classificationOverrides.createdAt,
        clearedAt: classificationOverrides.clearedAt,
      })
      .from(classificationOverrides)
      .innerJoin(bills, eq(bills.id, classificationOverrides.billId));

    if (rows.length === 0) {
      console.log('No overrides recorded.');
    } else {
      for (const row of rows) {
        console.log(
          `${row.billNumber.padEnd(8)} ${row.decision.padEnd(8)} ` +
            `${row.clearedAt ? 'cleared ' : 'active  '} ${row.createdAt.toISOString().slice(0, 10)}  ${row.reason}`,
        );
      }
    }

    await closeDb();
    return;
  }

  if (!args.bill) throw new Error('Missing --bill. Example: --bill S1001');
  if (!args.reason) throw new Error('Missing --reason. Every override must be justified.');
  if (!args.clear && !args.decision) {
    throw new Error('Specify --include, --exclude or --clear.');
  }

  const billNumber = args.bill.toUpperCase().replace(/\s+/g, '');

  const [bill] = await db
    .select({ id: bills.id, billNumber: bills.billNumber, slug: bills.slug })
    .from(bills)
    .where(sql`upper(replace(${bills.billNumber}, ' ', '')) = ${billNumber}`)
    .limit(1);

  if (!bill) {
    throw new Error(
      `No stored bill matches ${billNumber}. Run the sync first, or check the bill number.`,
    );
  }

  if (args.clear) {
    const cleared = await db
      .update(classificationOverrides)
      .set({ clearedAt: new Date(), clearedReason: args.reason })
      .where(
        and(
          eq(classificationOverrides.billId, bill.id),
          isNull(classificationOverrides.clearedAt),
        ),
      )
      .returning({ id: classificationOverrides.id });

    if (cleared.length === 0) {
      console.log(`${bill.billNumber} has no active override.`);
    } else {
      console.log(
        `Cleared the override on ${bill.billNumber}. The classifier decides again on the next run.`,
      );
      console.log('Run `npm run classify:rerun` to apply the automatic result immediately.');
    }

    await closeDb();
    return;
  }

  await db
    .insert(classificationOverrides)
    .values({
      billId: bill.id,
      decision: args.decision!,
      reason: args.reason,
      createdBy: args.author ?? null,
    })
    .onConflictDoUpdate({
      target: classificationOverrides.billId,
      set: {
        decision: args.decision!,
        reason: args.reason,
        createdBy: args.author ?? null,
        createdAt: new Date(),
        clearedAt: null,
        clearedReason: null,
      },
    });

  await db
    .update(bills)
    .set({ isTracked: args.decision === 'include' })
    .where(eq(bills.id, bill.id));

  console.log(
    `${bill.billNumber} is now ${args.decision === 'include' ? 'tracked' : 'excluded'} by manual override.`,
  );
  console.log(`Reason shown on /bills/${bill.slug}: ${args.reason}`);

  await closeDb();
}

main().catch(async (error) => {
  console.error('Override failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
