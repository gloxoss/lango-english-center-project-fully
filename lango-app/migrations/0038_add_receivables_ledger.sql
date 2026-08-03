DO $$ BEGIN
 CREATE TYPE "public"."discount_approval_status" AS ENUM('pending', 'approved', 'rejected');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "payment_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"invoice_item_id" uuid,
	"allocated_amount" numeric(12, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payment_allocations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade,
	CONSTRAINT "payment_allocations_amount_positive" CHECK ("allocated_amount" > 0),
	CONSTRAINT "payment_allocations_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE restrict,
	CONSTRAINT "payment_allocations_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE restrict,
	CONSTRAINT "payment_allocations_invoice_item_id_fk" FOREIGN KEY ("invoice_item_id") REFERENCES "invoice_items"("id") ON DELETE restrict
);

CREATE TABLE IF NOT EXISTS "credit_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"student_id" text NOT NULL,
	"invoice_id" uuid,
	"credit_note_number" varchar(50) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"reason" text NOT NULL,
	"issued_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "credit_notes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade,
	CONSTRAINT "credit_notes_amount_positive" CHECK ("amount" > 0),
	CONSTRAINT "credit_notes_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "user"("id") ON DELETE restrict,
	CONSTRAINT "credit_notes_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE restrict,
	CONSTRAINT "credit_notes_issued_by_id_user_id_fk" FOREIGN KEY ("issued_by_id") REFERENCES "user"("id") ON DELETE set null
);

CREATE TABLE IF NOT EXISTS "refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"student_id" text NOT NULL,
	"payment_id" uuid,
	"refund_number" varchar(50) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"refund_method" "payment_method" DEFAULT 'cash' NOT NULL,
	"reason" text NOT NULL,
	"approved_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "refunds_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade,
	CONSTRAINT "refunds_amount_positive" CHECK ("amount" > 0),
	CONSTRAINT "refunds_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "user"("id") ON DELETE restrict,
	CONSTRAINT "refunds_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE restrict,
	CONSTRAINT "refunds_approved_by_id_user_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "user"("id") ON DELETE set null
);

CREATE TABLE IF NOT EXISTS "fee_discounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"student_id" text NOT NULL,
	"fee_structure_id" uuid,
	"discount_name" varchar(150) NOT NULL,
	"discount_type" varchar(20) DEFAULT 'percentage' NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"approval_status" "discount_approval_status" DEFAULT 'pending' NOT NULL,
	"approved_by_id" text,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "fee_discounts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade,
	CONSTRAINT "fee_discounts_amount_positive" CHECK ("amount" > 0),
	CONSTRAINT "fee_discounts_type_check" CHECK ("discount_type" IN ('percentage', 'fixed')),
	CONSTRAINT "fee_discounts_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "user"("id") ON DELETE restrict,
	CONSTRAINT "fee_discounts_fee_structure_id_fk" FOREIGN KEY ("fee_structure_id") REFERENCES "fee_structures"("id") ON DELETE restrict,
	CONSTRAINT "fee_discounts_approved_by_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "user"("id") ON DELETE set null
);

CREATE INDEX IF NOT EXISTS "payment_allocations_tenant_payment_idx" ON "payment_allocations" ("tenant_id", "payment_id");
CREATE INDEX IF NOT EXISTS "payment_allocations_invoice_idx" ON "payment_allocations" ("invoice_id");
CREATE INDEX IF NOT EXISTS "credit_notes_tenant_student_idx" ON "credit_notes" ("tenant_id", "student_id");
CREATE INDEX IF NOT EXISTS "refunds_tenant_student_idx" ON "refunds" ("tenant_id", "student_id");
CREATE INDEX IF NOT EXISTS "fee_discounts_tenant_student_idx" ON "fee_discounts" ("tenant_id", "student_id");
CREATE UNIQUE INDEX IF NOT EXISTS "credit_notes_tenant_number_unique" ON "credit_notes" ("tenant_id", "credit_note_number");
CREATE UNIQUE INDEX IF NOT EXISTS "refunds_tenant_number_unique" ON "refunds" ("tenant_id", "refund_number");

-- Validate tenant/student consistency and allocation bounds under row locks.
CREATE OR REPLACE FUNCTION enforce_receivables_integrity()
RETURNS trigger AS $$
DECLARE payment_row payments%ROWTYPE; invoice_row invoices%ROWTYPE; already_allocated numeric(14,2);
BEGIN
  SELECT * INTO payment_row FROM payments WHERE id = NEW.payment_id FOR UPDATE;
  SELECT * INTO invoice_row FROM invoices WHERE id = NEW.invoice_id FOR UPDATE;
  IF payment_row.id IS NULL OR invoice_row.id IS NULL
    OR payment_row.tenant_id <> NEW.tenant_id OR invoice_row.tenant_id <> NEW.tenant_id
    OR payment_row.student_id <> invoice_row.student_id THEN
    RAISE EXCEPTION 'allocation references incompatible tenant/student records' USING ERRCODE = '23514';
  END IF;
  IF NEW.invoice_item_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM invoice_items ii WHERE ii.id = NEW.invoice_item_id AND ii.invoice_id = NEW.invoice_id
  ) THEN
    RAISE EXCEPTION 'invoice item does not belong to invoice' USING ERRCODE = '23514';
  END IF;
  SELECT COALESCE(SUM(allocated_amount), 0) INTO already_allocated
  FROM payment_allocations WHERE payment_id = NEW.payment_id AND id <> NEW.id;
  IF already_allocated + NEW.allocated_amount > payment_row.amount::numeric THEN
    RAISE EXCEPTION 'payment is over-allocated' USING ERRCODE = '23514';
  END IF;
  SELECT COALESCE(SUM(allocated_amount), 0) INTO already_allocated
  FROM payment_allocations WHERE invoice_id = NEW.invoice_id AND id <> NEW.id;
  IF already_allocated + NEW.allocated_amount > invoice_row.net_amount::numeric THEN
    RAISE EXCEPTION 'invoice is over-allocated' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payment_allocations_integrity_trigger
BEFORE INSERT OR UPDATE ON payment_allocations
FOR EACH ROW EXECUTE FUNCTION enforce_receivables_integrity();
