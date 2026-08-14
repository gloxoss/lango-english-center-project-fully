-- Library Management hardening: circulation idempotency + stocktake reconcile.
-- Hand-written (never drizzle-kit generate). Idempotent: safe to rerun.
--  1. library_loans.idempotency_key + partial-unique (tenant, key) — a repeated
--     desk checkout scan resolves to the existing loan instead of double-loaning.
--  2. library_stocktake_observations unique (stocktake_id, copy_id) — one count
--     per copy per stocktake (observeCopy upsert target).
--  3. library_stocktake_adjustments.applied_at + partial-unique — an adjustment
--     is applied to a copy at most once per stocktake.

--> statement-breakpoint
ALTER TABLE "library_loans" ADD COLUMN IF NOT EXISTS "idempotency_key" varchar(120);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "library_loans_tenant_idempotency_key_idx" ON "library_loans" ("tenant_id","idempotency_key") WHERE "idempotency_key" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "library_stocktake_observations_stocktake_copy_unique" ON "library_stocktake_observations" ("stocktake_id","copy_id");
--> statement-breakpoint
ALTER TABLE "library_stocktake_adjustments" ADD COLUMN IF NOT EXISTS "applied_at" timestamp;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "library_stocktake_adjustments_tenant_stocktake_copy_unapplied_idx" ON "library_stocktake_adjustments" ("tenant_id","stocktake_id","copy_id") WHERE "applied_at" IS NULL;
