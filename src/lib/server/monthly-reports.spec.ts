import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { MonthlyReportSnapshot } from '#lib/domain/reports.js';
import { auditLog, tasks, users } from '#lib/server/db/schema.js';
import type { Database } from '#lib/server/db/types.js';
import { createTestDatabase, resetTestDatabase } from '#lib/server/testing/database.js';
import {
	generateMonthlyReport,
	getMonthlyReportById,
	listMonthlyReports,
	prepareMonthlyReportData
} from './monthly-reports.js';
import { batchPublishWeeklyReports } from './reports.js';

describe('monthly reports server service (EF-MEN-01..06, RG-10, RG-11)', () => {
	let db: Database;

	beforeAll(async () => {
		db = await createTestDatabase();
	});

	beforeEach(async () => {
		await resetTestDatabase(db);
	});

	it('prepares and generates a consolidated monthly report adhering to CDC §6.2', async () => {
		// 1. Seed chef and members
		const [chef] = await db
			.insert(users)
			.values({
				username: 'chef_mensuel',
				fullName: 'Pascal Tchuente',
				passwordHash: 'hash',
				isAdmin: false,
				isChef: true,
				participatesInReports: true,
				active: true
			})
			.returning();

		const [member] = await db
			.insert(users)
			.values({
				username: 'member_mensuel',
				fullName: 'Jean Dupont',
				passwordHash: 'hash',
				isAdmin: false,
				isChef: false,
				participatesInReports: true,
				active: true
			})
			.returning();

		// October 2026 has weeks: 2026-10-05 (S41), 2026-10-12 (S42), 2026-10-19 (S43), 2026-10-26 (S44)
		const weeks = ['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26'];

		// Step A: Prepare data before any weekly report is published (EF-MEN-02)
		const prepBefore = await prepareMonthlyReportData(db, 2026, 10);
		expect(prepBefore.weeks).toEqual(weeks);
		expect(prepBefore.activeMembers).toHaveLength(2);
		expect(prepBefore.publishedWeeklyReports).toHaveLength(0);
		// 2 members * 4 weeks = 8 missing reports
		expect(prepBefore.missingReports).toHaveLength(8);

		// Attempting generation with missing reports must fail if allowMissing is false
		await expect(
			generateMonthlyReport(db, {
				chefId: chef.id,
				year: 2026,
				month: 10,
				allowMissing: false
			})
		).rejects.toThrow('rapports hebdomadaires sont manquants');

		// Generation with allowMissing: true succeeds
		const partialGen = await generateMonthlyReport(db, {
			chefId: chef.id,
			year: 2026,
			month: 10,
			allowMissing: true
		});
		expect(partialGen.version).toBe(1);

		// Step B: Now publish weekly reports for all weeks
		for (const w of weeks) {
			// Add tasks for member and chef
			await db.insert(tasks).values([
				{
					memberId: member.id,
					createdBy: chef.id,
					weekStart: w,
					title: `Tâche Jean ${w}`,
					weight: 2,
					isDone: true,
					doneOn: w
				},
				{
					memberId: chef.id,
					createdBy: chef.id,
					weekStart: w,
					title: `Tâche Pascal ${w}`,
					weight: 3,
					isDone: true,
					doneOn: w
				}
			]);

			await batchPublishWeeklyReports(db, chef.id, w);
		}

		// Step C: Prepare data after publishing all reports
		const prepAfter = await prepareMonthlyReportData(db, 2026, 10);
		expect(prepAfter.missingReports).toHaveLength(0);
		expect(prepAfter.publishedWeeklyReports).toHaveLength(8);
		expect(prepAfter.teamAveragePct).toBe(100);

		// Step D: Generate monthly report (version 2 because version 1 already exists)
		const result = await generateMonthlyReport(db, {
			chefId: chef.id,
			year: 2026,
			month: 10,
			introText: 'Introduction personnalisée par le chef de département.',
			conclusionText: 'Conclusion personnalisée pour le bilan mensuel.'
		});

		expect(result.version).toBe(2);

		// Verify persisted report
		const report = await getMonthlyReportById(db, result.reportId);
		expect(report).toBeDefined();
		expect(report?.year).toBe(2026);
		expect(report?.month).toBe(10);
		expect(report?.version).toBe(2);
		expect(report?.introText).toBe('Introduction personnalisée par le chef de département.');
		expect(report?.conclusionText).toBe('Conclusion personnalisée pour le bilan mensuel.');
		expect(report?.publisherName).toBe('Pascal Tchuente');

		const snapshot = report?.snapshot as unknown as MonthlyReportSnapshot;
		expect(snapshot.year).toBe(2026);
		expect(snapshot.month).toBe(10);
		expect(snapshot.monthLabel).toContain('Octobre 2026');
		expect(snapshot.keyIndicators.teamAverageProgressPct).toBe(100);
		expect(snapshot.keyIndicators.membersSummary).toHaveLength(2);
		expect(snapshot.weeklyEvolution.weeks).toHaveLength(4);
		expect(snapshot.weeklyEvolution.matrixRows).toHaveLength(2);
		expect(snapshot.annexReports).toHaveLength(8);

		// Step E: Verify audit log entry
		const auditEntries = await db.select().from(auditLog);
		const genAudits = auditEntries.filter((a) => a.action === 'monthly_report.generated');
		expect(genAudits).toHaveLength(2);
		expect(genAudits.some((a) => a.entityId === partialGen.reportId && a.userId === chef.id)).toBe(
			true
		);
		expect(genAudits.some((a) => a.entityId === result.reportId && a.userId === chef.id)).toBe(
			true
		);

		// Step F: List monthly reports
		const allReports = await listMonthlyReports(db);
		expect(allReports.length).toBeGreaterThanOrEqual(2);
		expect(allReports[0].version).toBe(2); // latest version first
	});
});
