import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { tasks, users } from '#lib/server/db/schema.js';
import type { Database } from '#lib/server/db/types.js';
import { createTestDatabase, resetTestDatabase } from '#lib/server/testing/database.js';
import {
	createNotification,
	getUnreadNotificationsCount,
	listUserNotifications,
	markAllNotificationsAsRead,
	markNotificationAsRead,
	runDailyNotificationCron
} from './notifications.js';

describe('notifications server service (EF-NOT-01..05, RG-09)', () => {
	let db: Database;

	beforeAll(async () => {
		db = await createTestDatabase();
	});

	beforeEach(async () => {
		await resetTestDatabase(db);
	});

	it('creates, lists, and marks notifications as read (EF-NOT-01)', async () => {
		const [user] = await db
			.insert(users)
			.values({
				username: 'notif_user',
				fullName: 'Alice Martin',
				passwordHash: 'hash',
				isAdmin: false,
				isChef: false,
				participatesInReports: true,
				active: true
			})
			.returning();

		// 1. Initial count is 0
		expect(await getUnreadNotificationsCount(db, user.id)).toBe(0);

		// 2. Create notification
		const notif1 = await createNotification(db, {
			userId: user.id,
			type: 'task_assigned',
			message: 'Nouvelle tâche assignée : Analyse des logs',
			link: '/mon-espace/2026-10-05',
			dedupeKey: 'task:123'
		});
		expect(notif1).toBeDefined();
		expect(notif1?.readAt).toBeNull();

		// Deduplication check: duplicate dedupeKey returns null
		const dup = await createNotification(db, {
			userId: user.id,
			type: 'task_assigned',
			message: 'Nouvelle tâche assignée',
			dedupeKey: 'task:123'
		});
		expect(dup).toBeNull();

		// Create second notification
		const notif2 = await createNotification(db, {
			userId: user.id,
			type: 'daily_reminder',
			message: 'Pensez à pointer vos tâches'
		});
		expect(notif2).toBeDefined();

		// 3. Count is 2
		expect(await getUnreadNotificationsCount(db, user.id)).toBe(2);

		// 4. List notifications
		const allNotifs = await listUserNotifications(db, user.id);
		expect(allNotifs).toHaveLength(2);
		expect(allNotifs[0].id).toBe(notif2?.id); // latest first

		// 5. Mark notif1 as read
		const marked = await markNotificationAsRead(db, user.id, notif1!.id);
		expect(marked).toBe(true);
		expect(await getUnreadNotificationsCount(db, user.id)).toBe(1);

		const unreadOnly = await listUserNotifications(db, user.id, { unreadOnly: true });
		expect(unreadOnly).toHaveLength(1);
		expect(unreadOnly[0].id).toBe(notif2?.id);

		// 6. Mark all as read
		const countMarked = await markAllNotificationsAsRead(db, user.id);
		expect(countMarked).toBe(1);
		expect(await getUnreadNotificationsCount(db, user.id)).toBe(0);
	});

	it('runs daily notification cron with reminders and chef alerts (EF-NOT-02, EF-NOT-03, EF-NOT-05)', async () => {
		// Seed chef
		const [chef] = await db
			.insert(users)
			.values({
				username: 'chef_notif',
				fullName: 'Chef Patrick',
				passwordHash: 'hash',
				isAdmin: false,
				isChef: true,
				participatesInReports: true,
				active: true
			})
			.returning();

		// Seed member A (has open task, hasn't checked today)
		const [memberA] = await db
			.insert(users)
			.values({
				username: 'member_a',
				fullName: 'Membre A',
				passwordHash: 'hash',
				isAdmin: false,
				isChef: false,
				participatesInReports: true,
				active: true
			})
			.returning();

		// Seed member B (has task completed today)
		const [memberB] = await db
			.insert(users)
			.values({
				username: 'member_b',
				fullName: 'Membre B',
				passwordHash: 'hash',
				isAdmin: false,
				isChef: false,
				participatesInReports: true,
				active: true
			})
			.returning();

		// Week: 2026-10-05 (Monday) to 2026-10-11 (Sunday)
		const weekStart = '2026-10-05';
		const wednesday = '2026-10-07';

		// Task for Member A: not done
		await db.insert(tasks).values({
			memberId: memberA.id,
			createdBy: chef.id,
			weekStart,
			title: 'Tâche en cours membre A',
			weight: 2,
			isDone: false
		});

		// Task for Member B: completed today on Wednesday
		await db.insert(tasks).values({
			memberId: memberB.id,
			createdBy: chef.id,
			weekStart,
			title: 'Tâche terminée membre B',
			weight: 1,
			isDone: true,
			doneOn: wednesday
		});

		// Execution 1: Wednesday 2026-10-07
		const wedStats = await runDailyNotificationCron(db, { date: wednesday });
		expect(wedStats.isWorkingDay).toBe(true);
		expect(wedStats.dailyRemindersSent).toBe(1); // Only Member A gets reminder
		expect(wedStats.weekClosingAlertsSent).toBe(0); // Not Friday
		expect(wedStats.monthlyReportAlertsSent).toBe(0); // Not end of month

		// Verify notification received by Member A
		const notifsA = await listUserNotifications(db, memberA.id);
		expect(notifsA).toHaveLength(1);
		expect(notifsA[0].type).toBe('daily_reminder');
		expect(notifsA[0].link).toBe(`/mon-espace/${weekStart}`);

		// Member B should have 0 notifications
		const notifsB = await listUserNotifications(db, memberB.id);
		expect(notifsB).toHaveLength(0);

		// Idempotency: re-running on Wednesday sends 0 new reminders
		const wedStatsRerun = await runDailyNotificationCron(db, { date: wednesday });
		expect(wedStatsRerun.dailyRemindersSent).toBe(0);

		// Execution 2: Friday 2026-10-09 (Week closing alert for chef)
		const friday = '2026-10-09';
		const friStats = await runDailyNotificationCron(db, { date: friday });
		expect(friStats.isWorkingDay).toBe(true);
		expect(friStats.weekClosingAlertsSent).toBe(1);

		const chefNotifs = await listUserNotifications(db, chef.id);
		const weekAlert = chefNotifs.find((n) => n.type === 'week_ready_to_close');
		expect(weekAlert).toBeDefined();
		expect(weekAlert?.link).toBe(`/rapports/hebdo/${weekStart}`);

		// Execution 3: Sunday 2026-10-11 (Non-working day)
		const sunStats = await runDailyNotificationCron(db, { date: '2026-10-11' });
		expect(sunStats.isWorkingDay).toBe(false);
		expect(sunStats.dailyRemindersSent).toBe(0);

		// Execution 4: Friday 2026-10-30 (End of month alert for chef)
		const lastDayOctober = '2026-10-30';
		const monthStats = await runDailyNotificationCron(db, { date: lastDayOctober });
		expect(monthStats.isWorkingDay).toBe(true);
		expect(monthStats.monthlyReportAlertsSent).toBe(1);

		const chefAllNotifs = await listUserNotifications(db, chef.id);
		const monthAlert = chefAllNotifs.find((n) => n.type === 'month_ready');
		expect(monthAlert).toBeDefined();
		expect(monthAlert?.link).toBe('/rapports/mensuel?mois=2026-10');
	});
});
