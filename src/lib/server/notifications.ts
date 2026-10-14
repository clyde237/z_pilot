import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import {
	isoDayOfWeek,
	isLastWorkingDayOfMonth,
	isLastWorkingDayOfWeek,
	parseIsoDate,
	todayInTimeZone,
	weekStartOf,
	type IsoDate
} from '#lib/domain/week.js';
import { formatMonthLabel } from '#lib/format.js';
import { notifications, settings, tasks, users, type Notification } from '#lib/server/db/schema.js';
import type { Database } from '#lib/server/db/types.js';

export type NotificationType =
	| 'task_assigned'
	| 'daily_reminder'
	| 'week_ready_to_close'
	| 'month_ready'
	| 'weekly_report_published';

export interface CreateNotificationParams {
	userId: string;
	type: NotificationType;
	message: string;
	link?: string | null;
	dedupeKey?: string | null;
}

export interface CronStats {
	executedAt: string;
	date: IsoDate;
	isWorkingDay: boolean;
	dailyRemindersSent: number;
	weekClosingAlertsSent: number;
	monthlyReportAlertsSent: number;
	skippedMembersCount: number;
}

/**
 * Creates an in-app notification (EF-NOT-01, RG-09).
 * If a dedupeKey is provided and an existing notification with that key exists for the user,
 * returns null to ensure idempotency.
 */
export async function createNotification(
	db: Database,
	params: CreateNotificationParams
): Promise<Notification | null> {
	if (params.dedupeKey) {
		const [existing] = await db
			.select()
			.from(notifications)
			.where(
				and(eq(notifications.userId, params.userId), eq(notifications.dedupeKey, params.dedupeKey))
			)
			.limit(1);

		if (existing) {
			return null;
		}
	}

	const [created] = await db
		.insert(notifications)
		.values({
			userId: params.userId,
			type: params.type,
			message: params.message.trim(),
			link: params.link?.trim() || null,
			dedupeKey: params.dedupeKey ?? null,
			readAt: null
		})
		.returning();

	return created;
}

/**
 * Retrieves the notifications of a user sorted by most recent (EF-NOT-01).
 */
export async function listUserNotifications(
	db: Database,
	userId: string,
	options: { limit?: number; unreadOnly?: boolean } = {}
): Promise<Notification[]> {
	const limit = options.limit ?? 50;
	const conditions = [eq(notifications.userId, userId)];

	if (options.unreadOnly) {
		conditions.push(isNull(notifications.readAt));
	}

	return db
		.select()
		.from(notifications)
		.where(and(...conditions))
		.orderBy(desc(notifications.createdAt))
		.limit(limit);
}

/**
 * Counts the number of unread notifications for a user (EF-NOT-01).
 */
export async function getUnreadNotificationsCount(db: Database, userId: string): Promise<number> {
	const [row] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(notifications)
		.where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));

	return row?.count ?? 0;
}

/**
 * Marks a single notification as read (EF-NOT-01).
 */
export async function markNotificationAsRead(
	db: Database,
	userId: string,
	notificationId: string
): Promise<boolean> {
	const [updated] = await db
		.update(notifications)
		.set({ readAt: new Date() })
		.where(
			and(
				eq(notifications.id, notificationId),
				eq(notifications.userId, userId),
				isNull(notifications.readAt)
			)
		)
		.returning({ id: notifications.id });

	return Boolean(updated);
}

/**
 * Marks all unread notifications of a user as read (EF-NOT-01).
 */
export async function markAllNotificationsAsRead(db: Database, userId: string): Promise<number> {
	const updated = await db
		.update(notifications)
		.set({ readAt: new Date() })
		.where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
		.returning({ id: notifications.id });

	return updated.length;
}

/**
 * Runs the daily notification cron job (EF-NOT-02, EF-NOT-03, EF-NOT-05).
 * - Sends daily reminders to active members with pending tasks who haven't checked tasks today.
 * - Sends week closing alert to the department head on Friday (or last working day of week).
 * - Sends month closing alert to the department head on the last working day of the month.
 */
export async function runDailyNotificationCron(
	db: Database,
	options?: { date?: IsoDate }
): Promise<CronStats> {
	const today: IsoDate = options?.date ?? todayInTimeZone();
	const executedAt = new Date().toISOString();

	// Fetch working days configuration from settings
	const [appSettings] = await db.select().from(settings).limit(1);
	const workingDays: number[] = appSettings?.workingDays ?? [1, 2, 3, 4, 5];

	const todayIsoDay = isoDayOfWeek(today);
	const isWorkingDay = workingDays.includes(todayIsoDay);

	if (!isWorkingDay) {
		return {
			executedAt,
			date: today,
			isWorkingDay: false,
			dailyRemindersSent: 0,
			weekClosingAlertsSent: 0,
			monthlyReportAlertsSent: 0,
			skippedMembersCount: 0
		};
	}

	const currentWeek = weekStartOf(today);
	let dailyRemindersSent = 0;
	let weekClosingAlertsSent = 0;
	let monthlyReportAlertsSent = 0;
	let skippedMembersCount = 0;

	// 1. EF-NOT-02: Daily reminders to active members
	const activeMembers = await db
		.select({
			id: users.id,
			fullName: users.fullName,
			isChef: users.isChef
		})
		.from(users)
		.where(and(eq(users.active, true), eq(users.participatesInReports, true)));

	for (const member of activeMembers) {
		// Fetch member tasks for current week
		const memberTasks = await db
			.select({
				id: tasks.id,
				isDone: tasks.isDone,
				doneOn: tasks.doneOn
			})
			.from(tasks)
			.where(and(eq(tasks.memberId, member.id), eq(tasks.weekStart, currentWeek)));

		const hasOpenTasks = memberTasks.some((t) => !t.isDone);
		const checkedToday = memberTasks.some((t) => t.isDone && t.doneOn === today);

		if (hasOpenTasks && !checkedToday) {
			const dedupeKey = `daily_reminder:${today}:${member.id}`;
			const created = await createNotification(db, {
				userId: member.id,
				type: 'daily_reminder',
				message:
					'Rappel de fin de journée : vous avez des tâches en attente. Pensez à pointer votre activité du jour.',
				link: `/mon-espace/${currentWeek}`,
				dedupeKey
			});

			if (created) {
				dailyRemindersSent++;
			}
		} else {
			skippedMembersCount++;
		}
	}

	// 2. EF-NOT-03: Alerts to department head
	const [chef] = await db
		.select({
			id: users.id,
			fullName: users.fullName
		})
		.from(users)
		.where(and(eq(users.active, true), eq(users.isChef, true)))
		.limit(1);

	if (chef) {
		// Alert 1: Week ready to close on last working day of week (Friday by default)
		if (isLastWorkingDayOfWeek(today, workingDays)) {
			const dedupeKey = `week_ready_to_close:${currentWeek}`;
			const created = await createNotification(db, {
				userId: chef.id,
				type: 'week_ready_to_close',
				message:
					'La semaine touche à sa fin : les activités de l’équipe sont prêtes à être validées et clôturées.',
				link: `/rapports/hebdo/${currentWeek}`,
				dedupeKey
			});

			if (created) {
				weekClosingAlertsSent++;
			}
		}

		// Alert 2: Monthly report ready on last working day of month
		if (isLastWorkingDayOfMonth(today, workingDays)) {
			const dateObj = parseIsoDate(today);
			const year = dateObj.getFullYear();
			const month = dateObj.getMonth() + 1;
			const monthParam = `${year}-${String(month).padStart(2, '0')}`;
			const monthLabel = formatMonthLabel(year, month);
			const dedupeKey = `month_ready:${monthParam}`;

			const created = await createNotification(db, {
				userId: chef.id,
				type: 'month_ready',
				message: `Le mois de ${monthLabel} s’achève : vous pouvez générer le rapport mensuel consolidé de l’équipe.`,
				link: `/rapports/mensuel?mois=${monthParam}`,
				dedupeKey
			});

			if (created) {
				monthlyReportAlertsSent++;
			}
		}
	}

	return {
		executedAt,
		date: today,
		isWorkingDay: true,
		dailyRemindersSent,
		weekClosingAlertsSent,
		monthlyReportAlertsSent,
		skippedMembersCount
	};
}
