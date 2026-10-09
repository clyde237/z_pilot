import { eq } from 'drizzle-orm';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { UserFormInput } from '#lib/schemas/users.js';
import { authenticate } from '#lib/server/auth/login.js';
import {
	createSession,
	generateSessionToken,
	validateSessionToken
} from '#lib/server/auth/session.js';
import { auditLog, users } from '#lib/server/db/schema.js';
import type { Database } from '#lib/server/db/types.js';
import { createTestDatabase, resetTestDatabase } from '#lib/server/testing/database.js';
import {
	createAccount,
	listAccounts,
	resetAccountPassword,
	setAccountActive,
	updateAccount
} from './users';

let db: Database;

const member = (overrides: Partial<UserFormInput> = {}): UserFormInput => ({
	fullName: 'Marie Tchamda',
	username: 'marie',
	isAdmin: false,
	isChef: false,
	participatesInReports: true,
	...overrides
});

async function create(input: UserFormInput, actorId: string | null = null) {
	const result = await createAccount(db, actorId ?? (await bootstrapActorId()), input);
	if (!result.ok) throw new Error(result.error.message);
	return result.value;
}

// The audit log needs an existing actor: the first admin is inserted directly.
async function bootstrapActorId(): Promise<string> {
	const [existing] = await db
		.select({ id: users.id })
		.from(users)
		.where(eq(users.username, 'root'));
	if (existing) return existing.id;
	const [root] = await db
		.insert(users)
		.values({
			username: 'root',
			fullName: 'Root',
			passwordHash: 'x',
			isAdmin: true,
			participatesInReports: false
		})
		.returning({ id: users.id });
	return root.id;
}

beforeAll(async () => {
	db = await createTestDatabase();
});

beforeEach(async () => {
	await resetTestDatabase(db);
});

describe('createAccount', () => {
	it('returns a temporary password that must be changed at first sign-in (REC-01)', async () => {
		const { userId, temporaryPassword } = await create(member());

		expect(temporaryPassword).toMatch(/^[A-Za-z2-9]{4}-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}$/);
		const login = await authenticate(db, 'marie', temporaryPassword);
		expect(login).toEqual({ ok: true, userId, mustChangePassword: true });
	});

	it('records the creation in the audit log without any secret', async () => {
		const actorId = await bootstrapActorId();
		const { userId } = await create(member(), actorId);

		const [entry] = await db.select().from(auditLog).where(eq(auditLog.entityId, userId));
		expect(entry).toMatchObject({ userId: actorId, action: 'user.created', entity: 'user' });
		expect(JSON.stringify(entry.details)).not.toMatch(/password|hash/i);
	});

	it('refuses a username already taken', async () => {
		await create(member());
		const result = await createAccount(db, await bootstrapActorId(), member({ fullName: 'Autre' }));
		expect(result).toEqual({ ok: false, error: expect.objectContaining({ field: 'username' }) });
	});

	it('refuses a second active department head (EF-USR-05)', async () => {
		await create(member({ username: 'clyde', isChef: true }));
		const result = await createAccount(db, await bootstrapActorId(), member({ isChef: true }));
		expect(result).toEqual({ ok: false, error: expect.objectContaining({ field: 'isChef' }) });
	});
});

describe('updateAccount', () => {
	it('records old and new values of the changed fields only', async () => {
		const actorId = await bootstrapActorId();
		const { userId } = await create(member(), actorId);

		const result = await updateAccount(db, actorId, userId, member({ fullName: 'Marie T.' }));

		expect(result.ok).toBe(true);
		const entries = await db.select().from(auditLog).where(eq(auditLog.action, 'user.updated'));
		expect(entries).toHaveLength(1);
		expect(entries[0].details).toEqual({
			changes: { fullName: { from: 'Marie Tchamda', to: 'Marie T.' } }
		});
	});

	it('forbids an admin to remove their own admin role', async () => {
		const { userId } = await create(member({ username: 'clyde', isAdmin: true }));
		const result = await updateAccount(db, userId, userId, member({ username: 'clyde' }));
		expect(result).toEqual({ ok: false, error: expect.objectContaining({ field: 'isAdmin' }) });
	});

	it('keeps at least one active admin', async () => {
		const rootId = await bootstrapActorId();
		const { userId: otherAdminId } = await create(
			member({ username: 'paul', isAdmin: true }),
			rootId
		);
		await setAccountActive(db, otherAdminId, rootId, false);

		// paul is now the only active admin; nobody may remove his role.
		const result = await updateAccount(db, rootId, otherAdminId, member({ username: 'paul' }));
		expect(result).toEqual({ ok: false, error: expect.objectContaining({ field: 'isAdmin' }) });
	});
});

describe('setAccountActive', () => {
	it('forbids an admin to deactivate their own account (EF-USR-05)', async () => {
		const rootId = await bootstrapActorId();
		const result = await setAccountActive(db, rootId, rootId, false);
		expect(result).toEqual({ ok: false, error: expect.objectContaining({ field: 'active' }) });
	});

	it('refuses to deactivate the last active admin', async () => {
		const rootId = await bootstrapActorId();
		const { userId: memberId } = await create(member(), rootId);
		// Simulates the only admin being deactivated by someone else: a non-admin actor.
		const result = await setAccountActive(db, memberId, rootId, false);
		expect(result).toEqual({ ok: false, error: expect.objectContaining({ field: 'active' }) });
	});

	it('signs a deactivated account out and blocks its sign-in (RG-12)', async () => {
		const rootId = await bootstrapActorId();
		const { userId, temporaryPassword } = await create(member(), rootId);
		const token = generateSessionToken();
		await createSession(db, userId, token);

		await setAccountActive(db, rootId, userId, false);

		expect(await validateSessionToken(db, token)).toBeNull();
		expect(await authenticate(db, 'marie', temporaryPassword)).toEqual({
			ok: false,
			reason: 'invalid_credentials'
		});
	});

	it('refuses to reactivate a former head while another head is active', async () => {
		const rootId = await bootstrapActorId();
		const { userId: formerChefId } = await create(
			member({ username: 'ancien', isChef: true }),
			rootId
		);
		await setAccountActive(db, rootId, formerChefId, false);
		await create(member({ username: 'clyde', isChef: true }), rootId);

		const result = await setAccountActive(db, rootId, formerChefId, true);
		expect(result).toEqual({ ok: false, error: expect.objectContaining({ field: 'active' }) });
	});
});

describe('resetAccountPassword', () => {
	it('issues a new temporary password, unlocks the account and closes its sessions (REC-08)', async () => {
		const rootId = await bootstrapActorId();
		const { userId } = await create(member(), rootId);
		await db
			.update(users)
			.set({ lockedUntil: new Date(Date.now() + 60_000), failedAttempts: 3 })
			.where(eq(users.id, userId));
		const token = generateSessionToken();
		await createSession(db, userId, token);

		const result = await resetAccountPassword(db, rootId, userId);

		if (!result.ok) throw new Error(result.error.message);
		expect(await validateSessionToken(db, token)).toBeNull();
		expect(await authenticate(db, 'marie', result.value.temporaryPassword)).toEqual({
			ok: true,
			userId,
			mustChangePassword: true
		});
	});

	it('refuses to reset the password of the admin doing it', async () => {
		const rootId = await bootstrapActorId();
		const result = await resetAccountPassword(db, rootId, rootId);
		expect(result.ok).toBe(false);
	});
});

describe('listAccounts', () => {
	it('searches name and username, and filters by status and role (EF-USR-07)', async () => {
		const rootId = await bootstrapActorId();
		await create(member(), rootId);
		const { userId: jeanId } = await create(
			member({ fullName: 'Jean Nkouem', username: 'jean' }),
			rootId
		);
		await create(member({ fullName: 'Clyde Fanche', username: 'clyde', isChef: true }), rootId);
		await setAccountActive(db, rootId, jeanId, false);

		const names = async (filters: Parameters<typeof listAccounts>[1]) =>
			(await listAccounts(db, filters)).map((account) => account.username);

		expect(await names({ q: 'NKOU', status: 'all', role: 'all' })).toEqual(['jean']);
		expect(await names({ q: '', status: 'inactive', role: 'all' })).toEqual(['jean']);
		expect(await names({ q: '', status: 'active', role: 'chef' })).toEqual(['clyde']);
		expect(await names({ q: '', status: 'all', role: 'admin' })).toEqual(['root']);
		// A % typed by the user is searched literally.
		expect(await names({ q: '%', status: 'all', role: 'all' })).toEqual([]);
	});
});
