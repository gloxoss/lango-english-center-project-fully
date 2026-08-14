-- Guard & Security Portal (core role feature, no addon)
-- Hand-written (never drizzle-kit generate). Idempotent: safe to rerun.
-- All guard tables are tenant-scoped; status fields are varchar (evidence style).

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "guard_gates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"branch_id" uuid,
	"gate_code" varchar(30) NOT NULL,
	"gate_name" varchar(120) NOT NULL,
	"direction" varchar(10) DEFAULT 'both' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_gates" ADD CONSTRAINT "guard_gates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_gates" ADD CONSTRAINT "guard_gates_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_gates" ADD CONSTRAINT "guard_gates_tenant_code_unique" UNIQUE ("tenant_id","gate_code");
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "guard_shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"branch_id" uuid,
	"name" varchar(120) NOT NULL,
	"start_time" varchar(5) NOT NULL,
	"end_time" varchar(5) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_shifts" ADD CONSTRAINT "guard_shifts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_shifts" ADD CONSTRAINT "guard_shifts_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "guard_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"guard_user_id" text NOT NULL,
	"gate_id" uuid NOT NULL,
	"shift_id" uuid NOT NULL,
	"device_id" uuid,
	"effective_from" timestamp NOT NULL,
	"effective_until" timestamp,
	"status" varchar(20) DEFAULT 'scheduled' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_assignments" ADD CONSTRAINT "guard_assignments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_assignments" ADD CONSTRAINT "guard_assignments_guard_user_id_user_id_fk" FOREIGN KEY ("guard_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_assignments" ADD CONSTRAINT "guard_assignments_gate_id_guard_gates_id_fk" FOREIGN KEY ("gate_id") REFERENCES "public"."guard_gates"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_assignments" ADD CONSTRAINT "guard_assignments_shift_id_guard_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."guard_shifts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_assignments" ADD CONSTRAINT "guard_assignments_device_id_scanner_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."scanner_devices"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "guard_assignments_guard_active_unique" ON "guard_assignments" ("guard_user_id") WHERE status = 'active';
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "guard_assignments_device_active_unique" ON "guard_assignments" ("device_id") WHERE status = 'active';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "guard_assignments_tenant_gate_idx" ON "guard_assignments" ("tenant_id","gate_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "guard_kiosk_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"gate_id" uuid NOT NULL,
	"device_id" uuid,
	"operator_id" text NOT NULL,
	"assignment_id" uuid NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp,
	"expires_at" timestamp NOT NULL,
	"locked_at" timestamp,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_kiosk_sessions" ADD CONSTRAINT "guard_kiosk_sessions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_kiosk_sessions" ADD CONSTRAINT "guard_kiosk_sessions_gate_id_guard_gates_id_fk" FOREIGN KEY ("gate_id") REFERENCES "public"."guard_gates"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_kiosk_sessions" ADD CONSTRAINT "guard_kiosk_sessions_operator_id_user_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_kiosk_sessions" ADD CONSTRAINT "guard_kiosk_sessions_assignment_id_guard_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."guard_assignments"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_kiosk_sessions" ADD CONSTRAINT "guard_kiosk_sessions_device_id_scanner_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."scanner_devices"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "guard_kiosk_sessions_device_active_unique" ON "guard_kiosk_sessions" ("device_id") WHERE status = 'active';
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "guard_kiosk_sessions_operator_gate_active_unique" ON "guard_kiosk_sessions" ("operator_id","gate_id") WHERE status = 'active';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "guard_kiosk_sessions_tenant_operator_idx" ON "guard_kiosk_sessions" ("tenant_id","operator_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "guard_visitor_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"branch_id" uuid,
	"visitor_first_name" varchar(120) NOT NULL,
	"visitor_last_name" varchar(120) NOT NULL,
	"visitor_phone" varchar(50),
	"visitor_email" varchar(255),
	"purpose" varchar(255) NOT NULL,
	"host_id" text NOT NULL,
	"expected_date" timestamp NOT NULL,
	"expected_start" varchar(5) NOT NULL,
	"expected_end" varchar(5) NOT NULL,
	"status" varchar(20) DEFAULT 'invited' NOT NULL,
	"approved_by_id" text,
	"approved_at" timestamp,
	"created_by_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_visitor_invitations" ADD CONSTRAINT "guard_visitor_invitations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_visitor_invitations" ADD CONSTRAINT "guard_visitor_invitations_host_id_user_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_visitor_invitations" ADD CONSTRAINT "guard_visitor_invitations_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "guard_visitor_invitations_tenant_expected_idx" ON "guard_visitor_invitations" ("tenant_id","expected_date");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "guard_visits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"branch_id" uuid,
	"invitation_id" uuid,
	"visitor_first_name" varchar(120) NOT NULL,
	"visitor_last_name" varchar(120) NOT NULL,
	"visitor_phone" varchar(50),
	"visitor_email" varchar(255),
	"purpose" varchar(255) NOT NULL,
	"host_id" text,
	"host_name" varchar(255),
	"pass_number" varchar(30),
	"badge_credential_id" uuid,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"check_in_at" timestamp,
	"check_out_at" timestamp,
	"check_in_by" text,
	"check_out_by" text,
	"gate_id" uuid,
	"created_by_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_visits" ADD CONSTRAINT "guard_visits_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_visits" ADD CONSTRAINT "guard_visits_invitation_id_guard_visitor_invitations_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."guard_visitor_invitations"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_visits" ADD CONSTRAINT "guard_visits_host_id_user_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_visits" ADD CONSTRAINT "guard_visits_badge_credential_id_identity_badge_credentials_id_fk" FOREIGN KEY ("badge_credential_id") REFERENCES "public"."identity_badge_credentials"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_visits" ADD CONSTRAINT "guard_visits_check_in_by_user_id_fk" FOREIGN KEY ("check_in_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_visits" ADD CONSTRAINT "guard_visits_check_out_by_user_id_fk" FOREIGN KEY ("check_out_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_visits" ADD CONSTRAINT "guard_visits_gate_id_guard_gates_id_fk" FOREIGN KEY ("gate_id") REFERENCES "public"."guard_gates"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_visits" ADD CONSTRAINT "guard_visits_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_visits" ADD CONSTRAINT "guard_visits_tenant_pass_number_unique" UNIQUE ("tenant_id","pass_number");
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "guard_visits_tenant_status_idx" ON "guard_visits" ("tenant_id","status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "guard_pickup_authorizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"student_id" text NOT NULL,
	"pickup_person_id" uuid NOT NULL,
	"relationship_type" varchar(100) NOT NULL,
	"authorized_from" timestamp NOT NULL,
	"authorized_until" timestamp NOT NULL,
	"reason" varchar(255),
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"consumed_at" timestamp,
	"created_by_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_pickup_authorizations" ADD CONSTRAINT "guard_pickup_authorizations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_pickup_authorizations" ADD CONSTRAINT "guard_pickup_authorizations_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_pickup_authorizations" ADD CONSTRAINT "guard_pickup_authorizations_pickup_person_id_guardians_id_fk" FOREIGN KEY ("pickup_person_id") REFERENCES "public"."guardians"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_pickup_authorizations" ADD CONSTRAINT "guard_pickup_authorizations_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "guard_pickup_authorizations_tenant_student_idx" ON "guard_pickup_authorizations" ("tenant_id","student_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "guard_release_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"student_id" text NOT NULL,
	"authorization_id" uuid NOT NULL,
	"release_method" varchar(20) NOT NULL,
	"operator_id" text NOT NULL,
	"gate_id" uuid NOT NULL,
	"device_id" uuid,
	"kiosk_session_id" uuid,
	"idempotency_key" varchar(255),
	"released_at" timestamp DEFAULT now() NOT NULL,
	"evidence" jsonb NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_release_events" ADD CONSTRAINT "guard_release_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_release_events" ADD CONSTRAINT "guard_release_events_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_release_events" ADD CONSTRAINT "guard_release_events_authorization_id_guard_pickup_authorizations_id_fk" FOREIGN KEY ("authorization_id") REFERENCES "public"."guard_pickup_authorizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_release_events" ADD CONSTRAINT "guard_release_events_operator_id_user_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_release_events" ADD CONSTRAINT "guard_release_events_gate_id_guard_gates_id_fk" FOREIGN KEY ("gate_id") REFERENCES "public"."guard_gates"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_release_events" ADD CONSTRAINT "guard_release_events_kiosk_session_id_guard_kiosk_sessions_id_fk" FOREIGN KEY ("kiosk_session_id") REFERENCES "public"."guard_kiosk_sessions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "guard_release_events_authorization_unique" ON "guard_release_events" ("authorization_id") WHERE release_method IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "guard_release_events_tenant_released_idx" ON "guard_release_events" ("tenant_id","released_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "guard_gate_scan_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"kiosk_session_id" uuid,
	"gate_id" uuid NOT NULL,
	"device_id" uuid,
	"direction" varchar(10) NOT NULL,
	"credential_id" uuid,
	"subject_type" varchar(20),
	"student_id" text,
	"visit_id" uuid,
	"result_status" varchar(20) NOT NULL,
	"rejection_reason" varchar(60),
	"idempotency_key" varchar(255),
	"scanned_at" timestamp DEFAULT now() NOT NULL,
	"actor_id" text NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_gate_scan_events" ADD CONSTRAINT "guard_gate_scan_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_gate_scan_events" ADD CONSTRAINT "guard_gate_scan_events_kiosk_session_id_guard_kiosk_sessions_id_fk" FOREIGN KEY ("kiosk_session_id") REFERENCES "public"."guard_kiosk_sessions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_gate_scan_events" ADD CONSTRAINT "guard_gate_scan_events_gate_id_guard_gates_id_fk" FOREIGN KEY ("gate_id") REFERENCES "public"."guard_gates"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_gate_scan_events" ADD CONSTRAINT "guard_gate_scan_events_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_gate_scan_events" ADD CONSTRAINT "guard_gate_scan_events_visit_id_guard_visits_id_fk" FOREIGN KEY ("visit_id") REFERENCES "public"."guard_visits"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_gate_scan_events" ADD CONSTRAINT "guard_gate_scan_events_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "guard_gate_scan_events_idempotency_unique" ON "guard_gate_scan_events" ("idempotency_key") WHERE idempotency_key IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "guard_gate_scan_events_tenant_scan_idx" ON "guard_gate_scan_events" ("tenant_id","scanned_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "guard_incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"branch_id" uuid,
	"gate_id" uuid,
	"category" varchar(50) NOT NULL,
	"severity" varchar(20) DEFAULT 'low' NOT NULL,
	"location" varchar(255),
	"description" text NOT NULL,
	"reported_by_id" text NOT NULL,
	"occurred_at" timestamp DEFAULT now() NOT NULL,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"escalated_to_id" text,
	"escalated_at" timestamp,
	"resolved_by_id" text,
	"resolved_at" timestamp,
	"resolution_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_incidents" ADD CONSTRAINT "guard_incidents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_incidents" ADD CONSTRAINT "guard_incidents_gate_id_guard_gates_id_fk" FOREIGN KEY ("gate_id") REFERENCES "public"."guard_gates"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_incidents" ADD CONSTRAINT "guard_incidents_reported_by_id_user_id_fk" FOREIGN KEY ("reported_by_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_incidents" ADD CONSTRAINT "guard_incidents_escalated_to_id_user_id_fk" FOREIGN KEY ("escalated_to_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "guard_incidents_tenant_status_idx" ON "guard_incidents" ("tenant_id","status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "guard_incident_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"incident_id" uuid NOT NULL,
	"action_type" varchar(30) NOT NULL,
	"notes" text,
	"actor_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_incident_actions" ADD CONSTRAINT "guard_incident_actions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_incident_actions" ADD CONSTRAINT "guard_incident_actions_incident_id_guard_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."guard_incidents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_incident_actions" ADD CONSTRAINT "guard_incident_actions_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "guard_incident_actions_tenant_incident_idx" ON "guard_incident_actions" ("tenant_id","incident_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "guard_incident_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"incident_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"original_name" varchar(255) NOT NULL,
	"mime_type" varchar(120) NOT NULL,
	"file_size" integer NOT NULL,
	"uploaded_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_incident_attachments" ADD CONSTRAINT "guard_incident_attachments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_incident_attachments" ADD CONSTRAINT "guard_incident_attachments_incident_id_guard_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."guard_incidents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_incident_attachments" ADD CONSTRAINT "guard_incident_attachments_uploaded_by_id_user_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "guard_emergency_procedures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"branch_id" uuid,
	"title" varchar(255) NOT NULL,
	"body" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"updated_by_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_emergency_procedures" ADD CONSTRAINT "guard_emergency_procedures_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_emergency_procedures" ADD CONSTRAINT "guard_emergency_procedures_updated_by_id_user_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "guard_emergency_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"branch_id" uuid,
	"name" varchar(255) NOT NULL,
	"role" varchar(120) NOT NULL,
	"phone" varchar(50) NOT NULL,
	"priority" integer DEFAULT 10 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_emergency_contacts" ADD CONSTRAINT "guard_emergency_contacts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "guard_emergency_activations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"activated_by_id" text NOT NULL,
	"activated_at" timestamp DEFAULT now() NOT NULL,
	"procedure_snapshot" jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"ended_by_id" text,
	"ended_at" timestamp,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_emergency_activations" ADD CONSTRAINT "guard_emergency_activations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_emergency_activations" ADD CONSTRAINT "guard_emergency_activations_activated_by_id_user_id_fk" FOREIGN KEY ("activated_by_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "guard_emergency_acknowledgements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"activation_id" uuid NOT NULL,
	"acknowledged_by_id" text NOT NULL,
	"acknowledged_at" timestamp DEFAULT now() NOT NULL,
	"device_id" uuid,
	"kiosk_session_id" uuid
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_emergency_acknowledgements" ADD CONSTRAINT "guard_emergency_acknowledgements_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_emergency_acknowledgements" ADD CONSTRAINT "guard_emergency_acknowledgements_activation_id_guard_emergency_activations_id_fk" FOREIGN KEY ("activation_id") REFERENCES "public"."guard_emergency_activations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_emergency_acknowledgements" ADD CONSTRAINT "guard_emergency_acknowledgements_acknowledged_by_id_user_id_fk" FOREIGN KEY ("acknowledged_by_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "guard_emergency_acknowledgements" ADD CONSTRAINT "guard_emergency_ack_activation_guard_unique" UNIQUE ("activation_id","acknowledged_by_id");
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
-- DOWN (dev/test only): drop tables in reverse dependency order.
-- DROP TABLE IF EXISTS "guard_emergency_acknowledgements";
-- DROP TABLE IF EXISTS "guard_emergency_activations";
-- DROP TABLE IF EXISTS "guard_emergency_contacts";
-- DROP TABLE IF EXISTS "guard_emergency_procedures";
-- DROP TABLE IF EXISTS "guard_incident_attachments";
-- DROP TABLE IF EXISTS "guard_incident_actions";
-- DROP TABLE IF EXISTS "guard_incidents";
-- DROP TABLE IF EXISTS "guard_gate_scan_events";
-- DROP TABLE IF EXISTS "guard_release_events";
-- DROP TABLE IF EXISTS "guard_pickup_authorizations";
-- DROP TABLE IF EXISTS "guard_visits";
-- DROP TABLE IF EXISTS "guard_visitor_invitations";
-- DROP TABLE IF EXISTS "guard_kiosk_sessions";
-- DROP TABLE IF EXISTS "guard_assignments";
-- DROP TABLE IF EXISTS "guard_shifts";
-- DROP TABLE IF EXISTS "guard_gates";
