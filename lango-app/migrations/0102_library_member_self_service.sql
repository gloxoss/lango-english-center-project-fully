-- Library member self-service: explicit parent library access right.
-- Hand-written (never drizzle-kit generate). Idempotent: safe to rerun.
-- guardian_students.can_access_library gates the parent/guardian view of a
-- child's library activity (self-service endpoints under /me/children/*).
-- Backfill-safe: existing rows default to true, preserving pre-portal access.

--> statement-breakpoint
ALTER TABLE "guardian_students" ADD COLUMN IF NOT EXISTS "can_access_library" boolean DEFAULT true NOT NULL;
