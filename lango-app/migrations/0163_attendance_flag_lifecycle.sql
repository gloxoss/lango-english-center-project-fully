-- 0159_attendance_flag_lifecycle.sql — A FOLLOW-UP HAS STATES.
--
-- attendance_flags only knew OPEN and RESOLVED. A follow-up that had been seen,
-- or that someone had already called the family about, looked identical to one
-- nobody had touched — so "how many alerts are outstanding" could not be
-- answered truthfully, and the only way to clear a flag nobody intended to act
-- on was to resolve a case that was never resolved.
--
-- The lifecycle is now:
--
--   OPEN (detected) -> ACKNOWLEDGED -> CONTACTED -> RESOLVED
--                                            \-> DISMISSED (reason required)
--
-- ADDITIVE: the two existing values keep their meaning, so no row is rewritten
-- and every current query still works. DISMISSED needs a reason, enforced in
-- the route rather than by a NOT NULL, because existing RESOLVED rows have none.
--
-- Hand-written, forward-only, idempotent.

-- ALTER TYPE ... ADD VALUE cannot run inside a transaction block on older
-- PostgreSQL, and IF NOT EXISTS makes a re-run a no-op.
ALTER TYPE "attendance_flag_status" ADD VALUE IF NOT EXISTS 'ACKNOWLEDGED';--> statement-breakpoint
ALTER TYPE "attendance_flag_status" ADD VALUE IF NOT EXISTS 'CONTACTED';--> statement-breakpoint
ALTER TYPE "attendance_flag_status" ADD VALUE IF NOT EXISTS 'DISMISSED';--> statement-breakpoint

ALTER TABLE "attendance_flags" ADD COLUMN IF NOT EXISTS "dismiss_reason" text;--> statement-breakpoint

-- When the family was actually reached. Distinct from resolved_at: a flag can be
-- contacted and still unresolved, and that gap is the follow-up that goes stale.
ALTER TABLE "attendance_flags" ADD COLUMN IF NOT EXISTS "contacted_at" timestamp;--> statement-breakpoint

-- The outstanding-work query: "what still needs action" filters on status, so it
-- needs an index once ACKNOWLEDGED/CONTACTED rows start accumulating.
CREATE INDEX IF NOT EXISTS "attendance_flags_tenant_status_idx"
  ON "attendance_flags" ("tenant_id", "status");
