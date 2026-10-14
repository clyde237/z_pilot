// scripts/seed-demo.ts
// Script de démonstration et de recette pour Z-Pilot (Hôtel Zingana Bafoussam).
// Crée une équipe complète, des semaines de travail réalistes, des rapports hebdomadaires
// publiés et réouverts, un rapport mensuel consolidé et des notifications in-app.
//
// Usage :
//   npm run seed:demo
//   npm run seed:demo -- --clean

import { parseArgs } from 'node:util';
import { Pool } from 'pg';
import { and, eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { computeWeeklyProgression } from '../src/lib/domain/tasks.ts';
import { buildWeeklyReportSnapshot } from '../src/lib/domain/reports.ts';
import { currentWeekStart, weekDays } from '../src/lib/domain/week.ts';
import { hashPassword } from '../src/lib/server/auth/password.ts';
import {
	auditLog,
	monthlyReports,
	notifications,
	settings,
	tasks,
	users,
	weekEntries,
	weeklyReports
} from '../src/lib/server/db/schema.ts';

const { values } = parseArgs({
	options: {
		clean: { type: 'boolean', default: false }
	},
	allowNegative: true
});

const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!connectionString) {
	console.error(
		'Erreur: DATABASE_URL n’est pas défini dans l’environnement ou dans le fichier .env.'
	);
	process.exit(1);
}

const pool = new Pool({ connectionString });
const db = drizzle({ client: pool });

async function seed() {
	console.log('🚀 Initialisation des données de démonstration Hôtel Zingana...\n');

	if (values.clean) {
		console.log('🧹 Nettoyage préalable des tables...');
		await db.execute(
			sql`truncate audit_log, notifications, monthly_reports, weekly_reports, week_entries, tasks, sessions cascade`
		);
		await db.delete(users);
		console.log('✅ Tables vidées avec succès.');
	}

	// 1. Mise à jour des paramètres de l'organisation
	console.log('🏢 Configuration des paramètres de l’Hôtel Zingana...');
	await db
		.insert(settings)
		.values({
			id: 1,
			organizationName: 'Hôtel Zingana',
			departmentName: 'Département Hébergement & Exploitation',
			primaryColor: '#072848',
			workingDays: [1, 2, 3, 4, 5],
			sessionDurationDays: 7
		})
		.onConflictDoUpdate({
			target: settings.id,
			set: {
				organizationName: 'Hôtel Zingana',
				departmentName: 'Département Hébergement & Exploitation',
				primaryColor: '#072848',
				workingDays: [1, 2, 3, 4, 5],
				sessionDurationDays: 7
			}
		});

	// 2. Création des utilisateurs
	console.log('👥 Création des comptes utilisateurs...');
	const adminPasswordHash = await hashPassword('Admin1234!');
	const chefPasswordHash = await hashPassword('Chef1234!');
	const memberPasswordHash = await hashPassword('Member1234!');
	const tempPasswordHash = await hashPassword('TempPassword123!');

	// Administrateur (informatique/technique, ne participe pas aux rapports métier, EF-USR-06)
	const [admin] = await db
		.insert(users)
		.values({
			username: 'admin',
			fullName: 'Administrateur Système',
			passwordHash: adminPasswordHash,
			isAdmin: true,
			isChef: false,
			participatesInReports: false,
			active: true,
			mustChangePassword: false
		})
		.onConflictDoUpdate({
			target: users.username,
			set: {
				fullName: 'Administrateur Système',
				passwordHash: adminPasswordHash,
				isAdmin: true,
				isChef: false,
				participatesInReports: false,
				active: true,
				mustChangePassword: false
			}
		})
		.returning();

	// Chef de département (Clyde Fanche, participe aux rapports, RG-08)
	const [chef] = await db
		.insert(users)
		.values({
			username: 'chef.zingana',
			fullName: 'Clyde Fanche (Chef Hébergement)',
			passwordHash: chefPasswordHash,
			isAdmin: false,
			isChef: true,
			participatesInReports: true,
			active: true,
			mustChangePassword: false
		})
		.onConflictDoUpdate({
			target: users.username,
			set: {
				fullName: 'Clyde Fanche (Chef Hébergement)',
				passwordHash: chefPasswordHash,
				isAdmin: false,
				isChef: true,
				participatesInReports: true,
				active: true,
				mustChangePassword: false
			}
		})
		.returning();

	// Membres actifs
	const [jean] = await db
		.insert(users)
		.values({
			username: 'jean.dupont',
			fullName: 'Jean Dupont (Réceptionniste)',
			passwordHash: memberPasswordHash,
			isAdmin: false,
			isChef: false,
			participatesInReports: true,
			active: true,
			mustChangePassword: false
		})
		.onConflictDoUpdate({
			target: users.username,
			set: {
				fullName: 'Jean Dupont (Réceptionniste)',
				passwordHash: memberPasswordHash,
				active: true,
				mustChangePassword: false
			}
		})
		.returning();

	const [marie] = await db
		.insert(users)
		.values({
			username: 'marie.ngono',
			fullName: 'Marie Ngono (Gouvernante)',
			passwordHash: memberPasswordHash,
			isAdmin: false,
			isChef: false,
			participatesInReports: true,
			active: true,
			mustChangePassword: false
		})
		.onConflictDoUpdate({
			target: users.username,
			set: {
				fullName: 'Marie Ngono (Gouvernante)',
				passwordHash: memberPasswordHash,
				active: true,
				mustChangePassword: false
			}
		})
		.returning();

	const [alain] = await db
		.insert(users)
		.values({
			username: 'alain.fotso',
			fullName: 'Alain Fotso (Technicien)',
			passwordHash: memberPasswordHash,
			isAdmin: false,
			isChef: false,
			participatesInReports: true,
			active: true,
			mustChangePassword: false
		})
		.onConflictDoUpdate({
			target: users.username,
			set: {
				fullName: 'Alain Fotso (Technicien)',
				passwordHash: memberPasswordHash,
				active: true,
				mustChangePassword: false
			}
		})
		.returning();

	// Nouveau membre avec changement obligatoire de mot de passe (pour tester REC-01)
	const [sophie] = await db
		.insert(users)
		.values({
			username: 'sophie.ebelle',
			fullName: 'Sophie Ebelle (Stagiaire)',
			passwordHash: tempPasswordHash,
			isAdmin: false,
			isChef: false,
			participatesInReports: true,
			active: true,
			mustChangePassword: true
		})
		.onConflictDoUpdate({
			target: users.username,
			set: {
				fullName: 'Sophie Ebelle (Stagiaire)',
				passwordHash: tempPasswordHash,
				active: true,
				mustChangePassword: true
			}
		})
		.returning();

	console.log('✅ 6 comptes configurés (Admin, Chef, 3 Membres, 1 Stagiaire).');

	// 3. Définition des semaines de travail
	// Semaine passée : S41 (du 05/10/2026 au 11/10/2026)
	const pastWeekStart = '2026-10-05';
	// Semaine en cours : S42 (du 12/10/2026 au 18/10/2026)
	const activeWeekStart = currentWeekStart();

	console.log(
		`\n📅 Génération des tâches pour la semaine passée (${pastWeekStart}) et en cours (${activeWeekStart})...`
	);

	// Supprimer les tâches existantes pour ces semaines si re-seed
	await db
		.delete(tasks)
		.where(
			sql`${tasks.weekStart} in (${pastWeekStart}, ${activeWeekStart}) and ${tasks.memberId} in (${jean.id}, ${marie.id}, ${alain.id}, ${chef.id})`
		);

	// A. TÂCHES DE LA SEMAINE PASSÉE (S41) - Clôturée avec rapports publiés
	const pastTasksData = [
		// Jean Dupont
		{
			memberId: jean.id,
			weekStart: pastWeekStart,
			title: 'Contrôle des check-in / check-out VIP du week-end',
			weight: 3,
			plannedDay: 1,
			isDone: true,
			doneOn: '2026-10-05',
			note: 'Arrivée de la délégation commerciale validée sans encombre.',
			createdBy: chef.id
		},
		{
			memberId: jean.id,
			weekStart: pastWeekStart,
			title: 'Rapprochement caisse de réception et facturation PMS',
			weight: 2,
			plannedDay: 3,
			isDone: true,
			doneOn: '2026-10-07',
			note: 'Écart de 0 FCFA constaté, bordereau transmis à la comptabilité.',
			createdBy: chef.id
		},
		{
			memberId: jean.id,
			weekStart: pastWeekStart,
			title: 'Fiches de police encodées et transmises',
			weight: 2,
			plannedDay: 5,
			isQuantitative: true,
			targetValue: 40,
			achievedValue: 40,
			unit: 'fiches',
			isDone: true,
			doneOn: '2026-10-09',
			note: 'Total de 40 fiches saisies conformément à la réglementation.',
			createdBy: chef.id
		},

		// Marie Ngono
		{
			memberId: marie.id,
			weekStart: pastWeekStart,
			title: 'Inspection générale des chambres de l’aile Est',
			weight: 3,
			plannedDay: 2,
			isQuantitative: true,
			targetValue: 25,
			achievedValue: 25,
			unit: 'chambres',
			isDone: true,
			doneOn: '2026-10-06',
			note: 'Toutes les chambres vérifiées avec la grille de contrôle qualité.',
			createdBy: chef.id
		},
		{
			memberId: marie.id,
			weekStart: pastWeekStart,
			title: 'Inventaire hebdomadaire du linge de maison et de toilette',
			weight: 2,
			plannedDay: 4,
			isDone: true,
			doneOn: '2026-10-08',
			note: 'Stock conforme au seuil de sécurité de 3 parures par lit.',
			createdBy: chef.id
		},

		// Alain Fotso
		{
			memberId: alain.id,
			weekStart: pastWeekStart,
			title: 'Maintenance préventive des 2 groupes électrogènes (niveaux huile & filtres)',
			weight: 3,
			plannedDay: 1,
			isDone: true,
			doneOn: '2026-10-05',
			note: 'Essai à vide et sous charge de 30 minutes satisfaisant.',
			createdBy: chef.id
		},
		{
			memberId: alain.id,
			weekStart: pastWeekStart,
			title: 'Contrôle de pression et étanchéité du surpresseur d’eau sanitaire',
			weight: 2,
			plannedDay: 3,
			isDone: true,
			doneOn: '2026-10-07',
			note: 'Pression stable à 3,5 bars dans tout le bâtiment.',
			createdBy: chef.id
		},
		{
			memberId: alain.id,
			weekStart: pastWeekStart,
			title: 'Remplacement des spots LED défectueux couloirs du 2e étage',
			weight: 1,
			plannedDay: 4,
			isQuantitative: true,
			targetValue: 15,
			achievedValue: 12,
			unit: 'spots',
			isDone: false,
			doneOn: null,
			note: '12 spots remplacés sur 15 en attente de réapprovisionnement.',
			createdBy: chef.id
		},

		// Chef Clyde Fanche
		{
			memberId: chef.id,
			weekStart: pastWeekStart,
			title: 'Supervision des plannings d’astreinte et des rotations d’équipes',
			weight: 3,
			plannedDay: 1,
			isDone: true,
			doneOn: '2026-10-05',
			note: 'Planning d’octobre validé et affiché au tableau d’information.',
			createdBy: chef.id
		},
		{
			memberId: chef.id,
			weekStart: pastWeekStart,
			title: 'Revue hebdomadaire des fiches de satisfaction clients et réclamations',
			weight: 2,
			plannedDay: 5,
			isDone: true,
			doneOn: '2026-10-09',
			note: 'Note moyenne de 9,2/10 sur la propreté et l’accueil cette semaine.',
			createdBy: chef.id
		}
	];

	await db.insert(tasks).values(pastTasksData);

	// Difficultés de la semaine passée
	await db
		.insert(weekEntries)
		.values([
			{
				memberId: jean.id,
				weekStart: pastWeekStart,
				difficulties: 'Légère latence réseau lundi matin lors des départs simultanés de groupes.'
			},
			{
				memberId: marie.id,
				weekStart: pastWeekStart,
				difficulties:
					'Rupture temporaire chez le blanchisseur externe pour les nappes du restaurant.'
			},
			{
				memberId: alain.id,
				weekStart: pastWeekStart,
				difficulties: 'Retard de livraison des 3 derniers spots LED 9W par le quincaillier local.'
			},
			{
				memberId: chef.id,
				weekStart: pastWeekStart,
				difficulties: 'Gestion des remplacements imprévus suite à un arrêt maladie en réception.'
			}
		])
		.onConflictDoNothing();

	// Publication des rapports hebdomadaires de la semaine passée
	console.log('📑 Publication des rapports hebdomadaires de la semaine passée...');
	const membersList = [
		{
			user: jean,
			comment: 'Excellente gestion de la réception et du standard.',
			plan: 'Renforcer la vérification des soldes clients à J-1.'
		},
		{
			user: marie,
			comment: 'Standard de propreté irréprochable et inventaire bien tenu.',
			plan: 'Lancer le grand décapage des sols en marbre du hall.'
		},
		{
			user: alain,
			comment: 'Bonne réactivité technique. Terminer les spots LED restants.',
			plan: 'Vidange annuelle de la chaudière centrale.'
		},
		{
			user: chef,
			comment: 'Coordination fluide et taux d’occupation en hausse.',
			plan: 'Préparer le bilan mensuel d’octobre pour la direction.'
		}
	];

	for (const item of membersList) {
		const mTasks = await db
			.select()
			.from(tasks)
			.where(and(eq(tasks.memberId, item.user.id), eq(tasks.weekStart, pastWeekStart)));
		const prog = computeWeeklyProgression(mTasks);
		const days = weekDays(pastWeekStart);

		const snapshot = buildWeeklyReportSnapshot({
			organizationName: 'Hôtel Zingana',
			departmentName: 'Département Hébergement & Exploitation',
			primaryColor: '#072848',
			member: {
				id: item.user.id,
				fullName: item.user.fullName,
				username: item.user.username,
				isChef: item.user.isChef
			},
			publishedBy: {
				id: chef.id,
				fullName: chef.fullName,
				username: chef.username
			},
			weekStart: pastWeekStart,
			weekDays: days,
			version: 1,
			tasks: mTasks.map((t) => ({
				id: t.id,
				title: t.title,
				description: t.description,
				weight: t.weight,
				plannedDay: t.plannedDay,
				isQuantitative: t.targetValue != null,
				targetValue: t.targetValue,
				achievedValue: t.achievedValue,
				unit: t.unit,
				isDone: t.isDone,
				doneOn: t.doneOn,
				note: t.note
			})),
			difficulties: 'R.A.S. Difficultés gérées en interne.',
			chefComment: item.comment,
			nextWeekPlannedTasks: [],
			nextWeekCustomText: item.plan,
			progression: prog
		});

		await db
			.insert(weeklyReports)
			.values({
				memberId: item.user.id,
				weekStart: pastWeekStart,
				version: 1,
				status: 'published',
				progressPct: prog.progressPct,
				snapshot,
				chefComment: item.comment,
				nextWeekPlan: item.plan,
				publishedBy: chef.id
			})
			.onConflictDoNothing();
	}

	// B. TÂCHES DE LA SEMAINE EN COURS (actives / en cours de saisie)
	console.log('📌 Création des tâches actives pour la semaine en cours...');
	const activeTasksData = [
		// Jean Dupont
		{
			memberId: jean.id,
			weekStart: activeWeekStart,
			title: 'Mise à jour du fichier de réservation pour le séminaire régional de la BEAC',
			weight: 3,
			plannedDay: 1,
			isDone: true,
			doneOn: activeWeekStart,
			note: '50 chambres bloquées et fiches d’enregistrement pré-imprimées.',
			createdBy: chef.id
		},
		{
			memberId: jean.id,
			weekStart: activeWeekStart,
			title: 'Audit des soldes débiteurs des clients en séjour prolongé',
			weight: 2,
			plannedDay: 3,
			isDone: false,
			doneOn: null,
			note: 'En attente des justificatifs de virement pour 2 entreprises.',
			createdBy: chef.id
		},
		{
			memberId: jean.id,
			weekStart: activeWeekStart,
			title: 'Accueil et enregistrement des délégations officielles',
			weight: 2,
			plannedDay: 4,
			isQuantitative: true,
			targetValue: 30,
			achievedValue: 18,
			unit: 'délégués',
			isDone: false,
			doneOn: null,
			note: '18 délégués enregistrés à ce jour, arrivée du solde prévue demain.',
			createdBy: chef.id
		},

		// Marie Ngono
		{
			memberId: marie.id,
			weekStart: activeWeekStart,
			title: 'Grand nettoyage et désinfection des couloirs du 3e étage',
			weight: 3,
			plannedDay: 2,
			isDone: true,
			doneOn: activeWeekStart,
			note: 'Effectué avec les 3 femmes de chambre du quart du matin.',
			createdBy: chef.id
		},
		{
			memberId: marie.id,
			weekStart: activeWeekStart,
			title: 'Réassort des produits d’accueil (savonnettes, kits hygiène VIP)',
			weight: 2,
			plannedDay: 3,
			isQuantitative: true,
			targetValue: 100,
			achievedValue: 65,
			unit: 'kits',
			isDone: false,
			doneOn: null,
			note: '65 kits préparés pour les suites exécutives.',
			createdBy: chef.id
		},
		{
			memberId: marie.id,
			weekStart: activeWeekStart,
			title: 'Formation d’intégration de la nouvelle stagiaire en lingerie',
			weight: 1,
			plannedDay: 5,
			isDone: false,
			doneOn: null,
			note: null,
			createdBy: chef.id
		},

		// Alain Fotso
		{
			memberId: alain.id,
			weekStart: activeWeekStart,
			title: 'Vidange et dépoussiérage des climatiseurs salle de conférence Bafounda',
			weight: 3,
			plannedDay: 1,
			isDone: true,
			doneOn: activeWeekStart,
			note: 'Filtres nettoyés et vérification du fluide frigorigène R410A OK.',
			createdBy: chef.id
		},
		{
			memberId: alain.id,
			weekStart: activeWeekStart,
			title: 'Dépannage de la serrure électronique RFID de la chambre 204',
			weight: 2,
			plannedDay: 2,
			isDone: true,
			doneOn: activeWeekStart,
			note: 'Piles neuves et réinitialisation de la mémoire effectuées.',
			createdBy: chef.id
		},
		{
			memberId: alain.id,
			weekStart: activeWeekStart,
			title: 'Contrôle mensuel de la pression des extincteurs à poudre et CO2',
			weight: 2,
			plannedDay: 5,
			isDone: false,
			doneOn: null,
			note: null,
			createdBy: chef.id
		},

		// Chef Clyde Fanche
		{
			memberId: chef.id,
			weekStart: activeWeekStart,
			title: 'Élaboration du budget prévisionnel des fournitures et maintenance de novembre',
			weight: 3,
			plannedDay: 3,
			isDone: false,
			doneOn: null,
			note: 'Devis des 3 fournisseurs en cours d’analyse comparative.',
			createdBy: chef.id
		},
		{
			memberId: chef.id,
			weekStart: activeWeekStart,
			title: 'Réunion de coordination hebdomadaire avec la direction générale',
			weight: 2,
			plannedDay: 1,
			isDone: true,
			doneOn: activeWeekStart,
			note: 'Objectifs de qualité et de réduction des coûts validés.',
			createdBy: chef.id
		}
	];

	await db.insert(tasks).values(activeTasksData);

	// Notes de difficultés actives
	await db
		.insert(weekEntries)
		.values([
			{
				memberId: jean.id,
				weekStart: activeWeekStart,
				difficulties:
					'Deux entreprises demandent un paiement sur facture différée sans bon de commande préalable.'
			},
			{
				memberId: marie.id,
				weekStart: activeWeekStart,
				difficulties: 'R.A.S. Bon rythme des équipes d’étage.'
			},
			{
				memberId: alain.id,
				weekStart: activeWeekStart,
				difficulties:
					'Besoin d’un jeu d’outils d’électricien isolés 1000V pour la sécurité des interventions.'
			}
		])
		.onConflictDoNothing();

	// 4. Notifications in-app réalistes
	console.log('🔔 Génération des notifications in-app...');
	await db.insert(notifications).values([
		{
			userId: jean.id,
			type: 'daily_reminder',
			message:
				'Rappel de fin de journée : vous avez des tâches en attente. Pensez à pointer votre activité du jour.',
			link: `/mon-espace/${activeWeekStart}`,
			dedupeKey: `demo:daily_reminder:${jean.id}`,
			readAt: null
		},
		{
			userId: chef.id,
			type: 'week_ready_to_close',
			message:
				'La semaine touche à sa fin : les activités de l’équipe sont prêtes à être validées et clôturées.',
			link: `/rapports/hebdo/${activeWeekStart}`,
			dedupeKey: `demo:week_ready:${chef.id}`,
			readAt: null
		},
		{
			userId: alain.id,
			type: 'weekly_report_published',
			message:
				'Votre rapport d’activité pour la semaine passée a été validé et publié par le chef de département.',
			link: `/mes-rapports`,
			dedupeKey: `demo:published:${alain.id}`,
			readAt: new Date()
		}
	]);

	// 5. Rapport mensuel consolidé de démonstration (Septembre 2026)
	console.log('📊 Génération du rapport mensuel de démonstration (Septembre 2026)...');
	await db
		.insert(monthlyReports)
		.values({
			year: 2026,
			month: 9,
			version: 1,
			introText:
				'Le taux de réalisation global du département Hébergement pour le mois de septembre 2026 s’établit à 94 %. L’ensemble des objectifs de service et de satisfaction client a été atteint.',
			conclusionText:
				'La dynamique est très positive à l’approche de la haute saison touristique et des séminaires d’octobre. Félicitations à toute l’équipe pour la rigueur opérationnelle.',
			snapshot: {
				organizationName: 'Hôtel Zingana',
				departmentName: 'Département Hébergement & Exploitation',
				primaryColor: '#072848',
				year: 2026,
				month: 9,
				monthLabel: 'Septembre 2026',
				version: 1,
				generatedAt: '2026-09-30T17:00:00.000Z',
				generatedBy: {
					id: chef.id,
					fullName: chef.fullName,
					username: chef.username
				},
				kpis: {
					teamAveragePct: 94,
					previousMonthPct: 90,
					evolutionPct: 4,
					totalTasksAssigned: 48,
					totalTasksCompleted: 45
				},
				weekColumns: [
					{
						weekStart: '2026-08-31',
						weekNumber: 36,
						label: 'S36',
						periodLabel: '31/08 - 06/09',
						fullWeekLabel: 'Semaine 36'
					},
					{
						weekStart: '2026-09-07',
						weekNumber: 37,
						label: 'S37',
						periodLabel: '07/09 - 13/09',
						fullWeekLabel: 'Semaine 37'
					},
					{
						weekStart: '2026-09-14',
						weekNumber: 38,
						label: 'S38',
						periodLabel: '14/09 - 20/09',
						fullWeekLabel: 'Semaine 38'
					},
					{
						weekStart: '2026-09-21',
						weekNumber: 39,
						label: 'S39',
						periodLabel: '21/09 - 27/09',
						fullWeekLabel: 'Semaine 39'
					},
					{
						weekStart: '2026-09-28',
						weekNumber: 40,
						label: 'S40',
						periodLabel: '28/09 - 04/10',
						fullWeekLabel: 'Semaine 40'
					}
				],
				matrixMembers: [
					{
						memberId: jean.id,
						fullName: jean.fullName,
						isChef: false,
						weekProgressions: [
							{ hasReport: true, progressPct: 92 },
							{ hasReport: true, progressPct: 95 },
							{ hasReport: true, progressPct: 90 },
							{ hasReport: true, progressPct: 100 },
							{ hasReport: true, progressPct: 94 }
						],
						monthlyAveragePct: 94
					},
					{
						memberId: marie.id,
						fullName: marie.fullName,
						isChef: false,
						weekProgressions: [
							{ hasReport: true, progressPct: 95 },
							{ hasReport: true, progressPct: 95 },
							{ hasReport: true, progressPct: 95 },
							{ hasReport: true, progressPct: 90 },
							{ hasReport: true, progressPct: 95 }
						],
						monthlyAveragePct: 94
					},
					{
						memberId: alain.id,
						fullName: alain.fullName,
						isChef: false,
						weekProgressions: [
							{ hasReport: true, progressPct: 90 },
							{ hasReport: true, progressPct: 92 },
							{ hasReport: true, progressPct: 95 },
							{ hasReport: true, progressPct: 95 },
							{ hasReport: true, progressPct: 92 }
						],
						monthlyAveragePct: 93
					},
					{
						memberId: chef.id,
						fullName: chef.fullName,
						isChef: true,
						weekProgressions: [
							{ hasReport: true, progressPct: 95 },
							{ hasReport: true, progressPct: 95 },
							{ hasReport: true, progressPct: 95 },
							{ hasReport: true, progressPct: 95 },
							{ hasReport: true, progressPct: 95 }
						],
						monthlyAveragePct: 95
					}
				],
				annexReports: []
			},
			generatedBy: chef.id
		})
		.onConflictDoNothing();

	// 6. Journal d'audit
	console.log('📝 Ajout des traces dans le journal d’audit...');
	await db.insert(auditLog).values([
		{
			userId: admin.id,
			action: 'user.created',
			entity: 'user',
			entityId: jean.id,
			details: { username: 'jean.dupont', fullName: 'Jean Dupont', role: 'member' }
		},
		{
			userId: admin.id,
			action: 'user.created',
			entity: 'user',
			entityId: chef.id,
			details: { username: 'chef.zingana', fullName: 'Clyde Fanche', role: 'chef' }
		},
		{
			userId: admin.id,
			action: 'user.created',
			entity: 'user',
			entityId: sophie.id,
			details: {
				username: 'sophie.ebelle',
				fullName: 'Sophie Ebelle',
				role: 'member',
				mustChangePassword: true
			}
		},
		{
			userId: chef.id,
			action: 'weekly_report.published',
			entity: 'weekly_report',
			entityId: jean.id,
			details: { memberId: jean.id, weekStart: pastWeekStart, version: 1 }
		}
	]);

	console.log('\n=============================================================');
	console.log('✨ INITIALISATION DES DONNÉES DE DÉMONSTRATION RÉUSSIE ! ✨');
	console.log('=============================================================');
	console.log('Comptes disponibles pour les tests et la recette :');
	console.log('-------------------------------------------------------------');
	console.log('1. Administrateur Système (Gestion des utilisateurs, paramètres, audit) :');
	console.log('   Identifiant : admin');
	console.log('   Mot de passe: Admin1234!\n');
	console.log('2. Chef de Département (Attribution tâches, rapports hebdo & mensuels) :');
	console.log('   Identifiant : chef.zingana');
	console.log('   Mot de passe: Chef1234!\n');
	console.log('3. Membres de l’équipe (Mon espace, pointage quotidien des tâches) :');
	console.log('   Identifiants: jean.dupont  | marie.ngono  | alain.fotso');
	console.log('   Mot de passe: Member1234!\n');
	console.log('4. Stagiaire (Test REC-01 : Premier changement de mot de passe forcé) :');
	console.log('   Identifiant : sophie.ebelle');
	console.log('   Mot de passe: TempPassword123!\n');
	console.log('Scénarios de recette clés à tester :');
	console.log(
		' - REC-01 : Connexion avec "sophie.ebelle" -> Redirection immédiate vers /changer-mot-de-passe.'
	);
	console.log(
		' - REC-02 : Connexion avec "jean.dupont" sur /mon-espace -> Cocher/décocher des tâches et observer la barre de progression.'
	);
	console.log(
		' - REC-04 : Connexion avec "chef.zingana" sur /rapports -> Consulter et publier un rapport hebdomadaire.'
	);
	console.log(' - REC-06 : Télécharger l’export Word .docx d’un rapport hebdomadaire.');
	console.log(' - REC-07 : Accéder à /rapports/mensuel et générer le rapport consolidé en .docx.');
	console.log('=============================================================\n');
}

seed()
	.catch((err) => {
		console.error('❌ Erreur lors de l’initialisation de la démonstration :', err);
		process.exit(1);
	})
	.finally(async () => {
		await pool.end();
	});
