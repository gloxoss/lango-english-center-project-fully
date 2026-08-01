CREATE TYPE "public"."attendance_flag_severity" AS ENUM('CRITIQUE', 'ELEVE', 'MOYEN');--> statement-breakpoint
CREATE TYPE "public"."attendance_register_status" AS ENUM('LOCKED', 'REOPENED');--> statement-breakpoint
CREATE TABLE "attendance_flag_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"flag_id" uuid NOT NULL,
	"author_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance_registers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"subject_id" uuid,
	"date" date NOT NULL,
	"period" integer DEFAULT 1 NOT NULL,
	"reference" varchar(50) NOT NULL,
	"status" "attendance_register_status" DEFAULT 'LOCKED' NOT NULL,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"submitted_by_id" text,
	"reopened_at" timestamp,
	"reopened_by_id" text,
	"reopen_reason" text,
	"correction_note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "attendance_registers_class_date_period_unique" UNIQUE("tenant_id","class_id","date","period")
);
--> statement-breakpoint
ALTER TABLE "attendance" DROP CONSTRAINT "attendance_student_group_id_student_groups_id_fk";
--> statement-breakpoint
ALTER TABLE "attendance" ADD COLUMN "register_id" uuid;--> statement-breakpoint
ALTER TABLE "attendance_excuses" ADD COLUMN "document_file_ext" varchar(10);--> statement-breakpoint
ALTER TABLE "attendance_excuses" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "attendance_flags" ADD COLUMN "severity" "attendance_flag_severity" DEFAULT 'MOYEN' NOT NULL;--> statement-breakpoint
ALTER TABLE "attendance_flags" ADD COLUMN "assigned_to_id" text;--> statement-breakpoint
ALTER TABLE "attendance_flag_notes" ADD CONSTRAINT "attendance_flag_notes_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_flag_notes" ADD CONSTRAINT "attendance_flag_notes_flag_id_fk" FOREIGN KEY ("flag_id") REFERENCES "public"."attendance_flags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_flag_notes" ADD CONSTRAINT "attendance_flag_notes_author_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_registers" ADD CONSTRAINT "attendance_registers_tenant_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_registers" ADD CONSTRAINT "attendance_registers_class_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_registers" ADD CONSTRAINT "attendance_registers_submitted_by_id_fk" FOREIGN KEY ("submitted_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_registers" ADD CONSTRAINT "attendance_registers_reopened_by_id_fk" FOREIGN KEY ("reopened_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attendance_flag_notes_flag_idx" ON "attendance_flag_notes" USING btree ("flag_id");--> statement-breakpoint
CREATE INDEX "attendance_registers_tenant_date_idx" ON "attendance_registers" USING btree ("tenant_id","date");--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_student_group_id_classes_id_fk" FOREIGN KEY ("student_group_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_register_id_fk" FOREIGN KEY ("register_id") REFERENCES "public"."attendance_registers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_flags" ADD CONSTRAINT "attendance_flags_assigned_to_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attendance_register_idx" ON "attendance" USING btree ("register_id");