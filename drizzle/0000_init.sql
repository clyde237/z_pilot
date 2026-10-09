CREATE TYPE "public"."notification_type" AS ENUM('task_assigned', 'daily_reminder', 'week_ready_to_close', 'month_ready', 'weekly_report_published');--> statement-breakpoint
CREATE TYPE "public"."weekly_report_status" AS ENUM('published', 'reopened');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monthly_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"year" smallint NOT NULL,
	"month" smallint NOT NULL,
	"version" smallint NOT NULL,
	"snapshot" jsonb NOT NULL,
	"intro_text" text,
	"conclusion_text" text,
	"generated_by" uuid NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "monthly_reports_year_month_version_key" UNIQUE("year","month","version"),
	CONSTRAINT "monthly_reports_month_range" CHECK ("monthly_reports"."month" between 1 and 12),
	CONSTRAINT "monthly_reports_version_positive" CHECK ("monthly_reports"."version" >= 1)
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "notification_type" NOT NULL,
	"message" text NOT NULL,
	"link" text,
	"dedupe_key" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_key" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"organization_name" text DEFAULT 'Hôtel Zingana' NOT NULL,
	"department_name" text,
	"logo" "bytea",
	"logo_mime_type" text,
	"primary_color" text DEFAULT '#072848' NOT NULL,
	"working_days" smallint[] DEFAULT '{1,2,3,4,5}' NOT NULL,
	"session_duration_days" smallint DEFAULT 7 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settings_singleton" CHECK ("settings"."id" = 1),
	CONSTRAINT "settings_primary_color_hex" CHECK ("settings"."primary_color" ~ '^#[0-9a-fA-F]{6}$'),
	CONSTRAINT "settings_working_days_valid" CHECK (cardinality("settings"."working_days") > 0 and "settings"."working_days" <@ '{1,2,3,4,5,6,7}'::smallint[]),
	CONSTRAINT "settings_logo_has_mime_type" CHECK (("settings"."logo" is null) = ("settings"."logo_mime_type" is null)),
	CONSTRAINT "settings_session_duration_range" CHECK ("settings"."session_duration_days" between 1 and 90)
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"week_start" date NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"weight" smallint DEFAULT 1 NOT NULL,
	"planned_day" smallint,
	"target_value" numeric(12, 2),
	"unit" text,
	"achieved_value" numeric(12, 2),
	"is_done" boolean DEFAULT false NOT NULL,
	"done_on" date,
	"note" text,
	"carried_from_task_id" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tasks_week_start_is_monday" CHECK (extract(isodow from "tasks"."week_start") = 1),
	CONSTRAINT "tasks_title_not_blank" CHECK (btrim("tasks"."title") <> ''),
	CONSTRAINT "tasks_weight_range" CHECK ("tasks"."weight" between 1 and 3),
	CONSTRAINT "tasks_planned_day_range" CHECK ("tasks"."planned_day" between 1 and 7),
	CONSTRAINT "tasks_quantitative_fields" CHECK (("tasks"."target_value" is null) = ("tasks"."unit" is null)
				and ("tasks"."achieved_value" is null or "tasks"."target_value" is not null)),
	CONSTRAINT "tasks_target_value_positive" CHECK ("tasks"."target_value" > 0),
	CONSTRAINT "tasks_achieved_value_non_negative" CHECK ("tasks"."achieved_value" >= 0),
	CONSTRAINT "tasks_quantitative_done_matches_target" CHECK ("tasks"."target_value" is null or "tasks"."is_done" = (coalesce("tasks"."achieved_value", 0) >= "tasks"."target_value")),
	CONSTRAINT "tasks_done_on_iff_done" CHECK ("tasks"."is_done" = ("tasks"."done_on" is not null)),
	CONSTRAINT "tasks_done_on_within_week" CHECK ("tasks"."done_on" between "tasks"."week_start" and "tasks"."week_start" + 6)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"full_name" text NOT NULL,
	"password_hash" text NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"is_chef" boolean DEFAULT false NOT NULL,
	"participates_in_reports" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"must_change_password" boolean DEFAULT true NOT NULL,
	"failed_attempts" smallint DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_key" UNIQUE("username"),
	CONSTRAINT "users_username_lowercase" CHECK ("users"."username" = lower("users"."username")),
	CONSTRAINT "users_chef_participates" CHECK (not "users"."is_chef" or "users"."participates_in_reports"),
	CONSTRAINT "users_non_admin_participates" CHECK ("users"."is_admin" or "users"."participates_in_reports"),
	CONSTRAINT "users_failed_attempts_non_negative" CHECK ("users"."failed_attempts" >= 0)
);
--> statement-breakpoint
CREATE TABLE "week_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"week_start" date NOT NULL,
	"difficulties" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "week_entries_member_week_key" UNIQUE("member_id","week_start"),
	CONSTRAINT "week_entries_week_start_is_monday" CHECK (extract(isodow from "week_entries"."week_start") = 1)
);
--> statement-breakpoint
CREATE TABLE "weekly_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"week_start" date NOT NULL,
	"version" smallint NOT NULL,
	"status" "weekly_report_status" DEFAULT 'published' NOT NULL,
	"progress_pct" smallint,
	"snapshot" jsonb NOT NULL,
	"chef_comment" text,
	"next_week_plan" text,
	"published_by" uuid NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reopened_reason" text,
	CONSTRAINT "weekly_reports_member_week_version_key" UNIQUE("member_id","week_start","version"),
	CONSTRAINT "weekly_reports_week_start_is_monday" CHECK (extract(isodow from "weekly_reports"."week_start") = 1),
	CONSTRAINT "weekly_reports_version_positive" CHECK ("weekly_reports"."version" >= 1),
	CONSTRAINT "weekly_reports_progress_range" CHECK ("weekly_reports"."progress_pct" between 0 and 100),
	CONSTRAINT "weekly_reports_reopened_has_reason" CHECK (("weekly_reports"."status" = 'reopened') = ("weekly_reports"."reopened_reason" is not null))
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monthly_reports" ADD CONSTRAINT "monthly_reports_generated_by_users_id_fk" FOREIGN KEY ("generated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_member_id_users_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_carried_from_task_id_fkey" FOREIGN KEY ("carried_from_task_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "week_entries" ADD CONSTRAINT "week_entries_member_id_users_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_reports" ADD CONSTRAINT "weekly_reports_member_id_users_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_reports" ADD CONSTRAINT "weekly_reports_published_by_users_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_created_idx" ON "audit_log" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_user_dedupe_key" ON "notifications" USING btree ("user_id","dedupe_key") WHERE "notifications"."dedupe_key" is not null;--> statement-breakpoint
CREATE INDEX "notifications_user_created_idx" ON "notifications" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "notifications_user_unread_idx" ON "notifications" USING btree ("user_id") WHERE "notifications"."read_at" is null;--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_carried_from_task_id_key" ON "tasks" USING btree ("carried_from_task_id") WHERE "tasks"."carried_from_task_id" is not null;--> statement-breakpoint
CREATE INDEX "tasks_member_week_idx" ON "tasks" USING btree ("member_id","week_start");--> statement-breakpoint
CREATE INDEX "tasks_week_idx" ON "tasks" USING btree ("week_start");--> statement-breakpoint
CREATE UNIQUE INDEX "users_single_active_chef_key" ON "users" USING btree ("is_chef") WHERE "users"."is_chef" and "users"."active";--> statement-breakpoint
CREATE UNIQUE INDEX "weekly_reports_single_published_key" ON "weekly_reports" USING btree ("member_id","week_start") WHERE "weekly_reports"."status" = 'published';--> statement-breakpoint
CREATE INDEX "weekly_reports_week_idx" ON "weekly_reports" USING btree ("week_start");