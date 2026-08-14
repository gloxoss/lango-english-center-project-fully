-- Migration 0064: Attendance QR staging — link scan evidence to real attendance records
-- A successful badge scan now creates a real `attendance` row (present/late). The scan
-- event keeps the class-section/register context, the staged status, and a pointer to
-- the attendance row it produced, so scan -> stage -> submit preserves a full evidence chain.

CREATE TYPE "public"."identity_badge_status" AS ENUM('active', 'revoked', 'expired', 'replaced');--> statement-breakpoint
CREATE TYPE "public"."identity_badge_subject_type" AS ENUM('student', 'staff', 'visitor');--> statement-breakpoint

CREATE TABLE "identity_badge_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"subject_type" "identity_badge_subject_type" DEFAULT 'student' NOT NULL,
	"token_hash" text NOT NULL,
	"display_prefix" varchar(20),
	"status" "identity_badge_status" DEFAULT 'active' NOT NULL,
	"issued_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"revoked_at" timestamp,
	"issuer_id" text,
	"replacement_id" uuid,
	CONSTRAINT "identity_badge_credentials_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "scanner_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"device_label" varchar(255) NOT NULL,
	"branch_id" uuid,
	"paired_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp,
	"is_disabled" boolean DEFAULT false NOT NULL,
	"secret_key" text
);
--> statement-breakpoint
CREATE TABLE "scanner_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"device_id" uuid,
	"operator_id" text NOT NULL,
	"class_section_id" uuid,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"status" varchar(50) DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance_scan_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"session_id" uuid,
	"credential_id" uuid,
	"student_id" text,
	"result_status" varchar(50) NOT NULL,
	"rejection_reason" text,
	"idempotency_key" varchar(255),
	"scanned_at" timestamp DEFAULT now() NOT NULL,
	"class_section_id" uuid,
	"register_id" uuid,
	"staged_status" varchar(20),
	"attendance_record_id" uuid
);
--> statement-breakpoint
CREATE TABLE "workforce_punch_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"employee_id" text NOT NULL,
	"credential_id" uuid,
	"punch_type" varchar(10) NOT NULL,
	"scanned_at" timestamp DEFAULT now() NOT NULL,
	"device_id" uuid,
	"notes" text
);
--> statement-breakpoint
ALTER TABLE "identity_badge_credentials" ADD CONSTRAINT "identity_badge_credentials_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity_badge_credentials" ADD CONSTRAINT "identity_badge_credentials_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scanner_devices" ADD CONSTRAINT "scanner_devices_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scanner_sessions" ADD CONSTRAINT "scanner_sessions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scanner_sessions" ADD CONSTRAINT "scanner_sessions_operator_id_user_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_scan_events" ADD CONSTRAINT "attendance_scan_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_punch_events" ADD CONSTRAINT "workforce_punch_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workforce_punch_events" ADD CONSTRAINT "workforce_punch_events_employee_id_user_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "attendance" ADD COLUMN "scan_event_id" uuid;--> statement-breakpoint

ALTER TABLE "school_settings" ADD COLUMN "attendance_late_grace_minutes" integer DEFAULT 15;--> statement-breakpoint
ALTER TABLE "school_settings" ADD COLUMN "attendance_period_start_time" varchar(5) DEFAULT '08:00';--> statement-breakpoint

ALTER TABLE "attendance" ADD CONSTRAINT "attendance_scan_event_id_attendance_scan_events_id_fk" FOREIGN KEY ("scan_event_id") REFERENCES "public"."attendance_scan_events"("id") ON DELETE SET NULL ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "attendance_scan_event_idx" ON "attendance" USING btree ("scan_event_id");--> statement-breakpoint
CREATE INDEX "identity_badge_credentials_tenant_user_idx" ON "identity_badge_credentials" USING btree ("tenant_id","user_id");--> statement-breakpoint
CREATE INDEX "attendance_scan_events_tenant_session_idx" ON "attendance_scan_events" USING btree ("tenant_id","session_id");--> statement-breakpoint
CREATE INDEX "attendance_scan_events_credential_session_idx" ON "attendance_scan_events" USING btree ("tenant_id","credential_id","session_id");--> statement-breakpoint
CREATE INDEX "attendance_scan_events_tenant_scan_idx" ON "attendance_scan_events" USING btree ("tenant_id","scanned_at");--> statement-breakpoint
CREATE INDEX "workforce_punch_events_tenant_employee_idx" ON "workforce_punch_events" USING btree ("tenant_id","employee_id");
