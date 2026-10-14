import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '#lib/server/auth/access.js';
import { db } from '#lib/server/db/index.js';
import { generateWeeklyReportDocx } from '#lib/server/docx/weekly-report.js';
import { getWeeklyReportById } from '#lib/server/reports.js';
import { formatWeeklyReportFilename, type WeeklyReportSnapshot } from '#lib/domain/reports.js';

export const GET: RequestHandler = async ({ locals, params }) => {
	const user = requireUser(locals, 'authenticated');
	const report = await getWeeklyReportById(db, params.id);

	if (!report) {
		error(404, 'Rapport introuvable.');
	}

	// EF-HEB-05, RG-07: Member can only export their own report. Chef can export any report.
	if (!user.isChef && report.memberId !== user.id) {
		error(403, 'Accès refusé : vous ne pouvez exporter que vos propres rapports.');
	}

	const snapshot = report.snapshot as unknown as WeeklyReportSnapshot;
	const docxBuffer = await generateWeeklyReportDocx(snapshot);

	const filename = formatWeeklyReportFilename(snapshot.member.fullName, report.weekStart);

	return new Response(docxBuffer as unknown as BodyInit, {
		status: 200,
		headers: {
			'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
			'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
			'Cache-Control': 'private, no-cache'
		}
	});
};
