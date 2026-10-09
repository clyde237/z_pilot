// Creates the first administrator, since the application has no self sign-up (EF-AUT-01).
// The other accounts are then created from the administration pages.
//
//   npm run admin:create -- --username clyde --name "Clyde Fanche" --chef
//
// Prints a temporary password once; it must be changed at first sign-in (EF-AUT-03).
// Refuses to run when an active administrator already exists.

import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { parseArgs } from 'node:util';
import { Pool } from 'pg';
import { USERNAME_PATTERN, USERNAME_RULE, normalizeUsername } from '../src/lib/domain/users.ts';
import { generateTemporaryPassword, hashPassword } from '../src/lib/server/auth/password.ts';
import { auditLog, users } from '../src/lib/server/db/schema.ts';

const { values } = parseArgs({
	options: {
		username: { type: 'string' },
		name: { type: 'string' },
		// Also department head (the CDC allows one person to hold both roles).
		chef: { type: 'boolean', default: false },
		// Purely technical admin, kept out of tasks and reports (EF-USR-06).
		reports: { type: 'boolean', default: true }
	},
	allowNegative: true
});

function fail(message: string): never {
	console.error(`Error: ${message}`);
	process.exit(1);
}

const username = normalizeUsername(values.username ?? '');
const fullName = (values.name ?? '').trim();
if (!USERNAME_PATTERN.test(username)) fail(`--username: ${USERNAME_RULE}`);
if (fullName.length < 2) fail('--name is required, e.g. --name "Clyde Fanche".');
if (values.chef && !values.reports) fail('A department head always takes part in reports.');

const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!connectionString) fail('DATABASE_URL is not set (see .env.example).');

const pool = new Pool({ connectionString });
const db = drizzle({ client: pool });

try {
	const temporaryPassword = generateTemporaryPassword();
	const passwordHash = await hashPassword(temporaryPassword);

	const created = await db.transaction(async (tx) => {
		const admins = await tx
			.select({ id: users.id })
			.from(users)
			.where(and(eq(users.isAdmin, true), eq(users.active, true)))
			.for('update');
		if (admins.length > 0) return null;

		const [user] = await tx
			.insert(users)
			.values({
				username,
				fullName,
				passwordHash,
				isAdmin: true,
				isChef: values.chef,
				participatesInReports: values.reports,
				mustChangePassword: true
			})
			.returning({ id: users.id });
		await tx.insert(auditLog).values({
			userId: null,
			action: 'user.created',
			entity: 'user',
			entityId: user.id,
			details: {
				fullName,
				username,
				isAdmin: true,
				isChef: values.chef,
				participatesInReports: values.reports,
				via: 'scripts/create-admin.ts'
			}
		});
		return user;
	});

	if (!created)
		fail('An active administrator already exists: create accounts from the application.');

	console.log(`Administrator created: ${fullName} (${username})`);
	console.log(`Temporary password, shown once: ${temporaryPassword}`);
	console.log('It works for one sign-in only, then a new password is required.');
} catch (error) {
	const code = (error as { cause?: { code?: string } }).cause?.code;
	if (code === '23505') fail('This username is already taken, or another active head exists.');
	throw error;
} finally {
	await pool.end();
}
