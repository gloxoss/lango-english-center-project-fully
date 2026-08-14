ALTER TABLE refunds ADD COLUMN IF NOT EXISTS status discount_approval_status NOT NULL DEFAULT 'pending';
ALTER TABLE refunds ADD COLUMN IF NOT EXISTS decided_by_id text;
ALTER TABLE refunds ADD COLUMN IF NOT EXISTS decided_at timestamp;
ALTER TABLE refunds ADD COLUMN IF NOT EXISTS rejection_reason text;

DO $$ BEGIN
  ALTER TABLE refunds ADD CONSTRAINT refunds_decided_by_id_user_id_fk FOREIGN KEY (decided_by_id) REFERENCES "user"(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- refunds created before this workflow existed are already final
UPDATE refunds SET status = 'approved', decided_at = created_at WHERE status = 'pending';
