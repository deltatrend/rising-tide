/**
 * Statement isolation for Supabase's transaction pooler.
 *
 * postgres.js pipelines: if a statement arrives while a connection is busy, it
 * is sent down that same connection anyway. Plain Postgres copes, but the
 * transaction pooler hands each transaction to a different backend, and the
 * pipelined statements deadlock — a page that runs more queries in parallel
 * than the pool has connections then never responds at all. That failure is
 * permanent for the process, not transient, which is what makes it dangerous.
 *
 * Reserving a connection per statement makes the waiting explicit: a statement
 * either has a connection to itself or waits for one to be released.
 */

import type postgres from 'postgres';

/** The subset of postgres.js's pending query that Drizzle actually uses. */
interface PendingQuery {
  values(): Promise<unknown>;
  execute(): Promise<unknown>;
  then(onResolved?: unknown, onRejected?: unknown): Promise<unknown>;
  catch(onRejected?: unknown): Promise<unknown>;
  finally(onFinally?: () => void): Promise<unknown>;
}

/**
 * Wraps a postgres.js client so `unsafe()` — the entry point Drizzle uses for
 * every statement — runs on a reserved connection. Transactions are untouched
 * because `begin()` already holds a connection for their duration.
 */
export function reserveConnectionPerStatement(sql: postgres.Sql): postgres.Sql {
  const unsafe = (query: string, params: unknown[] = []): PendingQuery => {
    // The statement runs at most once, no matter which way its result is read.
    let inFlight: Promise<unknown> | undefined;

    const execute = (asValues: boolean): Promise<unknown> => {
      inFlight ??= (async () => {
        const held = await sql.reserve();
        try {
          const pending = held.unsafe(query, params as never[]);
          return await (asValues ? pending.values() : pending);
        } finally {
          held.release();
        }
      })();
      return inFlight;
    };

    return {
      values: () => execute(true),
      execute: () => execute(false),
      then: (onResolved?: unknown, onRejected?: unknown) =>
        execute(false).then(
          onResolved as (value: unknown) => unknown,
          onRejected as (reason: unknown) => unknown,
        ),
      catch: (onRejected?: unknown) =>
        execute(false).catch(onRejected as (reason: unknown) => unknown),
      finally: (onFinally?: () => void) => execute(false).finally(onFinally),
    };
  };

  return new Proxy(sql, {
    get(target, property, receiver) {
      if (property === 'unsafe') return unsafe;
      return Reflect.get(target, property, receiver) as unknown;
    },
  });
}
