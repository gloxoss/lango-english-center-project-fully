-- 0113_events_addon_completion.sql — plan #26 Events completion: operational tables
-- (reminder rules, communication jobs, attachments, tasks, incidents, feedback,
-- audit events) + idempotent recurrence-materialization unique index. Idempotent.
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_reminder_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"event_id" uuid NOT NULL,
	"occurrence_id" uuid,
	"before_minutes" integer NOT NULL,
	"channel" text DEFAULT 'email' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_communication_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"event_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb,
	"status" text DEFAULT 'queued' NOT NULL,
	"scheduled_for" timestamp,
	"sent_at" timestamp,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"event_id" uuid NOT NULL,
	"occurrence_id" uuid,
	"title" text NOT NULL,
	"file_key" text NOT NULL,
	"mime_type" text,
	"size_bytes" integer,
	"kind" text DEFAULT 'document' NOT NULL,
	"uploaded_by_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"event_id" uuid NOT NULL,
	"occurrence_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'todo' NOT NULL,
	"due_at" timestamp,
	"assignee_id" text,
	"created_by_id" text NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"event_id" uuid NOT NULL,
	"occurrence_id" uuid,
	"severity" text DEFAULT 'medium' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'open' NOT NULL,
	"reported_by_id" text NOT NULL,
	"resolved_by_id" text,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"event_id" uuid NOT NULL,
	"occurrence_id" uuid,
	"person_id" text NOT NULL,
	"rating" integer,
	"comment" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_by_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"event_id" uuid NOT NULL,
	"action" text NOT NULL,
	"actor_id" text NOT NULL,
	"details" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_reminder_rules_event_idx" ON "event_reminder_rules" ("event_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_communication_jobs_event_idx" ON "event_communication_jobs" ("event_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_attachments_event_idx" ON "event_attachments" ("event_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_tasks_event_idx" ON "event_tasks" ("event_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_incidents_event_idx" ON "event_incidents" ("event_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_feedback_event_idx" ON "event_feedback" ("event_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_audit_events_event_idx" ON "event_audit_events" ("event_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "event_occurrences_schedule_date_uidx" ON "event_occurrences" ("schedule_id", "original_date");
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_reminder_rules" ADD CONSTRAINT "event_reminder_rules_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_communication_jobs" ADD CONSTRAINT "event_communication_jobs_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_attachments" ADD CONSTRAINT "event_attachments_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_tasks" ADD CONSTRAINT "event_tasks_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_incidents" ADD CONSTRAINT "event_incidents_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_feedback" ADD CONSTRAINT "event_feedback_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_audit_events" ADD CONSTRAINT "event_audit_events_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
