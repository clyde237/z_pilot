import { PGlite } from '@electric-sql/pglite';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { fileURLToPath } from 'node:url';
import * as schema from '#lib/server/db/schema.js';
import type { Database } from '#lib/server/db/types.js';

const MIGRATIONS_FOLDER = fileURLToPath(new URL('../../../../drizzle', import.meta.url));

/**
 * In-memory PostgreSQL with the real migrations applied: constraints, unique indexes
 * and row locks behave as in production.
 */
export async function createTestDatabase(): Promise<Database> {
	const db = drizzle({ client: new PGlite(), schema });
	await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
	return db;
}

/** Empties every table except the single settings row created by the migrations. */
export async function resetTestDatabase(db: Database): Promise<void> {
	await db.execute(
		sql`truncate audit_log, notifications, monthly_reports, weekly_reports, week_entries, tasks, sessions, users`
	);
	await db.execute(sql`update settings set session_duration_days = 7`);
}
