import { error, fail } from '@sveltejs/kit';
import { currentWeekStart, shiftWeek, weekStartOf } from '#lib/domain/week.js';
import { requireUser } from '#lib/server/auth/access.js';
import { db } from '#lib/server/db/index.js';
import { batchPublishWeeklyReports, getWeekReportsOverview } from '#lib/server/reports.js';
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

export const load: PageServerLoad = async ({ locals, params }) => {
	requireUser(locals, 'chef');
	const weekStart = normalizeWeekParam(params.semaine);

	const overview = await getWeekReportsOverview(db, weekStart);

	return {
		overview,
		weekStart,
		prevWeek: shiftWeek(weekStart, -7),
		nextWeek: shiftWeek(weekStart, 7),
		isCurrentWeek: weekStart === currentWeekStart()
	};
};

export const actions: Actions = {
	batchPublish: async ({ locals, params }) => {
		const chef = requireUser(locals, 'chef');
		const weekStart = normalizeWeekParam(params.semaine);

		try {
			const count = await batchPublishWeeklyReports(db, chef.id, weekStart);
			return { success: true, count };
		} catch (err) {
			return fail(400, {
				error: err instanceof Error ? err.message : 'Erreur lors de la publication groupée.'
			});
		}
	}
};
