-- Extends accounting_source_mappings.source_key_type so the payroll module can
-- declare account defaults for its accrual voucher (salary expense + statutory
-- liabilities). Extends the allowlist from 0103/0104 in place (forward-only,
-- DROP/ADD is idempotent); existing fee/library/student rows are untouched.

ALTER TABLE accounting_source_mappings DROP CONSTRAINT IF EXISTS accounting_source_mappings_shape_check;
ALTER TABLE accounting_source_mappings ADD CONSTRAINT accounting_source_mappings_shape_check CHECK (
  source_key_type IN (
    'fee_category',
    'payment_method',
    'student',
    'library_member',
    'library_charge_reason',
    'salary_expense',
    'cnss_payable',
    'amo_payable',
    'ir_payable',
    'net_payable',
    'advance_recovery'
  )
);
