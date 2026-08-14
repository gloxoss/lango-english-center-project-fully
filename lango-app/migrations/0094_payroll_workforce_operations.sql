-- Payroll & Workforce Operations add-on (hand-written, forward-only, idempotent).
-- Never regenerate with drizzle-kit generate. Safe to rerun.
--
-- Order is deliberate:
--   1. Backfill four tables that exist in Drizzle (hr-schema.ts) but have no
--      migration SQL: salary_advances, salary_advance_transactions,
--      employee_awards, employee_profile_edit_requests.
--   2. New configuration tables (regulation packs/versions, settings,
--      versioned components/structures, payroll profiles, adjustments).
--   3. Run/result/trace + posting reference tables.
--   4. Payment batches/payments (double-payment prevention).
--   5. Append-only leave ledger, advance repayment schedules, award definitions.
--   6. Additive extension of the existing payroll_periods / payroll_run_lines /
--      payslips / leave_requests / employee_leave_balances tables.
-- Payroll references the HR-owned employee_profiles identity only.

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "salary_advances" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "employee_id" uuid NOT NULL,
  "user_id" text NOT NULL,
  "requested_amount" numeric(12, 2) NOT NULL,
  "approved_amount" numeric(12, 2),
  "repaid_amount" numeric(12, 2) DEFAULT 0 NOT NULL,
  "monthly_installment" numeric(12, 2),
  "reason" text,
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "requested_at" date DEFAULT now() NOT NULL,
  "approved_at" timestamp,
  "approver_id" text,
  "rejection_reason" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "salary_advances" ADD CONSTRAINT "salary_advances_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "salary_advances" ADD CONSTRAINT "salary_advances_employee_id_employee_profiles_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employee_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "salary_advances" ADD CONSTRAINT "salary_advances_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "salary_advances" ADD CONSTRAINT "salary_advances_approver_id_user_id_fk" FOREIGN KEY ("approver_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "salary_advance_transactions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "advance_id" uuid NOT NULL,
  "type" varchar(20) NOT NULL,
  "amount" numeric(12, 2) NOT NULL,
  "reference_id" text,
  "transaction_date" date DEFAULT now() NOT NULL,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "salary_advance_transactions" ADD CONSTRAINT "salary_advance_tx_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "salary_advance_transactions" ADD CONSTRAINT "salary_advance_tx_advance_id_advances_id_fk" FOREIGN KEY ("advance_id") REFERENCES "public"."salary_advances"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "employee_awards" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "employee_id" uuid NOT NULL,
  "user_id" text NOT NULL,
  "title" varchar(255) NOT NULL,
  "category" varchar(50) NOT NULL,
  "monetary_reward" numeric(12, 2) DEFAULT 0 NOT NULL,
  "gift_description" text,
  "award_date" date NOT NULL,
  "summary" text,
  "presented_by" varchar(255),
  "status" varchar(20) DEFAULT 'granted' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "employee_awards" ADD CONSTRAINT "employee_awards_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "employee_awards" ADD CONSTRAINT "employee_awards_employee_id_employee_profiles_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employee_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "employee_awards" ADD CONSTRAINT "employee_awards_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "employee_profile_edit_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "employee_id" uuid NOT NULL,
  "user_id" text NOT NULL,
  "request_type" varchar(50) NOT NULL,
  "proposed_changes" jsonb NOT NULL,
  "reason" text,
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "reauthenticated_at" timestamp NOT NULL,
  "reviewed_at" timestamp,
  "reviewer_id" text,
  "rejection_reason" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "employee_profile_edit_requests" ADD CONSTRAINT "employee_edit_req_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "employee_profile_edit_requests" ADD CONSTRAINT "employee_edit_req_employee_id_employee_profiles_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employee_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "employee_profile_edit_requests" ADD CONSTRAINT "employee_edit_req_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "employee_profile_edit_requests" ADD CONSTRAINT "employee_edit_req_reviewer_id_user_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payroll_regulation_packs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "jurisdiction" varchar(2) DEFAULT 'MA' NOT NULL,
  "code" varchar(40) NOT NULL,
  "name" varchar(160) NOT NULL,
  "status" varchar(20) DEFAULT 'draft' NOT NULL,
  "source_url" text,
  "source_document_ref" text,
  "publication_date" date,
  "validation_status" varchar(30) DEFAULT 'unvalidated' NOT NULL,
  "validated_by_id" text,
  "validated_at" timestamp,
  "reviewer_notes" text,
  "notes" text,
  "created_by_id" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payroll_regulation_packs" ADD CONSTRAINT "payroll_regulation_packs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payroll_regulation_packs" ADD CONSTRAINT "payroll_regulation_packs_validated_by_id_user_id_fk" FOREIGN KEY ("validated_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payroll_regulation_packs" ADD CONSTRAINT "payroll_regulation_packs_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payroll_regulation_packs" ADD CONSTRAINT "payroll_regulation_packs_tenant_code_unique" UNIQUE ("tenant_id","code");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payroll_regulation_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "pack_id" uuid NOT NULL,
  "version_label" varchar(40) NOT NULL,
  "effective_from" date NOT NULL,
  "effective_to" date,
  "status" varchar(20) DEFAULT 'draft' NOT NULL,
  "rule_config" jsonb NOT NULL,
  "rounding_order" jsonb NOT NULL,
  "monthly_default" boolean DEFAULT false NOT NULL,
  "published_at" timestamp,
  "published_by_id" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payroll_regulation_versions" ADD CONSTRAINT "payroll_regulation_versions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payroll_regulation_versions" ADD CONSTRAINT "payroll_regulation_versions_pack_id_pack_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."payroll_regulation_packs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payroll_regulation_versions" ADD CONSTRAINT "payroll_regulation_versions_published_by_id_user_id_fk" FOREIGN KEY ("published_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payroll_regulation_versions" ADD CONSTRAINT "payroll_regulation_versions_tenant_pack_effective_unique" UNIQUE ("tenant_id","pack_id","effective_from");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payroll_settings_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "version_no" integer NOT NULL,
  "settings" jsonb NOT NULL,
  "status" varchar(20) DEFAULT 'draft' NOT NULL,
  "published_at" timestamp,
  "published_by_id" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payroll_settings_versions" ADD CONSTRAINT "payroll_settings_versions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payroll_settings_versions" ADD CONSTRAINT "payroll_settings_versions_published_by_id_user_id_fk" FOREIGN KEY ("published_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payroll_settings_versions" ADD CONSTRAINT "payroll_settings_versions_tenant_version_unique" UNIQUE ("tenant_id","version_no");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "salary_component_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "component_id" uuid NOT NULL,
  "version_no" integer NOT NULL,
  "code" varchar(40) NOT NULL,
  "name" varchar(160) NOT NULL,
  "component_type" varchar(20) NOT NULL,
  "value_type" varchar(20) NOT NULL,
  "fixed_value" numeric(12, 2),
  "percent_of" varchar(40),
  "formula" text,
  "taxable" boolean DEFAULT true NOT NULL,
  "contributable" boolean DEFAULT true NOT NULL,
  "side" varchar(20) NOT NULL,
  "proratable" boolean DEFAULT true NOT NULL,
  "recurring" boolean DEFAULT true NOT NULL,
  "rounding_mode" varchar(20) DEFAULT 'half_up' NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "status" varchar(20) DEFAULT 'draft' NOT NULL,
  "effective_from" date,
  "effective_to" date,
  "published_at" timestamp,
  "published_by_id" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "salary_component_versions" ADD CONSTRAINT "salary_component_versions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "salary_component_versions" ADD CONSTRAINT "salary_component_versions_component_id_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."salary_components"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "salary_component_versions" ADD CONSTRAINT "salary_component_versions_published_by_id_user_id_fk" FOREIGN KEY ("published_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "salary_component_versions" ADD CONSTRAINT "salary_component_versions_tenant_component_version_unique" UNIQUE ("tenant_id","component_id","version_no");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "salary_structure_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "template_id" uuid NOT NULL,
  "version_no" integer NOT NULL,
  "name" varchar(160) NOT NULL,
  "status" varchar(20) DEFAULT 'draft' NOT NULL,
  "effective_from" date,
  "effective_to" date,
  "published_at" timestamp,
  "published_by_id" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "salary_structure_versions" ADD CONSTRAINT "salary_structure_versions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "salary_structure_versions" ADD CONSTRAINT "salary_structure_versions_template_id_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."salary_templates"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "salary_structure_versions" ADD CONSTRAINT "salary_structure_versions_published_by_id_user_id_fk" FOREIGN KEY ("published_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "salary_structure_versions" ADD CONSTRAINT "salary_structure_versions_tenant_template_version_unique" UNIQUE ("tenant_id","template_id","version_no");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "salary_structure_components" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "structure_version_id" uuid NOT NULL,
  "component_id" uuid NOT NULL,
  "component_version_id" uuid NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "base_value" numeric(12, 2)
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "salary_structure_components" ADD CONSTRAINT "salary_structure_components_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "salary_structure_components" ADD CONSTRAINT "salary_structure_components_structure_version_fk" FOREIGN KEY ("structure_version_id") REFERENCES "public"."salary_structure_versions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "salary_structure_components" ADD CONSTRAINT "salary_structure_components_component_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."salary_components"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "salary_structure_components" ADD CONSTRAINT "salary_structure_components_component_version_fk" FOREIGN KEY ("component_version_id") REFERENCES "public"."salary_component_versions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "salary_structure_components" ADD CONSTRAINT "salary_structure_components_version_component_unique" UNIQUE ("structure_version_id","component_id");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "employee_payroll_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "employee_id" uuid NOT NULL,
  "user_id" text,
  "cnss_number" varchar(40),
  "amo_number" varchar(40),
  "tax_id" varchar(40),
  "bank_rib_encrypted" text,
  "bank_name" varchar(160),
  "bank_account_name" varchar(160),
  "dependants_count" integer DEFAULT 0 NOT NULL,
  "pay_frequency" varchar(20) DEFAULT 'monthly' NOT NULL,
  "payment_method" varchar(20) DEFAULT 'bank' NOT NULL,
  "salary_currency" varchar(3) DEFAULT 'MAD' NOT NULL,
  "status" varchar(20) DEFAULT 'active' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "employee_payroll_profiles" ADD CONSTRAINT "employee_payroll_profiles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "employee_payroll_profiles" ADD CONSTRAINT "employee_payroll_profiles_employee_id_profiles_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employee_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "employee_payroll_profiles" ADD CONSTRAINT "employee_payroll_profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "employee_payroll_profiles" ADD CONSTRAINT "employee_payroll_profiles_tenant_employee_unique" UNIQUE ("tenant_id","employee_id");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payroll_adjustments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "employee_id" uuid NOT NULL,
  "user_id" text NOT NULL,
  "period_id" uuid,
  "adjustment_type" varchar(30) NOT NULL,
  "component_id" uuid,
  "amount" numeric(12, 2),
  "units" numeric(12, 2),
  "rate" numeric(12, 2),
  "reason" text,
  "evidence_key" text,
  "tax_treatment" varchar(30) DEFAULT 'component' NOT NULL,
  "recurring" boolean DEFAULT false NOT NULL,
  "recurrence_start" date,
  "recurrence_end" date,
  "remaining_occurrences" integer,
  "effective_period_year" integer NOT NULL,
  "effective_period_month" integer NOT NULL,
  "status" varchar(20) DEFAULT 'draft' NOT NULL,
  "requester_id" text,
  "approver_id" text,
  "approved_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_employee_id_profiles_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employee_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_period_id_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."payroll_periods"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_component_id_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."salary_components"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_requester_id_user_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payroll_adjustments" ADD CONSTRAINT "payroll_adjustments_approver_id_user_id_fk" FOREIGN KEY ("approver_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payroll_result_lines" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "run_id" uuid NOT NULL,
  "user_id" text NOT NULL,
  "line_code" varchar(40) NOT NULL,
  "component_id" uuid,
  "component_version_id" uuid,
  "label" varchar(160) NOT NULL,
  "line_type" varchar(20) NOT NULL,
  "amount" numeric(12, 2) NOT NULL,
  "base" numeric(12, 2),
  "rate" numeric(12, 2),
  "quantity" numeric(12, 2),
  "formula_version" varchar(40),
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payroll_result_lines" ADD CONSTRAINT "payroll_result_lines_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payroll_result_lines" ADD CONSTRAINT "payroll_result_lines_run_id_periods_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."payroll_periods"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payroll_result_lines" ADD CONSTRAINT "payroll_result_lines_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payroll_result_lines" ADD CONSTRAINT "payroll_result_lines_component_id_components_id_fk" FOREIGN KEY ("component_id") REFERENCES "public"."salary_components"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payroll_result_lines" ADD CONSTRAINT "payroll_result_lines_component_version_fk" FOREIGN KEY ("component_version_id") REFERENCES "public"."salary_component_versions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payroll_result_lines" ADD CONSTRAINT "payroll_result_lines_run_user_code_unique" UNIQUE ("run_id","user_id","line_code");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payroll_result_lines_run_user_idx" ON "payroll_result_lines" ("run_id","user_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payroll_calculation_traces" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "run_id" uuid NOT NULL,
  "user_id" text NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "regulation_version_id" uuid,
  "trace" jsonb NOT NULL,
  "input_snapshot" jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payroll_calculation_traces" ADD CONSTRAINT "payroll_calculation_traces_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payroll_calculation_traces" ADD CONSTRAINT "payroll_calculation_traces_run_id_periods_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."payroll_periods"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payroll_calculation_traces" ADD CONSTRAINT "payroll_calculation_traces_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payroll_calculation_traces" ADD CONSTRAINT "payroll_calculation_traces_regulation_version_fk" FOREIGN KEY ("regulation_version_id") REFERENCES "public"."payroll_regulation_versions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payroll_calculation_traces" ADD CONSTRAINT "payroll_calculation_traces_run_user_version_unique" UNIQUE ("run_id","user_id","version");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payroll_postings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "run_id" uuid NOT NULL,
  "journal_entry_id" uuid,
  "posting_request_id" uuid,
  "payload_digest" text NOT NULL,
  "source_version" integer NOT NULL,
  "posting_type" varchar(20) NOT NULL,
  "status" varchar(20) DEFAULT 'processing' NOT NULL,
  "idempotency_key" varchar(120) NOT NULL,
  "fiscal_period_id" uuid,
  "posted_by_id" text,
  "posted_at" timestamp,
  "failure_reason" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payroll_postings" ADD CONSTRAINT "payroll_postings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payroll_postings" ADD CONSTRAINT "payroll_postings_run_id_periods_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."payroll_periods"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payroll_postings" ADD CONSTRAINT "payroll_postings_posted_by_id_user_id_fk" FOREIGN KEY ("posted_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payroll_postings" ADD CONSTRAINT "payroll_postings_tenant_idempotency_unique" UNIQUE ("tenant_id","idempotency_key");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payroll_posting_lines" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "posting_id" uuid NOT NULL,
  "account_id" uuid NOT NULL,
  "debit_amount" numeric(12, 2) NOT NULL,
  "credit_amount" numeric(12, 2) NOT NULL,
  "memo" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payroll_posting_lines" ADD CONSTRAINT "payroll_posting_lines_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payroll_posting_lines" ADD CONSTRAINT "payroll_posting_lines_posting_id_postings_id_fk" FOREIGN KEY ("posting_id") REFERENCES "public"."payroll_postings"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "salary_payment_batches" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "run_id" uuid NOT NULL,
  "method" varchar(20) NOT NULL,
  "status" varchar(30) DEFAULT 'prepared' NOT NULL,
  "total_amount" numeric(12, 2) NOT NULL,
  "prepared_by_id" text NOT NULL,
  "approved_by_id" text,
  "approved_at" timestamp,
  "exported_at" timestamp,
  "export_format" varchar(30),
  "export_file_key" text,
  "reconciliation_status" varchar(20) DEFAULT 'none' NOT NULL,
  "reconciled_by_id" text,
  "reconciled_at" timestamp,
  "reversed_by_id" text,
  "reversed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "salary_payment_batches" ADD CONSTRAINT "salary_payment_batches_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "salary_payment_batches" ADD CONSTRAINT "salary_payment_batches_run_id_periods_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."payroll_periods"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "salary_payment_batches" ADD CONSTRAINT "salary_payment_batches_prepared_by_id_user_id_fk" FOREIGN KEY ("prepared_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "salary_payment_batches" ADD CONSTRAINT "salary_payment_batches_approved_by_id_user_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "salary_payment_batches" ADD CONSTRAINT "salary_payment_batches_reconciled_by_id_user_id_fk" FOREIGN KEY ("reconciled_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "salary_payment_batches" ADD CONSTRAINT "salary_payment_batches_reversed_by_id_user_id_fk" FOREIGN KEY ("reversed_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "salary_payments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "batch_id" uuid NOT NULL,
  "run_line_id" uuid NOT NULL,
  "user_id" text NOT NULL,
  "amount" numeric(12, 2) NOT NULL,
  "status" varchar(20) DEFAULT 'pending' NOT NULL,
  "bank_reference" text,
  "receipt_reference" text,
  "masked_bank_details" text,
  "paid_by_id" text,
  "paid_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "salary_payments" ADD CONSTRAINT "salary_payments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "salary_payments" ADD CONSTRAINT "salary_payments_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."salary_payment_batches"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "salary_payments" ADD CONSTRAINT "salary_payments_run_line_id_run_lines_id_fk" FOREIGN KEY ("run_line_id") REFERENCES "public"."payroll_run_lines"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "salary_payments" ADD CONSTRAINT "salary_payments_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "salary_payments" ADD CONSTRAINT "salary_payments_paid_by_id_user_id_fk" FOREIGN KEY ("paid_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "salary_payments" ADD CONSTRAINT "salary_payments_tenant_run_line_unique" UNIQUE ("tenant_id","run_line_id");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "employee_leave_policies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "name" varchar(160) NOT NULL,
  "category_id" uuid NOT NULL,
  "accrual_type" varchar(20) DEFAULT 'annual' NOT NULL,
  "annual_days" numeric(6, 2),
  "monthly_accrual_days" numeric(6, 2),
  "carryover_limit" numeric(6, 2),
  "max_balance" numeric(6, 2),
  "allow_negative" boolean DEFAULT false NOT NULL,
  "probation_restriction_days" integer DEFAULT 0 NOT NULL,
  "effective_from" date NOT NULL,
  "effective_to" date,
  "status" varchar(20) DEFAULT 'active' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "employee_leave_policies" ADD CONSTRAINT "employee_leave_policies_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "employee_leave_policies" ADD CONSTRAINT "employee_leave_policies_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."leave_categories"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "employee_leave_policy_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "employee_id" uuid NOT NULL,
  "policy_id" uuid NOT NULL,
  "effective_from" date NOT NULL,
  "effective_to" date,
  "status" varchar(20) DEFAULT 'active' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "employee_leave_policy_assignments" ADD CONSTRAINT "employee_leave_policy_assignments_tenant_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "employee_leave_policy_assignments" ADD CONSTRAINT "employee_leave_policy_assignments_employee_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employee_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "employee_leave_policy_assignments" ADD CONSTRAINT "employee_leave_policy_assignments_policy_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."employee_leave_policies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "employee_leave_policy_assignments" ADD CONSTRAINT "employee_leave_policy_assignments_employee_effective_unique" UNIQUE ("tenant_id","employee_id","effective_from");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "employee_leave_balance_transactions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "employee_id" uuid NOT NULL,
  "user_id" text,
  "category_id" uuid NOT NULL,
  "policy_id" uuid,
  "year" integer NOT NULL,
  "tx_type" varchar(30) NOT NULL,
  "units" numeric(8, 2) NOT NULL,
  "ref_type" varchar(40),
  "ref_id" uuid,
  "occurred_at" timestamp DEFAULT now() NOT NULL,
  "created_by_id" text,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "employee_leave_balance_transactions" ADD CONSTRAINT "employee_leave_balance_tx_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "employee_leave_balance_transactions" ADD CONSTRAINT "employee_leave_balance_tx_employee_id_profiles_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employee_profiles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "employee_leave_balance_transactions" ADD CONSTRAINT "employee_leave_balance_tx_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "employee_leave_balance_transactions" ADD CONSTRAINT "employee_leave_balance_tx_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."leave_categories"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "employee_leave_balance_transactions" ADD CONSTRAINT "employee_leave_balance_tx_policy_id_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."employee_leave_policies"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "employee_leave_balance_tx_employee_year_idx" ON "employee_leave_balance_transactions" ("tenant_id","employee_id","year");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "salary_advance_policies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "name" varchar(160) NOT NULL,
  "max_amount" numeric(12, 2),
  "max_outstanding" numeric(12, 2),
  "min_employment_months" integer DEFAULT 0 NOT NULL,
  "repayment_start_months" integer DEFAULT 1 NOT NULL,
  "max_installments" integer DEFAULT 6 NOT NULL,
  "min_net_protection" numeric(12, 2),
  "status" varchar(20) DEFAULT 'active' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "salary_advance_policies" ADD CONSTRAINT "salary_advance_policies_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "salary_advance_repayment_schedules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "advance_id" uuid NOT NULL,
  "installment_no" integer NOT NULL,
  "due_period_year" integer NOT NULL,
  "due_period_month" integer NOT NULL,
  "amount" numeric(12, 2) NOT NULL,
  "status" varchar(20) DEFAULT 'scheduled' NOT NULL,
  "payroll_run_line_id" uuid,
  "allocated_at" timestamp,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "salary_advance_repayment_schedules" ADD CONSTRAINT "salary_advance_repay_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "salary_advance_repayment_schedules" ADD CONSTRAINT "salary_advance_repay_advance_id_advances_id_fk" FOREIGN KEY ("advance_id") REFERENCES "public"."salary_advances"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "salary_advance_repayment_schedules" ADD CONSTRAINT "salary_advance_repay_run_line_id_run_lines_id_fk" FOREIGN KEY ("payroll_run_line_id") REFERENCES "public"."payroll_run_lines"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "salary_advance_repayment_schedules" ADD CONSTRAINT "salary_advance_repay_advance_installment_unique" UNIQUE ("tenant_id","advance_id","installment_no");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "salary_advance_repayment_schedules" ADD CONSTRAINT "salary_advance_repay_run_line_unique" UNIQUE ("payroll_run_line_id");
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "award_definitions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "name" varchar(160) NOT NULL,
  "category" varchar(50) NOT NULL,
  "description" text,
  "eligibility" text,
  "approval_required" boolean DEFAULT true NOT NULL,
  "monetary_default" numeric(12, 2),
  "monetary_component_id" uuid,
  "visibility" varchar(20) DEFAULT 'internal' NOT NULL,
  "status" varchar(20) DEFAULT 'active' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "award_definitions" ADD CONSTRAINT "award_definitions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "award_definitions" ADD CONSTRAINT "award_definitions_monetary_component_id_components_fk" FOREIGN KEY ("monetary_component_id") REFERENCES "public"."salary_components"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;

-- ---------------------------------------------------------------------------
-- Extend payroll_periods → full lifecycle run
-- ---------------------------------------------------------------------------
--> statement-breakpoint
ALTER TABLE "payroll_periods" DROP CONSTRAINT IF EXISTS "payroll_periods_status_check";
--> statement-breakpoint
ALTER TABLE "payroll_periods" ADD CONSTRAINT "payroll_periods_status_check" CHECK ((status)::text = ANY ((ARRAY['draft'::character varying,'calculating'::character varying,'calculated'::character varying,'under_review'::character varying,'approved'::character varying,'posted'::character varying,'paid'::character varying,'closed'::character varying,'failed'::character varying,'cancelled'::character varying,'reversed'::character varying])::text[]));
--> statement-breakpoint
ALTER TABLE "payroll_periods" ADD COLUMN IF NOT EXISTS "regulation_version_id" uuid;
--> statement-breakpoint
ALTER TABLE "payroll_periods" ADD COLUMN IF NOT EXISTS "version" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "payroll_periods" ADD COLUMN IF NOT EXISTS "frozen_inputs" jsonb;
--> statement-breakpoint
ALTER TABLE "payroll_periods" ADD COLUMN IF NOT EXISTS "calculated_by_id" text;
--> statement-breakpoint
ALTER TABLE "payroll_periods" ADD COLUMN IF NOT EXISTS "calculated_at" timestamp;
--> statement-breakpoint
ALTER TABLE "payroll_periods" ADD COLUMN IF NOT EXISTS "approver_id" text;
--> statement-breakpoint
ALTER TABLE "payroll_periods" ADD COLUMN IF NOT EXISTS "approved_at" timestamp;
--> statement-breakpoint
ALTER TABLE "payroll_periods" ADD COLUMN IF NOT EXISTS "poster_id" text;
--> statement-breakpoint
ALTER TABLE "payroll_periods" ADD COLUMN IF NOT EXISTS "posted_at" timestamp;
--> statement-breakpoint
ALTER TABLE "payroll_periods" ADD COLUMN IF NOT EXISTS "payment_batch_id" uuid;
--> statement-breakpoint
ALTER TABLE "payroll_periods" ADD COLUMN IF NOT EXISTS "closed_at" timestamp;
--> statement-breakpoint
ALTER TABLE "payroll_periods" ADD COLUMN IF NOT EXISTS "cancelled_by_id" text;
--> statement-breakpoint
ALTER TABLE "payroll_periods" ADD COLUMN IF NOT EXISTS "cancelled_at" timestamp;
--> statement-breakpoint
ALTER TABLE "payroll_periods" ADD COLUMN IF NOT EXISTS "cancellation_reason" text;
--> statement-breakpoint
ALTER TABLE "payroll_periods" ADD COLUMN IF NOT EXISTS "reversal_of_run_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payroll_periods" ADD CONSTRAINT "payroll_periods_regulation_version_id_fk" FOREIGN KEY ("regulation_version_id") REFERENCES "public"."payroll_regulation_versions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payroll_periods" ADD CONSTRAINT "payroll_periods_calculated_by_id_user_id_fk" FOREIGN KEY ("calculated_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payroll_periods" ADD CONSTRAINT "payroll_periods_approver_id_user_id_fk" FOREIGN KEY ("approver_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payroll_periods" ADD CONSTRAINT "payroll_periods_poster_id_user_id_fk" FOREIGN KEY ("poster_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payroll_periods" ADD CONSTRAINT "payroll_periods_cancelled_by_id_user_id_fk" FOREIGN KEY ("cancelled_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payroll_periods" ADD CONSTRAINT "payroll_periods_reversal_of_run_id_periods_id_fk" FOREIGN KEY ("reversal_of_run_id") REFERENCES "public"."payroll_periods"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;

-- ---------------------------------------------------------------------------
-- Extend payroll_run_lines → immutable summary + provenance
-- ---------------------------------------------------------------------------
--> statement-breakpoint
ALTER TABLE "payroll_run_lines" ADD COLUMN IF NOT EXISTS "regulation_version_id" uuid;
--> statement-breakpoint
ALTER TABLE "payroll_run_lines" ADD COLUMN IF NOT EXISTS "calculation_version" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "payroll_run_lines" ADD COLUMN IF NOT EXISTS "proration_factor" numeric(6, 4) DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "payroll_run_lines" ADD COLUMN IF NOT EXISTS "net_payable" numeric(12, 2);
--> statement-breakpoint
ALTER TABLE "payroll_run_lines" ADD COLUMN IF NOT EXISTS "payment_method" varchar(20);
--> statement-breakpoint
ALTER TABLE "payroll_run_lines" ADD COLUMN IF NOT EXISTS "paid_at" timestamp;
--> statement-breakpoint
ALTER TABLE "payroll_run_lines" ADD COLUMN IF NOT EXISTS "is_frozen" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "payroll_run_lines" ADD COLUMN IF NOT EXISTS "is_reversed" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "payroll_run_lines" ADD COLUMN IF NOT EXISTS "reversed_by_line_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payroll_run_lines" ADD CONSTRAINT "payroll_run_lines_regulation_version_id_fk" FOREIGN KEY ("regulation_version_id") REFERENCES "public"."payroll_regulation_versions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payroll_run_lines" ADD CONSTRAINT "payroll_run_lines_reversed_by_line_id_run_lines_fk" FOREIGN KEY ("reversed_by_line_id") REFERENCES "public"."payroll_run_lines"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;

-- ---------------------------------------------------------------------------
-- Extend payslips → numbered, immutable, replaceable
-- ---------------------------------------------------------------------------
--> statement-breakpoint
ALTER TABLE "payslips" ADD COLUMN IF NOT EXISTS "payslip_number" varchar(40);
--> statement-breakpoint
ALTER TABLE "payslips" ADD COLUMN IF NOT EXISTS "status" varchar(20) DEFAULT 'issued' NOT NULL;
--> statement-breakpoint
ALTER TABLE "payslips" ADD COLUMN IF NOT EXISTS "replaced_by_payslip_id" uuid;
--> statement-breakpoint
ALTER TABLE "payslips" ADD COLUMN IF NOT EXISTS "regulation_version_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payslips" ADD CONSTRAINT "payslips_replaced_by_payslip_id_payslips_fk" FOREIGN KEY ("replaced_by_payslip_id") REFERENCES "public"."payslips"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payslips" ADD CONSTRAINT "payslips_regulation_version_id_fk" FOREIGN KEY ("regulation_version_id") REFERENCES "public"."payroll_regulation_versions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN null; END $$;

-- ---------------------------------------------------------------------------
-- Extend leave_requests → review + reservation lifecycle
-- ---------------------------------------------------------------------------
--> statement-breakpoint
ALTER TABLE "leave_requests" DROP CONSTRAINT IF EXISTS "leave_requests_status_check";
--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_status_check" CHECK ((status)::text = ANY ((ARRAY['pending'::character varying,'under_review'::character varying,'approved'::character varying,'rejected'::character varying,'cancelled'::character varying])::text[]));
--> statement-breakpoint
ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "reserved_units" numeric(8, 2) DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "consumed_units" numeric(8, 2) DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "payroll_allocated" boolean DEFAULT false NOT NULL;

-- ---------------------------------------------------------------------------
-- Extend employee_leave_balances → reservation-aware balance
-- ---------------------------------------------------------------------------
--> statement-breakpoint
ALTER TABLE "employee_leave_balances" ADD COLUMN IF NOT EXISTS "reserved_days" numeric(5, 2) DEFAULT 0 NOT NULL;
