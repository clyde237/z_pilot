import { formatWeekLabel } from '#lib/format.js';
import type { WeeklyProgression } from './tasks.js';

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
