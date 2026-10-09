import { eq } from 'drizzle-orm';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { sessions, settings, users } from '#lib/server/db/schema.js';
import type { Database } from '#lib/server/db/types.js';
import { createTestDatabase, resetTestDatabase } from '#lib/server/testing/database.js';
import {
	createSession,
	generateSessionToken,
	invalidateUserSessions,
	validateSessionToken
} from './session';

const DAY_MS = 86_400_000;
let db: Database;
let userId: string;

beforeAll(async () => {
	db = await createTestDatabase();
});

beforeEach(async () => {
	await resetTestDatabase(db);
	const [user] = await db
		.insert(users)
		.values({ username: 'marie', fullName: 'Marie Tchamda', passwordHash: 'x' })
		.returning({ id: users.id });
	userId = user.id;
});

describe('sessions', () => {
	it('lasts the duration set by the admin, 7 days by default (EF-AUT-02)', async () => {
		const now = new Date('2026-10-09T08:00:00Z');
		const { expiresAt } = await createSession(db, userId, generateSessionToken(), now);
		expect(expiresAt.getTime() - now.getTime()).toBe(7 * DAY_MS);

		await db.update(settings).set({ sessionDurationDays: 2 });
		const shorter = await createSession(db, userId, generateSessionToken(), now);
		expect(shorter.expiresAt.getTime() - now.getTime()).toBe(2 * DAY_MS);
	});

	it('stores only a hash of the token', async () => {
		const token = generateSessionToken();
		await createSession(db, userId, token);
		const [row] = await db.select({ tokenHash: sessions.tokenHash }).from(sessions);
		expect(row.tokenHash).not.toContain(token);
		expect(row.tokenHash).toMatch(/^[0-9a-f]{64}$/);
	});

	it('returns the user without any password data', async () => {
		const token = generateSessionToken();
		await createSession(db, userId, token);
		const session = await validateSessionToken(db, token);
		expect(session?.user).toEqual({
			id: userId,
			username: 'marie',
			fullName: 'Marie Tchamda',
			isAdmin: false,
			isChef: false,
			participatesInReports: true,
			mustChangePassword: true
		});
	});

	it('rejects an unknown token', async () => {
		expect(await validateSessionToken(db, generateSessionToken())).toBeNull();
	});

	it('rejects and deletes an expired session', async () => {
		const token = generateSessionToken();
		const now = new Date();
		await createSession(db, userId, token, now);
		expect(await validateSessionToken(db, token, new Date(now.getTime() + 7 * DAY_MS))).toBeNull();
		expect(await db.select().from(sessions)).toHaveLength(0);
	});

	it('extends a session used during the second half of its life', async () => {
		const token = generateSessionToken();
		const now = new Date();
		await createSession(db, userId, token, now);

		const early = await validateSessionToken(db, token, new Date(now.getTime() + DAY_MS));
		expect(early?.renewed).toBe(false);

		const lateNow = new Date(now.getTime() + 5 * DAY_MS);
		const late = await validateSessionToken(db, token, lateNow);
		expect(late?.renewed).toBe(true);
		expect(late?.expiresAt.getTime()).toBe(lateNow.getTime() + 7 * DAY_MS);
	});

	it('rejects the session of a deactivated account (RG-12)', async () => {
		const token = generateSessionToken();
		await createSession(db, userId, token);
		await db.update(users).set({ active: false }).where(eq(users.id, userId));
		expect(await validateSessionToken(db, token)).toBeNull();
	});

	it('can sign a user out everywhere except on the current device', async () => {
		const current = generateSessionToken();
		const other = generateSessionToken();
		const { sessionId } = await createSession(db, userId, current);
		await createSession(db, userId, other);

		await invalidateUserSessions(db, userId, { exceptSessionId: sessionId });

		expect(await validateSessionToken(db, current)).not.toBeNull();
		expect(await validateSessionToken(db, other)).toBeNull();
	});
});
