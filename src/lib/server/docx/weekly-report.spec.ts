import { describe, expect, it } from 'vitest';
import { generateWeeklyReportDocx } from './weekly-report.js';
import { formatWeeklyReportFilename, type WeeklyReportSnapshot } from '#lib/domain/reports.js';

describe('formatWeeklyReportFilename (EF-EXP-03)', () => {
	it('formats filename with member name and ISO week correctly', () => {
		const filename = formatWeeklyReportFilename('Pascaline Nguemo', '2026-10-05');
		expect(filename).toBe('Rapport_hebdo_Pascaline_Nguemo_2026-S41.docx');
	});

	it('strips accents and special characters cleanly', () => {
		const filename = formatWeeklyReportFilename("Éric d'Aurillac-Véran", '2026-01-05');
		expect(filename).toBe('Rapport_hebdo_Eric_d_Aurillac_Veran_2026-S02.docx');
	});

	it('handles single word names', () => {
		const filename = formatWeeklyReportFilename('Dupont', '2026-10-12');
		expect(filename).toBe('Rapport_hebdo_Dupont_2026-S42.docx');
	});

	it('falls back to Membre if name is empty or whitespaces only', () => {
		const filename = formatWeeklyReportFilename('   ', '2026-10-05');
		expect(filename).toBe('Rapport_hebdo_Membre_2026-S41.docx');
	});
});

describe('generateWeeklyReportDocx (EF-EXP-01, EF-EXP-02, EF-EXP-05, REC-06, CDC §6.1 & §6.3)', () => {
	const sampleSnapshot: WeeklyReportSnapshot = {
		organizationName: 'Hôtel Zingana',
		departmentName: 'Service Réception',
		primaryColor: '#0C8054',
		logoDataUrl: null,
		member: {
			id: 'user-1',
			fullName: 'Pascaline Nguemo',
			username: 'pascaline',
			isChef: false
		},
		publishedBy: {
			id: 'chef-1',
			fullName: 'Paul Biya',
			username: 'paul'
		},
		weekStart: '2026-10-05',
		weekLabel: 'Semaine 41 · du 5 au 11 octobre 2026',
		publishedAt: '2026-10-09T17:00:00.000Z',
		version: 1,
		progression: {
			progressPct: 83,
			totalWeight: 6,
			achievedWeight: 5,
			completedTasksCount: 2,
			totalTasksCount: 3
		},
		completedTasksByDay: [
			{
				dayNumber: 1,
				dayName: 'Lundi',
				date: '2026-10-05',
				tasks: [
					{
						id: 'task-1',
						title: 'Accueil des clients VIP',
						description: 'Gestion des arrivées du groupe international',
						weight: 3,
						plannedDay: 1,
						isDone: true,
						doneOn: '2026-10-05',
						note: '5 clients VIP accueillis en suite'
					}
				]
			},
			{
				dayNumber: 3,
				dayName: 'Mercredi',
				date: '2026-10-07',
				tasks: [
					{
						id: 'task-2',
						title: 'Enregistrement des réservations',
						weight: 2,
						plannedDay: 3,
						isQuantitative: true,
						targetValue: 20,
						achievedValue: 20,
						unit: 'dossiers',
						isDone: true,
						doneOn: '2026-10-07',
						note: 'Objectif atteint'
					}
				]
			}
		],
		uncompletedOrPartialTasks: [
			{
				id: 'task-3',
				title: 'Inventaire des fournitures',
				weight: 1,
				plannedDay: 5,
				isDone: false,
				note: 'En attente de livraison fournisseur'
			}
		],
		difficulties: 'Rupture temporaire de papier pour badges.',
		chefComment: 'Très bon travail cette semaine, réactivité exemplaire.',
		nextWeekPlan: {
			plannedTasks: [
				{
					id: 'task-next-1',
					title: 'Formation nouveau logiciel de caisse',
					weight: 2,
					plannedDay: 1
				}
			],
			customText: 'Prévoir un point le mardi matin à 9h.'
		}
	};

	it('generates a valid DOCX buffer for a weekly report (REC-06)', async () => {
		const buffer = await generateWeeklyReportDocx(sampleSnapshot);

		expect(Buffer.isBuffer(buffer)).toBe(true);
		expect(buffer.length).toBeGreaterThan(1000);

		// Every valid .docx is a ZIP package starting with the PK magic number: 0x50 0x4B 0x03 0x04
		expect(buffer[0]).toBe(0x50);
		expect(buffer[1]).toBe(0x4b);
		expect(buffer[2]).toBe(0x03);
		expect(buffer[3]).toBe(0x04);
	});

	it('embeds a valid base64 PNG logo when provided', async () => {
		// Minimal 1x1 transparent PNG in base64
		const minimalPngBase64 =
			'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

		const snapshotWithLogo: WeeklyReportSnapshot = {
			...sampleSnapshot,
			logoDataUrl: minimalPngBase64
		};

		const buffer = await generateWeeklyReportDocx(snapshotWithLogo);

		expect(Buffer.isBuffer(buffer)).toBe(true);
		expect(buffer.length).toBeGreaterThan(1000);
		expect(buffer[0]).toBe(0x50);
		expect(buffer[1]).toBe(0x4b);
	});

	it('generates a valid document when no tasks were completed', async () => {
		const emptyCompletedSnapshot: WeeklyReportSnapshot = {
			...sampleSnapshot,
			progression: {
				progressPct: 0,
				totalWeight: 3,
				achievedWeight: 0,
				completedTasksCount: 0,
				totalTasksCount: 1
			},
			completedTasksByDay: [],
			uncompletedOrPartialTasks: [
				{
					id: 'task-1',
					title: 'Tâche non faite',
					weight: 3,
					isDone: false,
					note: 'Maladie'
				}
			]
		};

		const buffer = await generateWeeklyReportDocx(emptyCompletedSnapshot);
		expect(Buffer.isBuffer(buffer)).toBe(true);
		expect(buffer.length).toBeGreaterThan(1000);
	});

	it('generates a valid document when all tasks are completed at 100%', async () => {
		const allDoneSnapshot: WeeklyReportSnapshot = {
			...sampleSnapshot,
			progression: {
				progressPct: 100,
				totalWeight: 5,
				achievedWeight: 5,
				completedTasksCount: 2,
				totalTasksCount: 2
			},
			uncompletedOrPartialTasks: []
		};

		const buffer = await generateWeeklyReportDocx(allDoneSnapshot);
		expect(Buffer.isBuffer(buffer)).toBe(true);
		expect(buffer.length).toBeGreaterThan(1000);
	});
});
