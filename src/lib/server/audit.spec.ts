import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { users } from '#lib/server/db/schema.js';
import type { Database } from '#lib/server/db/types.js';
import { createTestDatabase, resetTestDatabase } from '#lib/server/testing/database.js';
import { listAuditLogs, recordAudit } from './audit';

let db: Database;
let adminId: string;
let memberId: string;

beforeAll(async () => {
	db = await createTestDatabase();
});

beforeEach(async () => {
	await resetTestDatabase(db);
	const [admin] = await db
		.insert(users)
		.values({ username: 'clyde', fullName: 'Clyde Fanche', passwordHash: 'x', isAdmin: true })
		.returning({ id: users.id });
	adminId = admin.id;

	const [member] = await db
		.insert(users)
		.values({ username: 'marie', fullName: 'Marie Tchamda', passwordHash: 'x' })
		.returning({ id: users.id });
	memberId = member.id;
});

describe('listAuditLogs', () => {
	it('lists audit entries with actor details', async () => {
		await recordAudit(db, {
			actorId: adminId,
			action: 'user.created',
			entity: 'user',
			entityId: memberId,
			details: { username: 'marie' }
		});

		await recordAudit(db, {
			actorId: null,
			action: 'user.locked',
			entity: 'user',
			entityId: memberId,
			details: { failedAttempts: 5 }
		});

		const result = await listAuditLogs(db, { action: 'all', page: 1, pageSize: 10 });
		expect(result.total).toBe(2);
		expect(result.entries).toHaveLength(2);

		// Most recent first
		expect(result.entries[0].action).toBe('user.locked');
		expect(result.entries[0].actor).toBeNull();

		expect(result.entries[1].action).toBe('user.created');
		expect(result.entries[1].actor?.username).toBe('clyde');
	});

	it('filters by action and searches by term', async () => {
		await recordAudit(db, {
			actorId: adminId,
			action: 'user.created',
			entity: 'user',
			entityId: memberId
		});
		await recordAudit(db, {
			actorId: adminId,
			action: 'user.password_reset',
			entity: 'user',
			entityId: memberId
		});

		const filtered = await listAuditLogs(db, { action: 'user.password_reset' });
		expect(filtered.total).toBe(1);
		expect(filtered.entries[0].action).toBe('user.password_reset');

		const searched = await listAuditLogs(db, { q: 'Clyde' });
		expect(searched.total).toBe(2);

		const noMatch = await listAuditLogs(db, { q: 'Inexistant' });
		expect(noMatch.total).toBe(0);
	});
});
