import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { WeeklyReportSnapshot } from '#lib/domain/reports.js';
import { requireUser } from '#lib/server/auth/access.js';
import { db } from '#lib/server/db/index.js';
import { getWeeklyReportById } from '#lib/server/reports.js';

export const load: PageServerLoad = async ({ locals, params }) => {
	const user = requireUser(locals, 'authenticated');
	const report = await getWeeklyReportById(db, params.id);

	if (!report) {
		error(404, 'Rapport introuvable.');
	}

	// EF-HEB-05, RG-07: Member can only view their own report. Chef can view any.
	if (!user.isChef && report.memberId !== user.id) {
		error(403, 'Accès refusé : vous ne pouvez consulter que vos propres rapports.');
	}

	const snapshot = report.snapshot as unknown as WeeklyReportSnapshot;

	return {
		report,
		snapshot,
		isChef: user.isChef
	};
};
