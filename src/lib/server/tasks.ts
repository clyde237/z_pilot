import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { computeWeeklyProgression, type WeeklyProgression } from '#lib/domain/tasks.js';
import { currentWeekStart, todayInTimeZone, weekDays } from '#lib/domain/week.js';
import {
	notifications,
	tasks,
	users,
	weekEntries,
	weeklyReports,
	type Task
} from '#lib/server/db/schema.js';
import type { Database } from '#lib/server/db/types.js';

export interface TaskItem extends Task {
	carriedFromTitle?: string | null;
}

export interface CreateTaskParams {
	title: string;
	description?: string | null;
	memberIds: string[];
	weekStart: string;
	weight?: number;
	plannedDay?: number | null;
	isQuantitative?: boolean;
	targetValue?: number | null;
	unit?: string | null;
}

export interface EditTaskParams {
	taskId: string;
	title: string;
	description?: string | null;
	weight?: number;
	plannedDay?: number | null;
	isQuantitative?: boolean;
	targetValue?: number | null;
	unit?: string | null;
}

export interface UpdateMemberTaskParams {
	taskId: string;
	isDone: boolean;
	achievedValue?: number | null;
	doneOn?: string | null;
	note?: string | null;
}

export interface MemberWeekData {
	member: {
		id: string;
		fullName: string;
		username: string;
		isChef: boolean;
	};
	tasks: TaskItem[];
	difficulties: string;
	isLocked: boolean;
	progression: WeeklyProgression;
}

export interface DepartmentWeekData {
	weekStart: string;
	members: MemberWeekData[];
	teamAverageProgressPct: number | null;
}

/** RG-06: checks whether a weekly report has been published for this member and week. */
export async function isWeekLocked(
	db: Database,
	memberId: string,
	weekStart: string
): Promise<boolean> {
	const [report] = await db
		.select({ id: weeklyReports.id })
		.from(weeklyReports)
		.where(
			and(
				eq(weeklyReports.memberId, memberId),
				eq(weeklyReports.weekStart, weekStart),
				eq(weeklyReports.status, 'published')
			)
		);
	return Boolean(report);
}

/**
 * Ensures the completion date lies within [weekStart, weekStart + 6]
 * to satisfy the DB constraint tasks_done_on_within_week (RG-01, RG-05).
 */
function resolveDoneOn(weekStart: string, suggestedDoneOn?: string | null): string {
	const days = weekDays(weekStart);
	const start = days[0];
	const end = days[6];

	const candidate = suggestedDoneOn || todayInTimeZone();
	if (candidate >= start && candidate <= end) {
		return candidate;
	}
	// Fallback to Friday of the target week, or Monday
	return days[4] ?? start;
}

/**
 * Creates tasks for one or more members (EF-OBJ-01, EF-OBJ-04, EF-OBJ-05).
 * Triggers in-app notification if assigned in current week (RG-09).
 */
export async function createTasks(
	db: Database,
	authorId: string,
	input: CreateTaskParams
): Promise<string[]> {
	const createdIds: string[] = [];
	const isCurrentWeek = input.weekStart === currentWeekStart();

	await db.transaction(async (tx) => {
		for (const memberId of input.memberIds) {
			if (await isWeekLocked(tx, memberId, input.weekStart)) {
				throw new Error('Le rapport hebdomadaire de ce membre est déjà publié pour cette semaine.');
			}

			const [created] = await tx
				.insert(tasks)
				.values({
					memberId,
					weekStart: input.weekStart,
					title: input.title,
					description: input.description || null,
					weight: input.weight ?? 1,
					plannedDay: input.plannedDay ?? null,
					targetValue: input.isQuantitative ? input.targetValue : null,
					unit: input.isQuantitative ? input.unit : null,
					achievedValue: input.isQuantitative ? 0 : null,
					isDone: false,
					createdBy: authorId
				})
				.returning({ id: tasks.id });

			createdIds.push(created.id);

			// RG-09: Notify member if task assigned in active week (unless author assigns to self)
			if (isCurrentWeek && memberId !== authorId) {
				await tx.insert(notifications).values({
					userId: memberId,
					type: 'task_assigned',
					message: `Nouvelle tâche assignée : ${input.title}`,
					link: `/mon-espace/${input.weekStart}`
				});
			}
		}
	});

	return createdIds;
}

/** Updates a task by the department head (EF-OBJ-02). */
export async function updateTask(
	db: Database,
	authorId: string,
	input: EditTaskParams
): Promise<void> {
	await db.transaction(async (tx) => {
		const [current] = await tx.select().from(tasks).where(eq(tasks.id, input.taskId)).for('update');

		if (!current) throw new Error('Tâche introuvable.');

		if (await isWeekLocked(tx, current.memberId, current.weekStart)) {
			throw new Error(
				'Impossible de modifier une tâche dont le rapport est déjà publié (EF-OBJ-02).'
			);
		}

		let isDone = current.isDone;
		let achievedValue = current.achievedValue;

		if (input.isQuantitative && input.targetValue) {
			achievedValue = current.achievedValue ?? 0;
			isDone = achievedValue >= input.targetValue;
		} else if (!input.isQuantitative) {
			achievedValue = null;
		}

		await tx
			.update(tasks)
			.set({
				title: input.title,
				description: input.description || null,
				weight: input.weight ?? 1,
				plannedDay: input.plannedDay ?? null,
				targetValue: input.isQuantitative ? input.targetValue : null,
				unit: input.isQuantitative ? input.unit : null,
				achievedValue,
				isDone,
				doneOn: isDone ? current.doneOn || resolveDoneOn(current.weekStart) : null
			})
			.where(eq(tasks.id, input.taskId));
	});
}

/** Deletes a task by the department head (EF-OBJ-02). */
export async function deleteTask(db: Database, authorId: string, taskId: string): Promise<void> {
	await db.transaction(async (tx) => {
		const [current] = await tx.select().from(tasks).where(eq(tasks.id, taskId));
		if (!current) throw new Error('Tâche introuvable.');

		if (await isWeekLocked(tx, current.memberId, current.weekStart)) {
			throw new Error(
				'Impossible de supprimer une tâche dont le rapport est déjà publié (EF-OBJ-02).'
			);
		}

		await tx.delete(tasks).where(eq(tasks.id, taskId));
	});
}

/**
 * Carries an uncompleted task over to the following week (EF-OBJ-07).
 * Maintains origin link via carried_from_task_id.
 */
export async function carryOverTask(
	db: Database,
	authorId: string,
	taskId: string,
	targetWeekStart: string
): Promise<string> {
	return db.transaction(async (tx) => {
		const [origin] = await tx.select().from(tasks).where(eq(tasks.id, taskId));
		if (!origin) throw new Error('Tâche introuvable.');

		if (await isWeekLocked(tx, origin.memberId, targetWeekStart)) {
			throw new Error('Le rapport de la semaine cible est déjà publié.');
		}

		// Check if already carried over
		const [alreadyCarried] = await tx
			.select({ id: tasks.id })
			.from(tasks)
			.where(eq(tasks.carriedFromTaskId, taskId));

		if (alreadyCarried) {
			throw new Error('Cette tâche a déjà été reportée.');
		}

		const [created] = await tx
			.insert(tasks)
			.values({
				memberId: origin.memberId,
				weekStart: targetWeekStart,
				title: origin.title,
				description: origin.description,
				weight: origin.weight,
				plannedDay: origin.plannedDay,
				targetValue: origin.targetValue,
				unit: origin.unit,
				achievedValue: origin.targetValue ? 0 : null,
				isDone: false,
				carriedFromTaskId: origin.id,
				createdBy: authorId
			})
			.returning({ id: tasks.id });

		return created.id;
	});
}

/** Duplicates tasks from one week to another (EF-OBJ-06). */
export async function duplicateWeekTasks(
	db: Database,
	authorId: string,
	memberId: string,
	fromWeekStart: string,
	toWeekStart: string
): Promise<number> {
	return db.transaction(async (tx) => {
		if (await isWeekLocked(tx, memberId, toWeekStart)) {
			throw new Error('Le rapport de la semaine cible est déjà publié.');
		}

		const originTasks = await tx
			.select()
			.from(tasks)
			.where(and(eq(tasks.memberId, memberId), eq(tasks.weekStart, fromWeekStart)));

		if (originTasks.length === 0) return 0;

		for (const t of originTasks) {
			await tx.insert(tasks).values({
				memberId,
				weekStart: toWeekStart,
				title: t.title,
				description: t.description,
				weight: t.weight,
				plannedDay: t.plannedDay,
				targetValue: t.targetValue,
				unit: t.unit,
				achievedValue: t.targetValue ? 0 : null,
				isDone: false,
				createdBy: authorId
			});
		}

		return originTasks.length;
	});
}

/** Updates task progress, completion status, or note by the assigned member (EF-MEM-02, EF-MEM-03, RG-04, RG-05). */
export async function updateMemberTask(
	db: Database,
	memberId: string,
	input: UpdateMemberTaskParams
): Promise<void> {
	await db.transaction(async (tx) => {
		const [current] = await tx.select().from(tasks).where(eq(tasks.id, input.taskId)).for('update');

		if (!current) throw new Error('Tâche introuvable.');

		if (current.memberId !== memberId) {
			throw new Error('Vous ne pouvez modifier que vos propres tâches (RG-04).');
		}

		if (await isWeekLocked(tx, memberId, current.weekStart)) {
			throw new Error(
				'Cette semaine est clôturée : les modifications ne sont plus autorisées (RG-05).'
			);
		}

		let isDone = input.isDone;
		let achievedValue = current.achievedValue;

		if (current.targetValue != null && current.targetValue > 0) {
			achievedValue =
				input.achievedValue != null
					? Math.max(0, input.achievedValue)
					: (current.achievedValue ?? 0);
			isDone = achievedValue >= current.targetValue;
		}

		const doneOn = isDone ? resolveDoneOn(current.weekStart, input.doneOn) : null;

		await tx
			.update(tasks)
			.set({
				isDone,
				achievedValue,
				doneOn,
				note: input.note || null
			})
			.where(eq(tasks.id, input.taskId));
	});
}

/** Saves or updates weekly difficulties for a member (EF-MEM-04, RG-05). */
export async function saveWeekDifficulties(
	db: Database,
	memberId: string,
	weekStart: string,
	difficulties: string
): Promise<void> {
	if (await isWeekLocked(db, memberId, weekStart)) {
		throw new Error('Cette semaine est clôturée : les difficultés ne peuvent plus être modifiées.');
	}

	await db
		.insert(weekEntries)
		.values({
			memberId,
			weekStart,
			difficulties: difficulties.trim() || null
		})
		.onConflictDoUpdate({
			target: [weekEntries.memberId, weekEntries.weekStart],
			set: {
				difficulties: difficulties.trim() || null,
				updatedAt: new Date()
			}
		});
}

/** Loads week details, tasks, and difficulties for a single member (EF-MEM-01). */
export async function getMemberWeekData(
	db: Database,
	memberId: string,
	weekStart: string
): Promise<MemberWeekData> {
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

	const isLocked = await isWeekLocked(db, memberId, weekStart);
	const progression = computeWeeklyProgression(memberTasks);

	return {
		member,
		tasks: memberTasks,
		difficulties: entry?.difficulties ?? '',
		isLocked,
		progression
	};
}

/** Loads entire department activity for the week (EF-DAS-01, EF-DAS-02, EF-DAS-05). */
export async function getDepartmentWeekData(
	db: Database,
	weekStart: string
): Promise<DepartmentWeekData> {
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
		return { weekStart, members: [], teamAverageProgressPct: null };
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

	const publishedReports = await db
		.select({ memberId: weeklyReports.memberId })
		.from(weeklyReports)
		.where(
			and(
				inArray(weeklyReports.memberId, memberIds),
				eq(weeklyReports.weekStart, weekStart),
				eq(weeklyReports.status, 'published')
			)
		);

	const lockedSet = new Set(publishedReports.map((r) => r.memberId));
	const entriesMap = new Map(allEntries.map((e) => [e.memberId, e.difficulties ?? '']));

	const membersData: MemberWeekData[] = activeMembers.map((member) => {
		const mTasks = allTasks.filter((t) => t.memberId === member.id);
		return {
			member,
			tasks: mTasks,
			difficulties: entriesMap.get(member.id) ?? '',
			isLocked: lockedSet.has(member.id),
			progression: computeWeeklyProgression(mTasks)
		};
	});

	// EF-DAS-05: average progression across members who have tasks
	const withTasks = membersData.filter((m) => m.progression.progressPct !== null);
	const teamAverageProgressPct =
		withTasks.length > 0
			? Math.round(
					withTasks.reduce((sum, m) => sum + (m.progression.progressPct ?? 0), 0) / withTasks.length
				)
			: null;

	return {
		weekStart,
		members: membersData,
		teamAverageProgressPct
	};
}
