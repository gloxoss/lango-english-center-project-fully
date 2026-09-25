-- The 0042 refund cap summed EVERY refund on a payment, rejected ones included,
-- so rejecting a 500 MAD refund on a 500 MAD payment made any later refund of
-- that payment impossible. Only pending and approved refunds consume the cap,
-- and a refund being rejected no longer has to fit under it.
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
  IF NEW.status = 'rejected' THEN
    RETURN NEW;
  END IF;
  PERFORM 1 FROM payments WHERE id=NEW.payment_id FOR UPDATE;
  SELECT COALESCE(SUM(amount),0) INTO refunded FROM refunds
   WHERE payment_id=NEW.payment_id AND id<>NEW.id AND status<>'rejected';
  IF refunded + NEW.amount > (SELECT amount FROM payments WHERE id=NEW.payment_id) THEN
    RAISE EXCEPTION 'refunds exceed original payment' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
