-- 0112_student_accounting_phase_b.sql — plan #12 Phase B: fee types (fee_categories)
-- enrichment (code, revenue mapping, tax/refund/discount/fine flags, active dates,
-- archive) + fee_structures scope columns (academic term, branch). Idempotent.
--> statement-breakpoint
ALTER TABLE fee_categories ADD COLUMN IF NOT EXISTS code varchar(50);
--> statement-breakpoint
ALTER TABLE fee_categories ADD COLUMN IF NOT EXISTS taxable boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE fee_categories ADD COLUMN IF NOT EXISTS refundable boolean NOT NULL DEFAULT true;
--> statement-breakpoint
ALTER TABLE fee_categories ADD COLUMN IF NOT EXISTS discountable boolean NOT NULL DEFAULT true;
--> statement-breakpoint
ALTER TABLE fee_categories ADD COLUMN IF NOT EXISTS fineable boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE fee_categories ADD COLUMN IF NOT EXISTS revenue_account_id uuid;
--> statement-breakpoint
ALTER TABLE fee_categories ADD COLUMN IF NOT EXISTS effective_from date NOT NULL DEFAULT CURRENT_DATE;
--> statement-breakpoint
ALTER TABLE fee_categories ADD COLUMN IF NOT EXISTS effective_to date;
--> statement-breakpoint
ALTER TABLE fee_categories ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fee_categories_revenue_account_id_chart_of_accounts_id_fk'
  ) THEN
    ALTER TABLE fee_categories ADD CONSTRAINT fee_categories_revenue_account_id_chart_of_accounts_id_fk
      FOREIGN KEY (revenue_account_id) REFERENCES chart_of_accounts(id);
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS fee_categories_tenant_code_uidx
  ON fee_categories(tenant_id, code) WHERE code IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS fee_categories_tenant_archived_idx ON fee_categories(tenant_id, is_archived);
--> statement-breakpoint
ALTER TABLE fee_structures ADD COLUMN IF NOT EXISTS academic_term_id uuid;
--> statement-breakpoint
ALTER TABLE fee_structures ADD COLUMN IF NOT EXISTS branch_id uuid;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fee_structures_academic_term_id_semesters_id_fk'
  ) THEN
    ALTER TABLE fee_structures ADD CONSTRAINT fee_structures_academic_term_id_semesters_id_fk
      FOREIGN KEY (academic_term_id) REFERENCES semesters(id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fee_structures_branch_id_branches_id_fk'
  ) THEN
    ALTER TABLE fee_structures ADD CONSTRAINT fee_structures_branch_id_branches_id_fk
      FOREIGN KEY (branch_id) REFERENCES branches(id);
  END IF;
END $$;
