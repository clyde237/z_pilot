import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import type * as schema from './schema';

/**
 * Any Drizzle handle on the Z_Pilot schema: the application pool, a transaction, or the
 * in-memory database of the tests. Services take it as a parameter instead of importing
 * the pool, so the same code runs in production and against PGlite.
 */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;
