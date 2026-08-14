-- Library Management add-on + Librarian Portal (V1)
-- Hand-written (never drizzle-kit generate). Idempotent: safe to rerun.
-- 23 tables, all tenant-scoped. Circulation invariants (one active loan per
-- copy, one active hold per copy+member, partial-unique ISBN, fine-dedupe)
-- are enforced by partial UNIQUE INDEXes below - Drizzle cannot express them.

--> statement-breakpoint
-- New application role for the Librarian Portal (capability-gated at runtime).
DO $$ BEGIN
 ALTER TYPE "public"."role" ADD VALUE 'librarian';
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."library_copy_state" AS ENUM('available', 'on_hold_shelf', 'checked_out', 'in_transit', 'repair', 'lost', 'missing', 'withdrawn');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."library_copy_condition" AS ENUM('new', 'good', 'fair', 'poor', 'damaged');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."library_member_state" AS ENUM('active', 'blocked', 'inactive');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."library_loan_event_type" AS ENUM('issued', 'renewed', 'returned', 'lost', 'damaged', 'recovered', 'withdrawn');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."library_hold_state" AS ENUM('waiting', 'fulfilled', 'cancelled', 'expired');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."library_transfer_state" AS ENUM('requested', 'dispatched', 'received', 'discrepancy', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."library_stocktake_state" AS ENUM('open', 'closed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."library_charge_state" AS ENUM('open', 'waived', 'paid');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."library_charge_adjustment_type" AS ENUM('waive', 'reduce', 'reapply');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."library_notification_type" AS ENUM('due_soon', 'overdue', 'hold_ready', 'hold_expired', 'member_blocked');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "library_bibliographic_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"title" varchar(500) NOT NULL,
	"subtitle" varchar(500),
	"language" varchar(50),
	"publication_year" integer,
	"summary" text,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_bibliographic_records" ADD CONSTRAINT "library_records_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "library_records_tenant_title_idx" ON "library_bibliographic_records" ("tenant_id","title");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "library_contributors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"primary_role" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_contributors" ADD CONSTRAINT "library_contributors_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM pg_constraint WHERE conname = 'library_contributors_tenant_name_unique'
     AND conrelid = 'library_contributors'::regclass
 ) THEN
   ALTER TABLE "library_contributors" ADD CONSTRAINT "library_contributors_tenant_name_unique" UNIQUE ("tenant_id","name");
 END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "library_record_contributors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"record_id" uuid NOT NULL,
	"contributor_id" uuid NOT NULL,
	"role" varchar(50) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_record_contributors" ADD CONSTRAINT "library_record_contributors_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_record_contributors" ADD CONSTRAINT "library_record_contributors_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."library_bibliographic_records"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_record_contributors" ADD CONSTRAINT "library_record_contributors_contributor_id_contributors_id_fk" FOREIGN KEY ("contributor_id") REFERENCES "public"."library_contributors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM pg_constraint WHERE conname = 'library_record_contributors_record_contributor_role_unique'
     AND conrelid = 'library_record_contributors'::regclass
 ) THEN
   ALTER TABLE "library_record_contributors" ADD CONSTRAINT "library_record_contributors_record_contributor_role_unique" UNIQUE ("tenant_id","record_id","contributor_id","role");
 END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "library_publishers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"city" varchar(100),
	"country" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_publishers" ADD CONSTRAINT "library_publishers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM pg_constraint WHERE conname = 'library_publishers_tenant_name_unique'
     AND conrelid = 'library_publishers'::regclass
 ) THEN
   ALTER TABLE "library_publishers" ADD CONSTRAINT "library_publishers_tenant_name_unique" UNIQUE ("tenant_id","name");
 END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "library_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"parent_id" uuid,
	"name" varchar(255) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_categories" ADD CONSTRAINT "library_categories_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_categories" ADD CONSTRAINT "library_categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."library_categories"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM pg_constraint WHERE conname = 'library_categories_tenant_parent_name_unique'
     AND conrelid = 'library_categories'::regclass
 ) THEN
   ALTER TABLE "library_categories" ADD CONSTRAINT "library_categories_tenant_parent_name_unique" UNIQUE ("tenant_id","parent_id","name");
 END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "library_subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_subjects" ADD CONSTRAINT "library_subjects_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM pg_constraint WHERE conname = 'library_subjects_tenant_name_unique'
     AND conrelid = 'library_subjects'::regclass
 ) THEN
   ALTER TABLE "library_subjects" ADD CONSTRAINT "library_subjects_tenant_name_unique" UNIQUE ("tenant_id","name");
 END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "library_record_subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"record_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_record_subjects" ADD CONSTRAINT "library_record_subjects_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_record_subjects" ADD CONSTRAINT "library_record_subjects_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."library_bibliographic_records"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_record_subjects" ADD CONSTRAINT "library_record_subjects_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."library_subjects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM pg_constraint WHERE conname = 'library_record_subjects_record_subject_unique'
     AND conrelid = 'library_record_subjects'::regclass
 ) THEN
   ALTER TABLE "library_record_subjects" ADD CONSTRAINT "library_record_subjects_record_subject_unique" UNIQUE ("tenant_id","record_id","subject_id");
 END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "library_editions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"record_id" uuid NOT NULL,
	"publisher_id" uuid,
	"isbn13" varchar(13),
	"isbn10" varchar(10),
	"publication_year" integer,
	"pages" integer,
	"format" varchar(50),
	"cover_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_editions" ADD CONSTRAINT "library_editions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_editions" ADD CONSTRAINT "library_editions_record_id_records_id_fk" FOREIGN KEY ("record_id") REFERENCES "public"."library_bibliographic_records"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_editions" ADD CONSTRAINT "library_editions_publisher_id_publishers_id_fk" FOREIGN KEY ("publisher_id") REFERENCES "public"."library_publishers"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "library_editions_tenant_record_idx" ON "library_editions" ("tenant_id","record_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "library_editions_tenant_isbn13_unique" ON "library_editions" ("tenant_id","isbn13") WHERE "isbn13" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "library_editions_tenant_isbn10_unique" ON "library_editions" ("tenant_id","isbn10") WHERE "isbn10" IS NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "library_copies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"edition_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"accession_number" varchar(50) NOT NULL,
	"barcode" varchar(50),
	"shelf_location" varchar(100),
	"condition" "public"."library_copy_condition" DEFAULT 'good' NOT NULL,
	"state" "public"."library_copy_state" DEFAULT 'available' NOT NULL,
	"price" numeric(10, 2),
	"acquired_at" date,
	"withdrawn_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_copies" ADD CONSTRAINT "library_copies_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_copies" ADD CONSTRAINT "library_copies_edition_id_editions_id_fk" FOREIGN KEY ("edition_id") REFERENCES "public"."library_editions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_copies" ADD CONSTRAINT "library_copies_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM pg_constraint WHERE conname = 'library_copies_tenant_accession_unique'
     AND conrelid = 'library_copies'::regclass
 ) THEN
   ALTER TABLE "library_copies" ADD CONSTRAINT "library_copies_tenant_accession_unique" UNIQUE ("tenant_id","accession_number");
 END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM pg_constraint WHERE conname = 'library_copies_tenant_barcode_unique'
     AND conrelid = 'library_copies'::regclass
 ) THEN
   ALTER TABLE "library_copies" ADD CONSTRAINT "library_copies_tenant_barcode_unique" UNIQUE ("tenant_id","barcode");
 END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "library_copies_tenant_branch_state_idx" ON "library_copies" ("tenant_id","branch_id","state");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "library_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"member_number" varchar(50) NOT NULL,
	"branch_id" uuid NOT NULL,
	"state" "public"."library_member_state" DEFAULT 'active' NOT NULL,
	"block_reason" text,
	"block_until" date,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_members" ADD CONSTRAINT "library_members_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_members" ADD CONSTRAINT "library_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_members" ADD CONSTRAINT "library_members_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM pg_constraint WHERE conname = 'library_members_tenant_member_number_unique'
     AND conrelid = 'library_members'::regclass
 ) THEN
   ALTER TABLE "library_members" ADD CONSTRAINT "library_members_tenant_member_number_unique" UNIQUE ("tenant_id","member_number");
 END IF;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM pg_constraint WHERE conname = 'library_members_tenant_user_unique'
     AND conrelid = 'library_members'::regclass
 ) THEN
   ALTER TABLE "library_members" ADD CONSTRAINT "library_members_tenant_user_unique" UNIQUE ("tenant_id","user_id");
 END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "library_loan_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"patron_category" varchar(50) NOT NULL,
	"branch_id" uuid,
	"max_loans" integer DEFAULT 3 NOT NULL,
	"loan_duration_days" integer DEFAULT 14 NOT NULL,
	"renewal_limit" integer DEFAULT 1 NOT NULL,
	"renewal_duration_days" integer DEFAULT 14 NOT NULL,
	"fine_per_day" numeric(10, 2) DEFAULT '0' NOT NULL,
	"grace_period_days" integer DEFAULT 0 NOT NULL,
	"max_holds" integer DEFAULT 3 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_loan_policies" ADD CONSTRAINT "library_loan_policies_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_loan_policies" ADD CONSTRAINT "library_loan_policies_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM pg_constraint WHERE conname = 'library_loan_policies_tenant_category_branch_unique'
     AND conrelid = 'library_loan_policies'::regclass
 ) THEN
   ALTER TABLE "library_loan_policies" ADD CONSTRAINT "library_loan_policies_tenant_category_branch_unique" UNIQUE ("tenant_id","patron_category","branch_id");
 END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "library_loan_policies_tenant_category_idx" ON "library_loan_policies" ("tenant_id","patron_category");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "library_loans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"copy_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"issued_by_id" text NOT NULL,
	"issued_at" timestamp DEFAULT now() NOT NULL,
	"due_date" date NOT NULL,
	"returned_at" timestamp,
	"return_state" varchar(20),
	"renewed_count" integer DEFAULT 0 NOT NULL,
	"policy_snapshot" jsonb NOT NULL,
	"note" text
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_loans" ADD CONSTRAINT "library_loans_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_loans" ADD CONSTRAINT "library_loans_copy_id_copies_id_fk" FOREIGN KEY ("copy_id") REFERENCES "public"."library_copies"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_loans" ADD CONSTRAINT "library_loans_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."library_members"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_loans" ADD CONSTRAINT "library_loans_issued_by_id_user_id_fk" FOREIGN KEY ("issued_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM pg_constraint WHERE conname = 'library_loans_due_after_issue_check'
     AND conrelid = 'library_loans'::regclass
 ) THEN
   ALTER TABLE "library_loans" ADD CONSTRAINT "library_loans_due_after_issue_check" CHECK ("due_date" > "issued_at"::date);
 END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "library_loans_tenant_member_idx" ON "library_loans" ("tenant_id","member_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "library_loans_tenant_due_date_idx" ON "library_loans" ("tenant_id","due_date");
--> statement-breakpoint
-- Invariant 1: a copy can never have two active (unreturned) loans.
CREATE UNIQUE INDEX IF NOT EXISTS "library_loans_copy_active_unique" ON "library_loans" ("copy_id") WHERE "returned_at" IS NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "library_loan_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"loan_id" uuid NOT NULL,
	"event_type" "public"."library_loan_event_type" NOT NULL,
	"actor_id" text NOT NULL,
	"at" timestamp DEFAULT now() NOT NULL,
	"note" text
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_loan_events" ADD CONSTRAINT "library_loan_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_loan_events" ADD CONSTRAINT "library_loan_events_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."library_loans"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "library_loan_events_tenant_loan_idx" ON "library_loan_events" ("tenant_id","loan_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "library_holds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"copy_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"placed_by_id" text NOT NULL,
	"placed_at" timestamp DEFAULT now() NOT NULL,
	"state" "public"."library_hold_state" DEFAULT 'waiting' NOT NULL,
	"expires_at" date,
	"fulfilled_loan_id" uuid,
	"cancelled_at" timestamp,
	"cancel_reason" text
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_holds" ADD CONSTRAINT "library_holds_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_holds" ADD CONSTRAINT "library_holds_copy_id_copies_id_fk" FOREIGN KEY ("copy_id") REFERENCES "public"."library_copies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_holds" ADD CONSTRAINT "library_holds_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."library_members"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_holds" ADD CONSTRAINT "library_holds_placed_by_id_user_id_fk" FOREIGN KEY ("placed_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_holds" ADD CONSTRAINT "library_holds_fulfilled_loan_id_loans_id_fk" FOREIGN KEY ("fulfilled_loan_id") REFERENCES "public"."library_loans"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "library_holds_tenant_copy_state_idx" ON "library_holds" ("tenant_id","copy_id","state");
--> statement-breakpoint
-- Invariant 2: one active hold per copy+member.
CREATE UNIQUE INDEX IF NOT EXISTS "library_holds_copy_member_waiting_unique" ON "library_holds" ("copy_id","member_id") WHERE "state" = 'waiting';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "library_hold_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"hold_id" uuid NOT NULL,
	"event_type" varchar(30) NOT NULL,
	"actor_id" text NOT NULL,
	"at" timestamp DEFAULT now() NOT NULL,
	"note" text
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_hold_events" ADD CONSTRAINT "library_hold_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_hold_events" ADD CONSTRAINT "library_hold_events_hold_id_holds_id_fk" FOREIGN KEY ("hold_id") REFERENCES "public"."library_holds"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "library_hold_events_tenant_hold_idx" ON "library_hold_events" ("tenant_id","hold_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "library_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"copy_id" uuid NOT NULL,
	"from_branch_id" uuid NOT NULL,
	"to_branch_id" uuid NOT NULL,
	"state" "public"."library_transfer_state" DEFAULT 'requested' NOT NULL,
	"requested_by_id" text NOT NULL,
	"dispatched_at" timestamp,
	"dispatched_by_id" text,
	"received_at" timestamp,
	"received_by_id" text,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_transfers" ADD CONSTRAINT "library_transfers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_transfers" ADD CONSTRAINT "library_transfers_copy_id_copies_id_fk" FOREIGN KEY ("copy_id") REFERENCES "public"."library_copies"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_transfers" ADD CONSTRAINT "library_transfers_from_branch_id_branches_id_fk" FOREIGN KEY ("from_branch_id") REFERENCES "public"."branches"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_transfers" ADD CONSTRAINT "library_transfers_to_branch_id_branches_id_fk" FOREIGN KEY ("to_branch_id") REFERENCES "public"."branches"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_transfers" ADD CONSTRAINT "library_transfers_requested_by_id_user_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM pg_constraint WHERE conname = 'library_transfers_distinct_branches_check'
     AND conrelid = 'library_transfers'::regclass
 ) THEN
   ALTER TABLE "library_transfers" ADD CONSTRAINT "library_transfers_distinct_branches_check" CHECK ("from_branch_id" <> "to_branch_id");
 END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "library_transfers_tenant_state_idx" ON "library_transfers" ("tenant_id","state");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "library_transfer_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"transfer_id" uuid NOT NULL,
	"event_type" varchar(30) NOT NULL,
	"actor_id" text NOT NULL,
	"at" timestamp DEFAULT now() NOT NULL,
	"note" text
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_transfer_events" ADD CONSTRAINT "library_transfer_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_transfer_events" ADD CONSTRAINT "library_transfer_events_transfer_id_transfers_id_fk" FOREIGN KEY ("transfer_id") REFERENCES "public"."library_transfers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "library_transfer_events_tenant_transfer_idx" ON "library_transfer_events" ("tenant_id","transfer_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "library_stocktakes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"state" "public"."library_stocktake_state" DEFAULT 'open' NOT NULL,
	"started_by_id" text NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"closed_at" timestamp,
	"closed_by_id" text
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_stocktakes" ADD CONSTRAINT "library_stocktakes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_stocktakes" ADD CONSTRAINT "library_stocktakes_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_stocktakes" ADD CONSTRAINT "library_stocktakes_started_by_id_user_id_fk" FOREIGN KEY ("started_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "library_stocktakes_tenant_branch_state_idx" ON "library_stocktakes" ("tenant_id","branch_id","state");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "library_stocktake_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"stocktake_id" uuid NOT NULL,
	"copy_id" uuid NOT NULL,
	"counted_by_id" text NOT NULL,
	"counted_at" timestamp DEFAULT now() NOT NULL,
	"found" boolean,
	"note" text
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_stocktake_observations" ADD CONSTRAINT "library_stocktake_observations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_stocktake_observations" ADD CONSTRAINT "library_stocktake_observations_stocktake_id_stocktakes_id_fk" FOREIGN KEY ("stocktake_id") REFERENCES "public"."library_stocktakes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_stocktake_observations" ADD CONSTRAINT "library_stocktake_observations_copy_id_copies_id_fk" FOREIGN KEY ("copy_id") REFERENCES "public"."library_copies"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_stocktake_observations" ADD CONSTRAINT "library_stocktake_observations_counted_by_id_user_id_fk" FOREIGN KEY ("counted_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "library_stocktake_observations_tenant_stocktake_idx" ON "library_stocktake_observations" ("tenant_id","stocktake_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "library_stocktake_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"stocktake_id" uuid NOT NULL,
	"observation_id" uuid NOT NULL,
	"copy_id" uuid NOT NULL,
	"from_state" "public"."library_copy_state" NOT NULL,
	"to_state" "public"."library_copy_state" NOT NULL,
	"resolved_by_id" text NOT NULL,
	"reason" text NOT NULL,
	"at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_stocktake_adjustments" ADD CONSTRAINT "library_stocktake_adjustments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_stocktake_adjustments" ADD CONSTRAINT "library_stocktake_adjustments_stocktake_id_stocktakes_id_fk" FOREIGN KEY ("stocktake_id") REFERENCES "public"."library_stocktakes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_stocktake_adjustments" ADD CONSTRAINT "library_stocktake_adjustments_observation_id_observations_id_fk" FOREIGN KEY ("observation_id") REFERENCES "public"."library_stocktake_observations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_stocktake_adjustments" ADD CONSTRAINT "library_stocktake_adjustments_copy_id_copies_id_fk" FOREIGN KEY ("copy_id") REFERENCES "public"."library_copies"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_stocktake_adjustments" ADD CONSTRAINT "library_stocktake_adjustments_resolved_by_id_user_id_fk" FOREIGN KEY ("resolved_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "library_charges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"loan_id" uuid,
	"amount" numeric(10, 2) NOT NULL,
	"reason" varchar(50) NOT NULL,
	"state" "public"."library_charge_state" DEFAULT 'open' NOT NULL,
	"waived_by_id" text,
	"waived_at" timestamp,
	"waiver_reason" text,
	"dedupe_key" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_charges" ADD CONSTRAINT "library_charges_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_charges" ADD CONSTRAINT "library_charges_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."library_members"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_charges" ADD CONSTRAINT "library_charges_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."library_loans"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_charges" ADD CONSTRAINT "library_charges_waived_by_id_user_id_fk" FOREIGN KEY ("waived_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "library_charges_tenant_member_idx" ON "library_charges" ("tenant_id","member_id");
--> statement-breakpoint
-- Invariant 3: a fine can never be double-posted for the same loan+reason.
CREATE UNIQUE INDEX IF NOT EXISTS "library_charges_loan_reason_unique" ON "library_charges" ("tenant_id","loan_id","reason") WHERE "loan_id" IS NOT NULL;
--> statement-breakpoint
-- Invariant 3b: non-loan charges (e.g. lost copy) dedupe by an explicit key.
CREATE UNIQUE INDEX IF NOT EXISTS "library_charges_tenant_dedupe_key_unique" ON "library_charges" ("tenant_id","dedupe_key") WHERE "dedupe_key" IS NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "library_charge_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"charge_id" uuid NOT NULL,
	"adjustment_type" "public"."library_charge_adjustment_type" NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"actor_id" text NOT NULL,
	"reason" text NOT NULL,
	"at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_charge_adjustments" ADD CONSTRAINT "library_charge_adjustments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_charge_adjustments" ADD CONSTRAINT "library_charge_adjustments_charge_id_charges_id_fk" FOREIGN KEY ("charge_id") REFERENCES "public"."library_charges"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_charge_adjustments" ADD CONSTRAINT "library_charge_adjustments_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "library_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"type" "public"."library_notification_type" NOT NULL,
	"channel" varchar(20) DEFAULT 'in_app' NOT NULL,
	"state" varchar(20) DEFAULT 'queued' NOT NULL,
	"payload" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"delivered_at" timestamp
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_notifications" ADD CONSTRAINT "library_notifications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "library_notifications" ADD CONSTRAINT "library_notifications_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."library_members"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "library_notifications_tenant_member_idx" ON "library_notifications" ("tenant_id","member_id");
