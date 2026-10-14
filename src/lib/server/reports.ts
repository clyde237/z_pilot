import { and, asc, desc, eq, inArray, max } from 'drizzle-orm';
import {
	buildWeeklyReportSnapshot,
	type NextWeekPlanItem,
	type ReportTaskItem,
	type WeeklyReportSnapshot
} from '#lib/domain/reports.js';
import { computeWeeklyProgression, type WeeklyProgression } from '#lib/domain/tasks.js';
import { shiftWeek, weekDays } from '#lib/domain/week.js';
import {
	auditLog,
	notifications,
	settings,
	tasks,
	users,
	weekEntries,
	weeklyReports,
	type WeeklyReport
} from '#lib/server/db/schema.js';
import type { Database } from '#lib/server/db/types.js';

export interface WeeklyReportWithPublisher extends WeeklyReport {
	publisherName?: string;
	memberName?: string;
}

export interface PreparedWeeklyReportData {
	member: {
		id: string;
		fullName: string;
		username: string;
		isChef: boolean;
	};
	weekStart: string;
	weekDays: string[];
	existingReport: WeeklyReport | null;
	progression: WeeklyProgression;
	tasks: ReportTaskItem[];
	difficulties: string;
	nextWeekPlannedTasks: NextWeekPlanItem[];
	defaultChefComment: string;
	defaultNextWeekText: string;
}

export interface MemberWeekOverviewItem {
	member: {
		id: string;
		fullName: string;
		username: string;
		isChef: boolean;
	};
	progression: WeeklyProgression;
	tasksCount: number;
	doneTasksCount: number;
	difficulties: string;
	report: {
		id: string;
		version: number;
		status: 'published' | 'reopened';
		publishedAt: Date;
		publishedBy: string;
		progressPct: number | null;
	} | null;
	isLocked: boolean;
	hasNoRecentActivity: boolean; // EF-DAS-04
}

export interface WeekReportsOverview {
	weekStart: string;
	members: MemberWeekOverviewItem[];
	teamAverageProgressPct: number | null;
	totalTasks: number;
	totalDoneTasks: number;
	publishedCount: number;
	totalMembers: number;
}

/** Fetches a weekly report by its ID. */
export async function getWeeklyReportById(
	db: Database,
	reportId: string
): Promise<WeeklyReportWithPublisher | null> {
	const [row] = await db
		.select({
			report: weeklyReports,
			publisherName: users.fullName
		})
		.from(weeklyReports)
		.leftJoin(users, eq(weeklyReports.publishedBy, users.id))
		.where(eq(weeklyReports.id, reportId));

	if (!row) return null;

	return {
		...row.report,
		publisherName: row.publisherName ?? 'Chef de département'
	};
}

/** Fetches all published weekly reports for a member (EF-HEB-05, RG-07). */
export async function getMemberPublishedReports(
	db: Database,
	memberId: string
): Promise<WeeklyReportWithPublisher[]> {
	const rows = await db
		.select({
			report: weeklyReports,
			publisherName: users.fullName
		})
		.from(weeklyReports)
		.leftJoin(users, eq(weeklyReports.publishedBy, users.id))
		.where(and(eq(weeklyReports.memberId, memberId), eq(weeklyReports.status, 'published')))
		.orderBy(desc(weeklyReports.weekStart), desc(weeklyReports.version));

	return rows.map((r) => ({
		...r.report,
		publisherName: r.publisherName ?? 'Chef de département'
	}));
}

/** Prepares all data needed for the preview and publication screen of a weekly report. */
export async function prepareWeeklyReportData(
	db: Database,
	memberId: string,
	weekStart: string
): Promise<PreparedWeeklyReportData> {
	const [member] = await db
		.select({
			id: users.id,
			fullName: users.fullName,
			username: users.username,
			isChef: users.isChef
		})
		.from(users)
		.where(eq(users.id, memberId));

	if (!member) throw new Error('Membre introuvable.');

	const memberTasks = await db
		.select()
		.from(tasks)
		.where(and(eq(tasks.memberId, memberId), eq(tasks.weekStart, weekStart)))
		.orderBy(asc(tasks.plannedDay), asc(tasks.createdAt));

	const [entry] = await db
		.select({ difficulties: weekEntries.difficulties })
		.from(weekEntries)
		.where(and(eq(weekEntries.memberId, memberId), eq(weekEntries.weekStart, weekStart)));

	// Fetch currently published report, or most recent reopened version
	const [existingReport] = await db
		.select()
		.from(weeklyReports)
		.where(and(eq(weeklyReports.memberId, memberId), eq(weeklyReports.weekStart, weekStart)))
		.orderBy(desc(weeklyReports.version))
		.limit(1);

	// Fetch next week planned tasks (S+1) for EF-HEB-03
	const nextWeekStart = shiftWeek(weekStart, 7);
	const nextWeekTasks = await db
		.select({
			id: tasks.id,
			title: tasks.title,
			weight: tasks.weight,
			plannedDay: tasks.plannedDay
		})
		.from(tasks)
		.where(and(eq(tasks.memberId, memberId), eq(tasks.weekStart, nextWeekStart)))
		.orderBy(asc(tasks.plannedDay), asc(tasks.createdAt));

	const progression = computeWeeklyProgression(memberTasks);
	const days = weekDays(weekStart);

	return {
		member,
		weekStart,
		weekDays: days,
		existingReport: existingReport ?? null,
		progression,
		tasks: memberTasks,
		difficulties: entry?.difficulties ?? '',
		nextWeekPlannedTasks: nextWeekTasks,
		defaultChefComment: existingReport?.chefComment ?? '',
		defaultNextWeekText: existingReport?.nextWeekPlan ?? ''
	};
}

/**
 * Publishes a weekly report for a member (EF-HEB-01, EF-HEB-04, RG-06, RG-11).
 * Freezes the snapshot JSON and locks the member's tasks for that week.
 */
export async function publishWeeklyReport(
	db: Database,
	params: {
		chefId: string;
		memberId: string;
		weekStart: string;
		chefComment?: string;
		nextWeekCustomText?: string;
	}
): Promise<string> {
	const { chefId, memberId, weekStart, chefComment = '', nextWeekCustomText = '' } = params;

	return db.transaction(async (tx) => {
		// 1. Check if an active published report already exists
		const [alreadyPublished] = await tx
			.select({ id: weeklyReports.id })
			.from(weeklyReports)
			.where(
				and(
					eq(weeklyReports.memberId, memberId),
					eq(weeklyReports.weekStart, weekStart),
					eq(weeklyReports.status, 'published')
				)
			);

		if (alreadyPublished) {
			throw new Error('Le rapport hebdomadaire de ce membre est déjà publié pour cette semaine.');
		}

		// 2. Fetch member & chef details
		const [member] = await tx
			.select({
				id: users.id,
				fullName: users.fullName,
				username: users.username,
				isChef: users.isChef
			})
			.from(users)
			.where(eq(users.id, memberId));

		if (!member) throw new Error('Membre introuvable.');

		const [chef] = await tx
			.select({
				id: users.id,
				fullName: users.fullName,
				username: users.username
			})
			.from(users)
			.where(eq(users.id, chefId));

		if (!chef) throw new Error('Chef introuvable.');

		// 3. Fetch app settings
		const [appSettings] = await tx.select().from(settings).limit(1);

		// 4. Fetch member tasks and entry
		const memberTasks = await tx
			.select()
			.from(tasks)
			.where(and(eq(tasks.memberId, memberId), eq(tasks.weekStart, weekStart)))
			.orderBy(asc(tasks.plannedDay), asc(tasks.createdAt));

		const [entry] = await tx
			.select({ difficulties: weekEntries.difficulties })
			.from(weekEntries)
			.where(and(eq(weekEntries.memberId, memberId), eq(weekEntries.weekStart, weekStart)));

		// 5. Fetch next week tasks
		const nextWeekStart = shiftWeek(weekStart, 7);
		const nextWeekTasks = await tx
			.select({
				id: tasks.id,
				title: tasks.title,
				weight: tasks.weight,
				plannedDay: tasks.plannedDay
			})
			.from(tasks)
			.where(and(eq(tasks.memberId, memberId), eq(tasks.weekStart, nextWeekStart)))
			.orderBy(asc(tasks.plannedDay), asc(tasks.createdAt));

		// 6. Compute version
		const [lastVersionRow] = await tx
			.select({ maxVersion: max(weeklyReports.version) })
			.from(weeklyReports)
			.where(and(eq(weeklyReports.memberId, memberId), eq(weeklyReports.weekStart, weekStart)));

		const nextVersion = (lastVersionRow?.maxVersion ?? 0) + 1;
		const progression = computeWeeklyProgression(memberTasks);
		const days = weekDays(weekStart);

		// 7. Build frozen snapshot
		const logoDataUrl =
			appSettings?.logo && appSettings.logoMimeType
				? `data:${appSettings.logoMimeType};base64,${Buffer.from(appSettings.logo).toString('base64')}`
				: null;

		const snapshot: WeeklyReportSnapshot = buildWeeklyReportSnapshot({
			organizationName: appSettings?.organizationName ?? 'Zingana',
			departmentName: appSettings?.departmentName ?? 'Département',
			logoDataUrl,
			primaryColor: appSettings?.primaryColor,
			member,
			publishedBy: chef,
			weekStart,
			weekDays: days,
			version: nextVersion,
			tasks: memberTasks,
			difficulties: entry?.difficulties ?? '',
			chefComment,
			nextWeekPlannedTasks: nextWeekTasks,
			nextWeekCustomText,
			progression
		});

		// 8. Insert weekly_reports row
		const [created] = await tx
			.insert(weeklyReports)
			.values({
				memberId,
				weekStart,
				version: nextVersion,
				status: 'published',
				progressPct: progression.progressPct,
				snapshot: snapshot as unknown as Record<string, unknown>,
				chefComment: chefComment.trim() || null,
				nextWeekPlan: nextWeekCustomText.trim() || null,
				publishedBy: chefId,
				reopenedReason: null
			})
			.returning({ id: weeklyReports.id });

		// 9. Write audit log
		await tx.insert(auditLog).values({
			userId: chefId,
			action: 'weekly_report.published',
			entity: 'weekly_report',
			entityId: created.id,
			details: {
				memberId,
				weekStart,
				version: nextVersion,
				progressPct: progression.progressPct
			}
		});

		// 10. Notify member (unless chef publishing own report)
		if (memberId !== chefId) {
			await tx.insert(notifications).values({
				userId: memberId,
				type: 'weekly_report_published',
				message: `Votre rapport hebdomadaire pour la ${snapshot.weekLabel} a été publié.`,
				link: `/mes-rapports/${created.id}`
			});
		}

		return created.id;
	});
}

/**
 * Publishes reports for all active members in batch (EF-HEB-01).
 * Skips members whose report is already published for that week.
 */
export async function batchPublishWeeklyReports(
	db: Database,
	chefId: string,
	weekStart: string
): Promise<number> {
	const activeMembers = await db
		.select({ id: users.id })
		.from(users)
		.where(and(eq(users.active, true), eq(users.participatesInReports, true)));

	if (activeMembers.length === 0) return 0;

	const memberIds = activeMembers.map((m) => m.id);

	const alreadyPublished = await db
		.select({ memberId: weeklyReports.memberId })
		.from(weeklyReports)
		.where(
			and(
				inArray(weeklyReports.memberId, memberIds),
				eq(weeklyReports.weekStart, weekStart),
				eq(weeklyReports.status, 'published')
			)
		);

	const publishedSet = new Set(alreadyPublished.map((p) => p.memberId));
	const candidates = memberIds.filter((id) => !publishedSet.has(id));

	let publishedCount = 0;
	for (const candidateId of candidates) {
		await publishWeeklyReport(db, {
			chefId,
			memberId: candidateId,
			weekStart
		});
		publishedCount++;
	}

	return publishedCount;
}

/**
 * Reopens a published weekly report (EF-HEB-06, RG-06).
 * Requires mandatory reason, logs in audit_log, and unlocks the tasks.
 */
export async function reopenWeeklyReport(
	db: Database,
	params: {
		chefId: string;
		reportId: string;
		reason: string;
	}
): Promise<void> {
	const { chefId, reportId, reason } = params;
	const trimmedReason = reason.trim();

	if (trimmedReason.length < 3) {
		throw new Error('Le motif de réouverture est obligatoire (au moins 3 caractères).');
	}

	await db.transaction(async (tx) => {
		const [current] = await tx
			.select()
			.from(weeklyReports)
			.where(eq(weeklyReports.id, reportId))
			.for('update');

		if (!current) throw new Error('Rapport introuvable.');

		if (current.status !== 'published') {
			throw new Error('Ce rapport est déjà rouvert.');
		}

		await tx
			.update(weeklyReports)
			.set({
				status: 'reopened',
				reopenedReason: trimmedReason
			})
			.where(eq(weeklyReports.id, reportId));

		await tx.insert(auditLog).values({
			userId: chefId,
			action: 'weekly_report.reopened',
			entity: 'weekly_report',
			entityId: reportId,
			details: {
				memberId: current.memberId,
				weekStart: current.weekStart,
				version: current.version,
				reason: trimmedReason
			}
		});

		// Notify member about the reopening
		if (current.memberId !== chefId) {
			await tx.insert(notifications).values({
				userId: current.memberId,
				type: 'task_assigned',
				message: `Votre rapport hebdomadaire pour la semaine du ${current.weekStart} a été rouvert : ${trimmedReason}`,
				link: `/mon-espace/${current.weekStart}`
			});
		}
	});
}

/**
 * Loads team dashboard & weekly reports overview (EF-DAS-01..05, EF-HEB-01).
 */
export async function getWeekReportsOverview(
	db: Database,
	weekStart: string
): Promise<WeekReportsOverview> {
	const activeMembers = await db
		.select({
			id: users.id,
			fullName: users.fullName,
			username: users.username,
			isChef: users.isChef
		})
		.from(users)
		.where(and(eq(users.active, true), eq(users.participatesInReports, true)))
		.orderBy(desc(users.isChef), asc(users.fullName));

	if (activeMembers.length === 0) {
		return {
			weekStart,
			members: [],
			teamAverageProgressPct: null,
			totalTasks: 0,
			totalDoneTasks: 0,
			publishedCount: 0,
			totalMembers: 0
		};
	}

	const memberIds = activeMembers.map((m) => m.id);

	const allTasks = await db
		.select()
		.from(tasks)
		.where(and(inArray(tasks.memberId, memberIds), eq(tasks.weekStart, weekStart)))
		.orderBy(asc(tasks.plannedDay), asc(tasks.createdAt));

	const allEntries = await db
		.select()
		.from(weekEntries)
		.where(and(inArray(weekEntries.memberId, memberIds), eq(weekEntries.weekStart, weekStart)));

	const allReports = await db
		.select()
		.from(weeklyReports)
		.where(and(inArray(weeklyReports.memberId, memberIds), eq(weeklyReports.weekStart, weekStart)))
		.orderBy(desc(weeklyReports.version));

	const entriesMap = new Map(allEntries.map((e) => [e.memberId, e.difficulties ?? '']));

	// Most recent report per member
	const reportsMap = new Map<string, WeeklyReport>();
	for (const r of allReports) {
		if (!reportsMap.has(r.memberId) || r.status === 'published') {
			reportsMap.set(r.memberId, r);
		}
	}

	let totalTasks = 0;
	let totalDoneTasks = 0;
	let publishedCount = 0;

	const memberItems: MemberWeekOverviewItem[] = activeMembers.map((member) => {
		const mTasks = allTasks.filter((t) => t.memberId === member.id);
		const progression = computeWeeklyProgression(mTasks);
		const report = reportsMap.get(member.id) ?? null;
		const isPublished = report?.status === 'published';

		if (isPublished) publishedCount++;
		totalTasks += progression.totalTasksCount;
		totalDoneTasks += progression.completedTasksCount;

		// EF-DAS-04: inactivity detection
		// If member has tasks assigned for the week, but 0 tasks are done:
		const hasNoRecentActivity =
			progression.totalTasksCount > 0 && progression.completedTasksCount === 0;

		return {
			member,
			progression,
			tasksCount: progression.totalTasksCount,
			doneTasksCount: progression.completedTasksCount,
			difficulties: entriesMap.get(member.id) ?? '',
			report: report
				? {
						id: report.id,
						version: report.version,
						status: report.status,
						publishedAt: report.publishedAt,
						publishedBy: report.publishedBy,
						progressPct: report.progressPct
					}
				: null,
			isLocked: isPublished,
			hasNoRecentActivity
		};
	});

	const withTasks = memberItems.filter((m) => m.progression.progressPct !== null);
	const teamAverageProgressPct =
		withTasks.length > 0
			? Math.round(
					withTasks.reduce((sum, m) => sum + (m.progression.progressPct ?? 0), 0) / withTasks.length
				)
			: null;

	return {
		weekStart,
		members: memberItems,
		teamAverageProgressPct,
		totalTasks,
		totalDoneTasks,
		publishedCount,
		totalMembers: activeMembers.length
	};
}
