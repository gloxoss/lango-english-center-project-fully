-- Library policy CRUD + branch closure calendar.
-- Hand-written (never drizzle-kit generate). Idempotent: safe to rerun.
--  1. Partial-unique loan policies — one policy per (tenant, patron category,
--     branch) and one generic per (tenant, patron category) so branch-specific
--     precedence in resolveMemberPolicy is never ambiguous.
--  2. library_closure_calendar — closed dates (branch-scoped or tenant-wide)
--     that due dates skip. Partial-unique on (tenant, branch, date) and
--     (tenant, date) for the tenant-wide row (branch NULL).

--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "library_loan_policies_tenant_category_branch_unique" ON "library_loan_policies" ("tenant_id","patron_category","branch_id") WHERE "branch_id" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "library_loan_policies_tenant_category_generic_unique" ON "library_loan_policies" ("tenant_id","patron_category") WHERE "branch_id" IS NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "library_closure_calendar" (
  "id" uuid PRIMARY KEY NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL,
  "branch_id" uuid,
  "closed_on" date NOT NULL,
  "reason" varchar(255),
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'library_closure_calendar_tenant_id_tenants_id_fk') THEN
    ALTER TABLE "library_closure_calendar" ADD CONSTRAINT "library_closure_calendar_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'library_closure_calendar_branch_id_branches_id_fk') THEN
    ALTER TABLE "library_closure_calendar" ADD CONSTRAINT "library_closure_calendar_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE cascade;
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "library_closure_calendar_tenant_branch_date_unique" ON "library_closure_calendar" ("tenant_id","branch_id","closed_on") WHERE "branch_id" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "library_closure_calendar_tenant_date_unique" ON "library_closure_calendar" ("tenant_id","closed_on") WHERE "branch_id" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "library_closure_calendar_tenant_date_idx" ON "library_closure_calendar" ("tenant_id","closed_on");
