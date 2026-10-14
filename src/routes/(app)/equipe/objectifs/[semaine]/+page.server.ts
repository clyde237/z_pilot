import { error, fail } from '@sveltejs/kit';
import { and, asc, desc, eq } from 'drizzle-orm';
import { currentWeekStart, weekStartOf } from '#lib/domain/week.js';
import { createTaskSchema, editTaskSchema } from '#lib/schemas/tasks.js';
import { requireUser } from '#lib/server/auth/access.js';
import { db } from '#lib/server/db/index.js';
import { users } from '#lib/server/db/schema.js';
import {
	carryOverTask,
	createTasks,
	deleteTask,
	duplicateWeekTasks,
	getDepartmentWeekData,
	updateTask
} from '#lib/server/tasks.js';
import type { Actions, PageServerLoad } from './$types';

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function normalizeWeekParam(param: string): string {
	if (!ISO_DATE_PATTERN.test(param)) {
		error(404, 'Semaine invalide');
	}
	try {
		return weekStartOf(param);
	} catch {
		error(404, 'Semaine invalide');
	}
}

function shiftWeek(weekMonday: string, daysDelta: number): string {
	const d = new Date(`${weekMonday}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + daysDelta);
	return d.toISOString().split('T')[0];
}

export const load: PageServerLoad = async ({ locals, params }) => {
	requireUser(locals, 'chef');
	const weekStart = normalizeWeekParam(params.semaine);

	const deptData = await getDepartmentWeekData(db, weekStart);

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

	return {
		deptData,
		weekStart,
		prevWeek: shiftWeek(weekStart, -7),
		nextWeek: shiftWeek(weekStart, 7),
		activeMembers,
		isCurrentWeek: weekStart === currentWeekStart()
	};
};

export const actions: Actions = {
	create: async ({ request, locals, params }) => {
		const chef = requireUser(locals, 'chef');
		const weekStart = normalizeWeekParam(params.semaine);
		const formData = await request.formData();

		const rawMemberIds = formData.getAll('memberIds').map(String);
		const title = String(formData.get('title') ?? '');
		const description = String(formData.get('description') ?? '');
		const weight = Number(formData.get('weight') ?? 1);
		const plannedDayRaw = formData.get('plannedDay');
		const plannedDay = plannedDayRaw ? Number(plannedDayRaw) : null;
		const isQuantitative = formData.get('isQuantitative') === 'true';
		const targetValueRaw = formData.get('targetValue');
		const targetValue = isQuantitative && targetValueRaw ? Number(targetValueRaw) : null;
		const unit = isQuantitative ? String(formData.get('unit') ?? '') : null;

		const parsed = createTaskSchema.safeParse({
			title,
			description,
			memberIds: rawMemberIds,
			weekStart,
			weight,
			plannedDay,
			isQuantitative,
			targetValue,
			unit
		});

		if (!parsed.success) {
			const firstError = parsed.error.issues[0]?.message ?? 'Données invalides';
			return fail(400, { createError: firstError });
		}

		try {
			await createTasks(db, chef.id, parsed.data);
			return { successMessage: 'Tâche(s) créée(s) avec succès.' };
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Erreur lors de la création';
			return fail(400, { createError: message });
		}
	},

	edit: async ({ request, locals }) => {
		const chef = requireUser(locals, 'chef');
		const formData = await request.formData();

		const taskId = String(formData.get('taskId') ?? '');
		const title = String(formData.get('title') ?? '');
		const description = String(formData.get('description') ?? '');
		const weight = Number(formData.get('weight') ?? 1);
		const plannedDayRaw = formData.get('plannedDay');
		const plannedDay = plannedDayRaw ? Number(plannedDayRaw) : null;
		const isQuantitative = formData.get('isQuantitative') === 'true';
		const targetValueRaw = formData.get('targetValue');
		const targetValue = isQuantitative && targetValueRaw ? Number(targetValueRaw) : null;
		const unit = isQuantitative ? String(formData.get('unit') ?? '') : null;

		const parsed = editTaskSchema.safeParse({
			taskId,
			title,
			description,
			weight,
			plannedDay,
			isQuantitative,
			targetValue,
			unit
		});

		if (!parsed.success) {
			const firstError = parsed.error.issues[0]?.message ?? 'Données invalides';
			return fail(400, { editError: firstError });
		}

		try {
			await updateTask(db, chef.id, parsed.data);
			return { successMessage: 'Tâche modifiée avec succès.' };
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Erreur lors de la modification';
			return fail(400, { editError: message });
		}
	},

	delete: async ({ request, locals }) => {
		const chef = requireUser(locals, 'chef');
		const formData = await request.formData();
		const taskId = String(formData.get('taskId') ?? '');

		try {
			await deleteTask(db, chef.id, taskId);
			return { successMessage: 'Tâche supprimée.' };
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Erreur lors de la suppression';
			return fail(400, { actionError: message });
		}
	},

	carry: async ({ request, locals }) => {
		const chef = requireUser(locals, 'chef');
		const formData = await request.formData();
		const taskId = String(formData.get('taskId') ?? '');
		const targetWeekStart = String(formData.get('targetWeekStart') ?? '');

		try {
			await carryOverTask(db, chef.id, taskId, targetWeekStart);
			return { successMessage: 'Tâche reportée à la semaine suivante avec succès.' };
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Erreur lors du report';
			return fail(400, { actionError: message });
		}
	},

	duplicate: async ({ request, locals, params }) => {
		const chef = requireUser(locals, 'chef');
		const fromWeekStart = normalizeWeekParam(params.semaine);
		const formData = await request.formData();
		const memberId = String(formData.get('memberId') ?? '');
		const toWeekStart = shiftWeek(fromWeekStart, 7);

		try {
			const count = await duplicateWeekTasks(db, chef.id, memberId, fromWeekStart, toWeekStart);
			return { successMessage: `${count} tâche(s) dupliquée(s) vers la semaine suivante.` };
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Erreur lors de la duplication';
			return fail(400, { actionError: message });
		}
	}
};
