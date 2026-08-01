CREATE TABLE "role_permissions" (
       "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
       "tenant_id" uuid NOT NULL,
       "role_id" varchar(50) NOT NULL,
       "permission_id" varchar(128) NOT NULL,
       "created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "user_permission_overrides" (
       "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
       "tenant_id" uuid NOT NULL,
       "user_id" text NOT NULL,
       "permission_id" varchar(128) NOT NULL,
       "granted" boolean DEFAULT true NOT NULL,
       "created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permission_overrides" ADD CONSTRAINT "user_perm_overrides_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permission_overrides" ADD CONSTRAINT "user_perm_overrides_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_tenant_role_perm_unique" UNIQUE("tenant_id", "role_id", "permission_id");--> statement-breakpoint
ALTER TABLE "user_permission_overrides" ADD CONSTRAINT "user_perm_overrides_tenant_user_perm_unique" UNIQUE("tenant_id", "user_id", "permission_id");--> statement-breakpoint
CREATE INDEX "role_permissions_tenant_role_idx" ON "role_permissions" USING btree ("tenant_id", "role_id");--> statement-breakpoint
CREATE INDEX "user_perm_overrides_tenant_user_idx" ON "user_permission_overrides" USING btree ("tenant_id", "user_id");
