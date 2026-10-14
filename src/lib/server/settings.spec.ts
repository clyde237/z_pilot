import { eq } from 'drizzle-orm';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { auditLog, users } from '#lib/server/db/schema.js';
import type { Database } from '#lib/server/db/types.js';
import { createTestDatabase, resetTestDatabase } from '#lib/server/testing/database.js';
import { getLogo, getSettings, updateSettings } from './settings';

let db: Database;
let adminId: string;

beforeAll(async () => {
	db = await createTestDatabase();
});

beforeEach(async () => {
	await resetTestDatabase(db);
	const [admin] = await db
		.insert(users)
		.values({
			username: 'admin',
			fullName: 'Admin Test',
			passwordHash: 'dummy',
			isAdmin: true
		})
		.returning({ id: users.id });
	adminId = admin.id;
});

describe('settings service', () => {
	it('reads default settings correctly', async () => {
		const s = await getSettings(db);
		expect(s.organizationName).toBe('Hôtel Zingana');
		expect(s.departmentName).toBeNull();
		expect(s.primaryColor).toBe('#072848');
		expect(s.workingDays).toEqual([1, 2, 3, 4, 5]);
		expect(s.sessionDurationDays).toBe(7);
		expect(s.hasCustomLogo).toBe(false);
	});

	it('updates settings and writes audit entry', async () => {
		await updateSettings(db, adminId, {
			organizationName: 'Hôtel Zingana Luxury',
			departmentName: 'Restauration',
			primaryColor: '#003366',
			workingDays: [1, 2, 3, 4, 5, 6],
			sessionDurationDays: 14
		});

		const updated = await getSettings(db);
		expect(updated.organizationName).toBe('Hôtel Zingana Luxury');
		expect(updated.departmentName).toBe('Restauration');
		expect(updated.primaryColor).toBe('#003366');
		expect(updated.workingDays).toEqual([1, 2, 3, 4, 5, 6]);
		expect(updated.sessionDurationDays).toBe(14);

		const [audit] = await db.select().from(auditLog).where(eq(auditLog.action, 'settings.updated'));
		expect(audit).toBeDefined();
		expect(audit.userId).toBe(adminId);
		expect(audit.details).toMatchObject({
			changes: {
				organizationName: { from: 'Hôtel Zingana', to: 'Hôtel Zingana Luxury' },
				departmentName: { from: null, to: 'Restauration' },
				primaryColor: { from: '#072848', to: '#003366' },
				sessionDurationDays: { from: 7, to: 14 }
			}
		});
	});

	it('handles logo upload and removal', async () => {
		const logoBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG header
		await updateSettings(
			db,
			adminId,
			{
				organizationName: 'Hôtel Zingana',
				departmentName: null,
				primaryColor: '#072848',
				workingDays: [1, 2, 3, 4, 5],
				sessionDurationDays: 7
			},
			{ newLogo: { buffer: logoBuffer, mimeType: 'image/png' } }
		);

		const withLogo = await getSettings(db);
		expect(withLogo.hasCustomLogo).toBe(true);
		expect(withLogo.logoMimeType).toBe('image/png');

		const fetchedLogo = await getLogo(db);
		expect(fetchedLogo).not.toBeNull();
		expect(fetchedLogo?.mimeType).toBe('image/png');
		expect(Buffer.compare(fetchedLogo!.buffer, logoBuffer)).toBe(0);

		// Now remove logo
		await updateSettings(
			db,
			adminId,
			{
				organizationName: 'Hôtel Zingana',
				departmentName: null,
				primaryColor: '#072848',
				workingDays: [1, 2, 3, 4, 5],
				sessionDurationDays: 7
			},
			{ removeLogo: true }
		);

		const withoutLogo = await getSettings(db);
		expect(withoutLogo.hasCustomLogo).toBe(false);
		expect(withoutLogo.logoMimeType).toBeNull();
		expect(await getLogo(db)).toBeNull();
	});
});
