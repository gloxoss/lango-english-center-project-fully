-- 0155_attendance_rate_nullable.sql — ZERO DENOMINATOR TRUTH.
--
-- attendance_summary.attendance_rate was NOT NULL default '100.00', so a
-- student with zero recorded sessions was stored as 100% attendance — a
-- fabricated perfect score. The truthful domain value is NULL ("not
-- calculated"). Deterministic remediation: only rows that are BOTH
-- zero-denominator AND exactly 100.00 can be fake; every such row is set to
-- NULL. Non-zero rows and legitimate 100% rows (with sessions) are preserved.
--
-- Hand-written, forward-only, idempotent.

ALTER TABLE "attendance_summary" ALTER COLUMN "attendance_rate" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "attendance_summary" ALTER COLUMN "attendance_rate" DROP DEFAULT;--> statement-breakpoint

UPDATE "attendance_summary"
SET "attendance_rate" = NULL
WHERE "total_sessions" = 0
  AND "attendance_rate" = '100.00';
