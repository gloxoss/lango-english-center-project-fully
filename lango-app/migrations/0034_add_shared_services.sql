CREATE TABLE "files" (
       "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
       "tenant_id" uuid NOT NULL,
       "branch_id" uuid,
       "module" varchar(64) NOT NULL,
       "file_name" varchar(500) NOT NULL,
       "mime_type" varchar(128) NOT NULL,
       "size_bytes" integer NOT NULL,
       "storage_path" text NOT NULL,
       "uploaded_by" text,
       "is_deleted" boolean DEFAULT false NOT NULL,
       "created_at" timestamp DEFAULT now() NOT NULL,
       "deleted_at" timestamp
);--> statement-breakpoint
CREATE TYPE "notification_status" AS ENUM ('pending', 'sent', 'failed');--> statement-breakpoint
CREATE TABLE "notifications" (
       "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
       "tenant_id" uuid NOT NULL,
       "recipient_id" text NOT NULL,
       "channel" varchar(32) DEFAULT 'in_app' NOT NULL,
       "template" varchar(128) NOT NULL,
       "data" jsonb,
       "status" "notification_status" DEFAULT 'pending' NOT NULL,
       "read_at" timestamp,
       "sent_at" timestamp,
       "error" text,
       "created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TYPE "export_job_status" AS ENUM ('pending', 'processing', 'complete', 'failed');--> statement-breakpoint
CREATE TABLE "export_jobs" (
       "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
       "tenant_id" uuid NOT NULL,
       "report_type" varchar(128) NOT NULL,
       "params" jsonb,
       "status" "export_job_status" DEFAULT 'pending' NOT NULL,
       "result_path" text,
       "requested_by" text,
       "created_at" timestamp DEFAULT now() NOT NULL,
       "completed_at" timestamp
);--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_user_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_requested_by_user_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "files_tenant_module_idx" ON "files" USING btree ("tenant_id", "module");--> statement-breakpoint
CREATE INDEX "notifications_recipient_unread_idx" ON "notifications" USING btree ("recipient_id", "status");--> statement-breakpoint
CREATE INDEX "export_jobs_tenant_status_idx" ON "export_jobs" USING btree ("tenant_id", "status");
