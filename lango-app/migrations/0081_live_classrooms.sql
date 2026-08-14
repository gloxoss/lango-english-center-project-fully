-- Live Classrooms add-on (v1)
-- Hand-written (never drizzle-kit generate). Idempotent: safe to rerun.
-- Lango owns scheduling, authorization, roster, normalized immutable
-- participant events, derived attendance, recording policy and reports; the
-- provider owns media. See future-implementation/live-classrooms/.

DO $$ BEGIN
 CREATE TYPE "public"."live_class_session_status" AS ENUM('draft', 'scheduled', 'waiting', 'live', 'ended', 'cancelled', 'failed', 'expired');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."live_class_event_type" AS ENUM('joined', 'left', 'reconnect', 'error', 'kicked', 'muted', 'consent_accepted', 'recording_started', 'recording_stopped');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."live_class_reconciliation_state" AS ENUM('pending', 'proposed', 'approved', 'rejected', 'posted');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "live_class_provider_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"provider_type" varchar(30) NOT NULL,
	"scope" varchar(20) DEFAULT 'tenant' NOT NULL,
	"base_url" varchar(500),
	"account_id" varchar(120),
	"credential_ref" varchar(120),
	"credential_encrypted" text,
	"capabilities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "live_class_recurrences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"rule" varchar(255) NOT NULL,
	"timezone" varchar(64) NOT NULL,
	"starts_on" timestamp NOT NULL,
	"ends_on" timestamp,
	"source_slot_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "live_class_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"provider_profile_id" uuid NOT NULL,
	"class_offering_id" uuid,
	"class_section_id" uuid,
	"class_subject_id" uuid,
	"teacher_user_id" text NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"objectives" text,
	"provider_meeting_id" varchar(200),
	"scheduled_start" timestamp NOT NULL,
	"scheduled_end" timestamp NOT NULL,
	"timezone" varchar(64) DEFAULT 'Africa/Casablanca' NOT NULL,
	"actual_start" timestamp,
	"actual_end" timestamp,
	"status" "public"."live_class_session_status" DEFAULT 'draft' NOT NULL,
	"policy" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source_timetable_slot_id" uuid,
	"recurrence_id" uuid,
	"creator_user_id" text NOT NULL,
	"last_sync_at" timestamp,
	"failure_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "live_class_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"participant_role" varchar(20) NOT NULL,
	"join_eligible" boolean DEFAULT true NOT NULL,
	"delivery_state" varchar(20) DEFAULT 'none' NOT NULL,
	"delivery_channel" varchar(20),
	"delivered_at" timestamp,
	"invited_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "live_class_participant_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"provider_event_id" varchar(200) NOT NULL,
	"provider_profile_id" uuid NOT NULL,
	"user_id" text,
	"external_participant_id" varchar(200),
	"participant_role" varchar(20),
	"event_type" "public"."live_class_event_type" NOT NULL,
	"provider_timestamp" timestamp NOT NULL,
	"received_timestamp" timestamp DEFAULT now() NOT NULL,
	"raw_payload" jsonb,
	"processing_status" varchar(20) DEFAULT 'pending' NOT NULL,
	"retries" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "live_class_attendance_summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"participant_role" varchar(20) NOT NULL,
	"first_join_at" timestamp,
	"last_leave_at" timestamp,
	"total_presence_seconds" integer DEFAULT 0 NOT NULL,
	"intervals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reconnect_count" integer DEFAULT 0 NOT NULL,
	"late_join_seconds" integer DEFAULT 0 NOT NULL,
	"early_leave_seconds" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) DEFAULT 'unknown' NOT NULL,
	"reconciliation_state" "public"."live_class_reconciliation_state" DEFAULT 'pending' NOT NULL,
	"reconciliation_note" text,
	"reconciled_by" text,
	"reconciled_at" timestamp,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "live_class_recordings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"provider_recording_id" varchar(200),
	"state" varchar(20) DEFAULT 'processing' NOT NULL,
	"playback_url" text,
	"download_url" text,
	"duration_seconds" integer,
	"size_bytes" bigint,
	"retention_days" integer,
	"expires_at" timestamp,
	"consent_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "live_class_webhook_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"provider_profile_id" uuid NOT NULL,
	"provider_event_id" varchar(200),
	"signature_result" varchar(20) NOT NULL,
	"processing_status" varchar(20) DEFAULT 'received' NOT NULL,
	"attempts" integer DEFAULT 1 NOT NULL,
	"last_error" text,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp,
	"raw_payload" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "live_class_provider_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"session_id" uuid,
	"provider_profile_id" uuid NOT NULL,
	"operation" varchar(30) NOT NULL,
	"idempotency_key" varchar(160) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"request_snapshot" jsonb,
	"result_snapshot" jsonb,
	"error" text,
	"attempts" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "live_class_provider_profiles_tenant_name_unique" ON "live_class_provider_profiles" ("tenant_id","name");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "live_class_sessions_provider_meeting_unique" ON "live_class_sessions" ("provider_profile_id","provider_meeting_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "live_class_invitations_session_user_unique" ON "live_class_invitations" ("session_id","user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "live_class_participant_events_provider_event_unique" ON "live_class_participant_events" ("tenant_id","provider_event_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "live_class_attendance_summaries_session_user_unique" ON "live_class_attendance_summaries" ("session_id","user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "live_class_recordings_provider_recording_unique" ON "live_class_recordings" ("tenant_id","provider_recording_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "live_class_webhook_receipts_event_unique" ON "live_class_webhook_receipts" ("tenant_id","provider_event_id") WHERE "provider_event_id" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "live_class_provider_operations_idem_key_unique" ON "live_class_provider_operations" ("tenant_id","idempotency_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "live_class_sessions_tenant_start_idx" ON "live_class_sessions" ("tenant_id","scheduled_start");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "live_class_sessions_tenant_teacher_idx" ON "live_class_sessions" ("tenant_id","teacher_user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "live_class_sessions_tenant_status_idx" ON "live_class_sessions" ("tenant_id","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "live_class_participant_events_session_idx" ON "live_class_participant_events" ("tenant_id","session_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "live_class_recordings_session_idx" ON "live_class_recordings" ("tenant_id","session_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "live_class_webhook_receipts_profile_received_idx" ON "live_class_webhook_receipts" ("tenant_id","provider_profile_id","received_at");
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "live_class_provider_profiles" ADD CONSTRAINT "live_class_provider_profiles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "live_class_recurrences" ADD CONSTRAINT "live_class_recurrences_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "live_class_recurrences" ADD CONSTRAINT "live_class_recurrences_source_slot_id_class_schedule_slots_id_fk" FOREIGN KEY ("source_slot_id") REFERENCES "class_schedule_slots"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "live_class_sessions" ADD CONSTRAINT "live_class_sessions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "live_class_sessions" ADD CONSTRAINT "live_class_sessions_provider_profile_id_live_class_provider_profiles_id_fk" FOREIGN KEY ("provider_profile_id") REFERENCES "live_class_provider_profiles"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "live_class_sessions" ADD CONSTRAINT "live_class_sessions_class_offering_id_academic_class_offerings_id_fk" FOREIGN KEY ("class_offering_id") REFERENCES "academic_class_offerings"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "live_class_sessions" ADD CONSTRAINT "live_class_sessions_class_section_id_class_sections_id_fk" FOREIGN KEY ("class_section_id") REFERENCES "class_sections"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "live_class_sessions" ADD CONSTRAINT "live_class_sessions_class_subject_id_class_subjects_id_fk" FOREIGN KEY ("class_subject_id") REFERENCES "class_subjects"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "live_class_sessions" ADD CONSTRAINT "live_class_sessions_teacher_user_id_user_id_fk" FOREIGN KEY ("teacher_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "live_class_sessions" ADD CONSTRAINT "live_class_sessions_source_timetable_slot_id_class_schedule_slots_id_fk" FOREIGN KEY ("source_timetable_slot_id") REFERENCES "class_schedule_slots"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "live_class_sessions" ADD CONSTRAINT "live_class_sessions_recurrence_id_live_class_recurrences_id_fk" FOREIGN KEY ("recurrence_id") REFERENCES "live_class_recurrences"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "live_class_sessions" ADD CONSTRAINT "live_class_sessions_creator_user_id_user_id_fk" FOREIGN KEY ("creator_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "live_class_invitations" ADD CONSTRAINT "live_class_invitations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "live_class_invitations" ADD CONSTRAINT "live_class_invitations_session_id_live_class_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "live_class_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "live_class_invitations" ADD CONSTRAINT "live_class_invitations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "live_class_invitations" ADD CONSTRAINT "live_class_invitations_invited_by_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "live_class_participant_events" ADD CONSTRAINT "live_class_participant_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "live_class_participant_events" ADD CONSTRAINT "live_class_participant_events_session_id_live_class_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "live_class_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "live_class_participant_events" ADD CONSTRAINT "live_class_participant_events_provider_profile_id_live_class_provider_profiles_id_fk" FOREIGN KEY ("provider_profile_id") REFERENCES "live_class_provider_profiles"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "live_class_participant_events" ADD CONSTRAINT "live_class_participant_events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "live_class_attendance_summaries" ADD CONSTRAINT "live_class_attendance_summaries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "live_class_attendance_summaries" ADD CONSTRAINT "live_class_attendance_summaries_session_id_live_class_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "live_class_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "live_class_attendance_summaries" ADD CONSTRAINT "live_class_attendance_summaries_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "live_class_attendance_summaries" ADD CONSTRAINT "live_class_attendance_summaries_reconciled_by_user_id_fk" FOREIGN KEY ("reconciled_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "live_class_recordings" ADD CONSTRAINT "live_class_recordings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "live_class_recordings" ADD CONSTRAINT "live_class_recordings_session_id_live_class_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "live_class_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "live_class_recordings" ADD CONSTRAINT "live_class_recordings_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "live_class_webhook_receipts" ADD CONSTRAINT "live_class_webhook_receipts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "live_class_webhook_receipts" ADD CONSTRAINT "live_class_webhook_receipts_provider_profile_id_live_class_provider_profiles_id_fk" FOREIGN KEY ("provider_profile_id") REFERENCES "live_class_provider_profiles"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "live_class_provider_operations" ADD CONSTRAINT "live_class_provider_operations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "live_class_provider_operations" ADD CONSTRAINT "live_class_provider_operations_session_id_live_class_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "live_class_sessions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "live_class_provider_operations" ADD CONSTRAINT "live_class_provider_operations_provider_profile_id_live_class_provider_profiles_id_fk" FOREIGN KEY ("provider_profile_id") REFERENCES "live_class_provider_profiles"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
