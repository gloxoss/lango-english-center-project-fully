-- 0104_library_accounting_mappings.sql
-- WA6 — Library charge → Accounting posting adapter.
-- Extends accounting_source_mappings.source_key_type so the library module can
-- resolve its own accounts through the same adapter contract used by Student
-- Accounting:
--   * 'library_member'        -> receivable (per member, or NULL module default)
--   * 'library_charge_reason' -> revenue   (per reason, or NULL module default)
-- The existing rules are unchanged: exact key first, then the NULL default row;
-- exactly one default per (tenant, module, key_type) via the partial unique
-- index created by migration 0103. Idempotent: DROP IF EXISTS + ADD restores a
-- deterministic constraint state on re-run.
--> statement-breakpoint
ALTER TABLE accounting_source_mappings DROP CONSTRAINT IF EXISTS accounting_source_mappings_shape_check;
--> statement-breakpoint
ALTER TABLE accounting_source_mappings ADD CONSTRAINT accounting_source_mappings_shape_check CHECK (
  source_key_type IN ('fee_category','payment_method','student','library_member','library_charge_reason')
);
