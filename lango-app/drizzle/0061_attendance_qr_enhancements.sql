CREATE TYPE "identity_badge_status" AS ENUM('active', 'revoked', 'expired', 'replaced');
CREATE TYPE "identity_badge_subject_type" AS ENUM('student', 'staff', 'visitor');

CREATE TABLE IF NOT EXISTS "identity_badge_credentials" (
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

CREATE TABLE IF NOT EXISTS "scanner_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"device_label" varchar(255) NOT NULL,
	"branch_id" uuid,
	"paired_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp,
	"is_disabled" boolean DEFAULT false NOT NULL,
	"secret_key" text
);

CREATE TABLE IF NOT EXISTS "scanner_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"device_id" uuid,
	"operator_id" text NOT NULL,
	"class_section_id" uuid,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"status" varchar(50) DEFAULT 'active' NOT NULL
);

CREATE TABLE IF NOT EXISTS "attendance_scan_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"session_id" uuid,
	"credential_id" uuid,
	"student_id" text,
	"result_status" varchar(50) NOT NULL,
	"rejection_reason" text,
	"idempotency_key" varchar(255),
	"scanned_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "workforce_punch_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"employee_id" text NOT NULL,
	"credential_id" uuid,
	"punch_type" varchar(10) NOT NULL,
	"scanned_at" timestamp DEFAULT now() NOT NULL,
	"device_id" uuid,
	"notes" text
);

ALTER TABLE "identity_badge_credentials" ADD CONSTRAINT "identity_badge_credentials_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "identity_badge_credentials" ADD CONSTRAINT "identity_badge_credentials_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "scanner_devices" ADD CONSTRAINT "scanner_devices_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "scanner_sessions" ADD CONSTRAINT "scanner_sessions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "scanner_sessions" ADD CONSTRAINT "scanner_sessions_operator_id_user_id_fk" FOREIGN KEY ("operator_id") REFERENCES "user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "attendance_scan_events" ADD CONSTRAINT "attendance_scan_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "workforce_punch_events" ADD CONSTRAINT "workforce_punch_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "workforce_punch_events" ADD CONSTRAINT "workforce_punch_events_employee_id_user_id_fk" FOREIGN KEY ("employee_id") REFERENCES "user"("id") ON DELETE cascade ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "identity_badge_credentials_tenant_user_idx" ON "identity_badge_credentials" ("tenant_id", "user_id");
CREATE INDEX IF NOT EXISTS "attendance_scan_events_tenant_session_idx" ON "attendance_scan_events" ("tenant_id", "session_id");
CREATE INDEX IF NOT EXISTS "workforce_punch_events_tenant_employee_idx" ON "workforce_punch_events" ("tenant_id", "employee_id");
