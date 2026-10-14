import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireUser } from '#lib/server/auth/access.js';
import { db } from '#lib/server/db/index.js';
import { generateWeeklyReportDocx } from '#lib/server/docx/weekly-report.js';
import { getWeeklyReportById } from '#lib/server/reports.js';
import type { WeeklyReportSnapshot } from '#lib/domain/reports.js';
import { isoWeekOf } from '#lib/domain/week.js';

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

	const { week, year } = isoWeekOf(report.weekStart);
	const sanitizedName = snapshot.member.fullName
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-zA-Z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '');

	const filename = `Rapport_Hebdo_${year}_S${week}_${sanitizedName}.docx`;

	return new Response(docxBuffer as unknown as BodyInit, {
		status: 200,
		headers: {
			'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
			'Content-Disposition': `attachment; filename="${filename}"`,
			'Cache-Control': 'private, no-cache'
		}
	});
};
