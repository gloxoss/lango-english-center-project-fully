CREATE TABLE IF NOT EXISTS "document_designs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "kind" varchar(60) NOT NULL,
  "draft" jsonb NOT NULL,
  "published_version_id" uuid,
  "updated_by_id" text NOT NULL,
  "updated_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "document_designs_tenant_kind_unique" ON "document_designs" ("tenant_id", "kind");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "document_design_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "design_id" uuid NOT NULL REFERENCES "document_designs"("id") ON DELETE CASCADE,
  "version_number" integer NOT NULL,
  "settings" jsonb NOT NULL,
  "published_by_id" text NOT NULL,
  "published_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "document_design_versions_number_unique" ON "document_design_versions" ("tenant_id", "design_id", "version_number");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_design_versions_tenant_idx" ON "document_design_versions" ("tenant_id");
--> statement-breakpoint
ALTER TABLE "document_designs" ADD CONSTRAINT "document_designs_published_version_fk" FOREIGN KEY ("published_version_id") REFERENCES "document_design_versions"("id") ON DELETE SET NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "document_artifacts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "kind" varchar(60) NOT NULL,
  "source_id" text NOT NULL,
  "design_version_id" uuid REFERENCES "document_design_versions"("id") ON DELETE SET NULL,
  "storage_key" text NOT NULL,
  "sha256" varchar(64) NOT NULL,
  "byte_size" integer NOT NULL,
  "filename" varchar(255) NOT NULL,
  "archive_origin" varchar(30) NOT NULL DEFAULT 'issued',
  "created_by_id" text,
  "created_at" timestamp NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "document_artifacts_source_unique" ON "document_artifacts" ("tenant_id", "kind", "source_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "document_artifacts_tenant_idx" ON "document_artifacts" ("tenant_id");
--> statement-breakpoint
ALTER TABLE "receipts" ADD COLUMN IF NOT EXISTS "payment_id" uuid REFERENCES "payments"("id") ON DELETE SET NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "receipts_tenant_payment_unique" ON "receipts" ("tenant_id", "payment_id") WHERE "payment_id" IS NOT NULL;
