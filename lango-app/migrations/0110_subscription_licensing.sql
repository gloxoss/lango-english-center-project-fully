CREATE TABLE IF NOT EXISTS "school_licenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"license_key" varchar(100) NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"issued_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"last_upgrade_at" timestamp,
	"notes" text,
	"issued_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "school_licenses_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "school_licenses" ADD CONSTRAINT "school_licenses_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "school_licenses" ADD CONSTRAINT "school_licenses_issued_by_id_user_id_fk" FOREIGN KEY ("issued_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "license_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"license_id" uuid,
	"plan_tier" "plan_tier" DEFAULT 'trial' NOT NULL,
	"amount" numeric(12,2) DEFAULT 0 NOT NULL,
	"currency" varchar(3) DEFAULT 'MAD' NOT NULL,
	"method" varchar(20) DEFAULT 'bank_transfer' NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"transaction_ref" varchar(100),
	"purchased_at" timestamp,
	"expires_at_at_purchase" timestamp,
	"requested_months" integer,
	"requested_by_id" text,
	"recorded_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "license_payments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action,
	CONSTRAINT "license_payments_license_id_school_licenses_id_fk" FOREIGN KEY ("license_id") REFERENCES "public"."school_licenses"("id") ON DELETE set null ON UPDATE no action,
	CONSTRAINT "license_payments_requested_by_id_user_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action,
	CONSTRAINT "license_payments_recorded_by_id_user_id_fk" FOREIGN KEY ("recorded_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action
);
