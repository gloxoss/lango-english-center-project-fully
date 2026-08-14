-- Receptionist Portal — appointments, identity verifications, handoffs (core role feature)
-- Hand-written (never drizzle-kit generate). Idempotent: safe to rerun.
-- Adds the front-desk operational tables: appointment lifecycle + immutable
-- status history, identity-verification *outcomes* (method + result only, never
-- document copies), and handoff/task lifecycle + immutable status history. See
-- future-implementation/receptionist-portal/.implementation-plan/EXECUTION-PLAN.md.
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reception_appointments" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL,
  "branch_id" uuid,
  "guest_type" varchar(30) NOT NULL DEFAULT 'parent',
  "guest_name" varchar(255) NOT NULL,
  "guest_phone" varchar(50),
  "purpose" varchar(255) NOT NULL,
  "host_id" text NOT NULL,
  "host_name" varchar(255),
  "start_at" timestamp NOT NULL,
  "end_at" timestamp NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'scheduled',
  "notes" text,
  "version" integer NOT NULL DEFAULT 0,
  "idempotency_key" varchar(255),
  "created_by_id" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reception_appointments_host_id_user_id_fk') THEN
    ALTER TABLE "reception_appointments" ADD CONSTRAINT "reception_appointments_host_id_user_id_fk" FOREIGN KEY ("host_id") REFERENCES "user"("id") ON DELETE SET NULL;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reception_appointments_created_by_id_user_id_fk') THEN
    ALTER TABLE "reception_appointments" ADD CONSTRAINT "reception_appointments_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reception_appointments_tenant_start_idx" ON "reception_appointments" ("tenant_id","start_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reception_appointments_tenant_status_idx" ON "reception_appointments" ("tenant_id","status");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "reception_appointments_idempotency_unique" ON "reception_appointments" ("idempotency_key") WHERE "idempotency_key" IS NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reception_appointment_status_history" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL,
  "appointment_id" uuid NOT NULL,
  "from_status" varchar(20),
  "to_status" varchar(20) NOT NULL,
  "changed_by_id" text NOT NULL,
  "reason" varchar(500),
  "created_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reception_appointment_status_history_appointment_id_reception_appointments_id_fk') THEN
    ALTER TABLE "reception_appointment_status_history" ADD CONSTRAINT "reception_appointment_status_history_appointment_id_reception_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "reception_appointments"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reception_appointment_status_history_changed_by_id_user_id_fk') THEN
    ALTER TABLE "reception_appointment_status_history" ADD CONSTRAINT "reception_appointment_status_history_changed_by_id_user_id_fk" FOREIGN KEY ("changed_by_id") REFERENCES "user"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reception_appointment_status_history_tenant_appt_idx" ON "reception_appointment_status_history" ("tenant_id","appointment_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reception_identity_verifications" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL,
  "subject_type" varchar(20) NOT NULL,
  "subject_id" text NOT NULL,
  "method" varchar(30) NOT NULL,
  "outcome" varchar(20) NOT NULL,
  "notes" varchar(500),
  "verifier_id" text NOT NULL,
  "performed_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reception_identity_verifications_verifier_id_user_id_fk') THEN
    ALTER TABLE "reception_identity_verifications" ADD CONSTRAINT "reception_identity_verifications_verifier_id_user_id_fk" FOREIGN KEY ("verifier_id") REFERENCES "user"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reception_identity_verifications_tenant_performed_idx" ON "reception_identity_verifications" ("tenant_id","performed_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reception_identity_verifications_tenant_subject_idx" ON "reception_identity_verifications" ("tenant_id","subject_type","subject_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reception_handoffs" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL,
  "branch_id" uuid,
  "category" varchar(30) NOT NULL,
  "subject_type" varchar(20),
  "subject_id" text,
  "title" varchar(255) NOT NULL,
  "description" text,
  "priority" varchar(10) NOT NULL DEFAULT 'medium',
  "assigned_to_id" text,
  "deadline" timestamp,
  "status" varchar(20) NOT NULL DEFAULT 'open',
  "resolution_notes" text,
  "acknowledged_by_id" text,
  "acknowledged_at" timestamp,
  "resolved_by_id" text,
  "resolved_at" timestamp,
  "idempotency_key" varchar(255),
  "created_by_id" text NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reception_handoffs_assigned_to_id_user_id_fk') THEN
    ALTER TABLE "reception_handoffs" ADD CONSTRAINT "reception_handoffs_assigned_to_id_user_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "user"("id") ON DELETE SET NULL;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reception_handoffs_created_by_id_user_id_fk') THEN
    ALTER TABLE "reception_handoffs" ADD CONSTRAINT "reception_handoffs_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reception_handoffs_tenant_status_idx" ON "reception_handoffs" ("tenant_id","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reception_handoffs_tenant_assigned_idx" ON "reception_handoffs" ("tenant_id","assigned_to_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "reception_handoffs_idempotency_unique" ON "reception_handoffs" ("idempotency_key") WHERE "idempotency_key" IS NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reception_handoff_status_history" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL,
  "handoff_id" uuid NOT NULL,
  "from_status" varchar(20),
  "to_status" varchar(20) NOT NULL,
  "changed_by_id" text NOT NULL,
  "reason" varchar(500),
  "created_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reception_handoff_status_history_handoff_id_reception_handoffs_id_fk') THEN
    ALTER TABLE "reception_handoff_status_history" ADD CONSTRAINT "reception_handoff_status_history_handoff_id_reception_handoffs_id_fk" FOREIGN KEY ("handoff_id") REFERENCES "reception_handoffs"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reception_handoff_status_history_changed_by_id_user_id_fk') THEN
    ALTER TABLE "reception_handoff_status_history" ADD CONSTRAINT "reception_handoff_status_history_changed_by_id_user_id_fk" FOREIGN KEY ("changed_by_id") REFERENCES "user"("id") ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "reception_handoff_status_history_tenant_handoff_idx" ON "reception_handoff_status_history" ("tenant_id","handoff_id");
