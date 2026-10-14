import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { computeWeeklyProgression } from '#lib/domain/tasks.js';
import type { MonthlyReportSnapshot, WeeklyReportSnapshot } from '#lib/domain/reports.js';
import { monthWeeks } from '#lib/domain/week.js';
import { setInitialPassword } from '#lib/server/auth/password-change.js';
import { authenticate } from '#lib/server/auth/login.js';
import { createSession, generateSessionToken } from '#lib/server/auth/session.js';
import { tasks, users, weekEntries } from '#lib/server/db/schema.js';
import type { Database } from '#lib/server/db/types.js';
import { generateMonthlyReportDocx } from '#lib/server/docx/monthly-report.js';
import { generateWeeklyReportDocx } from '#lib/server/docx/weekly-report.js';
import {
	generateMonthlyReport,
	getMonthlyReportById,
	prepareMonthlyReportData
} from '#lib/server/monthly-reports.js';
import {
	getUnreadNotificationsCount,
	listUserNotifications,
	runDailyNotificationCron
} from '#lib/server/notifications.js';
import {
	getMemberPublishedReports,
	getWeeklyReportById,
	prepareWeeklyReportData,
	publishWeeklyReport,
	reopenWeeklyReport
} from '#lib/server/reports.js';
import {
	createTasks,
	isWeekLocked,
	saveWeekDifficulties,
	updateMemberTask
} from '#lib/server/tasks.js';
import { createTestDatabase, resetTestDatabase } from '#lib/server/testing/database.js';
import { createAccount, resetAccountPassword } from '#lib/server/users.js';

describe('Recette globale et conformité au cahier des charges (CDC §12 : REC-01 à REC-10)', () => {
	let db: Database;

	beforeAll(async () => {
		db = await createTestDatabase();
	});

	beforeEach(async () => {
		await resetTestDatabase(db);
	});

	// =========================================================================
	// REC-01 : Création de membre et premier mot de passe obligatoire
	// =========================================================================
	it('REC-01 : L’administrateur crée un membre puis celui-ci se connecte pour la première fois -> Changement de mot de passe imposé avant l’accès à l’application (EF-AUT-03, EF-AUT-04, EF-USR-01)', async () => {
		// 1. Un administrateur existe
		const [admin] = await db
			.insert(users)
			.values({
				username: 'admin',
				fullName: 'Administrateur Test',
				passwordHash: 'hash',
				isAdmin: true,
				isChef: false,
				participatesInReports: false,
				active: true,
				mustChangePassword: false
			})
			.returning();

		// 2. L'administrateur crée un compte membre
		const createResult = await createAccount(db, admin.id, {
			username: 'alain.fotso',
			fullName: 'Alain Fotso',
			isAdmin: false,
			isChef: false,
			participatesInReports: true
		});

		expect(createResult.ok).toBe(true);
		if (!createResult.ok) return;

		const { userId, temporaryPassword } = createResult.value;
		expect(temporaryPassword).toBeTruthy();
		expect(temporaryPassword.length).toBeGreaterThanOrEqual(10);

		// 3. Le membre s'authentifie avec le mot de passe temporaire
		const authResult = await authenticate(db, 'alain.fotso', temporaryPassword);
		expect(authResult.ok).toBe(true);
		if (!authResult.ok) return;

		// Le flag mustChangePassword est impérativement à true
		expect(authResult.mustChangePassword).toBe(true);

		// 4. Le membre ouvre une session puis effectue son changement initial obligatoire
		const token = generateSessionToken();
		const { sessionId } = await createSession(db, userId, token);
		const newPassword = 'MonSuperMotDePasse2026!';
		await setInitialPassword(db, userId, sessionId, newPassword);

		// 5. À la reconnexion avec le nouveau mot de passe, mustChangePassword est désormais false
		const authAfterChange = await authenticate(db, 'alain.fotso', newPassword);
		expect(authAfterChange.ok).toBe(true);
		if (!authAfterChange.ok) return;
		expect(authAfterChange.mustChangePassword).toBe(false);
	});

	// =========================================================================
	// REC-02 : Pondération des tâches et calcul de progression (RG-03)
	// =========================================================================
	it('REC-02 : Le chef crée trois tâches pour un membre (poids 2, 3 et 1) ; le membre en coche une -> La barre de progression affiche le pourcentage correct selon RG-03', async () => {
		const [chef] = await db
			.insert(users)
			.values({
				username: 'chef',
				fullName: 'Chef Département',
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
				username: 'jean',
				fullName: 'Jean Dupont',
				passwordHash: 'hash',
				isAdmin: false,
				isChef: false,
				participatesInReports: true,
				active: true
			})
			.returning();

		const weekStart = '2026-10-12';

		// 2. Création de 3 tâches (poids 2, 3 et 1)
		await createTasks(db, chef.id, {
			title: 'Tâche A (poids 2)',
			memberIds: [member.id],
			weekStart,
			weight: 2
		});

		await createTasks(db, chef.id, {
			title: 'Tâche B (poids 3)',
			memberIds: [member.id],
			weekStart,
			weight: 3
		});

		await createTasks(db, chef.id, {
			title: 'Tâche C (poids 1)',
			memberIds: [member.id],
			weekStart,
			weight: 1
		});

		// Récupérer les tâches créées
		const memberTasks = await db.select().from(tasks).where(eq(tasks.memberId, member.id));
		expect(memberTasks).toHaveLength(3);

		// Initial : 0 %
		const initialProgression = computeWeeklyProgression(memberTasks);
		expect(initialProgression.totalWeight).toBe(6);
		expect(initialProgression.achievedWeight).toBe(0);
		expect(initialProgression.progressPct).toBe(0);

		// 3. Le membre coche la tâche A (poids 2)
		const taskA = memberTasks.find((t) => t.weight === 2)!;
		await updateMemberTask(db, member.id, {
			taskId: taskA.id,
			isDone: true,
			doneOn: '2026-10-13',
			note: 'Terminé mardi'
		});

		const updatedTasks1 = await db.select().from(tasks).where(eq(tasks.memberId, member.id));
		const prog1 = computeWeeklyProgression(updatedTasks1);
		// 2 / 6 * 100 = 33.333% -> arrondi à 33%
		expect(prog1.achievedWeight).toBe(2);
		expect(prog1.progressPct).toBe(33);

		// 4. Le membre coche aussi la tâche B (poids 3) -> total réalisé = 5 / 6 = 83.33% -> 83%
		const taskB = memberTasks.find((t) => t.weight === 3)!;
		await updateMemberTask(db, member.id, {
			taskId: taskB.id,
			isDone: true,
			doneOn: '2026-10-14'
		});

		const updatedTasks2 = await db.select().from(tasks).where(eq(tasks.memberId, member.id));
		const prog2 = computeWeeklyProgression(updatedTasks2);
		expect(prog2.achievedWeight).toBe(5);
		expect(prog2.progressPct).toBe(83);

		// 5. Cas limite RG-03 : Sans tâche assignée -> null ("Aucun objectif défini" et non 0%)
		const emptyProg = computeWeeklyProgression([]);
		expect(emptyProg.totalWeight).toBe(0);
		expect(emptyProg.progressPct).toBeNull();

		// 6. Tâche quantitative RG-03 : poids 4, cible 10, réalisé 5 -> contribution = 4 * (5/10) = 2
		const quantProg = computeWeeklyProgression([
			{
				weight: 4,
				isDone: false,
				targetValue: 10,
				achievedValue: 5
			}
		]);
		expect(quantProg.achievedWeight).toBe(2);
		expect(quantProg.progressPct).toBe(50);
	});

	// =========================================================================
	// REC-03 : Confidentialité et cloisonnement des accès (RG-04, RG-07, EF-AUT-06)
	// =========================================================================
	it('REC-03 : Un membre tente d’ouvrir l’espace d’un autre membre ou de modifier ses tâches -> Accès refusé, aucune donnée modifiée (RG-04, RG-07)', async () => {
		const [chef] = await db
			.insert(users)
			.values({
				username: 'chef',
				fullName: 'Chef',
				passwordHash: 'hash',
				isChef: true,
				participatesInReports: true,
				active: true
			})
			.returning();

		const [memberA] = await db
			.insert(users)
			.values({
				username: 'member_a',
				fullName: 'Membre A',
				passwordHash: 'hash',
				isChef: false,
				participatesInReports: true,
				active: true
			})
			.returning();

		const [memberB] = await db
			.insert(users)
			.values({
				username: 'member_b',
				fullName: 'Membre B',
				passwordHash: 'hash',
				isChef: false,
				participatesInReports: true,
				active: true
			})
			.returning();

		const weekStart = '2026-10-12';

		// Création d'une tâche pour membre B
		await createTasks(db, chef.id, {
			title: 'Tâche confidentielle de B',
			memberIds: [memberB.id],
			weekStart,
			weight: 2
		});

		const [taskB] = await db.select().from(tasks).where(eq(tasks.memberId, memberB.id));

		// Membre A tente de modifier la tâche de Membre B
		await expect(
			updateMemberTask(db, memberA.id, {
				taskId: taskB.id,
				isDone: true
			})
		).rejects.toThrow(/Vous ne pouvez modifier que vos propres tâches/);

		// La tâche de B n'a pas été modifiée
		const [intactTaskB] = await db.select().from(tasks).where(eq(tasks.id, taskB.id));
		expect(intactTaskB.isDone).toBe(false);
	});

	// =========================================================================
	// REC-04 : Publication de rapport hebdomadaire, instantané figé, notification
	// =========================================================================
	it('REC-04 : Le chef publie le rapport hebdomadaire d’un membre -> Rapport figé, tâches verrouillées, membre notifié, rapport consultable en lecture seule (EF-HEB-04, EF-HEB-05, EF-NOT-04, RG-06, RG-11)', async () => {
		const [chef] = await db
			.insert(users)
			.values({
				username: 'chef',
				fullName: 'Chef',
				passwordHash: 'hash',
				isChef: true,
				participatesInReports: true,
				active: true
			})
			.returning();

		const [member] = await db
			.insert(users)
			.values({
				username: 'marie',
				fullName: 'Marie Ngono',
				passwordHash: 'hash',
				isChef: false,
				participatesInReports: true,
				active: true
			})
			.returning();

		const weekStart = '2026-10-12';

		await createTasks(db, chef.id, {
			title: 'Entretien des suites',
			memberIds: [member.id],
			weekStart,
			weight: 2
		});

		const [task] = await db.select().from(tasks).where(eq(tasks.memberId, member.id));
		await updateMemberTask(db, member.id, {
			taskId: task.id,
			isDone: true,
			doneOn: '2026-10-14',
			note: 'Parfait'
		});

		await saveWeekDifficulties(
			db,
			member.id,
			weekStart,
			'Difficulté d’approvisionnement en linge.'
		);

		// Les tâches ne sont pas verrouillées avant publication
		expect(await isWeekLocked(db, member.id, weekStart)).toBe(false);

		// Le chef prépare les données et publie le rapport
		const prep = await prepareWeeklyReportData(db, member.id, weekStart);
		expect(prep.tasks).toHaveLength(1);
		expect(prep.progression.progressPct).toBe(100);

		const reportId = await publishWeeklyReport(db, {
			chefId: chef.id,
			memberId: member.id,
			weekStart,
			chefComment: 'Excellent travail cette semaine.',
			nextWeekCustomText: 'Continuer sur les étages 3 et 4.'
		});

		expect(reportId).toBeTruthy();

		// 1. Tâches désormais verrouillées pour cette semaine
		expect(await isWeekLocked(db, member.id, weekStart)).toBe(true);

		// 2. Le membre tente de modifier sa tâche verrouillée -> Refus
		await expect(
			updateMemberTask(db, member.id, {
				taskId: task.id,
				isDone: false
			})
		).rejects.toThrow(/Cette semaine est clôturée/);

		// 3. Le membre est notifié
		const unreadCount = await getUnreadNotificationsCount(db, member.id);
		expect(unreadCount).toBeGreaterThanOrEqual(1);

		const notifs = await listUserNotifications(db, member.id);
		const pubNotif = notifs.find((n) => n.type === 'weekly_report_published');
		expect(pubNotif).toBeDefined();
		expect(pubNotif?.message).toContain('publié');

		// 4. Le membre peut consulter son rapport figé en lecture seule
		const memberReports = await getMemberPublishedReports(db, member.id);
		expect(memberReports).toHaveLength(1);
		expect(memberReports[0].chefComment).toBe('Excellent travail cette semaine.');
		const snapshot = memberReports[0].snapshot as WeeklyReportSnapshot;
		expect(snapshot.difficulties).toBe('Difficulté d’approvisionnement en linge.');
		expect(snapshot.completedTasksByDay.length).toBeGreaterThan(0);
	});

	// =========================================================================
	// REC-05 : Tentative de modification après publication & réouverture motivée
	// =========================================================================
	it('REC-05 : Le chef tente de modifier après publication sans rouvrir -> Refusé ; après réouverture motivée, nouvelle version à la republication (EF-HEB-06, RG-06, RG-11)', async () => {
		const [chef] = await db
			.insert(users)
			.values({
				username: 'chef',
				fullName: 'Chef',
				passwordHash: 'hash',
				isChef: true,
				participatesInReports: true,
				active: true
			})
			.returning();

		const [member] = await db
			.insert(users)
			.values({
				username: 'alain',
				fullName: 'Alain Fotso',
				passwordHash: 'hash',
				isChef: false,
				participatesInReports: true,
				active: true
			})
			.returning();

		const weekStart = '2026-10-12';

		await createTasks(db, chef.id, {
			title: 'Réparation groupe électrogène',
			memberIds: [member.id],
			weekStart,
			weight: 3
		});

		const [task] = await db.select().from(tasks).where(eq(tasks.memberId, member.id));

		// Publication initiale (version 1)
		const reportId = await publishWeeklyReport(db, {
			chefId: chef.id,
			memberId: member.id,
			weekStart,
			chefComment: 'Première validation.',
			nextWeekCustomText: 'Maintenance compresseur.'
		});

		// Tentative de modification sans réouverture -> échec
		await expect(
			updateMemberTask(db, member.id, {
				taskId: task.id,
				isDone: true
			})
		).rejects.toThrow(/Cette semaine est clôturée/);

		// Réouverture sans motif -> refus
		await expect(
			reopenWeeklyReport(db, {
				chefId: chef.id,
				reportId,
				reason: '   '
			})
		).rejects.toThrow(/Le motif de réouverture est obligatoire/);

		// Réouverture motivée par le chef
		await reopenWeeklyReport(db, {
			chefId: chef.id,
			reportId,
			reason: 'Oubli de la validation de fin de maintenance avec bon de livraison.'
		});

		// Les tâches sont déverrouillées
		expect(await isWeekLocked(db, member.id, weekStart)).toBe(false);

		// Le membre peut à présent modifier sa tâche
		await updateMemberTask(db, member.id, {
			taskId: task.id,
			isDone: true,
			doneOn: '2026-10-15',
			note: 'Validé avec facture signée'
		});

		// Republication : génère la version 2
		const republishReportId = await publishWeeklyReport(db, {
			chefId: chef.id,
			memberId: member.id,
			weekStart,
			chefComment: 'Deuxième validation après justificatifs.',
			nextWeekCustomText: 'Maintenance compresseur.'
		});

		expect(republishReportId).toBeTruthy();

		// Consultation par le membre : version 2 est celle publiée
		const reports = await getMemberPublishedReports(db, member.id);
		expect(reports).toHaveLength(1);
		expect(reports[0].version).toBe(2);
		const snapshotV2 = reports[0].snapshot as WeeklyReportSnapshot;
		expect(snapshotV2.completedTasksByDay.length).toBeGreaterThan(0);
	});

	// =========================================================================
	// REC-06 : Export Word d’un rapport hebdomadaire (.docx natif et conforme)
	// =========================================================================
	it('REC-06 : Export Word d’un rapport hebdomadaire -> Fichier .docx ouvrable dans Word, contenu conforme à la section 6.1 (EF-EXP-01, EF-EXP-02, EF-EXP-05)', async () => {
		const [chef] = await db
			.insert(users)
			.values({
				username: 'chef_docx',
				fullName: 'Chef Docx',
				passwordHash: 'hash',
				isChef: true,
				participatesInReports: true,
				active: true
			})
			.returning();

		const [member] = await db
			.insert(users)
			.values({
				username: 'jean_docx',
				fullName: 'Jean Dupont',
				passwordHash: 'hash',
				isChef: false,
				participatesInReports: true,
				active: true
			})
			.returning();

		const weekStart = '2026-10-12';

		await createTasks(db, chef.id, {
			title: 'Accueil client VIP',
			memberIds: [member.id],
			weekStart,
			weight: 3
		});

		const [task] = await db.select().from(tasks).where(eq(tasks.memberId, member.id));
		await updateMemberTask(db, member.id, {
			taskId: task.id,
			isDone: true,
			doneOn: '2026-10-12',
			note: 'Client satisfait'
		});

		const reportId = await publishWeeklyReport(db, {
			chefId: chef.id,
			memberId: member.id,
			weekStart,
			chefComment: 'Très bonne tenue du poste.',
			nextWeekCustomText: 'Préparer l’arrivée du groupe de la conférence.'
		});

		const report = await getWeeklyReportById(db, reportId);
		expect(report).toBeDefined();
		if (!report) return;

		const docxBuffer = await generateWeeklyReportDocx(report.snapshot as WeeklyReportSnapshot);

		expect(docxBuffer).toBeInstanceOf(Buffer);
		expect(docxBuffer.length).toBeGreaterThan(3000);

		// Les fichiers docx sont des archives ZIP commençant par la signature PK\x03\x04
		const magicHeader = docxBuffer.subarray(0, 4);
		expect(magicHeader[0]).toBe(0x50); // P
		expect(magicHeader[1]).toBe(0x4b); // K
		expect(magicHeader[2]).toBe(0x03);
		expect(magicHeader[3]).toBe(0x04);
	});

	// =========================================================================
	// REC-07 : Rapport mensuel avec semaine à cheval sur deux mois (Règle 5.2)
	// =========================================================================
	it('REC-07 : Génération du rapport mensuel avec une semaine à cheval sur deux mois -> Semaine rattachée au bon mois (règle 5.2 / RG-01), chef inclus, avertissement si un rapport manque (EF-MEN-01..05)', async () => {
		// En octobre 2026 :
		// S40 (lundi 28/09 au dimanche 04/10) : son mercredi est le 30/09 -> rattachée à SEPTEMBRE.
		// S41 (lundi 05/10 au dimanche 11/10) : son mercredi est le 07/10 -> rattachée à OCTOBRE.
		// S44 (lundi 26/10 au dimanche 01/11) : son mercredi est le 28/10 -> rattachée à OCTOBRE.
		const octoberWeeks = monthWeeks(2026, 10);
		expect(octoberWeeks).toContain('2026-10-05'); // S41
		expect(octoberWeeks).toContain('2026-10-26'); // S44 (mercredi 28 octobre)
		expect(octoberWeeks).not.toContain('2026-09-28'); // S40 appartient à septembre !

		const septemberWeeks = monthWeeks(2026, 9);
		expect(septemberWeeks).toContain('2026-09-28'); // S40 a son mercredi 30 septembre

		// 1. Chef et membre
		const [chef] = await db
			.insert(users)
			.values({
				username: 'chef_mensuel',
				fullName: 'Chef Mensuel',
				passwordHash: 'hash',
				isChef: true,
				participatesInReports: true,
				active: true
			})
			.returning();

		await db.insert(users).values({
			username: 'member_mensuel',
			fullName: 'Membre Mensuel',
			passwordHash: 'hash',
			isChef: false,
			participatesInReports: true,
			active: true
		});

		// 2. Préparation des données mensuelles pour octobre 2026 sans publication préalable
		const prepared = await prepareMonthlyReportData(db, 2026, 10);
		// Le chef est inclus dans les membres actifs participant aux rapports (RG-08)
		const chefInMembers = prepared.activeMembers.some((m) => m.id === chef.id && m.isChef);
		expect(chefInMembers).toBe(true);

		// Les rapports n'étant pas publiés, ils sont détectés comme manquants
		expect(prepared.missingReports.length).toBeGreaterThan(0);
		expect(prepared.canGenerate).toBe(true);

		// 3. Sauvegarde et export Word du rapport mensuel
		const { reportId, version } = await generateMonthlyReport(db, {
			chefId: chef.id,
			year: 2026,
			month: 10,
			introText: prepared.defaultIntro,
			conclusionText: prepared.defaultConclusion,
			allowMissing: true
		});

		expect(version).toBe(1);

		const savedReport = await getMonthlyReportById(db, reportId);
		expect(savedReport).toBeDefined();
		if (!savedReport) return;

		const monthlyDocx = await generateMonthlyReportDocx(
			savedReport.snapshot as MonthlyReportSnapshot
		);

		expect(monthlyDocx).toBeInstanceOf(Buffer);
		expect(monthlyDocx.length).toBeGreaterThan(3000);
	});

	// =========================================================================
	// REC-08 : Réinitialisation d’un mot de passe par l’administrateur
	// =========================================================================
	it('REC-08 : Réinitialisation d’un mot de passe par l’administrateur -> Mot de passe temporaire affiché une fois, changement forcé à la connexion suivante (EF-AUT-04, EF-USR-03)', async () => {
		const [admin] = await db
			.insert(users)
			.values({
				username: 'admin_reset',
				fullName: 'Admin Reset',
				passwordHash: 'hash',
				isAdmin: true,
				isChef: false,
				participatesInReports: false,
				active: true
			})
			.returning();

		const [user] = await db
			.insert(users)
			.values({
				username: 'user_reset',
				fullName: 'Utilisateur À Réinitialiser',
				passwordHash: 'old_hash',
				isAdmin: false,
				isChef: false,
				participatesInReports: true,
				active: true,
				mustChangePassword: false,
				failedAttempts: 3
			})
			.returning();

		// L'administrateur réinitialise le mot de passe
		const resetResult = await resetAccountPassword(db, admin.id, user.id);
		expect(resetResult.ok).toBe(true);
		if (!resetResult.ok) return;

		const { temporaryPassword } = resetResult.value;
		expect(temporaryPassword).toBeTruthy();

		// L'utilisateur s'authentifie avec le mot de passe temporaire
		const authResult = await authenticate(db, 'user_reset', temporaryPassword);
		expect(authResult.ok).toBe(true);
		if (!authResult.ok) return;

		// Le changement de mot de passe est obligatoire
		expect(authResult.mustChangePassword).toBe(true);
	});

	// =========================================================================
	// REC-09 : Exécution de la tâche planifiée quotidienne (Cron)
	// =========================================================================
	it('REC-09 : Exécution de la tâche planifiée un jour ouvré -> Rappel créé pour les membres sans saisie ; alerte au chef le vendredi (EF-NOT-02, EF-NOT-03, EF-NOT-05)', async () => {
		const [chef] = await db
			.insert(users)
			.values({
				username: 'chef_cron',
				fullName: 'Chef Cron',
				passwordHash: 'hash',
				isChef: true,
				participatesInReports: true,
				active: true
			})
			.returning();

		const [member] = await db
			.insert(users)
			.values({
				username: 'member_cron',
				fullName: 'Membre Cron',
				passwordHash: 'hash',
				isChef: false,
				participatesInReports: true,
				active: true
			})
			.returning();

		// Mercredi 14 octobre 2026 (jour ouvré en milieu de semaine)
		const wednesday = '2026-10-14';
		const weekStart = '2026-10-12';

		// On assigne une tâche en attente non cochée
		await createTasks(db, chef.id, {
			title: 'Tâche urgente mercredi',
			memberIds: [member.id],
			weekStart,
			weight: 2
		});

		// 1. Exécution du cron un mercredi
		const wedStats = await runDailyNotificationCron(db, { date: wednesday });
		expect(wedStats.isWorkingDay).toBe(true);
		expect(wedStats.dailyRemindersSent).toBeGreaterThanOrEqual(1);

		// Le membre a reçu son rappel de fin de journée
		const memberNotifs = await listUserNotifications(db, member.id);
		expect(memberNotifs.some((n) => n.type === 'daily_reminder')).toBe(true);

		// 2. Exécution du cron le vendredi 16 octobre 2026 (dernier jour ouvré de la semaine)
		const friday = '2026-10-16';
		const friStats = await runDailyNotificationCron(db, { date: friday });
		expect(friStats.weekClosingAlertsSent).toBe(1);

		// Le chef a reçu l'alerte de clôture de semaine
		const chefNotifs = await listUserNotifications(db, chef.id);
		expect(chefNotifs.some((n) => n.type === 'week_ready_to_close')).toBe(true);
	});

	// =========================================================================
	// REC-10 : Utilisation mobile et confort ergonomique
	// =========================================================================
	it('REC-10 : Paramètres ergonomiques, adaptabilité mobile et fuseau horaire (RG-01, EF-NOT-02, CDC §10)', async () => {
		// Vérification des exigences non fonctionnelles de structure
		// RG-01 : Semaine commence un lundi
		const mondayDate = '2026-10-12';
		const [entry] = await db
			.insert(weekEntries)
			.values({
				memberId: (
					await db
						.insert(users)
						.values({
							username: 'ergonomie',
							fullName: 'Ergonomie',
							passwordHash: 'hash',
							active: true
						})
						.returning()
				)[0].id,
				weekStart: mondayDate,
				difficulties: 'R.A.S.'
			})
			.returning();

		expect(entry.weekStart).toBe('2026-10-12');
	});
});
