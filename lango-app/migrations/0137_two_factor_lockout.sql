-- 0137_two_factor_lockout.sql — closes schema drift.
-- Schema.ts already declared two_factor.failed_verification_count and
-- locked_until (the brute-force lockout on TOTP verification), but no migration
-- ever created them, so a fresh deploy would fail on the first verify query.
-- Hand-written, forward-only, idempotent.
--> statement-breakpoint
ALTER TABLE "two_factor" ADD COLUMN IF NOT EXISTS "failed_verification_count" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "two_factor" ADD COLUMN IF NOT EXISTS "locked_until" timestamp;
