import { eq } from 'drizzle-orm';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { auditLog, users } from '#lib/server/db/schema.js';
import type { Database } from '#lib/server/db/types.js';
import { createTestDatabase, resetTestDatabase } from '#lib/server/testing/database.js';
import { LOCKOUT_MINUTES, MAX_FAILED_ATTEMPTS, authenticate } from './login';
import { hashPassword } from './password';

let db: Database;
let userId: string;
const PASSWORD = 'correct horse battery';

beforeAll(async () => {
	db = await createTestDatabase();
});

beforeEach(async () => {
	await resetTestDatabase(db);
	const [user] = await db
		.insert(users)
		.values({
			username: 'marie',
			fullName: 'Marie Tchamda',
			passwordHash: await hashPassword(PASSWORD),
			mustChangePassword: false
		})
		.returning({ id: users.id });
	userId = user.id;
});

async function failTimes(count: number, now = new Date()) {
	for (let attempt = 0; attempt < count; attempt++) await authenticate(db, 'marie', 'wrong', now);
}

describe('authenticate', () => {
	it('accepts the right password, whatever the case and spaces of the username', async () => {
		expect(await authenticate(db, '  Marie ', PASSWORD)).toEqual({
			ok: true,
			userId,
			mustChangePassword: false
		});
	});

	it('gives the same answer for an unknown user, a wrong password and a deactivated account', async () => {
		const invalid = { ok: false, reason: 'invalid_credentials' };
		expect(await authenticate(db, 'nobody', PASSWORD)).toEqual(invalid);
		expect(await authenticate(db, 'marie', 'wrong')).toEqual(invalid);
		await db.update(users).set({ active: false }).where(eq(users.id, userId));
		expect(await authenticate(db, 'marie', PASSWORD)).toEqual(invalid);
	});

	it(`locks the account for ${LOCKOUT_MINUTES} minutes after ${MAX_FAILED_ATTEMPTS} consecutive failures (EF-AUT-05)`, async () => {
		const now = new Date();
		await failTimes(MAX_FAILED_ATTEMPTS - 1, now);
		const fifth = await authenticate(db, 'marie', 'wrong', now);

		expect(fifth).toMatchObject({ ok: false, reason: 'locked' });
		if (fifth.ok || fifth.reason !== 'locked') throw new Error('unreachable');
		expect(fifth.lockedUntil.getTime()).toBe(now.getTime() + LOCKOUT_MINUTES * 60_000);
		// Even the right password is refused while locked.
		expect(await authenticate(db, 'marie', PASSWORD, now)).toMatchObject({ reason: 'locked' });

		const [entry] = await db.select().from(auditLog).where(eq(auditLog.action, 'user.locked'));
		expect(entry).toMatchObject({ userId: null, entityId: userId });
	});

	it('accepts the right password again once the lock has expired', async () => {
		const now = new Date();
		await failTimes(MAX_FAILED_ATTEMPTS, now);
		const later = new Date(now.getTime() + LOCKOUT_MINUTES * 60_000 + 1);
		expect(await authenticate(db, 'marie', PASSWORD, later)).toMatchObject({ ok: true });
	});

	it('only counts consecutive failures: a success resets the counter', async () => {
		await failTimes(MAX_FAILED_ATTEMPTS - 1);
		await authenticate(db, 'marie', PASSWORD);
		await failTimes(MAX_FAILED_ATTEMPTS - 1);
		expect(await authenticate(db, 'marie', PASSWORD)).toMatchObject({ ok: true });
	});

	it('accepts a temporary password only once (RG-14)', async () => {
		await db
			.update(users)
			.set({ passwordHash: await hashPassword('Temp-Pass-1234'), mustChangePassword: true })
			.where(eq(users.id, userId));

		expect(await authenticate(db, 'marie', 'Temp-Pass-1234')).toEqual({
			ok: true,
			userId,
			mustChangePassword: true
		});
		expect(await authenticate(db, 'marie', 'Temp-Pass-1234')).toEqual({
			ok: false,
			reason: 'invalid_credentials'
		});
	});
});
