DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='document_templates' AND column_name='created_by' AND data_type='uuid') THEN
  ALTER TABLE "document_templates" ALTER COLUMN "created_by" TYPE text USING "created_by"::text;
 END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='document_template_versions' AND column_name='published_by_id' AND data_type='uuid') THEN
  ALTER TABLE "document_template_versions" ALTER COLUMN "published_by_id" TYPE text USING "published_by_id"::text;
 END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='issued_documents' AND column_name='subject_id' AND data_type='uuid') THEN
  ALTER TABLE "issued_documents" ALTER COLUMN "subject_id" TYPE text USING "subject_id"::text;
 END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='issued_documents' AND column_name='issued_by_id' AND data_type='uuid') THEN
  ALTER TABLE "issued_documents" ALTER COLUMN "issued_by_id" TYPE text USING "issued_by_id"::text;
 END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='issued_documents' AND column_name='revoked_by_id' AND data_type='uuid') THEN
  ALTER TABLE "issued_documents" ALTER COLUMN "revoked_by_id" TYPE text USING "revoked_by_id"::text;
 END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='document_generation_jobs' AND column_name='created_by' AND data_type='uuid') THEN
  ALTER TABLE "document_generation_jobs" ALTER COLUMN "created_by" TYPE text USING "created_by"::text;
 END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='document_generation_items' AND column_name='subject_id' AND data_type='uuid') THEN
  ALTER TABLE "document_generation_items" ALTER COLUMN "subject_id" TYPE text USING "subject_id"::text;
 END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='document_events' AND column_name='actor_id' AND data_type='uuid') THEN
  ALTER TABLE "document_events" ALTER COLUMN "actor_id" TYPE text USING "actor_id"::text;
 END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='certificate_definitions' AND column_name='created_by' AND data_type='uuid') THEN
  ALTER TABLE "certificate_definitions" ALTER COLUMN "created_by" TYPE text USING "created_by"::text;
 END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='certificate_definition_versions' AND column_name='created_by' AND data_type='uuid') THEN
  ALTER TABLE "certificate_definition_versions" ALTER COLUMN "created_by" TYPE text USING "created_by"::text;
 END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='certificate_templates' AND column_name='created_by' AND data_type='uuid') THEN
  ALTER TABLE "certificate_templates" ALTER COLUMN "created_by" TYPE text USING "created_by"::text;
 END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='certificate_template_versions' AND column_name='created_by' AND data_type='uuid') THEN
  ALTER TABLE "certificate_template_versions" ALTER COLUMN "created_by" TYPE text USING "created_by"::text;
 END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='certificate_requests' AND column_name='requester_id' AND data_type='uuid') THEN
  ALTER TABLE "certificate_requests" ALTER COLUMN "requester_id" TYPE text USING "requester_id"::text;
 END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='certificate_requests' AND column_name='recipient_id' AND data_type='uuid') THEN
  ALTER TABLE "certificate_requests" ALTER COLUMN "recipient_id" TYPE text USING "recipient_id"::text;
 END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='certificate_jobs' AND column_name='created_by' AND data_type='uuid') THEN
  ALTER TABLE "certificate_jobs" ALTER COLUMN "created_by" TYPE text USING "created_by"::text;
 END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='certificate_job_items' AND column_name='recipient_id' AND data_type='uuid') THEN
  ALTER TABLE "certificate_job_items" ALTER COLUMN "recipient_id" TYPE text USING "recipient_id"::text;
 END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='issued_certificates' AND column_name='recipient_id' AND data_type='uuid') THEN
  ALTER TABLE "issued_certificates" ALTER COLUMN "recipient_id" TYPE text USING "recipient_id"::text;
 END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='issued_certificates' AND column_name='issued_by' AND data_type='uuid') THEN
  ALTER TABLE "issued_certificates" ALTER COLUMN "issued_by" TYPE text USING "issued_by"::text;
 END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='certificate_events' AND column_name='actor_id' AND data_type='uuid') THEN
  ALTER TABLE "certificate_events" ALTER COLUMN "actor_id" TYPE text USING "actor_id"::text;
 END IF;
END $$;--> statement-breakpoint
