import { error } from '@sveltejs/kit';
import { currentWeekStart, shiftWeek, weekStartOf } from '#lib/domain/week.js';
import { requireUser } from '#lib/server/auth/access.js';
import { db } from '#lib/server/db/index.js';
import { getWeekReportsOverview } from '#lib/server/reports.js';
import { getDepartmentWeekData } from '#lib/server/tasks.js';
import type { PageServerLoad } from './$types';

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

	const [deptData, overview] = await Promise.all([
		getDepartmentWeekData(db, weekStart),
		getWeekReportsOverview(db, weekStart)
	]);

	// Merge tasks and difficulties into overview member items for accordion detail (EF-DAS-02)
	const tasksMap = new Map(deptData.members.map((m) => [m.member.id, m.tasks]));

	const enrichedMembers = overview.members.map((item) => ({
		...item,
		tasks: tasksMap.get(item.member.id) ?? []
	}));

	return {
		weekStart,
		prevWeek: shiftWeek(weekStart, -7),
		nextWeek: shiftWeek(weekStart, 7),
		isCurrentWeek: weekStart === currentWeekStart(),
		overview: {
			...overview,
			members: enrichedMembers
		}
	};
};
