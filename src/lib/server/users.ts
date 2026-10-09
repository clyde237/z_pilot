import { and, asc, desc, eq, ilike, or, type SQL } from 'drizzle-orm';
import type { UserFormInput, UserListFilters } from '#lib/schemas/users.js';
import { recordAudit } from '#lib/server/audit.js';
import { generateTemporaryPassword, hashPassword } from '#lib/server/auth/password.js';
import { invalidateUserSessions } from '#lib/server/auth/session.js';
import { violatedUniqueConstraint } from '#lib/server/db/errors.js';
import { users } from '#lib/server/db/schema.js';
import type { Database } from '#lib/server/db/types.js';

// Account management by an admin (CDC §3.2). Accounts are never deleted (EF-USR-02):
// reports keep pointing to their authors.

export interface AccountSummary {
	id: string;
	username: string;
	fullName: string;
	isAdmin: boolean;
	isChef: boolean;
	participatesInReports: boolean;
	active: boolean;
	mustChangePassword: boolean;
	lockedUntil: Date | null;
	createdAt: Date;
}

/** Refusal shown next to a field, or above the form when `field` is absent. */
export interface AccountError {
	field?: 'username' | 'isAdmin' | 'isChef' | 'active';
	message: string;
}

export type AccountResult<T = void> = { ok: true; value: T } | { ok: false; error: AccountError };

const summaryColumns = {
	id: users.id,
	username: users.username,
	fullName: users.fullName,
	isAdmin: users.isAdmin,
	isChef: users.isChef,
	participatesInReports: users.participatesInReports,
	active: users.active,
	mustChangePassword: users.mustChangePassword,
	lockedUntil: users.lockedUntil,
	createdAt: users.createdAt
};

const USERNAME_TAKEN: AccountError = {
	field: 'username',
	message: 'Ce nom d’utilisateur est déjà utilisé.'
};
const CHEF_TAKEN: AccountError = {
	field: 'isChef',
	message:
		'Un chef de département actif existe déjà. Retirez-lui ce rôle avant d’en désigner un autre.'
};
const LAST_ADMIN: AccountError = {
	field: 'isAdmin',
	message: 'Il doit rester au moins un administrateur actif.'
};
const NOT_FOUND: AccountError = { message: 'Ce compte n’existe pas.' };

function uniqueViolationError(error: unknown): AccountError | null {
	switch (violatedUniqueConstraint(error)) {
		case 'users_username_key':
			return USERNAME_TAKEN;
		case 'users_single_active_chef_key':
			return CHEF_TAKEN;
		default:
			return null;
	}
}

// LIKE wildcards typed by the user are searched literally.
function escapeLikePattern(value: string): string {
	return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

export async function listAccounts(
	db: Database,
	filters: UserListFilters
): Promise<AccountSummary[]> {
	const conditions: SQL[] = [];
	if (filters.q) {
		const pattern = `%${escapeLikePattern(filters.q)}%`;
		conditions.push(or(ilike(users.fullName, pattern), ilike(users.username, pattern))!);
	}
	if (filters.status !== 'all') conditions.push(eq(users.active, filters.status === 'active'));
	if (filters.role === 'admin') conditions.push(eq(users.isAdmin, true));
	if (filters.role === 'chef') conditions.push(eq(users.isChef, true));
	if (filters.role === 'member') conditions.push(eq(users.participatesInReports, true));

	return db
		.select(summaryColumns)
		.from(users)
		.where(and(...conditions))
		.orderBy(desc(users.active), asc(users.fullName));
}

export async function getAccount(db: Database, userId: string): Promise<AccountSummary | null> {
	const [account] = await db.select(summaryColumns).from(users).where(eq(users.id, userId));
	return account ?? null;
}

/**
 * True when an active admin other than `userId` remains. Locks the active admin rows, so
 * two admins cannot remove each other's rights at the same time (EF-USR-05).
 */
async function anotherActiveAdminExists(tx: Database, userId: string): Promise<boolean> {
	const admins = await tx
		.select({ id: users.id })
		.from(users)
		.where(and(eq(users.isAdmin, true), eq(users.active, true)))
		.for('update');
	return admins.some((admin) => admin.id !== userId);
}

/** EF-USR-01: the temporary password is returned once and never stored in clear. */
export async function createAccount(
	db: Database,
	actorId: string,
	input: UserFormInput
): Promise<AccountResult<{ userId: string; temporaryPassword: string }>> {
	const temporaryPassword = generateTemporaryPassword();
	const passwordHash = await hashPassword(temporaryPassword);
	try {
		const userId = await db.transaction(async (tx) => {
			const [created] = await tx
				.insert(users)
				.values({ ...input, passwordHash, mustChangePassword: true })
				.returning({ id: users.id });
			await recordAudit(tx, {
				actorId,
				action: 'user.created',
				entity: 'user',
				entityId: created.id,
				details: { ...input }
			});
			return created.id;
		});
		return { ok: true, value: { userId, temporaryPassword } };
	} catch (error) {
		const known = uniqueViolationError(error);
		if (known) return { ok: false, error: known };
		throw error;
	}
}

/** EF-USR-02. The audit entry keeps the old and new value of each changed field. */
export async function updateAccount(
	db: Database,
	actorId: string,
	userId: string,
	input: UserFormInput
): Promise<AccountResult> {
	try {
		return await db.transaction(async (tx): Promise<AccountResult> => {
			const [current] = await tx
				.select(summaryColumns)
				.from(users)
				.where(eq(users.id, userId))
				.for('update');
			if (!current) return { ok: false, error: NOT_FOUND };

			if (current.isAdmin && !input.isAdmin) {
				if (userId === actorId) {
					return {
						ok: false,
						error: {
							field: 'isAdmin',
							message: 'Vous ne pouvez pas retirer votre propre rôle d’administrateur.'
						}
					};
				}
				if (current.active && !(await anotherActiveAdminExists(tx, userId))) {
					return { ok: false, error: LAST_ADMIN };
				}
			}

			const changes: Record<string, { from: unknown; to: unknown }> = {};
			for (const field of Object.keys(input) as (keyof UserFormInput)[]) {
				if (current[field] !== input[field])
					changes[field] = { from: current[field], to: input[field] };
			}
			if (Object.keys(changes).length === 0) return { ok: true, value: undefined };

			await tx.update(users).set(input).where(eq(users.id, userId));
			await recordAudit(tx, {
				actorId,
				action: 'user.updated',
				entity: 'user',
				entityId: userId,
				details: { changes }
			});
			return { ok: true, value: undefined };
		});
	} catch (error) {
		const known = uniqueViolationError(error);
		if (known) return { ok: false, error: known };
		throw error;
	}
}

/**
 * EF-USR-02 and EF-USR-05. A deactivated account is signed out at once and can no longer
 * sign in (RG-12); its history stays in the reports.
 */
export async function setAccountActive(
	db: Database,
	actorId: string,
	userId: string,
	active: boolean
): Promise<AccountResult> {
	try {
		return await db.transaction(async (tx): Promise<AccountResult> => {
			const [current] = await tx
				.select({ active: users.active, isAdmin: users.isAdmin })
				.from(users)
				.where(eq(users.id, userId))
				.for('update');
			if (!current) return { ok: false, error: NOT_FOUND };
			if (current.active === active) return { ok: true, value: undefined };

			if (!active) {
				if (userId === actorId) {
					return {
						ok: false,
						error: {
							field: 'active',
							message: 'Vous ne pouvez pas désactiver votre propre compte.'
						}
					};
				}
				if (current.isAdmin && !(await anotherActiveAdminExists(tx, userId))) {
					return { ok: false, error: { ...LAST_ADMIN, field: 'active' } };
				}
			}

			await tx.update(users).set({ active }).where(eq(users.id, userId));
			if (!active) await invalidateUserSessions(tx, userId);
			await recordAudit(tx, {
				actorId,
				action: active ? 'user.reactivated' : 'user.deactivated',
				entity: 'user',
				entityId: userId
			});
			return { ok: true, value: undefined };
		});
	} catch (error) {
		// Reactivating a former head while another head is active.
		const known = uniqueViolationError(error);
		if (known) return { ok: false, error: { ...known, field: 'active' } };
		throw error;
	}
}

/**
 * EF-USR-03: new temporary password, change forced at next sign-in, account unlocked,
 * every session closed.
 */
export async function resetAccountPassword(
	db: Database,
	actorId: string,
	userId: string
): Promise<AccountResult<{ temporaryPassword: string }>> {
	if (userId === actorId) {
		return {
			ok: false,
			error: { message: 'Changez votre propre mot de passe depuis la page Profil.' }
		};
	}

	const temporaryPassword = generateTemporaryPassword();
	const passwordHash = await hashPassword(temporaryPassword);
	return db.transaction(async (tx) => {
		const [updated] = await tx
			.update(users)
			.set({ passwordHash, mustChangePassword: true, failedAttempts: 0, lockedUntil: null })
			.where(eq(users.id, userId))
			.returning({ id: users.id });
		if (!updated) return { ok: false, error: NOT_FOUND };

		await invalidateUserSessions(tx, userId);
		await recordAudit(tx, {
			actorId,
			action: 'user.password_reset',
			entity: 'user',
			entityId: userId
		});
		return { ok: true, value: { temporaryPassword } };
	});
}
