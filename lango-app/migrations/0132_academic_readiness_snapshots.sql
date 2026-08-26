-- 0132_academic_readiness_snapshots.sql — weekly point-in-time snapshots of the
-- academic readiness score (Part 4, item 6). Backs the historical trend line on
-- the readiness dashboard. tenant_id/session_year_id are uuid to match the
-- academics domain. Hand-written, idempotent.
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "academic_readiness_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"session_year_id" uuid NOT NULL,
	"overall_score" integer NOT NULL,
	"captured_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "academic_readiness_snapshots" DROP CONSTRAINT IF EXISTS "academic_readiness_snapshots_tenant_id_tenants_id_fk";
ALTER TABLE "academic_readiness_snapshots" ADD CONSTRAINT "academic_readiness_snapshots_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "academic_readiness_snapshots" DROP CONSTRAINT IF EXISTS "academic_readiness_snapshots_session_year_id_session_years_id_fk";
ALTER TABLE "academic_readiness_snapshots" ADD CONSTRAINT "academic_readiness_snapshots_session_year_id_session_years_id_fk" FOREIGN KEY ("session_year_id") REFERENCES "public"."session_years"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "academic_readiness_snapshots_tenant_session_idx" ON "academic_readiness_snapshots" ("tenant_id", "session_year_id", "captured_at");
