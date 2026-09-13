-- 0140_report_run_heartbeat.sql — crash recovery for background report runs.
--
-- Recovery previously judged a run "stuck" by its created_at age, which is wrong
-- in both directions: a run that queued an hour ago but started a minute ago was
-- killed, and a run whose process died one second after starting looked healthy
-- until the 15-minute mark. Staleness now comes from a heartbeat the executing
-- process touches, which is the only thing that actually stops when a process
-- dies.
--
-- Hand-written, forward-only, idempotent.
--> statement-breakpoint
ALTER TABLE "report_runs" ADD COLUMN IF NOT EXISTS "started_at" timestamp;
--> statement-breakpoint
ALTER TABLE "report_runs" ADD COLUMN IF NOT EXISTS "heartbeat_at" timestamp;
--> statement-breakpoint
ALTER TABLE "report_runs" ADD COLUMN IF NOT EXISTS "attempts" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
-- Backfill: rows already in flight when this ships have no heartbeat, so without
-- a seed the first sweep would judge them infinitely stale and fail them all.
-- created_at is the most conservative stand-in — it makes an old run look old
-- (which it is) without inventing a fresher timestamp than the data supports.
UPDATE "report_runs"
   SET "started_at" = COALESCE("started_at", "created_at"),
       "heartbeat_at" = COALESCE("heartbeat_at", "created_at"),
       "attempts" = GREATEST("attempts", 1)
 WHERE "status" IN ('running', 'queued');
--> statement-breakpoint
-- The sweep reads by (status, heartbeat_at) across all tenants.
CREATE INDEX IF NOT EXISTS "report_runs_status_heartbeat_idx"
  ON "report_runs" ("status", "heartbeat_at");
