CREATE TYPE "public"."cndp_filing_status" AS ENUM('draft', 'submitted', 'approved');

CREATE TABLE "cndp_filings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"filing_reference" varchar(100),
	"filed_at" date,
	"status" "cndp_filing_status" DEFAULT 'draft' NOT NULL,
	"document_upload_path" varchar(255),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cndp_filings_tenant_id_unique" UNIQUE("tenant_id")
);

ALTER TABLE "cndp_filings" ADD CONSTRAINT "cndp_filings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
