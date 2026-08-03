-- Exact database representation for every active receivables money path.
ALTER TABLE expenses ALTER COLUMN amount TYPE numeric(14,2) USING round(amount::numeric, 2);
ALTER TABLE fee_components ALTER COLUMN amount TYPE numeric(14,2) USING round(amount::numeric, 2);
ALTER TABLE fee_structures ALTER COLUMN amount TYPE numeric(14,2) USING round(amount::numeric, 2);
ALTER TABLE invoice_items ALTER COLUMN amount TYPE numeric(14,2) USING round(amount::numeric, 2);
ALTER TABLE invoices ALTER COLUMN amount TYPE numeric(14,2) USING round(amount::numeric, 2);
ALTER TABLE invoices ALTER COLUMN discount_amount TYPE numeric(14,2) USING round(discount_amount::numeric, 2);
ALTER TABLE invoices ALTER COLUMN net_amount TYPE numeric(14,2) USING round(net_amount::numeric, 2);
ALTER TABLE invoices ALTER COLUMN paid_amount TYPE numeric(14,2) USING round(paid_amount::numeric, 2);
ALTER TABLE payments ALTER COLUMN amount TYPE numeric(14,2) USING round(amount::numeric, 2);

ALTER TABLE expenses ADD CONSTRAINT expenses_amount_positive CHECK (amount > 0);
ALTER TABLE fee_components ADD CONSTRAINT fee_components_amount_nonnegative CHECK (amount >= 0);
ALTER TABLE fee_structures ADD CONSTRAINT fee_structures_amount_nonnegative CHECK (amount >= 0);
ALTER TABLE invoice_items ADD CONSTRAINT invoice_items_amount_nonnegative CHECK (amount >= 0);
ALTER TABLE invoices ADD CONSTRAINT invoices_money_sane CHECK (
  amount >= 0 AND discount_amount >= 0 AND net_amount >= 0 AND paid_amount >= 0
  AND discount_amount <= amount AND net_amount = amount - discount_amount AND paid_amount <= net_amount
);
ALTER TABLE payments ADD CONSTRAINT payments_amount_positive CHECK (amount > 0);
