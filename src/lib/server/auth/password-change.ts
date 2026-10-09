import { and, eq } from 'drizzle-orm';
import { recordAudit } from '#lib/server/audit.js';
import { users } from '#lib/server/db/schema.js';
import type { Database } from '#lib/server/db/types.js';
import { hashPassword, verifyPassword } from './password';
import { invalidateUserSessions } from './session';

export type PasswordChangeResult = { ok: true } | { ok: false; reason: 'wrong_current_password' };

/**
 * First password after sign-in with a temporary one (EF-AUT-03). The temporary password
 * was consumed at sign-in, so the current session is the proof of identity.
 */
export async function setInitialPassword(
	db: Database,
	userId: string,
	sessionId: string,
	newPassword: string
): Promise<void> {
	const passwordHash = await hashPassword(newPassword);
	await db.transaction(async (tx) => {
		const [updated] = await tx
			.update(users)
			.set({ passwordHash, mustChangePassword: false })
			.where(and(eq(users.id, userId), eq(users.mustChangePassword, true)))
			.returning({ id: users.id });
		// Already changed, e.g. in another tab: nothing to do.
		if (!updated) return;

		await invalidateUserSessions(tx, userId, { exceptSessionId: sessionId });
		await recordAudit(tx, {
			actorId: userId,
			action: 'user.password_changed',
			entity: 'user',
			entityId: userId,
			details: { reason: 'initial' }
		});
	});
}

/** Change from the profile page (EF-AUT-04). Other devices are signed out. */
export async function changePassword(
	db: Database,
	userId: string,
	sessionId: string,
	currentPassword: string,
	newPassword: string
): Promise<PasswordChangeResult> {
	const [user] = await db
		.select({ passwordHash: users.passwordHash })
		.from(users)
		.where(eq(users.id, userId));
	if (!user || !(await verifyPassword(user.passwordHash, currentPassword))) {
		return { ok: false, reason: 'wrong_current_password' };
	}

	const passwordHash = await hashPassword(newPassword);
	await db.transaction(async (tx) => {
		await tx.update(users).set({ passwordHash }).where(eq(users.id, userId));
		await invalidateUserSessions(tx, userId, { exceptSessionId: sessionId });
		await recordAudit(tx, {
			actorId: userId,
			action: 'user.password_changed',
			entity: 'user',
			entityId: userId,
			details: { reason: 'profile' }
		});
	});
	return { ok: true };
}
