-- One payment per payslip line was enforced for EVERY status, so once a bank
-- batch failed (or a paid batch was reversed) its rows blocked any new batch
-- for the same payroll: the salaries could never be paid again through the app.
-- Only live payments (pending, paid) are unique now; failed and reversed rows
-- stay as history.
ALTER TABLE "salary_payments" DROP CONSTRAINT IF EXISTS "salary_payments_tenant_run_line_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "salary_payments_tenant_run_line_active_unique"
  ON "salary_payments" ("tenant_id", "run_line_id")
  WHERE "status" IN ('pending', 'paid');
