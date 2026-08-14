-- 0114_student_accounting_phase_c.sql — plan #12 Phase C: allocation run lifecycle.
-- fee_allocation_runs gains branch scope, base due date and approve/cancel audit;
-- fee_allocation_targets gains processed_at. Idempotent.
--> statement-breakpoint
ALTER TABLE fee_allocation_runs ADD COLUMN IF NOT EXISTS branch_id uuid;
ALTER TABLE fee_allocation_runs ADD COLUMN IF NOT EXISTS due_date date;
ALTER TABLE fee_allocation_runs ADD COLUMN IF NOT EXISTS approved_by_id text;
ALTER TABLE fee_allocation_runs ADD COLUMN IF NOT EXISTS approved_at timestamp;
ALTER TABLE fee_allocation_runs ADD COLUMN IF NOT EXISTS cancelled_by_id text;
ALTER TABLE fee_allocation_runs ADD COLUMN IF NOT EXISTS cancelled_at timestamp;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fee_allocation_runs_branch_id_branches_id_fk'
  ) THEN
    ALTER TABLE fee_allocation_runs ADD CONSTRAINT fee_allocation_runs_branch_id_branches_id_fk
      FOREIGN KEY (branch_id) REFERENCES branches(id);
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE fee_allocation_targets ADD COLUMN IF NOT EXISTS processed_at timestamp;
