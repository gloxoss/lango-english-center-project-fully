-- Parent / Guardian Portal — parent request inbox (P7).
-- Hand-written (never drizzle-kit generate). Idempotent: safe to rerun.
-- Records parent → school requests (profile correction, leave/permission,
-- document request, other) as *intent only*; the destination module performs
-- the actual change in its own table. FKs: tenant (cascade), guardian
-- (cascade), student (cascade), deciding staff (set null).
-- See future-implementation/parent-guardian-portal/.implementation-plan/PLAN.md §P7.

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "parent_requests" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL,
  "guardian_id" uuid NOT NULL,
  "student_id" text NOT NULL,
  "request_type" varchar(30) NOT NULL,
  "subject" varchar(255) NOT NULL,
  "body" text,
  "status" varchar(20) NOT NULL DEFAULT 'pending',
  "decided_by_id" text,
  "decision_notes" text,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "parent_requests_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "parent_requests_guardian_id_guardians_id_fk" FOREIGN KEY ("guardian_id") REFERENCES "public"."guardians"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "parent_requests_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action,
  CONSTRAINT "parent_requests_decided_by_id_user_id_fk" FOREIGN KEY ("decided_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "parent_requests_tenant_status_idx" ON "parent_requests" ("tenant_id","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "parent_requests_tenant_student_idx" ON "parent_requests" ("tenant_id","student_id");
