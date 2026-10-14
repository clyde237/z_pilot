import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import type { MonthlyReportSnapshot } from '#lib/domain/reports.js';
import { requireUser } from '#lib/server/auth/access.js';
import { db } from '#lib/server/db/index.js';
import { getMonthlyReportById } from '#lib/server/monthly-reports.js';

export const load: PageServerLoad = async ({ locals, params }) => {
	const user = requireUser(locals, 'authenticated');

	// EF-MEN-07: Monthly report access is reserved for the chef (and admin)
	if (!user.isChef && !user.isAdmin) {
		error(403, 'Accès réservé au chef de département ou à l’administrateur.');
	}

	const report = await getMonthlyReportById(db, params.id);

	if (!report) {
		error(404, 'Rapport mensuel introuvable.');
	}

	const snapshot = report.snapshot as unknown as MonthlyReportSnapshot;

	return {
		report,
		snapshot,
		isChef: user.isChef,
		isAdmin: user.isAdmin
	};
};
