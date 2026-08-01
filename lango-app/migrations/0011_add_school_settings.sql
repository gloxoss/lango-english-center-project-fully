CREATE TABLE "school_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"establishment_name" varchar(255) NOT NULL,
	"city" varchar(255),
	"address" text,
	"phone" varchar(50),
	"email" varchar(255),
	"academic_year" varchar(50),
	"start_date" date,
	"end_date" date,
	"allow_operations" boolean DEFAULT true NOT NULL,
	"presence_modes" jsonb,
	"languages" jsonb,
	"security" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "school_settings_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
ALTER TABLE "school_settings" ADD CONSTRAINT "school_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;