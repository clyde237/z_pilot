import { formatWeekLabel } from '#lib/format.js';
import type { WeeklyProgression } from './tasks.js';
import { isoWeekOf } from './week.js';

/**
 * Generates a normalized filename for a weekly report Word export (EF-EXP-03).
 * Format: Rapport_hebdo_Nom_2026-S41.docx
 * Accents and special characters are stripped for cross-platform filesystem compatibility.
 */
export function formatWeeklyReportFilename(fullName: string, weekStart: string): string {
	const { week, year } = isoWeekOf(weekStart);
	const weekStr = String(week).padStart(2, '0');
	const sanitizedName = fullName
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-zA-Z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '');

	const namePart = sanitizedName || 'Membre';
	return `Rapport_hebdo_${namePart}_${year}-S${weekStr}.docx`;
}

export interface ReportTaskItem {
	id: string;
	title: string;
	description?: string | null;
	weight: number;
	plannedDay?: number | null;
	isQuantitative?: boolean;
	targetValue?: number | null;
	achievedValue?: number | null;
	unit?: string | null;
	isDone: boolean;
	doneOn?: string | null;
	note?: string | null;
	carriedFromTaskId?: string | null;
}

export interface DayActivityGroup {
	dayNumber: number; // 1 = Monday ... 7 = Sunday
	dayName: string; // "Lundi", "Mardi", etc.
	date: string; // YYYY-MM-DD
	tasks: ReportTaskItem[];
}

export interface NextWeekPlanItem {
	id: string;
	title: string;
	weight: number;
	plannedDay?: number | null;
}

export interface WeeklyReportSnapshot {
	organizationName: string;
	departmentName: string;
	logoDataUrl?: string | null;
	primaryColor?: string | null;
	member: {
		id: string;
		fullName: string;
		username: string;
		isChef: boolean;
	};
	publishedBy: {
		id: string;
		fullName: string;
		username: string;
	};
	weekStart: string; // YYYY-MM-DD (Monday)
	weekLabel: string; // e.g. "Semaine 42 · du 12 au 18 octobre 2026"
	publishedAt: string; // ISO 8601 string
	version: number;
	progression: WeeklyProgression;
	completedTasksByDay: DayActivityGroup[];
	uncompletedOrPartialTasks: ReportTaskItem[];
	difficulties: string;
	chefComment: string;
	nextWeekPlan: {
		plannedTasks: NextWeekPlanItem[];
		customText: string;
	};
}

const DAY_NAMES_FR = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

/**
 * Builds the frozen JSON snapshot of a weekly report adhering to CDC §6.1.
 */
export function buildWeeklyReportSnapshot(params: {
	organizationName: string;
	departmentName: string;
	logoDataUrl?: string | null;
	primaryColor?: string | null;
	member: {
		id: string;
		fullName: string;
		username: string;
		isChef: boolean;
	};
	publishedBy: {
		id: string;
		fullName: string;
		username: string;
	};
	weekStart: string;
	weekDays: string[];
	version: number;
	tasks: ReportTaskItem[];
	difficulties: string;
	chefComment: string;
	nextWeekPlannedTasks: NextWeekPlanItem[];
	nextWeekCustomText: string;
	progression: WeeklyProgression;
	publishedAt?: string;
}): WeeklyReportSnapshot {
	const {
		organizationName,
		departmentName,
		logoDataUrl,
		primaryColor,
		member,
		publishedBy,
		weekStart,
		weekDays,
		version,
		tasks,
		difficulties,
		chefComment,
		nextWeekPlannedTasks,
		nextWeekCustomText,
		progression,
		publishedAt = new Date().toISOString()
	} = params;

	// 1. Group completed tasks by day of completion (or planned day fallback)
	const normalizedTasks: ReportTaskItem[] = tasks.map((t) => ({
		...t,
		isQuantitative: Boolean(t.targetValue && t.targetValue > 0)
	}));

	const completedTasks = normalizedTasks.filter((t) => t.isDone);
	const completedByDay: DayActivityGroup[] = weekDays.map((dateStr, index) => {
		const dayNumber = index + 1;
		const dayTasks = completedTasks.filter((t) => {
			if (t.doneOn) {
				return t.doneOn === dateStr;
			}
			return t.plannedDay === dayNumber;
		});

		return {
			dayNumber,
			dayName: DAY_NAMES_FR[index] ?? `Jour ${dayNumber}`,
			date: dateStr,
			tasks: dayTasks
		};
	});

	// Any completed task that didn't match a specific date goes to Friday or Monday
	const assignedIds = new Set(completedByDay.flatMap((g) => g.tasks.map((t) => t.id)));
	const unassignedCompleted = completedTasks.filter((t) => !assignedIds.has(t.id));
	if (unassignedCompleted.length > 0 && completedByDay[4]) {
		completedByDay[4].tasks.push(...unassignedCompleted);
	}

	// 2. Uncompleted or partial tasks
	const uncompletedOrPartialTasks = normalizedTasks.filter((t) => !t.isDone);

	return {
		organizationName,
		departmentName,
		logoDataUrl,
		primaryColor,
		member,
		publishedBy,
		weekStart,
		weekLabel: formatWeekLabel(weekStart),
		publishedAt,
		version,
		progression,
		completedTasksByDay: completedByDay.filter((group) => group.tasks.length > 0),
		uncompletedOrPartialTasks,
		difficulties: difficulties.trim(),
		chefComment: chefComment.trim(),
		nextWeekPlan: {
			plannedTasks: nextWeekPlannedTasks,
			customText: nextWeekCustomText.trim()
		}
	};
}

/**
 * Generates a normalized filename for a monthly report Word export (EF-EXP-03).
 * Format: Rapport_mensuel_2026-10.docx
 */
export function formatMonthlyReportFilename(year: number, month: number): string {
	const monthStr = String(month).padStart(2, '0');
	return `Rapport_mensuel_${year}-${monthStr}.docx`;
}

export interface MonthlyMemberSummary {
	memberId: string;
	fullName: string;
	username: string;
	isChef: boolean;
	assignedTasksCount: number;
	completedTasksCount: number;
	averageProgressPct: number | null;
}

export interface MonthlyWeekColumn {
	weekStart: string; // YYYY-MM-DD
	weekNumber: number; // e.g. 41
	label: string; // e.g. "S41"
	periodLabel: string; // e.g. "05/10 - 11/10"
	fullWeekLabel: string; // e.g. "Semaine 41 · du 5 au 11 octobre 2026"
}

export interface MonthlyMatrixMemberRow {
	memberId: string;
	fullName: string;
	username: string;
	isChef: boolean;
	ratesByWeek: Record<string, number | null>; // weekStart -> progressPct
	monthlyAveragePct: number | null;
}

export interface MonthlyMemberReviewWeek {
	weekStart: string;
	weekNumber: number;
	version: number;
	progressPct: number | null;
	completedTasks: Array<{
		title: string;
		note?: string | null;
		doneOn?: string | null;
		weight: number;
	}>;
	uncompletedTasks: Array<{
		title: string;
		note?: string | null;
		weight: number;
	}>;
	difficulties: string;
	chefComment: string;
}

export interface MonthlyMemberReview {
	memberId: string;
	fullName: string;
	username: string;
	isChef: boolean;
	weeks: MonthlyMemberReviewWeek[];
	totalCompletedTasks: number;
	monthlyAveragePct: number | null;
}

export interface MonthlyAnnexReport {
	reportId: string;
	memberId: string;
	memberName: string;
	weekStart: string;
	weekNumber: number;
	version: number;
	publishedAt: string;
}

export interface MonthlyReportSnapshot {
	organizationName: string;
	departmentName: string;
	logoDataUrl?: string | null;
	primaryColor?: string | null;
	year: number;
	month: number;
	monthLabel: string; // e.g. "Octobre 2026"
	version: number;
	generatedAt: string; // ISO 8601
	generatedBy: {
		id: string;
		fullName: string;
		username: string;
	};
	introText: string;
	conclusionText: string;
	keyIndicators: {
		teamAverageProgressPct: number | null;
		totalTasksAssigned: number;
		totalTasksCompleted: number;
		previousMonthEvolutionPct: number | null;
		membersSummary: MonthlyMemberSummary[];
	};
	weeklyEvolution: {
		weeks: MonthlyWeekColumn[];
		matrixRows: MonthlyMatrixMemberRow[];
		teamWeeklyAverages: Record<string, number | null>;
	};
	memberReviews: MonthlyMemberReview[];
	recurringDifficulties: string[];
	perspectives: string[];
	annexReports: MonthlyAnnexReport[];
}

/**
 * Automatic text template for monthly introduction (EF-MEN-04, CDC §5.3).
 */
export function generateMonthlyIntroTemplate(params: {
	monthLabel: string;
	teamAveragePct: number | null;
	totalCompleted: number;
	totalAssigned: number;
	previousEvolutionPct: number | null;
	weeksRangeLabel: string;
	membersCount: number;
}): string {
	const avgStr = params.teamAveragePct !== null ? `${params.teamAveragePct} %` : 'N/A';
	let evolutionStr = '';
	if (params.previousEvolutionPct !== null) {
		const sign = params.previousEvolutionPct >= 0 ? '+' : '';
		evolutionStr = `, soit une évolution de ${sign}${params.previousEvolutionPct} point${Math.abs(params.previousEvolutionPct) > 1 ? 's' : ''} par rapport au mois précédent`;
	}
	return `Au cours du mois de ${params.monthLabel.toLowerCase()}, l'équipe (${params.membersCount} collaborateurs) a réalisé ${avgStr} des objectifs fixés (${params.totalCompleted} tâche${params.totalCompleted > 1 ? 's' : ''} sur ${params.totalAssigned})${evolutionStr}. Les semaines ${params.weeksRangeLabel} sont consolidées dans ce rapport.`;
}

/**
 * Automatic text template for monthly conclusion (EF-MEN-04, CDC §5.3).
 */
export function generateMonthlyConclusionTemplate(params: {
	monthLabel: string;
	teamAveragePct: number | null;
}): string {
	const qualif =
		params.teamAveragePct !== null && params.teamAveragePct >= 80
			? 'très satisfaisante'
			: params.teamAveragePct !== null && params.teamAveragePct >= 60
				? 'satisfaisante'
				: 'en cours d’amélioration';
	return `Au terme de ce mois de ${params.monthLabel.toLowerCase()}, la dynamique globale d'exécution au sein du département demeure ${qualif}. Les réalisations accomplies ainsi que les axes de progression et perspectives identifiés serviront de repères opérationnels pour le pilotage du mois à venir.`;
}
