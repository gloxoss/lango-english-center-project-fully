-- 0121_student_accounting_phase_e.sql — plan #12 Phase E: payment reversals,
-- refund linkage, cashier close + reconcile. Idempotent.
-- CREATE TYPE has no IF NOT EXISTS in PG, so it is wrapped in a DO block.
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    CREATE TYPE payment_status AS ENUM ('posted','reversed','refunded');
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE payments ADD COLUMN IF NOT EXISTS status payment_status DEFAULT 'posted' NOT NULL;
--> statement-breakpoint
ALTER TABLE payment_reversals ADD COLUMN IF NOT EXISTS rejection_reason text;
--> statement-breakpoint
ALTER TABLE cashier_sessions ADD COLUMN IF NOT EXISTS reconciled_by_id text;
--> statement-breakpoint
ALTER TABLE cashier_sessions ADD COLUMN IF NOT EXISTS reconciled_at timestamp;
