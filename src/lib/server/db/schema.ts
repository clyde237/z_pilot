import { sql } from 'drizzle-orm';
import {
	boolean,
	check,
	customType,
	date,
	foreignKey,
	index,
	jsonb,
	numeric,
	pgEnum,
	pgTable,
	smallint,
	text,
	timestamp,
	unique,
	uniqueIndex,
	uuid
} from 'drizzle-orm/pg-core';

// Conventions (CDC §7): UUID keys, timestamps stored in UTC (timestamptz),
// weeks identified by the date of their Monday (`week_start`, ISO 8601 week, RG-01).

const bytea = customType<{ data: Buffer }>({
	dataType: () => 'bytea'
});

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
	timestamp('updated_at', { withTimezone: true })
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date());

export const users = pgTable(
	'users',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		username: text('username').notNull(),
		fullName: text('full_name').notNull(),
		passwordHash: text('password_hash').notNull(),
		isAdmin: boolean('is_admin').notNull().default(false),
		isChef: boolean('is_chef').notNull().default(false),
		participatesInReports: boolean('participates_in_reports').notNull().default(true),
		active: boolean('active').notNull().default(true),
		mustChangePassword: boolean('must_change_password').notNull().default(true),
		failedAttempts: smallint('failed_attempts').notNull().default(0),
		lockedUntil: timestamp('locked_until', { withTimezone: true }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [
		unique('users_username_key').on(t.username),
		check('users_username_lowercase', sql`${t.username} = lower(${t.username})`),
		// RG-13 / EF-USR-05: at most one active department head.
		uniqueIndex('users_single_active_chef_key')
			.on(t.isChef)
			.where(sql`${t.isChef} and ${t.active}`),
		// RG-08: the head is a full member. EF-USR-06: only an admin may stay out of reports.
		check('users_chef_participates', sql`not ${t.isChef} or ${t.participatesInReports}`),
		check('users_non_admin_participates', sql`${t.isAdmin} or ${t.participatesInReports}`),
		check('users_failed_attempts_non_negative', sql`${t.failedAttempts} >= 0`)
	]
);

export const sessions = pgTable(
	'sessions',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		// Only the SHA-256 of the cookie token is stored: a database leak does not leak sessions.
		tokenHash: text('token_hash').notNull(),
		expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
		createdAt: createdAt()
	},
	(t) => [
		unique('sessions_token_hash_key').on(t.tokenHash),
		index('sessions_user_id_idx').on(t.userId)
	]
);

export const tasks = pgTable(
	'tasks',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		memberId: uuid('member_id')
			.notNull()
			.references(() => users.id),
		weekStart: date('week_start').notNull(),
		title: text('title').notNull(),
		description: text('description'),
		weight: smallint('weight').notNull().default(1),
		// ISO weekday: 1 = Monday … 7 = Sunday.
		plannedDay: smallint('planned_day'),
		// Set together for a quantitative task (CDC §5.1), null for a qualitative one.
		targetValue: numeric('target_value', { precision: 12, scale: 2, mode: 'number' }),
		unit: text('unit'),
		achievedValue: numeric('achieved_value', { precision: 12, scale: 2, mode: 'number' }),
		isDone: boolean('is_done').notNull().default(false),
		doneOn: date('done_on'),
		note: text('note'),
		carriedFromTaskId: uuid('carried_from_task_id'),
		createdBy: uuid('created_by')
			.notNull()
			.references(() => users.id),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [
		foreignKey({
			name: 'tasks_carried_from_task_id_fkey',
			columns: [t.carriedFromTaskId],
			foreignColumns: [t.id]
		}).onDelete('set null'),
		// A task is carried over at most once (EF-OBJ-07), even on a double submit.
		uniqueIndex('tasks_carried_from_task_id_key')
			.on(t.carriedFromTaskId)
			.where(sql`${t.carriedFromTaskId} is not null`),
		index('tasks_member_week_idx').on(t.memberId, t.weekStart),
		index('tasks_week_idx').on(t.weekStart),
		check('tasks_week_start_is_monday', sql`extract(isodow from ${t.weekStart}) = 1`),
		check('tasks_title_not_blank', sql`btrim(${t.title}) <> ''`),
		check('tasks_weight_range', sql`${t.weight} between 1 and 3`),
		check('tasks_planned_day_range', sql`${t.plannedDay} between 1 and 7`),
		check(
			'tasks_quantitative_fields',
			sql`(${t.targetValue} is null) = (${t.unit} is null)
				and (${t.achievedValue} is null or ${t.targetValue} is not null)`
		),
		check('tasks_target_value_positive', sql`${t.targetValue} > 0`),
		check('tasks_achieved_value_non_negative', sql`${t.achievedValue} >= 0`),
		// CDC §5.1: a quantitative task is done exactly when its target is reached.
		check(
			'tasks_quantitative_done_matches_target',
			sql`${t.targetValue} is null or ${t.isDone} = (coalesce(${t.achievedValue}, 0) >= ${t.targetValue})`
		),
		check('tasks_done_on_iff_done', sql`${t.isDone} = (${t.doneOn} is not null)`),
		check(
			'tasks_done_on_within_week',
			sql`${t.doneOn} between ${t.weekStart} and ${t.weekStart} + 6`
		)
	]
);

export const weekEntries = pgTable(
	'week_entries',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		memberId: uuid('member_id')
			.notNull()
			.references(() => users.id),
		weekStart: date('week_start').notNull(),
		difficulties: text('difficulties'),
		updatedAt: updatedAt()
	},
	(t) => [
		unique('week_entries_member_week_key').on(t.memberId, t.weekStart),
		check('week_entries_week_start_is_monday', sql`extract(isodow from ${t.weekStart}) = 1`)
	]
);

// A published report is a frozen snapshot (RG-11). Reopening marks the version as
// `reopened` and unlocks the tasks; republishing inserts the next version (EF-HEB-06).
export const weeklyReportStatus = pgEnum('weekly_report_status', ['published', 'reopened']);

export const weeklyReports = pgTable(
	'weekly_reports',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		memberId: uuid('member_id')
			.notNull()
			.references(() => users.id),
		weekStart: date('week_start').notNull(),
		version: smallint('version').notNull(),
		status: weeklyReportStatus('status').notNull().default('published'),
		// Null when the member had no task that week ("Aucun objectif défini", RG-03).
		progressPct: smallint('progress_pct'),
		snapshot: jsonb('snapshot').notNull(),
		chefComment: text('chef_comment'),
		nextWeekPlan: text('next_week_plan'),
		publishedBy: uuid('published_by')
			.notNull()
			.references(() => users.id),
		publishedAt: timestamp('published_at', { withTimezone: true }).notNull().defaultNow(),
		reopenedReason: text('reopened_reason')
	},
	(t) => [
		unique('weekly_reports_member_week_version_key').on(t.memberId, t.weekStart, t.version),
		// RG-06: the member's tasks for a week are locked while this row exists.
		uniqueIndex('weekly_reports_single_published_key')
			.on(t.memberId, t.weekStart)
			.where(sql`${t.status} = 'published'`),
		index('weekly_reports_week_idx').on(t.weekStart),
		check('weekly_reports_week_start_is_monday', sql`extract(isodow from ${t.weekStart}) = 1`),
		check('weekly_reports_version_positive', sql`${t.version} >= 1`),
		check('weekly_reports_progress_range', sql`${t.progressPct} between 0 and 100`),
		check(
			'weekly_reports_reopened_has_reason',
			sql`(${t.status} = 'reopened') = (${t.reopenedReason} is not null)`
		)
	]
);

export const monthlyReports = pgTable(
	'monthly_reports',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		year: smallint('year').notNull(),
		month: smallint('month').notNull(),
		version: smallint('version').notNull(),
		snapshot: jsonb('snapshot').notNull(),
		introText: text('intro_text'),
		conclusionText: text('conclusion_text'),
		generatedBy: uuid('generated_by')
			.notNull()
			.references(() => users.id),
		generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		unique('monthly_reports_year_month_version_key').on(t.year, t.month, t.version),
		check('monthly_reports_month_range', sql`${t.month} between 1 and 12`),
		check('monthly_reports_version_positive', sql`${t.version} >= 1`)
	]
);

export const notificationType = pgEnum('notification_type', [
	'task_assigned',
	'daily_reminder',
	'week_ready_to_close',
	'month_ready',
	'weekly_report_published'
]);

export const notifications = pgTable(
	'notifications',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id),
		type: notificationType('type').notNull(),
		message: text('message').notNull(),
		link: text('link'),
		// Makes the daily cron idempotent: e.g. `daily_reminder:2026-10-09` exists once per user.
		dedupeKey: text('dedupe_key'),
		readAt: timestamp('read_at', { withTimezone: true }),
		createdAt: createdAt()
	},
	(t) => [
		uniqueIndex('notifications_user_dedupe_key')
			.on(t.userId, t.dedupeKey)
			.where(sql`${t.dedupeKey} is not null`),
		index('notifications_user_created_idx').on(t.userId, t.createdAt.desc()),
		index('notifications_user_unread_idx')
			.on(t.userId)
			.where(sql`${t.readAt} is null`)
	]
);

// Single-row table; the row is created by migration 0001.
export const settings = pgTable(
	'settings',
	{
		id: smallint('id').primaryKey().default(1),
		organizationName: text('organization_name').notNull().default('Hôtel Zingana'),
		departmentName: text('department_name'),
		logo: bytea('logo'),
		logoMimeType: text('logo_mime_type'),
		primaryColor: text('primary_color').notNull().default('#072848'),
		// ISO weekdays considered worked (RG-01): Monday to Friday by default.
		workingDays: smallint('working_days')
			.array()
			.notNull()
			.default(sql`'{1,2,3,4,5}'`),
		sessionDurationDays: smallint('session_duration_days').notNull().default(7),
		updatedAt: updatedAt()
	},
	(t) => [
		check('settings_singleton', sql`${t.id} = 1`),
		check('settings_primary_color_hex', sql`${t.primaryColor} ~ '^#[0-9a-fA-F]{6}$'`),
		check(
			'settings_working_days_valid',
			sql`cardinality(${t.workingDays}) > 0 and ${t.workingDays} <@ '{1,2,3,4,5,6,7}'::smallint[]`
		),
		check('settings_logo_has_mime_type', sql`(${t.logo} is null) = (${t.logoMimeType} is null)`),
		check('settings_session_duration_range', sql`${t.sessionDurationDays} between 1 and 90`)
	]
);

export const auditLog = pgTable(
	'audit_log',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		// Null when the action is performed by the system (scheduled task).
		userId: uuid('user_id').references(() => users.id),
		action: text('action').notNull(),
		entity: text('entity').notNull(),
		entityId: text('entity_id'),
		details: jsonb('details'),
		createdAt: createdAt()
	},
	(t) => [
		index('audit_log_created_idx').on(t.createdAt.desc()),
		index('audit_log_entity_idx').on(t.entity, t.entityId)
	]
);

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type WeekEntry = typeof weekEntries.$inferSelect;
export type WeeklyReport = typeof weeklyReports.$inferSelect;
export type MonthlyReport = typeof monthlyReports.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type Settings = typeof settings.$inferSelect;
export type AuditLogEntry = typeof auditLog.$inferSelect;
