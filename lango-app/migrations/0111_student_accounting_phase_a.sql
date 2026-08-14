--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'naming_series_pkey') THEN
    ALTER TABLE naming_series DROP CONSTRAINT naming_series_pkey;
  END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'naming_series_pkey') THEN
    ALTER TABLE naming_series ADD PRIMARY KEY (tenant_id, prefix);
  END IF;
END $$;
--> statement-breakpoint
-- Backfill: seed one naming_series row per INV-<year>- prefix in invoices so
-- atomic numbering continues from the highest number already issued instead of
-- restarting at 1 (and colliding with the unique index below).
INSERT INTO naming_series (tenant_id, prefix, current_val)
SELECT tenant_id,
       substring(invoice_number FROM '^INV-\d{4}-') AS prefix,
       max((substring(invoice_number FROM 'INV-\d{4}-(\d+)'))::int) AS current_val
FROM invoices
WHERE invoice_number ~ '^INV-\d{4}-\d+$'
GROUP BY tenant_id, substring(invoice_number FROM '^INV-\d{4}-')
ON CONFLICT (tenant_id, prefix) DO NOTHING;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS invoices_tenant_number_uidx ON invoices(tenant_id, invoice_number);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS credit_notes_tenant_number_uidx ON credit_notes(tenant_id, credit_note_number);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS refunds_tenant_number_uidx ON refunds(tenant_id, refund_number);
--> statement-breakpoint
ALTER TABLE payments ADD COLUMN IF NOT EXISTS idempotency_key text;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS payments_tenant_idempotency_uidx ON payments(tenant_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
