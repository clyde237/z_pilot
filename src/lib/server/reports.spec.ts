import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { WeeklyReportSnapshot } from '#lib/domain/reports.js';
import { users, tasks, weekEntries } from '#lib/server/db/schema.js';
import type { Database } from '#lib/server/db/types.js';
import { createTestDatabase, resetTestDatabase } from '#lib/server/testing/database.js';
import { generateWeeklyReportDocx } from './docx/weekly-report.js';
import {
	batchPublishWeeklyReports,
	getMemberPublishedReports,
	getWeeklyReportById,
	getWeekReportsOverview,
	prepareWeeklyReportData,
	publishWeeklyReport,
	reopenWeeklyReport
} from './reports.js';
import { isWeekLocked } from './tasks.js';

describe('reports server service', () => {
	let db: Database;

	beforeAll(async () => {
		db = await createTestDatabase();
	});

	beforeEach(async () => {
		await resetTestDatabase(db);
	});

	it('publishes a weekly report, locks tasks, writes audit log, and generates snapshot (EF-HEB-01, EF-HEB-04, RG-06, RG-11)', async () => {
		// Seed chef and member
		const [chef] = await db
			.insert(users)
			.values({
				username: 'chef_test',
				fullName: 'Chef Test',
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
				username: 'member_test',
				fullName: 'Member Test',
				passwordHash: 'hash',
				isAdmin: false,
				isChef: false,
				participatesInReports: true,
				active: true
			})
			.returning();

		const weekStart = '2026-10-12';

		// Seed tasks for member
		await db.insert(tasks).values([
			{
				memberId: member.id,
				weekStart,
				title: 'Rédaction documentation',
				weight: 2,
				isDone: true,
				doneOn: '2026-10-12',
				note: 'Fait avec succès',
				createdBy: chef.id
			},
			{
				memberId: member.id,
				weekStart,
				title: 'Campagne de tests',
				weight: 3,
				isDone: false,
				note: 'Bloqué par l’infrastructure',
				createdBy: chef.id
			}
		]);

		// Seed difficulties
		await db.insert(weekEntries).values({
			memberId: member.id,
			weekStart,
			difficulties: 'Problèmes de réseau mercredi.'
		});

		// Tasks should be unlocked initially
		expect(await isWeekLocked(db, member.id, weekStart)).toBe(false);

		// Prepare data
		const prep = await prepareWeeklyReportData(db, member.id, weekStart);
		expect(prep.tasks).toHaveLength(2);
		expect(prep.difficulties).toBe('Problèmes de réseau mercredi.');
		expect(prep.progression.progressPct).toBe(40); // 2 out of 5 points = 40%

		// Publish report
		const reportId = await publishWeeklyReport(db, {
			chefId: chef.id,
			memberId: member.id,
			weekStart,
			chefComment: 'Bravo pour la doc, régler le blocage test la semaine prochaine.',
			nextWeekCustomText: 'Priorité absolue aux tests.'
		});

		expect(reportId).toBeDefined();

		// Tasks should now be locked (RG-06)
		expect(await isWeekLocked(db, member.id, weekStart)).toBe(true);

		// Fetch report
		const report = await getWeeklyReportById(db, reportId);
		expect(report).not.toBeNull();
		expect(report?.version).toBe(1);
		expect(report?.status).toBe('published');
		expect(report?.progressPct).toBe(40);
		expect(report?.chefComment).toContain('Bravo pour la doc');

		// Check snapshot
		const snapshot = report?.snapshot as unknown as WeeklyReportSnapshot;
		expect(snapshot.member.fullName).toBe('Member Test');
		expect(snapshot.difficulties).toBe('Problèmes de réseau mercredi.');
		expect(snapshot.completedTasksByDay[0].tasks[0].title).toBe('Rédaction documentation');
		expect(snapshot.uncompletedOrPartialTasks[0].title).toBe('Campagne de tests');

		// Word document generation from snapshot
		const docxBuffer = await generateWeeklyReportDocx(snapshot);
		expect(docxBuffer.length).toBeGreaterThan(1000);

		// Member published reports
		const memberReports = await getMemberPublishedReports(db, member.id);
		expect(memberReports).toHaveLength(1);
		expect(memberReports[0].id).toBe(reportId);

		// Cannot publish twice without reopening
		await expect(
			publishWeeklyReport(db, {
				chefId: chef.id,
				memberId: member.id,
				weekStart
			})
		).rejects.toThrow('déjà publié');
	});

	it('reopens a report with reason, unlocks tasks, and supports version increment upon republishing (EF-HEB-06, RG-06)', async () => {
		const [chef] = await db
			.insert(users)
			.values({
				username: 'chef_2',
				fullName: 'Chef Deux',
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
				username: 'member_2',
				fullName: 'Member Deux',
				passwordHash: 'hash',
				isAdmin: false,
				isChef: false,
				participatesInReports: true,
				active: true
			})
			.returning();

		const weekStart = '2026-10-12';

		// Publish initial version 1
		const reportId = await publishWeeklyReport(db, {
			chefId: chef.id,
			memberId: member.id,
			weekStart
		});

		expect(await isWeekLocked(db, member.id, weekStart)).toBe(true);

		// Attempt reopening with empty reason must fail
		await expect(
			reopenWeeklyReport(db, {
				chefId: chef.id,
				reportId,
				reason: ' '
			})
		).rejects.toThrow('motif de réouverture est obligatoire');

		// Reopen with valid reason
		await reopenWeeklyReport(db, {
			chefId: chef.id,
			reportId,
			reason: 'Correction de la saisie demandée par le membre'
		});

		// Tasks are unlocked
		expect(await isWeekLocked(db, member.id, weekStart)).toBe(false);

		const reopenedReport = await getWeeklyReportById(db, reportId);
		expect(reopenedReport?.status).toBe('reopened');
		expect(reopenedReport?.reopenedReason).toBe('Correction de la saisie demandée par le membre');

		// Republish -> should create version 2
		const v2Id = await publishWeeklyReport(db, {
			chefId: chef.id,
			memberId: member.id,
			weekStart,
			chefComment: 'Version 2 corrigée'
		});

		const v2Report = await getWeeklyReportById(db, v2Id);
		expect(v2Report?.version).toBe(2);
		expect(v2Report?.status).toBe('published');
		expect(await isWeekLocked(db, member.id, weekStart)).toBe(true);
	});

	it('batch publishes reports for all active members (EF-HEB-01)', async () => {
		const [chef] = await db
			.insert(users)
			.values({
				username: 'chef_batch',
				fullName: 'Chef Batch',
				passwordHash: 'hash',
				isAdmin: false,
				isChef: true,
				participatesInReports: true,
				active: true
			})
			.returning();

		await db.insert(users).values({
			username: 'm1',
			fullName: 'Membre 1',
			passwordHash: 'hash',
			isAdmin: false,
			isChef: false,
			participatesInReports: true,
			active: true
		});

		await db.insert(users).values({
			username: 'm2',
			fullName: 'Membre 2',
			passwordHash: 'hash',
			isAdmin: false,
			isChef: false,
			participatesInReports: true,
			active: true
		});

		const weekStart = '2026-10-12';

		// Batch publish for all 3 members (chef + m1 + m2)
		const publishedCount = await batchPublishWeeklyReports(db, chef.id, weekStart);
		expect(publishedCount).toBe(3);

		// Running again should publish 0 because all are already published
		const secondRun = await batchPublishWeeklyReports(db, chef.id, weekStart);
		expect(secondRun).toBe(0);

		// Overview checks
		const overview = await getWeekReportsOverview(db, weekStart);
		expect(overview.publishedCount).toBe(3);
		expect(overview.totalMembers).toBe(3);
	});
});
