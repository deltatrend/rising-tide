/**
 * The pooled-connection wrapper is the difference between a page that renders
 * and a server that stops answering, so its contract is pinned here: one
 * connection per statement, always released, and never executed twice.
 */

import { describe, expect, it } from 'vitest';

import { reserveConnectionPerStatement } from '@/lib/db/reserve';

interface Reservation {
  released: boolean;
  statements: string[];
}

/** A stand-in for postgres.js that records how connections are used. */
function fakeSql(options: { poolSize?: number } = {}) {
  const poolSize = options.poolSize ?? 1;
  const reservations: Reservation[] = [];
  let inUse = 0;
  let peakInUse = 0;
  const waiting: (() => void)[] = [];

  const sql = {
    async reserve() {
      if (inUse >= poolSize) {
        await new Promise<void>((resolve) => waiting.push(resolve));
      }
      inUse += 1;
      peakInUse = Math.max(peakInUse, inUse);

      const reservation: Reservation = { released: false, statements: [] };
      reservations.push(reservation);

      return {
        unsafe(query: string) {
          reservation.statements.push(query);
          const result = Promise.resolve([{ query }]);
          return Object.assign(result, {
            values: () => Promise.resolve([[query]]),
          });
        },
        release() {
          reservation.released = true;
          inUse -= 1;
          waiting.shift()?.();
        },
      };
    },
    unsafe() {
      throw new Error('statements must run on a reserved connection');
    },
    someOtherProperty: 'passthrough',
  };

  return {
    sql: sql as never,
    reservations,
    peakInUse: () => peakInUse,
  };
}

describe('reserveConnectionPerStatement', () => {
  it('runs a statement on its own connection and releases it', async () => {
    const fake = fakeSql();
    const wrapped = reserveConnectionPerStatement(fake.sql);

    const rows = (await wrapped.unsafe('select 1', [])) as { query: string }[];

    expect(rows).toEqual([{ query: 'select 1' }]);
    expect(fake.reservations).toHaveLength(1);
    expect(fake.reservations[0]?.released).toBe(true);
  });

  it('supports the array form Drizzle uses for joined selects', async () => {
    const fake = fakeSql();
    const wrapped = reserveConnectionPerStatement(fake.sql);

    const rows = await wrapped.unsafe('select 2', []).values();

    expect(rows).toEqual([['select 2']]);
    expect(fake.reservations[0]?.released).toBe(true);
  });

  it('never sends two statements down the same connection at once', async () => {
    // One connection, six parallel statements: the shape that deadlocks when
    // statements are pipelined instead of queued.
    const fake = fakeSql({ poolSize: 1 });
    const wrapped = reserveConnectionPerStatement(fake.sql);

    await Promise.all(
      Array.from({ length: 6 }, (_, i) => wrapped.unsafe(`select ${i}`, [])),
    );

    expect(fake.peakInUse()).toBe(1);
    expect(fake.reservations).toHaveLength(6);
    expect(fake.reservations.every((r) => r.released)).toBe(true);
    expect(fake.reservations.every((r) => r.statements.length === 1)).toBe(true);
  });

  it('releases the connection when a statement fails', async () => {
    const reservations: Reservation[] = [];
    const sql = {
      async reserve() {
        const reservation: Reservation = { released: false, statements: [] };
        reservations.push(reservation);
        return {
          unsafe() {
            return Promise.reject(new Error('syntax error'));
          },
          release() {
            reservation.released = true;
          },
        };
      },
    } as never;

    const wrapped = reserveConnectionPerStatement(sql);

    await expect(wrapped.unsafe('select bad', [])).rejects.toThrow('syntax error');
    expect(reservations[0]?.released).toBe(true);
  });

  it('executes a statement once even if its result is read twice', async () => {
    const fake = fakeSql();
    const wrapped = reserveConnectionPerStatement(fake.sql);

    const pending = wrapped.unsafe('select 3', []);
    await Promise.all([pending, pending]);

    expect(fake.reservations).toHaveLength(1);
  });

  it('leaves the rest of the client untouched', () => {
    const fake = fakeSql();
    const wrapped = reserveConnectionPerStatement(fake.sql) as unknown as {
      someOtherProperty: string;
    };

    expect(wrapped.someOtherProperty).toBe('passthrough');
  });
});
