DO $$ BEGIN
 CREATE TYPE "public"."event_lifecycle_status" AS ENUM('draft', 'pending_approval', 'published', 'completed', 'cancelled', 'archived');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."event_recurrence_rule" AS ENUM('none', 'daily', 'weekly', 'monthly');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."event_venue_type" AS ENUM('physical', 'online', 'hybrid');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."event_audience_target_kind" AS ENUM('school', 'role', 'class_offering', 'class_section', 'class_subject', 'user', 'group');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."event_registration_status" AS ENUM('going', 'maybe', 'declined', 'waitlisted', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."event_invitation_status" AS ENUM('pending', 'sent', 'opened', 'responded');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."event_waitlist_status" AS ENUM('queued', 'offered', 'expired', 'accepted', 'declined');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."event_checkin_method" AS ENUM('qr', 'manual_search', 'self_service');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"style" jsonb,
	"requires_approval" boolean DEFAULT false NOT NULL,
	"requires_rsvp" boolean DEFAULT false NOT NULL,
	"requires_checkin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"branch_id" uuid,
	"owner_id" text NOT NULL,
	"type_id" uuid,
	"event_type" text DEFAULT 'event' NOT NULL,
	"is_system_generated" boolean DEFAULT false NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"visibility" text DEFAULT 'internal' NOT NULL,
	"lifecycle" "event_lifecycle_status" DEFAULT 'draft' NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"published_at" timestamp,
	"cancelled_at" timestamp,
	"cancellation_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"event_id" uuid NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"is_all_day" boolean DEFAULT false NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"recurrence_rule" "event_recurrence_rule" DEFAULT 'none' NOT NULL,
	"recurrence_end_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_occurrences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"event_id" uuid NOT NULL,
	"schedule_id" uuid NOT NULL,
	"original_date" text NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"is_cancelled" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_venues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"event_id" uuid NOT NULL,
	"occurrence_id" uuid,
	"venue_type" "event_venue_type" DEFAULT 'physical' NOT NULL,
	"name" text,
	"address" text,
	"capacity" integer,
	"online_link" text,
	"accessibility_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_audience_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"event_id" uuid NOT NULL,
	"target_kind" "event_audience_target_kind" NOT NULL,
	"target_role_value" text,
	"target_ref_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"event_id" uuid NOT NULL,
	"occurrence_id" uuid,
	"person_id" text NOT NULL,
	"status" "event_invitation_status" DEFAULT 'pending' NOT NULL,
	"sent_at" timestamp,
	"responded_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"occurrence_id" uuid NOT NULL,
	"person_id" text NOT NULL,
	"status" "event_registration_status" DEFAULT 'going' NOT NULL,
	"seats" integer DEFAULT 1 NOT NULL,
	"answers" jsonb,
	"consent_given" boolean DEFAULT false NOT NULL,
	"idempotency_key" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_waitlist_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"occurrence_id" uuid NOT NULL,
	"person_id" text NOT NULL,
	"status" "event_waitlist_status" DEFAULT 'queued' NOT NULL,
	"queued_at" timestamp DEFAULT now() NOT NULL,
	"offer_expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_checkins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"occurrence_id" uuid NOT NULL,
	"registration_id" uuid,
	"person_id" text NOT NULL,
	"method" "event_checkin_method" DEFAULT 'manual_search' NOT NULL,
	"operator_id" text,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_types_tenant_idx" ON "event_types" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_tenant_idx" ON "events" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_schedules_event_idx" ON "event_schedules" ("event_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_occurrences_event_idx" ON "event_occurrences" ("event_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_venues_event_idx" ON "event_venues" ("event_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_audience_rules_event_idx" ON "event_audience_rules" ("event_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_invitations_event_idx" ON "event_invitations" ("event_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_invitations_person_idx" ON "event_invitations" ("person_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "event_registrations_occurrence_person_unique" ON "event_registrations" ("occurrence_id","person_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_waitlist_occurrence_idx" ON "event_waitlist_entries" ("occurrence_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_checkins_occurrence_idx" ON "event_checkins" ("occurrence_id");
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_schedules" ADD CONSTRAINT "event_schedules_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_occurrences" ADD CONSTRAINT "event_occurrences_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_occurrences" ADD CONSTRAINT "event_occurrences_schedule_id_event_schedules_id_fk" FOREIGN KEY ("schedule_id") REFERENCES "event_schedules"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_venues" ADD CONSTRAINT "event_venues_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_venues" ADD CONSTRAINT "event_venues_occurrence_id_event_occurrences_id_fk" FOREIGN KEY ("occurrence_id") REFERENCES "event_occurrences"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_audience_rules" ADD CONSTRAINT "event_audience_rules_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_invitations" ADD CONSTRAINT "event_invitations_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_invitations" ADD CONSTRAINT "event_invitations_occurrence_id_event_occurrences_id_fk" FOREIGN KEY ("occurrence_id") REFERENCES "event_occurrences"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_occurrence_id_event_occurrences_id_fk" FOREIGN KEY ("occurrence_id") REFERENCES "event_occurrences"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_waitlist_entries" ADD CONSTRAINT "event_waitlist_entries_occurrence_id_event_occurrences_id_fk" FOREIGN KEY ("occurrence_id") REFERENCES "event_occurrences"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_checkins" ADD CONSTRAINT "event_checkins_occurrence_id_event_occurrences_id_fk" FOREIGN KEY ("occurrence_id") REFERENCES "event_occurrences"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_checkins" ADD CONSTRAINT "event_checkins_registration_id_event_registrations_id_fk" FOREIGN KEY ("registration_id") REFERENCES "event_registrations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
