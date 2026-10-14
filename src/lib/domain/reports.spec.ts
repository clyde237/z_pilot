import { describe, expect, it } from 'vitest';
import {
	buildWeeklyReportSnapshot,
	formatMonthlyReportFilename,
	generateMonthlyConclusionTemplate,
	generateMonthlyIntroTemplate
} from './reports.js';
import { computeWeeklyProgression } from './tasks.js';
import { weekDays } from './week.js';

describe('buildWeeklyReportSnapshot', () => {
	const days = weekDays('2026-10-12');

	it('creates a complete frozen snapshot adhering to CDC §6.1', () => {
		const tasks = [
			{
				id: 't-1',
				title: 'Rapport technique',
				weight: 2,
				isQuantitative: false,
				isDone: true,
				doneOn: '2026-10-12',
				note: 'Terminé en avance'
			},
			{
				id: 't-2',
				title: 'Contrats clients',
				weight: 3,
				isQuantitative: true,
				targetValue: 5,
				achievedValue: 3,
				unit: 'contrats',
				isDone: false,
				note: 'En attente signature'
			}
		];

		const progression = computeWeeklyProgression(tasks);

		const snapshot = buildWeeklyReportSnapshot({
			organizationName: 'Zingana',
			departmentName: 'Direction Technique',
			member: {
				id: 'm-1',
				fullName: 'Pascal Tchuente',
				username: 'pascal',
				isChef: true
			},
			publishedBy: {
				id: 'c-1',
				fullName: 'Clyde Fanche',
				username: 'clyde'
			},
			weekStart: '2026-10-12',
			weekDays: days,
			version: 1,
			tasks,
			difficulties: 'Coupures de connexion lundi après-midi.',
			chefComment: 'Bonne semaine, finaliser les 2 contrats manquants dès lundi.',
			nextWeekPlannedTasks: [
				{
					id: 'next-1',
					title: 'Déploiement production',
					weight: 3,
					plannedDay: 2
				}
			],
			nextWeekCustomText: 'Prévoir un point d’étape mercredi matin.',
			progression
		});

		expect(snapshot.version).toBe(1);
		expect(snapshot.member.fullName).toBe('Pascal Tchuente');
		expect(snapshot.weekLabel).toContain('Semaine 42');
		expect(snapshot.difficulties).toBe('Coupures de connexion lundi après-midi.');
		expect(snapshot.chefComment).toBe(
			'Bonne semaine, finaliser les 2 contrats manquants dès lundi.'
		);

		// 1 task completed on Monday
		expect(snapshot.completedTasksByDay).toHaveLength(1);
		expect(snapshot.completedTasksByDay[0].dayName).toBe('Lundi');
		expect(snapshot.completedTasksByDay[0].tasks[0].title).toBe('Rapport technique');

		// 1 uncompleted task
		expect(snapshot.uncompletedOrPartialTasks).toHaveLength(1);
		expect(snapshot.uncompletedOrPartialTasks[0].title).toBe('Contrats clients');

		// Next week plan
		expect(snapshot.nextWeekPlan.plannedTasks).toHaveLength(1);
		expect(snapshot.nextWeekPlan.customText).toBe('Prévoir un point d’étape mercredi matin.');
	});
});

describe('formatMonthlyReportFilename', () => {
	it('generates normalized filename adhering to EF-EXP-03 (Rapport_mensuel_YYYY-MM.docx)', () => {
		expect(formatMonthlyReportFilename(2026, 10)).toBe('Rapport_mensuel_2026-10.docx');
		expect(formatMonthlyReportFilename(2026, 4)).toBe('Rapport_mensuel_2026-04.docx');
	});
});

describe('generateMonthlyIntroTemplate & generateMonthlyConclusionTemplate', () => {
	it('generates coherent French prose for monthly introduction (CDC §5.3)', () => {
		const intro = generateMonthlyIntroTemplate({
			monthLabel: 'Octobre 2026',
			teamAveragePct: 87,
			totalCompleted: 52,
			totalAssigned: 60,
			previousEvolutionPct: 4,
			weeksRangeLabel: 'S41 à S44',
			membersCount: 4
		});

		expect(intro).toContain('octobre 2026');
		expect(intro).toContain('87 %');
		expect(intro).toContain('52 tâches sur 60');
		expect(intro).toContain('+4 points par rapport au mois précédent');
		expect(intro).toContain('S41 à S44');
	});

	it('generates coherent French prose for monthly conclusion', () => {
		const conclusion = generateMonthlyConclusionTemplate({
			monthLabel: 'Octobre 2026',
			teamAveragePct: 85
		});

		expect(conclusion).toContain('octobre 2026');
		expect(conclusion).toContain('très satisfaisante');
	});
});
