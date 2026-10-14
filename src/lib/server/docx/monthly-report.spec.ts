import { describe, expect, it } from 'vitest';
import type { MonthlyReportSnapshot } from '#lib/domain/reports.js';
import { generateMonthlyReportDocx } from './monthly-report.js';

describe('generateMonthlyReportDocx (EF-MEN-07, EF-EXP-01, EF-EXP-02, EF-EXP-05, CDC §6.2 & §6.3)', () => {
	const sampleMonthlySnapshot: MonthlyReportSnapshot = {
		organizationName: 'Hôtel Zingana',
		departmentName: 'Direction Technique',
		primaryColor: '#0C8054',
		logoDataUrl: null,
		year: 2026,
		month: 10,
		monthLabel: 'Octobre 2026',
		version: 1,
		generatedAt: '2026-10-31T18:00:00.000Z',
		generatedBy: {
			id: 'chef-1',
			fullName: 'Pascal Tchuente',
			username: 'ptchuente'
		},
		introText:
			'Au cours du mois d’octobre 2026, l’équipe a réalisé 88 % des objectifs fixés. Les semaines S41 à S44 sont consolidées dans ce rapport.',
		conclusionText:
			'La dynamique globale d’exécution au sein du département demeure très satisfaisante.',
		keyIndicators: {
			teamAverageProgressPct: 88,
			totalTasksAssigned: 50,
			totalTasksCompleted: 44,
			previousMonthEvolutionPct: 5,
			membersSummary: [
				{
					memberId: 'm-1',
					fullName: 'Pascal Tchuente',
					username: 'ptchuente',
					isChef: true,
					assignedTasksCount: 20,
					completedTasksCount: 18,
					averageProgressPct: 90
				},
				{
					memberId: 'm-2',
					fullName: 'Jean Dupont',
					username: 'jdupont',
					isChef: false,
					assignedTasksCount: 30,
					completedTasksCount: 26,
					averageProgressPct: 86
				}
			]
		},
		weeklyEvolution: {
			weeks: [
				{
					weekStart: '2026-10-05',
					weekNumber: 41,
					label: 'S41',
					periodLabel: '05/10 - 11/10',
					fullWeekLabel: 'Semaine 41 (05/10 - 11/10)'
				},
				{
					weekStart: '2026-10-12',
					weekNumber: 42,
					label: 'S42',
					periodLabel: '12/10 - 18/10',
					fullWeekLabel: 'Semaine 42 (12/10 - 18/10)'
				}
			],
			matrixRows: [
				{
					memberId: 'm-1',
					fullName: 'Pascal Tchuente',
					username: 'ptchuente',
					isChef: true,
					ratesByWeek: {
						'2026-10-05': 90,
						'2026-10-12': 90
					},
					monthlyAveragePct: 90
				},
				{
					memberId: 'm-2',
					fullName: 'Jean Dupont',
					username: 'jdupont',
					isChef: false,
					ratesByWeek: {
						'2026-10-05': 85,
						'2026-10-12': 87
					},
					monthlyAveragePct: 86
				}
			],
			teamWeeklyAverages: {
				'2026-10-05': 88,
				'2026-10-12': 88
			}
		},
		memberReviews: [
			{
				memberId: 'm-1',
				fullName: 'Pascal Tchuente',
				username: 'ptchuente',
				isChef: true,
				weeks: [
					{
						weekStart: '2026-10-05',
						weekNumber: 41,
						version: 1,
						progressPct: 90,
						completedTasks: [
							{
								title: 'Audit sécurité trimestriel',
								note: 'Rapport validé',
								doneOn: '2026-10-06',
								weight: 3
							}
						],
						uncompletedTasks: [],
						difficulties: '',
						chefComment: 'Objectifs atteints.'
					}
				],
				totalCompletedTasks: 1,
				monthlyAveragePct: 90
			}
		],
		recurringDifficulties: [
			'Jean Dupont (05/10 - 11/10) : Retard approvisionnement matériel réseau.'
		],
		perspectives: ['Pascal Tchuente : Lancement du chantier de migration des serveurs.'],
		annexReports: [
			{
				reportId: 'rep-1',
				memberId: 'm-1',
				memberName: 'Pascal Tchuente',
				weekStart: '2026-10-05',
				weekNumber: 41,
				version: 1,
				publishedAt: '2026-10-09T17:00:00.000Z'
			}
		]
	};

	it('generates a valid .docx Buffer adhering to Word specifications (CDC §6.3)', async () => {
		const buffer = await generateMonthlyReportDocx(sampleMonthlySnapshot);
		expect(buffer).toBeInstanceOf(Buffer);
		expect(buffer.length).toBeGreaterThan(1000);

		// Magic number for ZIP/DOCX archive: PK (0x50, 0x4B)
		expect(buffer[0]).toBe(0x50);
		expect(buffer[1]).toBe(0x4b);
	});

	it('handles base64 image logo if provided', async () => {
		const transparentPng1x1 =
			'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

		const buffer = await generateMonthlyReportDocx({
			...sampleMonthlySnapshot,
			logoDataUrl: transparentPng1x1
		});

		expect(buffer.length).toBeGreaterThan(1000);
		expect(buffer[0]).toBe(0x50);
		expect(buffer[1]).toBe(0x4b);
	});
});
