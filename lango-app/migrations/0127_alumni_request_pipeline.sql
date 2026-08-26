-- 0127_alumni_request_pipeline.sql — §5.1: replace the binary alumni-request
-- decision (pending -> approved | rejected) with a 5-stage fulfillment pipeline
-- received -> accepted -> preparing -> ready -> taken/refused. Extends the
-- alumni_request_status enum. Hand-written. Idempotent.
-- ALTER TYPE ... ADD VALUE (PG 17) must be its own autocommit statement — never
-- wrapped in a DO block or combined with other statements in one transaction.
-- The original version of this file also backfilled existing rows from the
-- old pending/approved/rejected values onto the new stage names via UPDATE -
-- removed: drizzle-kit migrate batches every pending file into one
-- transaction, and Postgres refuses to use a value added by ALTER TYPE ADD
-- VALUE earlier in that same transaction ("unsafe use of new value... New
-- enum values must be committed before they can be used"), so this file
-- could never actually apply via `drizzle-kit migrate` even standalone. The
-- backfill only ever mattered for rows already using the old values on an
-- already-migrated live database; the enum extension itself does not depend
-- on it, and it is a no-op for any fresh install (no existing rows to touch).
--> statement-breakpoint
ALTER TYPE "alumni_request_status" ADD VALUE IF NOT EXISTS 'received';
--> statement-breakpoint
ALTER TYPE "alumni_request_status" ADD VALUE IF NOT EXISTS 'accepted';
--> statement-breakpoint
ALTER TYPE "alumni_request_status" ADD VALUE IF NOT EXISTS 'preparing';
--> statement-breakpoint
ALTER TYPE "alumni_request_status" ADD VALUE IF NOT EXISTS 'ready';
--> statement-breakpoint
ALTER TYPE "alumni_request_status" ADD VALUE IF NOT EXISTS 'taken';
--> statement-breakpoint
ALTER TYPE "alumni_request_status" ADD VALUE IF NOT EXISTS 'refused';
