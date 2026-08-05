ALTER TABLE "credit_notes" ADD COLUMN IF NOT EXISTS "status" "discount_approval_status" DEFAULT 'pending' NOT NULL;
ALTER TABLE "credit_notes" ADD COLUMN IF NOT EXISTS "approved_by_id" text;
ALTER TABLE "credit_notes" ADD COLUMN IF NOT EXISTS "approved_at" timestamp;
ALTER TABLE "credit_notes" ADD COLUMN IF NOT EXISTS "rejection_reason" text;

ALTER TABLE "credit_notes" DROP CONSTRAINT IF EXISTS "credit_notes_approved_by_id_user_id_fk";
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_approved_by_id_user_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;

-- Backfill: every existing credit note predates this workflow - treat it as
-- already-approved (it was already final/effective under the old model),
-- not as newly-pending (which would incorrectly imply it needs someone to
-- act on it now).
UPDATE "credit_notes" SET "status" = 'approved', "approved_at" = "created_at" WHERE "status" = 'pending';

CREATE INDEX IF NOT EXISTS "credit_notes_tenant_status_idx" ON "credit_notes" USING btree ("tenant_id","status");
