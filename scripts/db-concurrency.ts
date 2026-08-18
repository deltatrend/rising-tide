/**
 * Explores how the driver behaves when a page fires several queries at once
 * against Supabase's transaction pooler, which is the shape of every render.
 *
 * Each scenario gets a hard deadline so a hang is reported instead of blocking
 * the run.
 *
 *   npm run db:concurrency
 */

import { config } from 'dotenv';

config({ path: '.env.local', quiet: true });

const DEADLINE_MS = 10_000;
const PARALLEL = 6;

type Options = Record<string, unknown>;

async function withDeadline<T>(promise: Promise<T>, label: string): Promise<T | string> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<string>((resolve) => {
    timer = setTimeout(() => resolve(`HUNG (>${DEADLINE_MS}ms) — ${label}`), DEADLINE_MS);
  });
  try {
    return await Promise.race([promise, deadline]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function scenario(
  name: string,
  options: Options,
  sequential = false,
  reserve = false,
): Promise<void> {
  const { default: postgres } = await import('postgres');
  const sql = postgres(process.env.DATABASE_URL!, {
    ssl: 'require',
    connect_timeout: 15,
    onnotice: () => {},
    ...options,
  });

  const one = async (): Promise<void> => {
    if (!reserve) {
      await sql`select count(*)::int from bills where is_tracked = true`;
      return;
    }
    const held = await sql.reserve();
    try {
      await held`select count(*)::int from bills where is_tracked = true`;
    } finally {
      held.release();
    }
  };

  const burst = async (): Promise<string> => {
    const started = Date.now();
    if (sequential) {
      for (let i = 0; i < PARALLEL; i += 1) await one();
    } else {
      await Promise.all(Array.from({ length: PARALLEL }, () => one()));
    }
    return `${Date.now() - started}ms`;
  };

  const cold = await withDeadline(burst(), 'cold burst');
  const warm = typeof cold === 'string' && cold.startsWith('HUNG')
    ? 'skipped'
    : await withDeadline(burst(), 'warm burst');
  const third = warm === 'skipped' || String(warm).startsWith('HUNG')
    ? 'skipped'
    : await withDeadline(burst(), 'third burst');

  console.log(`${name.padEnd(38)} cold ${String(cold).padEnd(22)} warm ${String(warm).padEnd(22)} third ${third}`);

  await sql.end({ timeout: 1 }).catch(() => {});
}

async function main(): Promise<void> {
  console.log(`${PARALLEL} queries per burst, ${DEADLINE_MS}ms deadline`);
  console.log('');

  await scenario('max=3, prepare=false, parallel', { max: 3, prepare: false, idle_timeout: 10 });
  await scenario('max=6, prepare=false, parallel', { max: 6, prepare: false, idle_timeout: 10 });
  await scenario('max=1, prepare=false, parallel', { max: 1, prepare: false, idle_timeout: 10 });
  await scenario('max=3, prepare=true,  parallel', { max: 3, prepare: true, idle_timeout: 10 });
  await scenario('max=3, prepare=false, sequential', { max: 3, prepare: false, idle_timeout: 10 }, true);
  await scenario('max=3, no idle_timeout, parallel', { max: 3, prepare: false });
  await scenario(
    'max=3, reserve per statement, parallel',
    { max: 3, prepare: false, idle_timeout: 10 },
    false,
    true,
  );
  await scenario(
    'max=1, reserve per statement, parallel',
    { max: 1, prepare: false, idle_timeout: 10 },
    false,
    true,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
