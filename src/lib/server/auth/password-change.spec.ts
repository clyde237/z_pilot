import { eq } from 'drizzle-orm';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { users } from '#lib/server/db/schema.js';
import type { Database } from '#lib/server/db/types.js';
import { createTestDatabase, resetTestDatabase } from '#lib/server/testing/database.js';
import { authenticate } from './login';
import { hashPassword } from './password';
import { changePassword, setInitialPassword } from './password-change';
import { createSession, generateSessionToken, validateSessionToken } from './session';

let db: Database;
let userId: string;

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
			passwordHash: await hashPassword('old-password'),
			mustChangePassword: false
		})
		.returning({ id: users.id });
	userId = user.id;
});

async function openSession() {
	const token = generateSessionToken();
	const { sessionId } = await createSession(db, userId, token);
	return { token, sessionId };
}

describe('setInitialPassword', () => {
	it('sets the password, lifts the forced change and signs out the other devices', async () => {
		await db.update(users).set({ mustChangePassword: true }).where(eq(users.id, userId));
		const current = await openSession();
		const other = await openSession();

		await setInitialPassword(db, userId, current.sessionId, 'brand-new-password');

		expect(await authenticate(db, 'marie', 'brand-new-password')).toMatchObject({
			ok: true,
			mustChangePassword: false
		});
		expect(await validateSessionToken(db, current.token)).not.toBeNull();
		expect(await validateSessionToken(db, other.token)).toBeNull();
	});

	it('does nothing when no change is pending', async () => {
		const { sessionId } = await openSession();
		await setInitialPassword(db, userId, sessionId, 'brand-new-password');
		expect(await authenticate(db, 'marie', 'old-password')).toMatchObject({ ok: true });
	});
});

describe('changePassword', () => {
	it('requires the current password (EF-AUT-04)', async () => {
		const { sessionId } = await openSession();
		expect(await changePassword(db, userId, sessionId, 'not-it', 'brand-new-password')).toEqual({
			ok: false,
			reason: 'wrong_current_password'
		});
		expect(await authenticate(db, 'marie', 'old-password')).toMatchObject({ ok: true });
	});

	it('replaces the password and signs out the other devices', async () => {
		const current = await openSession();
		const other = await openSession();

		expect(
			await changePassword(db, userId, current.sessionId, 'old-password', 'brand-new-password')
		).toEqual({ ok: true });

		expect(await authenticate(db, 'marie', 'old-password')).toMatchObject({ ok: false });
		expect(await authenticate(db, 'marie', 'brand-new-password')).toMatchObject({ ok: true });
		expect(await validateSessionToken(db, current.token)).not.toBeNull();
		expect(await validateSessionToken(db, other.token)).toBeNull();
	});
});
