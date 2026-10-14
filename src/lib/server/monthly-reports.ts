import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import {
	generateMonthlyConclusionTemplate,
	generateMonthlyIntroTemplate,
	type MonthlyAnnexReport,
	type MonthlyMatrixMemberRow,
	type MonthlyMemberReview,
	type MonthlyMemberSummary,
	type MonthlyReportSnapshot,
	type MonthlyWeekColumn,
	type WeeklyReportSnapshot
} from '#lib/domain/reports.js';
import { formatMonthLabel } from '#lib/format.js';
import { isoWeekOf, monthWeeks, weekDays, type IsoDate } from '#lib/domain/week.js';
import {
	auditLog,
	monthlyReports,
	settings,
	users,
	weeklyReports,
	type MonthlyReport
} from '#lib/server/db/schema.js';
import type { Database } from '#lib/server/db/types.js';

export interface MonthlyReportWithPublisher extends MonthlyReport {
	publisherName?: string;
	publisherUsername?: string;
}

export interface MissingWeeklyReportItem {
	member: {
		id: string;
		fullName: string;
		username: string;
		isChef: boolean;
	};
	weekStart: IsoDate;
	weekNumber: number;
	periodLabel: string;
}

export interface PreparedMonthlyData {
	year: number;
	month: number;
	monthLabel: string;
	weeks: IsoDate[];
	weekColumns: MonthlyWeekColumn[];
	activeMembers: Array<{
		id: string;
		fullName: string;
		username: string;
		isChef: boolean;
	}>;
	publishedWeeklyReports: Array<{
		id: string;
		memberId: string;
		weekStart: string;
		version: number;
		progressPct: number | null;
		snapshot: unknown;
		publishedAt: Date;
	}>;
	missingReports: MissingWeeklyReportItem[];
	existingReports: MonthlyReport[];
	latestMonthlyReport: MonthlyReport | null;
	teamAveragePct: number | null;
	totalTasksAssigned: number;
	totalTasksCompleted: number;
	previousMonthEvolutionPct: number | null;
	defaultIntro: string;
	defaultConclusion: string;
	canGenerate: boolean;
}

/**
 * Formats a short week period, e.g. "05/10 - 11/10"
 */
function formatShortPeriod(weekStart: IsoDate): string {
	const days = weekDays(weekStart);
	const startParts = days[0].split('-');
	const endParts = days[6].split('-');
	return `${startParts[2]}/${startParts[1]} - ${endParts[2]}/${endParts[1]}`;
}

/**
 * Prepares and consolidates all data for a monthly report overview & generation (EF-MEN-01, EF-MEN-02, EF-MEN-05, RG-10).
 */
export async function prepareMonthlyReportData(
	db: Database,
	year: number,
	month: number
): Promise<PreparedMonthlyData> {
	if (month < 1 || month > 12) {
		throw new RangeError(`Mois invalide: ${month}`);
	}

	const weeks = monthWeeks(year, month);
	const monthLabel = formatMonthLabel(year, month);

	const weekColumns: MonthlyWeekColumn[] = weeks.map((w) => {
		const { week } = isoWeekOf(w);
		return {
			weekStart: w,
			weekNumber: week,
			label: `S${week}`,
			periodLabel: formatShortPeriod(w),
			fullWeekLabel: `Semaine ${week} (${formatShortPeriod(w)})`
		};
	});

	// Active participating members (EF-USR-06, RG-08)
	const activeMembers = await db
		.select({
			id: users.id,
			fullName: users.fullName,
			username: users.username,
			isChef: users.isChef
		})
		.from(users)
		.where(and(eq(users.active, true), eq(users.participatesInReports, true)))
		.orderBy(desc(users.isChef), asc(users.fullName));

	// Load published weekly reports for all weeks in this month
	const publishedWeeklyReports =
		weeks.length > 0
			? await db
					.select({
						id: weeklyReports.id,
						memberId: weeklyReports.memberId,
						weekStart: weeklyReports.weekStart,
						version: weeklyReports.version,
						progressPct: weeklyReports.progressPct,
						snapshot: weeklyReports.snapshot,
						publishedAt: weeklyReports.publishedAt
					})
					.from(weeklyReports)
					.where(
						and(inArray(weeklyReports.weekStart, weeks), eq(weeklyReports.status, 'published'))
					)
					.orderBy(asc(weeklyReports.weekStart))
			: [];

	// Map of published reports: `${memberId}:${weekStart}`
	const reportMap = new Map<string, (typeof publishedWeeklyReports)[number]>();
	for (const rep of publishedWeeklyReports) {
		reportMap.set(`${rep.memberId}:${rep.weekStart}`, rep);
	}

	// Detect missing reports (EF-MEN-02)
	const missingReports: MissingWeeklyReportItem[] = [];
	for (const weekStart of weeks) {
		const { week } = isoWeekOf(weekStart);
		const periodLabel = formatShortPeriod(weekStart);
		for (const member of activeMembers) {
			if (!reportMap.has(`${member.id}:${weekStart}`)) {
				missingReports.push({
					member,
					weekStart,
					weekNumber: week,
					periodLabel
				});
			}
		}
	}

	// Existing monthly reports for this month
	const existingReports = await db
		.select()
		.from(monthlyReports)
		.where(and(eq(monthlyReports.year, year), eq(monthlyReports.month, month)))
		.orderBy(desc(monthlyReports.version));

	const latestMonthlyReport = existingReports[0] ?? null;

	// Calculate tasks totals & team average from published reports
	let totalTasksAssigned = 0;
	let totalTasksCompleted = 0;
	const memberAverages: number[] = [];

	for (const rep of publishedWeeklyReports) {
		const snap = rep.snapshot as unknown as WeeklyReportSnapshot | null;
		if (snap?.progression) {
			totalTasksAssigned += snap.progression.totalTasksCount;
			totalTasksCompleted += snap.progression.completedTasksCount;
		}
		if (rep.progressPct !== null) {
			memberAverages.push(rep.progressPct);
		}
	}

	const teamAveragePct =
		memberAverages.length > 0
			? Math.round(memberAverages.reduce((sum, v) => sum + v, 0) / memberAverages.length)
			: null;

	// Previous month report to calculate evolution (EF-MEN-03)
	const prevMonth = month === 1 ? 12 : month - 1;
	const prevYear = month === 1 ? year - 1 : year;

	const [prevMonthly] = await db
		.select({ snapshot: monthlyReports.snapshot })
		.from(monthlyReports)
		.where(and(eq(monthlyReports.year, prevYear), eq(monthlyReports.month, prevMonth)))
		.orderBy(desc(monthlyReports.version))
		.limit(1);

	let previousMonthEvolutionPct: number | null = null;
	if (prevMonthly?.snapshot && teamAveragePct !== null) {
		const prevSnap = prevMonthly.snapshot as unknown as MonthlyReportSnapshot;
		if (
			prevSnap.keyIndicators?.teamAverageProgressPct !== undefined &&
			prevSnap.keyIndicators?.teamAverageProgressPct !== null
		) {
			previousMonthEvolutionPct = teamAveragePct - prevSnap.keyIndicators.teamAverageProgressPct;
		}
	}

	const firstWeekNum = weekColumns[0]?.weekNumber ?? 1;
	const lastWeekNum = weekColumns[weekColumns.length - 1]?.weekNumber ?? 1;
	const weeksRangeLabel =
		firstWeekNum === lastWeekNum ? `S${firstWeekNum}` : `S${firstWeekNum} à S${lastWeekNum}`;

	const defaultIntro = generateMonthlyIntroTemplate({
		monthLabel,
		teamAveragePct,
		totalCompleted: totalTasksCompleted,
		totalAssigned: totalTasksAssigned,
		previousEvolutionPct: previousMonthEvolutionPct,
		weeksRangeLabel,
		membersCount: activeMembers.length
	});

	const defaultConclusion = generateMonthlyConclusionTemplate({
		monthLabel,
		teamAveragePct
	});

	return {
		year,
		month,
		monthLabel,
		weeks,
		weekColumns,
		activeMembers,
		publishedWeeklyReports,
		missingReports,
		existingReports,
		latestMonthlyReport,
		teamAveragePct,
		totalTasksAssigned,
		totalTasksCompleted,
		previousMonthEvolutionPct,
		defaultIntro,
		defaultConclusion,
		canGenerate: activeMembers.length > 0 && weeks.length > 0
	};
}

/**
 * Generates a monthly report snapshot and saves it as a new version in `monthly_reports` (EF-MEN-01..06, RG-10, RG-11).
 */
export async function generateMonthlyReport(
	db: Database,
	params: {
		chefId: string;
		year: number;
		month: number;
		introText?: string;
		conclusionText?: string;
		allowMissing?: boolean;
	}
): Promise<{ reportId: string; version: number }> {
	const { chefId, year, month, allowMissing = false } = params;

	const prep = await prepareMonthlyReportData(db, year, month);

	if (!prep.canGenerate) {
		throw new Error(
			'Impossible de générer le rapport : aucun membre ou semaine trouvée pour ce mois.'
		);
	}

	if (prep.missingReports.length > 0 && !allowMissing) {
		throw new Error(
			`Certains rapports hebdomadaires sont manquants (${prep.missingReports.length} rapport(s)). Veuillez confirmer pour forcer la génération.`
		);
	}

	// Fetch generator user
	const [chef] = await db
		.select({
			id: users.id,
			fullName: users.fullName,
			username: users.username
		})
		.from(users)
		.where(eq(users.id, chefId));

	if (!chef) throw new Error('Utilisateur introuvable.');

	// Fetch organization settings
	const [appSettings] = await db.select().from(settings).limit(1);

	// Build key indicators per member
	const membersSummary: MonthlyMemberSummary[] = prep.activeMembers.map((member) => {
		const memberReports = prep.publishedWeeklyReports.filter((r) => r.memberId === member.id);
		let assigned = 0;
		let completed = 0;
		const rates: number[] = [];

		for (const r of memberReports) {
			const s = r.snapshot as unknown as WeeklyReportSnapshot | null;
			if (s?.progression) {
				assigned += s.progression.totalTasksCount;
				completed += s.progression.completedTasksCount;
			}
			if (r.progressPct !== null) rates.push(r.progressPct);
		}

		const averageProgressPct =
			rates.length > 0 ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : null;

		return {
			memberId: member.id,
			fullName: member.fullName,
			username: member.username,
			isChef: member.isChef,
			assignedTasksCount: assigned,
			completedTasksCount: completed,
			averageProgressPct
		};
	});

	// Build weekly evolution matrix
	const teamWeeklyAverages: Record<string, number | null> = {};
	for (const weekStart of prep.weeks) {
		const weekReports = prep.publishedWeeklyReports.filter((r) => r.weekStart === weekStart);
		const validRates = weekReports.map((r) => r.progressPct).filter((p): p is number => p !== null);
		teamWeeklyAverages[weekStart] =
			validRates.length > 0
				? Math.round(validRates.reduce((a, b) => a + b, 0) / validRates.length)
				: null;
	}

	const matrixRows: MonthlyMatrixMemberRow[] = prep.activeMembers.map((member) => {
		const ratesByWeek: Record<string, number | null> = {};
		const memberRates: number[] = [];

		for (const weekStart of prep.weeks) {
			const rep = prep.publishedWeeklyReports.find(
				(r) => r.memberId === member.id && r.weekStart === weekStart
			);
			ratesByWeek[weekStart] = rep ? rep.progressPct : null;
			if (rep && rep.progressPct !== null) {
				memberRates.push(rep.progressPct);
			}
		}

		const monthlyAveragePct =
			memberRates.length > 0
				? Math.round(memberRates.reduce((a, b) => a + b, 0) / memberRates.length)
				: null;

		return {
			memberId: member.id,
			fullName: member.fullName,
			username: member.username,
			isChef: member.isChef,
			ratesByWeek,
			monthlyAveragePct
		};
	});

	// Build member reviews & achievements
	const recurringDifficultiesList: string[] = [];
	const perspectivesList: string[] = [];

	const memberReviews: MonthlyMemberReview[] = prep.activeMembers.map((member) => {
		const memberReports = prep.publishedWeeklyReports.filter((r) => r.memberId === member.id);
		let totalCompleted = 0;
		const rates: number[] = [];

		const weeksReview = memberReports.map((r) => {
			const snap = r.snapshot as unknown as WeeklyReportSnapshot;
			const { week } = isoWeekOf(r.weekStart);

			const completedTasks = (snap.completedTasksByDay || []).flatMap((day) =>
				(day.tasks || []).map((t) => ({
					title: t.title,
					note: t.note ?? null,
					doneOn: t.doneOn ?? null,
					weight: t.weight
				}))
			);

			totalCompleted += completedTasks.length;

			const uncompletedTasks = (snap.uncompletedOrPartialTasks || []).map((t) => ({
				title: t.title,
				note: t.note ?? null,
				weight: t.weight
			}));

			if (snap.difficulties && snap.difficulties.trim().length > 0) {
				recurringDifficultiesList.push(
					`${member.fullName} (${formatShortPeriod(r.weekStart)}) : ${snap.difficulties.trim()}`
				);
			}

			if (snap.nextWeekPlan?.customText && snap.nextWeekPlan.customText.trim().length > 0) {
				perspectivesList.push(`${member.fullName} : ${snap.nextWeekPlan.customText.trim()}`);
			}

			if (r.progressPct !== null) rates.push(r.progressPct);

			return {
				weekStart: r.weekStart,
				weekNumber: week,
				version: r.version,
				progressPct: r.progressPct,
				completedTasks,
				uncompletedTasks,
				difficulties: snap.difficulties || '',
				chefComment: snap.chefComment || ''
			};
		});

		const monthlyAveragePct =
			rates.length > 0 ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : null;

		return {
			memberId: member.id,
			fullName: member.fullName,
			username: member.username,
			isChef: member.isChef,
			weeks: weeksReview,
			totalCompletedTasks: totalCompleted,
			monthlyAveragePct
		};
	});

	// Build annex reports list
	const annexReports: MonthlyAnnexReport[] = prep.publishedWeeklyReports.map((r) => {
		const member = prep.activeMembers.find((m) => m.id === r.memberId);
		const { week } = isoWeekOf(r.weekStart);
		return {
			reportId: r.id,
			memberId: r.memberId,
			memberName: member?.fullName ?? 'Membre',
			weekStart: r.weekStart,
			weekNumber: week,
			version: r.version,
			publishedAt: r.publishedAt.toISOString()
		};
	});

	const finalIntro = params.introText?.trim() || prep.defaultIntro;
	const finalConclusion = params.conclusionText?.trim() || prep.defaultConclusion;

	// Calculate next version
	const nextVersion = prep.latestMonthlyReport ? prep.latestMonthlyReport.version + 1 : 1;

	const logoDataUrl =
		appSettings?.logo && appSettings.logoMimeType
			? `data:${appSettings.logoMimeType};base64,${Buffer.from(appSettings.logo).toString('base64')}`
			: null;

	const snapshot: MonthlyReportSnapshot = {
		organizationName: appSettings?.organizationName || 'Z_Pilot',
		departmentName: appSettings?.departmentName || 'Département',
		logoDataUrl,
		primaryColor: appSettings?.primaryColor ?? null,
		year,
		month,
		monthLabel: prep.monthLabel,
		version: nextVersion,
		generatedAt: new Date().toISOString(),
		generatedBy: {
			id: chef.id,
			fullName: chef.fullName,
			username: chef.username
		},
		introText: finalIntro,
		conclusionText: finalConclusion,
		keyIndicators: {
			teamAverageProgressPct: prep.teamAveragePct,
			totalTasksAssigned: prep.totalTasksAssigned,
			totalTasksCompleted: prep.totalTasksCompleted,
			previousMonthEvolutionPct: prep.previousMonthEvolutionPct,
			membersSummary
		},
		weeklyEvolution: {
			weeks: prep.weekColumns,
			matrixRows,
			teamWeeklyAverages
		},
		memberReviews,
		recurringDifficulties: recurringDifficultiesList,
		perspectives: perspectivesList,
		annexReports
	};

	let reportId: string;

	await db.transaction(async (tx) => {
		const [created] = await tx
			.insert(monthlyReports)
			.values({
				year,
				month,
				version: nextVersion,
				snapshot,
				introText: finalIntro,
				conclusionText: finalConclusion,
				generatedBy: chefId
			})
			.returning({ id: monthlyReports.id });

		reportId = created.id;

		await tx.insert(auditLog).values({
			userId: chefId,
			action: 'monthly_report.generated',
			entity: 'monthly_report',
			entityId: created.id,
			details: {
				year,
				month,
				version: nextVersion,
				teamAveragePct: prep.teamAveragePct,
				missingReportsCount: prep.missingReports.length
			}
		});
	});

	return { reportId: reportId!, version: nextVersion };
}

/**
 * Loads a monthly report by ID with its publisher information.
 */
export async function getMonthlyReportById(
	db: Database,
	id: string
): Promise<MonthlyReportWithPublisher | null> {
	const [report] = await db
		.select({
			id: monthlyReports.id,
			year: monthlyReports.year,
			month: monthlyReports.month,
			version: monthlyReports.version,
			snapshot: monthlyReports.snapshot,
			introText: monthlyReports.introText,
			conclusionText: monthlyReports.conclusionText,
			generatedBy: monthlyReports.generatedBy,
			generatedAt: monthlyReports.generatedAt,
			publisherName: users.fullName,
			publisherUsername: users.username
		})
		.from(monthlyReports)
		.innerJoin(users, eq(monthlyReports.generatedBy, users.id))
		.where(eq(monthlyReports.id, id));

	return report ?? null;
}

/**
 * Lists all generated monthly reports (ordered by year desc, month desc, version desc).
 */
export async function listMonthlyReports(db: Database): Promise<MonthlyReportWithPublisher[]> {
	return db
		.select({
			id: monthlyReports.id,
			year: monthlyReports.year,
			month: monthlyReports.month,
			version: monthlyReports.version,
			snapshot: monthlyReports.snapshot,
			introText: monthlyReports.introText,
			conclusionText: monthlyReports.conclusionText,
			generatedBy: monthlyReports.generatedBy,
			generatedAt: monthlyReports.generatedAt,
			publisherName: users.fullName,
			publisherUsername: users.username
		})
		.from(monthlyReports)
		.innerJoin(users, eq(monthlyReports.generatedBy, users.id))
		.orderBy(desc(monthlyReports.year), desc(monthlyReports.month), desc(monthlyReports.version));
}
