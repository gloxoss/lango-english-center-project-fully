-- Migration: 0146_support_ticket_attachments.sql
-- Fixes schema/migration drift from 0143: src/models/Schema.ts declares
-- `attachments` jsonb on platform_support_tickets and
-- platform_support_ticket_messages, but 0143 never created the columns, so
-- every GET /api/tenant/support SELECT failed with
-- "column \"attachments\" does not exist" (500) — root cause of the recurring
-- tenant-isolation suite failure.
-- Hand-written, forward-only, idempotent.

ALTER TABLE "platform_support_tickets"
  ADD COLUMN IF NOT EXISTS "attachments" jsonb DEFAULT '[]'::jsonb;
--> statement-breakpoint
ALTER TABLE "platform_support_ticket_messages"
  ADD COLUMN IF NOT EXISTS "attachments" jsonb DEFAULT '[]'::jsonb;
