CREATE TABLE "addon_entitlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"addon_id" varchar(64) NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"expires_at" timestamp,
	"granted_by_id" text,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "addon_entitlements_tenant_addon_unique" UNIQUE("tenant_id","addon_id")
);
--> statement-breakpoint
ALTER TABLE "addon_entitlements" ADD CONSTRAINT "addon_entitlements_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "addon_entitlements" ADD CONSTRAINT "addon_entitlements_granted_by_id_user_id_fk" FOREIGN KEY ("granted_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
