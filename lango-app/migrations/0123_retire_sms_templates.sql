-- §15.1 Retire the standalone sms_templates table: the SMS Communication
-- template studio was consolidated onto the shared Broadcast
-- communication_templates system (channel='sms'), and a backfill script
-- (scripts/backfill-sms-templates.ts) already migrated existing rows. This drops
-- the now-orphaned table so there is exactly one template store.
-- Hand-written. Idempotent: safe to rerun (IF EXISTS).

--> statement-breakpoint
DROP TABLE IF EXISTS "sms_templates";
