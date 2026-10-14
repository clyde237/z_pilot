import { describe, expect, it } from 'vitest';
import { computeWeeklyProgression, taskContribution, type TaskProgressionInput } from './tasks';

describe('taskContribution', () => {
	it('calculates qualitative tasks (done vs not done)', () => {
		expect(taskContribution({ weight: 2, isDone: true })).toBe(2);
		expect(taskContribution({ weight: 2, isDone: false })).toBe(0);
	});

	it('calculates quantitative tasks proportionally up to target', () => {
		// CDC §5.1 example: weight 3, target 20, achieved 15 -> 3 * (15/20) = 2.25
		expect(
			taskContribution({
				weight: 3,
				isDone: false,
				targetValue: 20,
				achievedValue: 15
			})
		).toBeCloseTo(2.25);

		// Achieved >= target caps at 100% of weight
		expect(
			taskContribution({
				weight: 3,
				isDone: true,
				targetValue: 20,
				achievedValue: 25
			})
		).toBe(3);

		// Achieved = 0 -> 0
		expect(
			taskContribution({
				weight: 3,
				isDone: false,
				targetValue: 20,
				achievedValue: 0
			})
		).toBe(0);
	});
});

describe('computeWeeklyProgression (RG-03, REC-02)', () => {
	it('returns null progressPct when no tasks are assigned (RG-03)', () => {
		const result = computeWeeklyProgression([]);
		expect(result.progressPct).toBeNull();
		expect(result.totalWeight).toBe(0);
		expect(result.achievedWeight).toBe(0);
		expect(result.totalTasksCount).toBe(0);
	});

	it('reproduces CDC §5.1 exact sample scenario (71%)', () => {
		const sampleTasks: TaskProgressionInput[] = [
			{ weight: 2, isDone: true }, // 2.00
			{ weight: 3, isDone: false, targetValue: 20, achievedValue: 15 }, // 2.25
			{ weight: 1, isDone: false } // 0.00
		];

		const result = computeWeeklyProgression(sampleTasks);
		expect(result.totalWeight).toBe(6);
		expect(result.achievedWeight).toBeCloseTo(4.25);
		// 4.25 / 6 * 100 = 70.833... -> rounded to 71%
		expect(result.progressPct).toBe(71);
		expect(result.completedTasksCount).toBe(1);
		expect(result.totalTasksCount).toBe(3);
	});

	it('verifies REC-02: 3 tasks (weights 2, 3, 1) with 1 completed (weight 2)', () => {
		const tasks: TaskProgressionInput[] = [
			{ weight: 2, isDone: true },
			{ weight: 3, isDone: false },
			{ weight: 1, isDone: false }
		];

		const result = computeWeeklyProgression(tasks);
		// 2 / (2+3+1) = 2/6 = 33.33% -> 33%
		expect(result.progressPct).toBe(33);
		expect(result.totalWeight).toBe(6);
		expect(result.achievedWeight).toBe(2);
		expect(result.completedTasksCount).toBe(1);
	});

	it('returns 100% when all tasks are complete', () => {
		const tasks: TaskProgressionInput[] = [
			{ weight: 1, isDone: true },
			{ weight: 3, isDone: true }
		];
		expect(computeWeeklyProgression(tasks).progressPct).toBe(100);
	});

	it('returns 0% when tasks exist but none are done', () => {
		const tasks: TaskProgressionInput[] = [
			{ weight: 2, isDone: false },
			{ weight: 1, isDone: false }
		];
		expect(computeWeeklyProgression(tasks).progressPct).toBe(0);
	});
});
