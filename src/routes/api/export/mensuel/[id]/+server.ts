import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { formatMonthlyReportFilename, type MonthlyReportSnapshot } from '#lib/domain/reports.js';
import { requireUser } from '#lib/server/auth/access.js';
import { db } from '#lib/server/db/index.js';
import { generateMonthlyReportDocx } from '#lib/server/docx/monthly-report.js';
import { getMonthlyReportById } from '#lib/server/monthly-reports.js';

export const GET: RequestHandler = async ({ locals, params }) => {
	const user = requireUser(locals, 'authenticated');

	// EF-MEN-07: Monthly report export is reserved for the chef (and admin)
	if (!user.isChef && !user.isAdmin) {
		error(403, 'Accès réservé au chef de département ou à l’administrateur.');
	}

	const report = await getMonthlyReportById(db, params.id);

	if (!report) {
		error(404, 'Rapport mensuel introuvable.');
	}

	const snapshot = report.snapshot as unknown as MonthlyReportSnapshot;
	const docxBuffer = await generateMonthlyReportDocx(snapshot);

	const filename = formatMonthlyReportFilename(report.year, report.month);

	return new Response(docxBuffer as unknown as BodyInit, {
		status: 200,
		headers: {
			'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
			'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
			'Cache-Control': 'private, no-cache'
		}
	});
};
