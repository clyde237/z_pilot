import { error, fail } from '@sveltejs/kit';
import { weekStartOf } from '#lib/domain/week.js';
import { publishReportSchema, reopenReportSchema } from '#lib/schemas/reports.js';
import { requireUser } from '#lib/server/auth/access.js';
import { db } from '#lib/server/db/index.js';
import {
	getWeeklyReportById,
	prepareWeeklyReportData,
	publishWeeklyReport,
	reopenWeeklyReport
} from '#lib/server/reports.js';
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
	const memberId = params.memberId;

	const prep = await prepareWeeklyReportData(db, memberId, weekStart);

	let publishedReport = null;
	if (prep.existingReport && prep.existingReport.status === 'published') {
		publishedReport = await getWeeklyReportById(db, prep.existingReport.id);
	}

	return {
		prep,
		publishedReport,
		weekStart,
		memberId
	};
};

export const actions: Actions = {
	publish: async ({ locals, params, request }) => {
		const chef = requireUser(locals, 'chef');
		const weekStart = normalizeWeekParam(params.semaine);
		const memberId = params.memberId;

		const formData = await request.formData();
		const parsed = publishReportSchema.safeParse({
			chefComment: formData.get('chefComment') ?? '',
			nextWeekCustomText: formData.get('nextWeekCustomText') ?? ''
		});

		if (!parsed.success) {
			return fail(400, {
				error: parsed.error.issues[0]?.message ?? 'Données de formulaire invalides.'
			});
		}

		try {
			const reportId = await publishWeeklyReport(db, {
				chefId: chef.id,
				memberId,
				weekStart,
				chefComment: parsed.data.chefComment,
				nextWeekCustomText: parsed.data.nextWeekCustomText
			});

			return { success: true, reportId };
		} catch (err) {
			return fail(400, {
				error: err instanceof Error ? err.message : 'Erreur lors de la publication.'
			});
		}
	},

	reopen: async ({ locals, request }) => {
		const chef = requireUser(locals, 'chef');
		const formData = await request.formData();
		const reportId = String(formData.get('reportId') ?? '');
		const reopenedReason = String(formData.get('reopenedReason') ?? '');

		const parsed = reopenReportSchema.safeParse({ reopenedReason });
		if (!parsed.success) {
			return fail(400, {
				error: parsed.error.issues[0]?.message ?? 'Le motif de réouverture est obligatoire.'
			});
		}

		try {
			await reopenWeeklyReport(db, {
				chefId: chef.id,
				reportId,
				reason: parsed.data.reopenedReason
			});

			return { success: true, reopened: true };
		} catch (err) {
			return fail(400, {
				error: err instanceof Error ? err.message : 'Erreur lors de la réouverture.'
			});
		}
	}
};
