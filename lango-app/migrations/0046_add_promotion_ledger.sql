CREATE TYPE "public"."promotion_batch_status" AS ENUM('committed', 'reverted');--> statement-breakpoint
CREATE TYPE "public"."promotion_decision_type" AS ENUM('promote', 'repeat', 'graduate', 'transfer', 'withdraw', 'hold');--> statement-breakpoint
CREATE TABLE "promotion_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"source_class_section_id" uuid NOT NULL,
	"target_session_year_id" uuid NOT NULL,
	"status" "promotion_batch_status" DEFAULT 'committed' NOT NULL,
	"idempotency_key" varchar(100) NOT NULL,
	"operator_id" text NOT NULL,
	"reverted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "promotion_batches_tenant_id_idempotency_key_unique" UNIQUE("tenant_id","idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "promotion_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"batch_id" uuid NOT NULL,
	"student_id" text NOT NULL,
	"decision" "promotion_decision_type" NOT NULL,
	"target_class_section_id" uuid,
	"placement_id" uuid,
	"average_percentage_at_decision" numeric(5, 2),
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "promotion_decisions_batch_id_student_id_unique" UNIQUE("batch_id","student_id")
);
--> statement-breakpoint
ALTER TABLE "promotion_batches" ADD CONSTRAINT "promotion_batches_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_batches" ADD CONSTRAINT "promotion_batches_source_class_section_id_class_sections_id_fk" FOREIGN KEY ("source_class_section_id") REFERENCES "public"."class_sections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_batches" ADD CONSTRAINT "promotion_batches_target_session_year_id_session_years_id_fk" FOREIGN KEY ("target_session_year_id") REFERENCES "public"."session_years"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_decisions" ADD CONSTRAINT "promotion_decisions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_decisions" ADD CONSTRAINT "promotion_decisions_batch_id_promotion_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."promotion_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_decisions" ADD CONSTRAINT "promotion_decisions_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_decisions" ADD CONSTRAINT "promotion_decisions_target_class_section_id_class_sections_id_fk" FOREIGN KEY ("target_class_section_id") REFERENCES "public"."class_sections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_decisions" ADD CONSTRAINT "promotion_decisions_placement_id_student_placements_id_fk" FOREIGN KEY ("placement_id") REFERENCES "public"."student_placements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "promotion_batches_tenant_idx" ON "promotion_batches" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "promotion_decisions_tenant_student_idx" ON "promotion_decisions" USING btree ("tenant_id","student_id");
