import { eq, sql } from 'drizzle-orm';
import { normalizeUsername } from '#lib/domain/users.js';
import { recordAudit } from '#lib/server/audit.js';
import { users } from '#lib/server/db/schema.js';
import type { Database } from '#lib/server/db/types.js';
import { unusablePasswordHash, verifyAgainstDummyHash, verifyPassword } from './password';

/** EF-AUT-05: five consecutive failures lock the account for fifteen minutes. */
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_MINUTES = 15;

export type LoginResult =
	| { ok: true; userId: string; mustChangePassword: boolean }
	| { ok: false; reason: 'invalid_credentials' }
	| { ok: false; reason: 'locked'; lockedUntil: Date };

const INVALID_CREDENTIALS: LoginResult = { ok: false, reason: 'invalid_credentials' };

/**
 * Checks a username and password (EF-AUT-01). Unknown username, wrong password and
 * deactivated account (RG-12) give the same answer, so the form does not reveal which
 * accounts exist.
 */
export async function authenticate(
	db: Database,
	username: string,
	password: string,
	now = new Date()
): Promise<LoginResult> {
	const [user] = await db
		.select({
			id: users.id,
			passwordHash: users.passwordHash,
			active: users.active,
			mustChangePassword: users.mustChangePassword,
			lockedUntil: users.lockedUntil
		})
		.from(users)
		.where(eq(users.username, normalizeUsername(username)));

	if (!user) {
		await verifyAgainstDummyHash(password);
		return INVALID_CREDENTIALS;
	}

	// No verification while locked: the lock must actually stop guessing.
	if (user.lockedUntil && user.lockedUntil > now) {
		return { ok: false, reason: 'locked', lockedUntil: user.lockedUntil };
	}

	const passwordMatches = await verifyPassword(user.passwordHash, password);
	if (!user.active) return INVALID_CREDENTIALS;
	if (!passwordMatches) return recordFailedAttempt(db, user.id, now);

	await db
		.update(users)
		.set({
			failedAttempts: 0,
			lockedUntil: null,
			// RG-14: a temporary password works once. The session just opened only gives
			// access to the password change page.
			...(user.mustChangePassword ? { passwordHash: await unusablePasswordHash() } : {})
		})
		.where(eq(users.id, user.id));

	return { ok: true, userId: user.id, mustChangePassword: user.mustChangePassword };
}

async function recordFailedAttempt(db: Database, userId: string, now: Date): Promise<LoginResult> {
	const lockUntil = new Date(now.getTime() + LOCKOUT_MINUTES * 60_000);
	// One statement: concurrent failures cannot overwrite each other's count.
	const reachesLimit = sql`${users.failedAttempts} + 1 >= ${MAX_FAILED_ATTEMPTS}`;
	const [updated] = await db
		.update(users)
		.set({
			failedAttempts: sql`case when ${reachesLimit} then 0 else ${users.failedAttempts} + 1 end`,
			lockedUntil: sql`case when ${reachesLimit} then ${lockUntil.toISOString()}::timestamptz else ${users.lockedUntil} end`
		})
		.where(eq(users.id, userId))
		.returning({ lockedUntil: users.lockedUntil });

	if (updated?.lockedUntil && updated.lockedUntil > now) {
		await recordAudit(db, {
			actorId: null,
			action: 'user.locked',
			entity: 'user',
			entityId: userId,
			details: { failedAttempts: MAX_FAILED_ATTEMPTS, lockedUntil: updated.lockedUntil }
		});
		return { ok: false, reason: 'locked', lockedUntil: updated.lockedUntil };
	}
	return INVALID_CREDENTIALS;
}
