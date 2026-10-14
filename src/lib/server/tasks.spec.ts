import { sql } from 'drizzle-orm';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { currentWeekStart } from '#lib/domain/week.js';
import { users, weeklyReports } from '#lib/server/db/schema.js';
import type { Database } from '#lib/server/db/types.js';
import { createTestDatabase, resetTestDatabase } from '#lib/server/testing/database.js';
import {
	carryOverTask,
	createTasks,
	deleteTask,
	duplicateWeekTasks,
	getDepartmentWeekData,
	getMemberWeekData,
	saveWeekDifficulties,
	updateMemberTask,
	updateTask
} from './tasks';

let db: Database;
let chefId: string;
let member1Id: string;
let member2Id: string;
let weekMonday: string;

beforeAll(async () => {
	db = await createTestDatabase();
});

beforeEach(async () => {
	await resetTestDatabase(db);
	weekMonday = currentWeekStart();

	const [chef] = await db
		.insert(users)
		.values({
			username: 'chef',
			fullName: 'Chef Test',
			passwordHash: 'dummy',
			isChef: true,
			participatesInReports: true
		})
		.returning({ id: users.id });
	chefId = chef.id;

	const [m1] = await db
		.insert(users)
		.values({
			username: 'marie',
			fullName: 'Marie Tchamda',
			passwordHash: 'dummy',
			participatesInReports: true
		})
		.returning({ id: users.id });
	member1Id = m1.id;

	const [m2] = await db
		.insert(users)
		.values({
			username: 'jean',
			fullName: 'Jean Nkouem',
			passwordHash: 'dummy',
			participatesInReports: true
		})
		.returning({ id: users.id });
	member2Id = m2.id;
});

describe('tasks service', () => {
	it('creates qualitative and quantitative tasks for single and multiple members (EF-OBJ-01, EF-OBJ-04)', async () => {
		const taskIds = await createTasks(db, chefId, {
			title: 'Nettoyer le hall',
			description: 'Grand nettoyage',
			memberIds: [member1Id, member2Id],
			weekStart: weekMonday,
			weight: 2,
			plannedDay: 1,
			isQuantitative: false
		});

		expect(taskIds).toHaveLength(2);

		const m1Data = await getMemberWeekData(db, member1Id, weekMonday);
		expect(m1Data.tasks).toHaveLength(1);
		expect(m1Data.tasks[0].title).toBe('Nettoyer le hall');
		expect(m1Data.tasks[0].weight).toBe(2);

		const m2Data = await getMemberWeekData(db, member2Id, weekMonday);
		expect(m2Data.tasks).toHaveLength(1);
	});

	it('allows member to check task and add notes (EF-MEM-02, EF-MEM-03)', async () => {
		const [taskId] = await createTasks(db, chefId, {
			title: 'Vérifier inventaire',
			memberIds: [member1Id],
			weekStart: weekMonday,
			weight: 3,
			isQuantitative: false
		});

		await updateMemberTask(db, member1Id, {
			taskId,
			isDone: true,
			note: 'Tout est en ordre'
		});

		const m1Data = await getMemberWeekData(db, member1Id, weekMonday);
		expect(m1Data.tasks[0].isDone).toBe(true);
		expect(m1Data.tasks[0].note).toBe('Tout est en ordre');
		expect(m1Data.tasks[0].doneOn).toBeDefined();
		expect(m1Data.progression.progressPct).toBe(100);
	});

	it('handles quantitative tasks with partial and complete progress (EF-OBJ-05, RG-03)', async () => {
		const [taskId] = await createTasks(db, chefId, {
			title: 'Traiter tickets',
			memberIds: [member1Id],
			weekStart: weekMonday,
			weight: 3,
			isQuantitative: true,
			targetValue: 20,
			unit: 'tickets'
		});

		// Partial progress: 10 / 20 -> 50%
		await updateMemberTask(db, member1Id, {
			taskId,
			isDone: false,
			achievedValue: 10
		});

		let data = await getMemberWeekData(db, member1Id, weekMonday);
		expect(data.tasks[0].achievedValue).toBe(10);
		expect(data.tasks[0].isDone).toBe(false);
		expect(data.progression.progressPct).toBe(50);

		// Target reached: 20 / 20 -> auto done & 100%
		await updateMemberTask(db, member1Id, {
			taskId,
			isDone: false,
			achievedValue: 20
		});

		data = await getMemberWeekData(db, member1Id, weekMonday);
		expect(data.tasks[0].isDone).toBe(true);
		expect(data.progression.progressPct).toBe(100);
	});

	it('forbids modifying another member’s task (RG-04)', async () => {
		const [taskId] = await createTasks(db, chefId, {
			title: 'Tâche privée',
			memberIds: [member1Id],
			weekStart: weekMonday,
			weight: 1,
			isQuantitative: false
		});

		await expect(
			updateMemberTask(db, member2Id, {
				taskId,
				isDone: true
			})
		).rejects.toThrow(/propres tâches/);
	});

	it('locks task modifications when weekly report is published (EF-OBJ-02, RG-05, RG-06)', async () => {
		const [taskId] = await createTasks(db, chefId, {
			title: 'Tâche à figer',
			memberIds: [member1Id],
			weekStart: weekMonday,
			weight: 1,
			isQuantitative: false
		});

		// Publish weekly report for member1
		await db.insert(weeklyReports).values({
			memberId: member1Id,
			weekStart: weekMonday,
			version: 1,
			status: 'published',
			snapshot: {},
			publishedBy: chefId
		});

		// Member cannot check task
		await expect(
			updateMemberTask(db, member1Id, {
				taskId,
				isDone: true
			})
		).rejects.toThrow(/clôturée/);

		// Chef cannot delete or update task without reopening
		await expect(deleteTask(db, chefId, taskId)).rejects.toThrow(/publié/);
		await expect(
			updateTask(db, chefId, {
				taskId,
				title: 'Nouveau titre',
				weight: 2,
				isQuantitative: false
			})
		).rejects.toThrow(/publié/);
	});

	it('carries an uncompleted task to next week (EF-OBJ-07)', async () => {
		const [taskId] = await createTasks(db, chefId, {
			title: 'Tâche en retard',
			memberIds: [member1Id],
			weekStart: weekMonday,
			weight: 2,
			isQuantitative: false
		});

		const [nextWeekStart] = await db
			.select({ nextMon: sql<string>`(${weekMonday}::date + 7)::text` })
			.from(users);

		const carriedId = await carryOverTask(db, chefId, taskId, nextWeekStart.nextMon);
		expect(carriedId).toBeDefined();

		const nextWeekData = await getMemberWeekData(db, member1Id, nextWeekStart.nextMon);
		expect(nextWeekData.tasks).toHaveLength(1);
		expect(nextWeekData.tasks[0].carriedFromTaskId).toBe(taskId);
		expect(nextWeekData.tasks[0].title).toBe('Tâche en retard');

		// Forbids carrying twice
		await expect(carryOverTask(db, chefId, taskId, nextWeekStart.nextMon)).rejects.toThrow(
			/déjà été reportée/
		);
	});

	it('duplicates tasks of a member from one week to the next (EF-OBJ-06)', async () => {
		await createTasks(db, chefId, {
			title: 'Tâche récurrente 1',
			memberIds: [member1Id],
			weekStart: weekMonday,
			weight: 1,
			isQuantitative: false
		});
		await createTasks(db, chefId, {
			title: 'Tâche récurrente 2',
			memberIds: [member1Id],
			weekStart: weekMonday,
			weight: 2,
			isQuantitative: false
		});

		const [nextWeek] = await db
			.select({ nextMon: sql<string>`(${weekMonday}::date + 7)::text` })
			.from(users);

		const count = await duplicateWeekTasks(db, chefId, member1Id, weekMonday, nextWeek.nextMon);
		expect(count).toBe(2);

		const nextData = await getMemberWeekData(db, member1Id, nextWeek.nextMon);
		expect(nextData.tasks).toHaveLength(2);
		expect(nextData.tasks.map((t) => t.title)).toContain('Tâche récurrente 1');
	});

	it('saves and updates weekly difficulties (EF-MEM-04)', async () => {
		await saveWeekDifficulties(db, member1Id, weekMonday, 'Problème de réseau mardi');
		let data = await getMemberWeekData(db, member1Id, weekMonday);
		expect(data.difficulties).toBe('Problème de réseau mardi');

		// Updating works idempotently
		await saveWeekDifficulties(db, member1Id, weekMonday, 'Résolu mercredi');
		data = await getMemberWeekData(db, member1Id, weekMonday);
		expect(data.difficulties).toBe('Résolu mercredi');
	});

	it('computes department overview and average progress (EF-DAS-01, EF-DAS-05)', async () => {
		// Chef creates task for self
		await createTasks(db, chefId, {
			title: 'Gestion planning',
			memberIds: [chefId],
			weekStart: weekMonday,
			weight: 2,
			isQuantitative: false
		});
		// Member 1 has task and completes it
		const [m1Task] = await createTasks(db, chefId, {
			title: 'Accueil client',
			memberIds: [member1Id],
			weekStart: weekMonday,
			weight: 2,
			isQuantitative: false
		});
		await updateMemberTask(db, member1Id, { taskId: m1Task, isDone: true });

		// Member 2 has no task
		const deptData = await getDepartmentWeekData(db, weekMonday);
		expect(deptData.members).toHaveLength(3); // chef, marie, jean

		const chefMember = deptData.members.find((m) => m.member.id === chefId);
		expect(chefMember?.progression.progressPct).toBe(0);

		const marieMember = deptData.members.find((m) => m.member.id === member1Id);
		expect(marieMember?.progression.progressPct).toBe(100);

		const jeanMember = deptData.members.find((m) => m.member.id === member2Id);
		expect(jeanMember?.progression.progressPct).toBeNull(); // Aucun objectif

		// Average of members with tasks: (0 + 100) / 2 = 50%
		expect(deptData.teamAverageProgressPct).toBe(50);
	});
});
