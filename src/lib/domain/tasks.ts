// Pure business functions for weekly tasks and progression (CDC §4 RG-03, §5.1).
// No DB imports here: pure calculation and formatting only.

export interface TaskProgressionInput {
	weight: number;
	isDone: boolean;
	targetValue?: number | null;
	achievedValue?: number | null;
}

export interface WeeklyProgression {
	/** Rounded to nearest integer, or null when no tasks are assigned ("Aucun objectif défini", RG-03). */
	progressPct: number | null;
	totalWeight: number;
	achievedWeight: number;
	completedTasksCount: number;
	totalTasksCount: number;
}

/**
 * Calculates the weight contribution of a single task (CDC §5.1).
 * - Qualitative task: full weight if done, 0 otherwise.
 * - Quantitative task: proportional contribution weight * min(achieved / target, 1).
 */
export function taskContribution(task: TaskProgressionInput): number {
	const weight = task.weight;
	if (task.targetValue != null && task.targetValue > 0) {
		const achieved = Math.max(0, task.achievedValue ?? 0);
		const ratio = Math.min(achieved / task.targetValue, 1);
		return weight * ratio;
	}
	return task.isDone ? weight : 0;
}

/**
 * Computes weekly progression from an array of tasks according to RG-03.
 * Without assigned tasks, returns progressPct = null (displays « Aucun objectif défini » instead of 0%).
 */
export function computeWeeklyProgression(
	tasks: ReadonlyArray<TaskProgressionInput>
): WeeklyProgression {
	if (tasks.length === 0) {
		return {
			progressPct: null,
			totalWeight: 0,
			achievedWeight: 0,
			completedTasksCount: 0,
			totalTasksCount: 0
		};
	}

	let totalWeight = 0;
	let achievedWeight = 0;
	let completedTasksCount = 0;

	for (const task of tasks) {
		totalWeight += task.weight;
		achievedWeight += taskContribution(task);
		if (task.isDone) {
			completedTasksCount++;
		}
	}

	if (totalWeight <= 0) {
		return {
			progressPct: null,
			totalWeight: 0,
			achievedWeight: 0,
			completedTasksCount,
			totalTasksCount: tasks.length
		};
	}

	const progressPct = Math.round((achievedWeight / totalWeight) * 100);

	return {
		progressPct,
		totalWeight,
		achievedWeight,
		completedTasksCount,
		totalTasksCount: tasks.length
	};
}

export const TASK_WEIGHT_LABELS: Record<number, { label: string; shortLabel: string }> = {
	1: { label: 'Léger', shortLabel: 'Poids 1' },
	2: { label: 'Normal', shortLabel: 'Poids 2' },
	3: { label: 'Important', shortLabel: 'Poids 3' }
};

export const ISO_DAY_NAMES: Record<number, string> = {
	1: 'Lundi',
	2: 'Mardi',
	3: 'Mercredi',
	4: 'Jeudi',
	5: 'Vendredi',
	6: 'Samedi',
	7: 'Dimanche'
};
