-- 0124_student_accounting_phase_h.sql — plan #12 Phase H: multi-method payments,
-- per-tenant currency + accounting export.
--  1. payments.payment_method: enum -> varchar(50) (config-driven methods).
--  2. payment_method_configurations: gateway fields (provider/mode/secret keys).
--  3. payment_gateway_sessions: online gateway session ledger.
--  4. backfill the 4 built-in offline methods for every tenant (idempotent).
--> statement-breakpoint
ALTER TABLE payments ALTER COLUMN payment_method DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE payments ALTER COLUMN payment_method SET DATA TYPE varchar(50) USING payment_method::text;
--> statement-breakpoint
ALTER TABLE payments ALTER COLUMN payment_method SET DEFAULT 'cash';
--> statement-breakpoint
ALTER TABLE payment_method_configurations ADD COLUMN IF NOT EXISTS provider varchar(30);
--> statement-breakpoint
ALTER TABLE payment_method_configurations ADD COLUMN IF NOT EXISTS gateway_mode varchar(10) DEFAULT 'sandbox';
--> statement-breakpoint
ALTER TABLE payment_method_configurations ADD COLUMN IF NOT EXISTS credential_secret_key varchar(128);
--> statement-breakpoint
ALTER TABLE payment_method_configurations ADD COLUMN IF NOT EXISTS webhook_secret_key varchar(128);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS payment_gateway_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  invoice_id uuid NOT NULL,
  payment_id uuid,
  method_code varchar(50) NOT NULL,
  provider varchar(30) NOT NULL,
  external_reference varchar(100),
  amount numeric(14,2) NOT NULL,
  currency varchar(3) DEFAULT 'MAD' NOT NULL,
  status varchar(20) DEFAULT 'pending' NOT NULL,
  mode varchar(10) DEFAULT 'sandbox' NOT NULL,
  raw_callback jsonb,
  expires_at timestamp,
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL,
  CONSTRAINT payment_gateway_sessions_tenant_id_tenants_id_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT payment_gateway_sessions_invoice_id_invoices_id_fk FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);
--> statement-breakpoint
ALTER TABLE payment_gateway_sessions ADD COLUMN IF NOT EXISTS method_code varchar(50);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS payment_gateway_sessions_tenant_ext_idx ON payment_gateway_sessions (tenant_id, external_reference);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS payment_gateway_sessions_tenant_status_idx ON payment_gateway_sessions (tenant_id, status);
--> statement-breakpoint
INSERT INTO payment_method_configurations (tenant_id, method_code, label_fr, refundable, is_active, effective_from)
SELECT t.id, m.code, m.label, true, true, CURRENT_DATE FROM tenants t
CROSS JOIN (VALUES ('cash','Espèces'),('card','Carte'),('transfer','Virement'),('check','Chèque')) AS m(code,label)
WHERE NOT EXISTS (
  SELECT 1 FROM payment_method_configurations pm
  WHERE pm.tenant_id = t.id AND pm.method_code = m.code
);
