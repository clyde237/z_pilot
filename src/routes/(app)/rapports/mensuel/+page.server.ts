import { error, fail, redirect } from '@sveltejs/kit';
import { formatYearMonth, parseYearMonth, todayInTimeZone } from '#lib/domain/week.js';
import { generateMonthlyReportSchema } from '#lib/schemas/reports.js';
import { requireUser } from '#lib/server/auth/access.js';
import { db } from '#lib/server/db/index.js';
import {
	generateMonthlyReport,
	listMonthlyReports,
	prepareMonthlyReportData
} from '#lib/server/monthly-reports.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = requireUser(locals, 'authenticated');
	if (!user.isChef && !user.isAdmin) {
		error(403, 'Accès réservé au chef de département ou à l’administrateur.');
	}

	const today = todayInTimeZone();
	const currentYearMonth = today.slice(0, 7); // "YYYY-MM"
	const moisParam = url.searchParams.get('mois') || currentYearMonth;

	let year: number;
	let month: number;
	try {
		const parsed = parseYearMonth(moisParam);
		year = parsed.year;
		month = parsed.month;
	} catch {
		const parsed = parseYearMonth(currentYearMonth);
		year = parsed.year;
		month = parsed.month;
	}

	const prep = await prepareMonthlyReportData(db, year, month);
	const allReports = await listMonthlyReports(db);

	const prevYear = month === 1 ? year - 1 : year;
	const prevMonth = month === 1 ? 12 : month - 1;
	const nextYear = month === 12 ? year + 1 : year;
	const nextMonth = month === 12 ? 1 : month + 1;

	return {
		prep,
		selectedYear: year,
		selectedMonth: month,
		selectedYearMonth: formatYearMonth(year, month),
		prevMonthParam: formatYearMonth(prevYear, prevMonth),
		nextMonthParam: formatYearMonth(nextYear, nextMonth),
		isCurrentMonth: formatYearMonth(year, month) === currentYearMonth,
		allReports
	};
};

export const actions: Actions = {
	generate: async ({ request, locals }) => {
		const user = requireUser(locals, 'authenticated');
		if (!user.isChef && !user.isAdmin) {
			return fail(403, { error: 'Accès réservé au chef de département ou à l’administrateur.' });
		}

		const formData = await request.formData();
		const year = Number(formData.get('year'));
		const month = Number(formData.get('month'));
		const introText = String(formData.get('introText') ?? '');
		const conclusionText = String(formData.get('conclusionText') ?? '');
		const allowMissing = formData.get('allowMissing') === 'true';

		const parsed = generateMonthlyReportSchema.safeParse({
			year,
			month,
			introText,
			conclusionText,
			allowMissing
		});

		if (!parsed.success) {
			return fail(400, {
				error: parsed.error.issues[0]?.message ?? 'Paramètres invalides.'
			});
		}

		let reportId: string;
		try {
			const result = await generateMonthlyReport(db, {
				chefId: user.id,
				year: parsed.data.year,
				month: parsed.data.month,
				introText: parsed.data.introText,
				conclusionText: parsed.data.conclusionText,
				allowMissing: parsed.data.allowMissing
			});
			reportId = result.reportId;
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Erreur lors de la génération.';
			return fail(400, { error: message });
		}

		redirect(303, `/rapports/mensuel/${reportId}`);
	}
};
