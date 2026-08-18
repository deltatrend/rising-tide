/**
 * Explicitly qualified identifiers for hand-written SQL fragments.
 *
 * Drizzle omits the table prefix when a select has a single table in its FROM
 * clause, which is harmless for ordinary columns but silently wrong inside a
 * correlated subquery: `${bills.id}` renders as `"id"`, and Postgres then
 * resolves it against the *subquery's* table — either an ambiguity error or,
 * worse, a query that runs and returns nonsense.
 *
 * Any raw fragment that reaches across tables should therefore use `col()` and
 * `tbl()` instead of interpolating the schema objects directly. Both keep the
 * compile-time link to the schema, so renaming a column is still a type error.
 */

import { getTableName, sql, type AnyColumn, type SQL, type Table } from 'drizzle-orm';

/** Renders a table name: `"bills"`. */
export function tbl(table: Table): SQL {
  return sql`${sql.identifier(getTableName(table))}`;
}

/** Renders a fully qualified column reference: `"bills"."id"`. */
export function col(column: AnyColumn): SQL {
  return sql`${sql.identifier(getTableName(column.table))}.${sql.identifier(column.name)}`;
}
