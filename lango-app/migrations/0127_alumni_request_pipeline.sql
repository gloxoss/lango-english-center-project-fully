-- 0127_alumni_request_pipeline.sql — §5.1: replace the binary alumni-request
-- decision (pending -> approved | rejected) with a 5-stage fulfillment pipeline
-- received -> accepted -> preparing -> ready -> taken/refused. Extends the
-- alumni_request_status enum, then backfills existing rows onto the new stage
-- names. Hand-written. Idempotent.
-- ALTER TYPE ... ADD VALUE (PG 17) must be its own autocommit statement — never
-- wrapped in a DO block or combined with other statements in one transaction.
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
--> statement-breakpoint
UPDATE "alumni_requests" SET "status" = 'received' WHERE "status" = 'pending';
--> statement-breakpoint
UPDATE "alumni_requests" SET "status" = 'accepted' WHERE "status" = 'approved';
--> statement-breakpoint
UPDATE "alumni_requests" SET "status" = 'refused' WHERE "status" = 'rejected';
