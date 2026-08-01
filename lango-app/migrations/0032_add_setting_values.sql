CREATE TABLE "setting_values" (
       "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
       "tenant_id" uuid NOT NULL,
       "branch_id" uuid,
       "key" varchar(128) NOT NULL,
       "value" jsonb NOT NULL,
       "version" integer DEFAULT 1 NOT NULL,
       "updated_by" text,
       "created_at" timestamp DEFAULT now() NOT NULL,
       "updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE "setting_value_versions" (
       "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
       "setting_value_id" uuid NOT NULL,
       "version" integer NOT NULL,
       "previous_value" jsonb,
       "new_value" jsonb,
       "actor_id" text,
       "reason" text,
       "created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "setting_values" ADD CONSTRAINT "setting_values_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "setting_values" ADD CONSTRAINT "setting_values_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "setting_value_versions" ADD CONSTRAINT "setting_value_versions_setting_value_id_fk" FOREIGN KEY ("setting_value_id") REFERENCES "public"."setting_values"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "setting_value_versions" ADD CONSTRAINT "setting_value_versions_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "setting_values" ADD CONSTRAINT "setting_values_tenant_branch_key_unique" UNIQUE("tenant_id", "branch_id", "key");--> statement-breakpoint
CREATE INDEX "setting_values_tenant_key_idx" ON "setting_values" USING btree ("tenant_id", "key");--> statement-breakpoint
CREATE INDEX "setting_value_versions_setting_value_id_idx" ON "setting_value_versions" USING btree ("setting_value_id");
