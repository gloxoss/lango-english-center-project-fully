CREATE UNIQUE INDEX IF NOT EXISTS salary_advances_one_pending_per_user_idx ON salary_advances(tenant_id,user_id) WHERE status='pending';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='salary_advances_amounts_check') THEN
    ALTER TABLE salary_advances ADD CONSTRAINT salary_advances_amounts_check CHECK (requested_amount > 0 AND (approved_amount IS NULL OR approved_amount > 0) AND repaid_amount >= 0 AND (monthly_installment IS NULL OR monthly_installment > 0));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='salary_advances_status_check') THEN
    ALTER TABLE salary_advances ADD CONSTRAINT salary_advances_status_check CHECK (status IN ('pending','approved','rejected','fully_repaid','cancelled'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='salary_advances_tenant_id_id_unique') THEN
    ALTER TABLE salary_advances ADD CONSTRAINT salary_advances_tenant_id_id_unique UNIQUE (tenant_id,id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='salary_advance_tx_advance_tenant_fk') THEN
    ALTER TABLE salary_advance_transactions ADD CONSTRAINT salary_advance_tx_advance_tenant_fk FOREIGN KEY (tenant_id,advance_id) REFERENCES salary_advances(tenant_id,id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='salary_advance_transactions_amount_check') THEN
    ALTER TABLE salary_advance_transactions ADD CONSTRAINT salary_advance_transactions_amount_check CHECK (amount > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='employee_profile_edit_requests_status_check') THEN
    ALTER TABLE employee_profile_edit_requests ADD CONSTRAINT employee_profile_edit_requests_status_check CHECK (status IN ('pending','approved','rejected','cancelled'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS employee_profile_edit_requests_one_pending_type_idx ON employee_profile_edit_requests(tenant_id,user_id,request_type) WHERE status='pending';
