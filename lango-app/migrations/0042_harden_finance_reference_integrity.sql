CREATE OR REPLACE FUNCTION enforce_credit_note_integrity()
RETURNS trigger AS $$
DECLARE credited numeric(14,2);
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "user" u WHERE u.id=NEW.student_id AND u.tenant_id=NEW.tenant_id AND u.role='student') THEN
    RAISE EXCEPTION 'credit note student is outside tenant' USING ERRCODE='23514';
  END IF;
  IF NEW.invoice_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM invoices i WHERE i.id=NEW.invoice_id AND i.tenant_id=NEW.tenant_id AND i.student_id=NEW.student_id) THEN
      RAISE EXCEPTION 'credit note invoice is incompatible' USING ERRCODE='23514';
    END IF;
    SELECT COALESCE(SUM(amount),0) INTO credited FROM credit_notes WHERE invoice_id=NEW.invoice_id AND id<>NEW.id;
    IF credited + NEW.amount > (SELECT net_amount FROM invoices WHERE id=NEW.invoice_id) THEN
      RAISE EXCEPTION 'credit notes exceed invoice value' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER credit_note_integrity_trigger BEFORE INSERT OR UPDATE ON credit_notes
FOR EACH ROW EXECUTE FUNCTION enforce_credit_note_integrity();

CREATE OR REPLACE FUNCTION enforce_refund_integrity()
RETURNS trigger AS $$
DECLARE refunded numeric(14,2);
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "user" u WHERE u.id=NEW.student_id AND u.tenant_id=NEW.tenant_id AND u.role='student') THEN
    RAISE EXCEPTION 'refund student is outside tenant' USING ERRCODE='23514';
  END IF;
  IF NEW.payment_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM payments p WHERE p.id=NEW.payment_id AND p.tenant_id=NEW.tenant_id AND p.student_id=NEW.student_id
  ) THEN
    RAISE EXCEPTION 'refund requires a compatible original payment' USING ERRCODE='23514';
  END IF;
  PERFORM 1 FROM payments WHERE id=NEW.payment_id FOR UPDATE;
  SELECT COALESCE(SUM(amount),0) INTO refunded FROM refunds WHERE payment_id=NEW.payment_id AND id<>NEW.id;
  IF refunded + NEW.amount > (SELECT amount FROM payments WHERE id=NEW.payment_id) THEN
    RAISE EXCEPTION 'refunds exceed original payment' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER refund_integrity_trigger BEFORE INSERT OR UPDATE ON refunds
FOR EACH ROW EXECUTE FUNCTION enforce_refund_integrity();

CREATE OR REPLACE FUNCTION enforce_fee_discount_integrity()
RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "user" u WHERE u.id=NEW.student_id AND u.tenant_id=NEW.tenant_id AND u.role='student') THEN
    RAISE EXCEPTION 'discount student is outside tenant' USING ERRCODE='23514';
  END IF;
  IF NEW.fee_structure_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM fee_structures fs WHERE fs.id=NEW.fee_structure_id AND fs.tenant_id=NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'discount fee structure is outside tenant' USING ERRCODE='23514';
  END IF;
  IF NEW.discount_type='percentage' AND NEW.amount > 100 THEN
    RAISE EXCEPTION 'percentage discount cannot exceed 100' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER fee_discount_integrity_trigger BEFORE INSERT OR UPDATE ON fee_discounts
FOR EACH ROW EXECUTE FUNCTION enforce_fee_discount_integrity();

CREATE OR REPLACE FUNCTION enforce_bank_reconciliation_scope()
RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM bank_accounts ba WHERE ba.id=NEW.bank_account_id AND ba.tenant_id=NEW.tenant_id) THEN
    RAISE EXCEPTION 'bank reconciliation account is outside tenant' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER bank_reconciliation_scope_trigger BEFORE INSERT OR UPDATE ON bank_reconciliations
FOR EACH ROW EXECUTE FUNCTION enforce_bank_reconciliation_scope();

CREATE OR REPLACE FUNCTION prevent_overlapping_fiscal_periods()
RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM fiscal_periods fp WHERE fp.tenant_id=NEW.tenant_id AND fp.id<>NEW.id
      AND daterange(fp.start_date, fp.end_date, '[]') && daterange(NEW.start_date, NEW.end_date, '[]')
  ) THEN
    RAISE EXCEPTION 'fiscal periods cannot overlap' USING ERRCODE='23P01';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER fiscal_period_overlap_trigger BEFORE INSERT OR UPDATE ON fiscal_periods
FOR EACH ROW EXECUTE FUNCTION prevent_overlapping_fiscal_periods();
