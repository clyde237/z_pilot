import { error, fail } from '@sveltejs/kit';
import { currentWeekStart, weekStartOf } from '#lib/domain/week.js';
import { requireUser } from '#lib/server/auth/access.js';
import { db } from '#lib/server/db/index.js';
import { getMemberWeekData, saveWeekDifficulties, updateMemberTask } from '#lib/server/tasks.js';
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
	const user = requireUser(locals, 'member');
	const weekStart = normalizeWeekParam(params.semaine);

	const weekData = await getMemberWeekData(db, user.id, weekStart);
	const activeCurrentWeek = currentWeekStart();

	return {
		weekData,
		weekStart,
		prevWeek: shiftWeek(weekStart, -7),
		nextWeek: shiftWeek(weekStart, 7),
		isCurrentWeek: weekStart === activeCurrentWeek
	};
};

export const actions: Actions = {
	updateTask: async ({ request, locals }) => {
		const user = requireUser(locals, 'member');
		const formData = await request.formData();

		const taskId = String(formData.get('taskId') ?? '');
		const isDone = formData.get('isDone') === 'true';
		const note = String(formData.get('note') ?? '');
		const achievedRaw = formData.get('achievedValue');
		const achievedValue =
			achievedRaw !== null && achievedRaw !== '' ? Number(achievedRaw) : undefined;
		const doneOnRaw = formData.get('doneOn');
		const doneOn = doneOnRaw ? String(doneOnRaw) : undefined;

		try {
			await updateMemberTask(db, user.id, {
				taskId,
				isDone,
				achievedValue,
				doneOn,
				note
			});
			return { success: true };
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Erreur lors de la mise à jour';
			return fail(400, { error: message });
		}
	},

	saveDifficulties: async ({ request, locals, params }) => {
		const user = requireUser(locals, 'member');
		const weekStart = normalizeWeekParam(params.semaine);
		const formData = await request.formData();
		const difficulties = String(formData.get('difficulties') ?? '');

		try {
			await saveWeekDifficulties(db, user.id, weekStart, difficulties);
			return { savedDifficulties: true };
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Erreur lors de l’enregistrement';
			return fail(400, { error: message });
		}
	}
};
