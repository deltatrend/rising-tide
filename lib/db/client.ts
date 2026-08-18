/**
 * Database connection.
 *
 * Supabase's transaction pooler (port 6543) is what makes this app viable on
 * Vercel's serverless runtime, but transaction pooling cannot support prepared
 * statements — so they are disabled automatically when a pooled host is detected.
 * Connections are also kept to a minimum per instance, because every serverless
 * invocation opens its own.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { getDatabaseUrl, hasDatabaseUrl } from '@/lib/env';
import { reserveConnectionPerStatement } from './reserve';
import * as schema from './schema';

if (typeof window !== 'undefined') {
  throw new Error('lib/db must never be imported from client components.');
}

export type Database = ReturnType<typeof drizzle<typeof schema>>;

interface GlobalWithDb {
  __risingTideSql?: postgres.Sql;
  __risingTideDb?: Database;
}

const globalForDb = globalThis as unknown as GlobalWithDb;

/** Supabase pooled connections use port 6543 and a `pooler` hostname. */
export function isPooledConnection(url: string): boolean {
  return url.includes(':6543') || url.includes('pooler.supabase.com');
}

function createClient(): { sql: postgres.Sql; db: Database } {
  const url = getDatabaseUrl();
  const pooled = isPooledConnection(url);

  const sql = postgres(url, {
    // Required for Supabase transaction pooling: PgBouncer in transaction mode
    // cannot keep a prepared statement alive between statements.
    prepare: !pooled,
    // Small, but never one: a single connection means one slow or stuck query
    // blocks every other query in the instance.
    max: process.env.NODE_ENV === 'production' ? 3 : 5,
    // The pooler reaps idle connections on its own schedule. Closing ours first
    // avoids writing a query into a socket the other end has already dropped.
    idle_timeout: 10,
    max_lifetime: 60 * 30,
    connect_timeout: 15,
    // Supabase terminates the connection without this in some regions.
    ssl: url.includes('localhost') || url.includes('127.0.0.1') ? false : 'require',
    onnotice: () => {},
  });

  return { sql, db: drizzle(reserveConnectionPerStatement(sql), { schema }) };
}

/**
 * Returns the shared Drizzle instance, reusing it across hot reloads in
 * development so `next dev` does not exhaust the connection limit.
 */
export function getDb(): Database {
  if (!globalForDb.__risingTideDb) {
    const { sql, db } = createClient();
    globalForDb.__risingTideSql = sql;
    globalForDb.__risingTideDb = db;
  }
  return globalForDb.__risingTideDb;
}

export function getSql(): postgres.Sql {
  getDb();
  return globalForDb.__risingTideSql!;
}

export function isDatabaseConfigured(): boolean {
  return hasDatabaseUrl();
}

/** Closes the pool. Only used by CLI scripts so the process can exit. */
export async function closeDb(): Promise<void> {
  if (globalForDb.__risingTideSql) {
    await globalForDb.__risingTideSql.end({ timeout: 5 });
    globalForDb.__risingTideSql = undefined;
    globalForDb.__risingTideDb = undefined;
  }
}

/**
 * A page is allowed to be empty; it is never allowed to hang. A pooled socket
 * that the other end has quietly dropped produces a query that never settles,
 * so reads carry their own deadline.
 */
const QUERY_TIMEOUT_MS = 5_000;
const RETRY_TIMEOUT_MS = 8_000;

class QueryTimeout extends Error {}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new QueryTimeout(`timed out after ${ms}ms`)), ms);
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/**
 * Discards the shared pool so the next query builds fresh connections.
 *
 * A timed-out query is abandoned but still occupies its connection, so without
 * this a single dead socket would eventually consume the pool and every later
 * request would time out until the process restarted.
 */
function resetDb(): void {
  const stale = globalForDb.__risingTideSql;
  globalForDb.__risingTideSql = undefined;
  globalForDb.__risingTideDb = undefined;

  if (stale) {
    // Nothing waits on this: the point is to stop using the pool immediately.
    void stale.end({ timeout: 0 }).catch(() => {});
  }
}

/**
 * Runs a read query, returning a fallback if the database is unreachable, slow
 * or not configured. Public pages use this so a transient database problem
 * degrades to an empty state instead of a 500 or a stalled response.
 *
 * One timeout is retried against a rebuilt pool, because the usual cause is a
 * single stale connection rather than a database that is actually down.
 */
export async function safeQuery<T>(
  run: (db: Database) => Promise<T>,
  fallback: T,
  context = 'query',
): Promise<T> {
  if (!isDatabaseConfigured()) return fallback;

  try {
    return await withTimeout(run(getDb()), QUERY_TIMEOUT_MS);
  } catch (error) {
    if (!(error instanceof QueryTimeout)) {
      console.error(`[db] ${context} failed:`, error instanceof Error ? error.message : error);
      return fallback;
    }

    console.warn(`[db] ${context} timed out; rebuilding the connection pool and retrying once.`);
    resetDb();

    try {
      return await withTimeout(run(getDb()), RETRY_TIMEOUT_MS);
    } catch (retryError) {
      console.error(
        `[db] ${context} failed after retry:`,
        retryError instanceof Error ? retryError.message : retryError,
      );
      if (retryError instanceof QueryTimeout) resetDb();
      return fallback;
    }
  }
}

/** Distinguishes "database is empty" from "database is broken" for empty states. */
export async function checkDatabaseHealth(): Promise<{
  configured: boolean;
  reachable: boolean;
  message?: string;
}> {
  if (!isDatabaseConfigured()) {
    return { configured: false, reachable: false, message: 'DATABASE_URL is not set.' };
  }

  try {
    const sql = getSql();
    await sql`select 1 as ok`;
    return { configured: true, reachable: true };
  } catch (error) {
    return {
      configured: true,
      reachable: false,
      message: error instanceof Error ? error.message : 'Unknown database error',
    };
  }
}
