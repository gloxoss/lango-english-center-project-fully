-- 0118_student_accounting_phase_d.sql — plan #12 Phase D: invoice lifecycle
-- (draft/credited statuses) + persisted receipts. Idempotent.
-- ALTER TYPE ... ADD VALUE (PG 17) must be its own autocommit statement — never
-- wrapped in a DO block or combined with other statements in one transaction.
--> statement-breakpoint
ALTER TYPE invoice_status ADD VALUE IF NOT EXISTS 'draft';
--> statement-breakpoint
ALTER TYPE invoice_status ADD VALUE IF NOT EXISTS 'credited';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  receipt_number varchar(50) NOT NULL,
  student_id text NOT NULL,
  amount numeric(14,2) NOT NULL,
  payment_date date NOT NULL,
  allocations jsonb NOT NULL DEFAULT '[]',
  created_by_id text,
  created_at timestamp DEFAULT now(),
  CONSTRAINT receipts_tenant_id_tenants_id_fk FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT receipts_student_id_user_id_fk FOREIGN KEY (student_id) REFERENCES "user"(id) ON DELETE CASCADE,
  CONSTRAINT receipts_tenant_receipt_number_uidx UNIQUE (tenant_id, receipt_number)
);
