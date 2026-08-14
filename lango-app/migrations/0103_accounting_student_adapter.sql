-- 0103_accounting_student_adapter.sql
-- WA5 — Student Accounting posting adapter.
--   * accounting_source_mappings   : resolves student accounting sources to the
--     chart of accounts. A mapping is scoped by (source_module, source_key_type,
--     source_key): fee_category -> revenue, payment_method -> bank/cash asset,
--     student -> receivable. A NULL source_key is the DEFAULT mapping for that
--     (module, key_type); exactly one default row per (tenant, module, key_type)
--     is enforced by a partial unique index. Accounts are referenced via the
--     tenant-composite FK convention (UNIQUE(tenant_id, id) on chart_of_accounts,
--     added by migration 0089).
--   * accounting_adapter_exceptions: explicit queue of BLOCKED source documents.
--     There is NO suspense fallback: an unmapped source is never posted to a
--     guessed account; it lands here with the exact payload that would have been
--     posted, so an accountant can fix the mapping and retry. One open row per
--     (source_module, source_document_id, version).
-- Invariants at the DB layer:
--   * The (module, key_type, key) tuple is unique per tenant; the default row per
--     (module, key_type) is unique (partial unique index on NULL source_key).
--   * Exceptions are unique per (tenant, source_module, source_document_id,
--     version) and restricted to open/resolved/dismissed.

CREATE TABLE IF NOT EXISTS accounting_source_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  source_module varchar(50) NOT NULL,
  source_key_type varchar(50) NOT NULL,
  source_key varchar(100),
  account_id uuid NOT NULL,
  created_by text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_by text,
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT accounting_source_mappings_tenant_id_unique UNIQUE (tenant_id, id),
  CONSTRAINT accounting_source_mappings_key_unique UNIQUE (tenant_id, source_module, source_key_type, source_key),
  CONSTRAINT accounting_source_mappings_account_fk FOREIGN KEY (tenant_id, account_id) REFERENCES chart_of_accounts(tenant_id, id) ON DELETE RESTRICT,
  CONSTRAINT accounting_source_mappings_shape_check CHECK (
    source_key_type IN ('fee_category','payment_method','student')
  )
);
CREATE INDEX IF NOT EXISTS accounting_source_mappings_account_idx ON accounting_source_mappings(tenant_id, account_id);
-- Exactly one default mapping per (tenant, source_module, source_key_type).
CREATE UNIQUE INDEX IF NOT EXISTS accounting_source_mappings_default_unique
  ON accounting_source_mappings(tenant_id, source_module, source_key_type)
  WHERE source_key IS NULL;
-- Self-heal for databases that applied the earlier 'default'-type variant of this
-- migration: drop the legacy rows and the old CHECK, re-apply the new CHECK.
DELETE FROM accounting_source_mappings WHERE source_key_type = 'default';
ALTER TABLE accounting_source_mappings DROP CONSTRAINT IF EXISTS accounting_source_mappings_shape_check;
ALTER TABLE accounting_source_mappings ADD CONSTRAINT accounting_source_mappings_shape_check CHECK (source_key_type IN ('fee_category','payment_method','student'));

CREATE TABLE IF NOT EXISTS accounting_adapter_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  source_module varchar(50) NOT NULL,
  source_document_type varchar(50) NOT NULL,
  source_document_id uuid NOT NULL,
  version integer NOT NULL DEFAULT 1,
  reason varchar(255) NOT NULL,
  detail text,
  payload jsonb,
  status varchar(20) NOT NULL DEFAULT 'open',
  created_by text,
  created_at timestamp NOT NULL DEFAULT now(),
  resolved_by text,
  resolved_at timestamp,
  resolution_note text,
  CONSTRAINT accounting_adapter_exceptions_tenant_id_unique UNIQUE (tenant_id, id),
  CONSTRAINT accounting_adapter_exceptions_source_unique UNIQUE (tenant_id, source_module, source_document_id, version),
  CONSTRAINT accounting_adapter_exceptions_status_check CHECK (status IN ('open','resolved','dismissed'))
);
CREATE INDEX IF NOT EXISTS accounting_adapter_exceptions_queue_idx ON accounting_adapter_exceptions(tenant_id, status, created_at);
