import { attachDatabasePool } from '@vercel/functions';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { DATABASE_URL } from '$app/env/private';
import * as schema from './schema';

// TCP pool reused across requests on Vercel Fluid compute (Neon's recommendation for
// Vercel). Unlike the HTTP driver, it supports interactive transactions, which the
// publication and reopening of reports require.
const pool = new Pool({ connectionString: DATABASE_URL, max: 5, idleTimeoutMillis: 5_000 });

// An idle client can lose its connection (Neon scales to zero); without this listener
// the error would crash the process.
pool.on('error', (error) => console.error('[db] idle client error', error));

// Closes idle connections before Vercel suspends the function. No-op outside Vercel.
attachDatabasePool(pool);

export const db = drizzle({ client: pool, schema });
