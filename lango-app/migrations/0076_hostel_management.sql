-- Hostel Management add-on (v1 = phases 0-3)
-- Hand-written (never drizzle-kit generate). Idempotent: safe to rerun.
-- Requires the btree_gist extension for the composite GiST EXCLUDE constraints
-- that prevent bed overbooking and student double-allocation.

DO $$ BEGIN
 CREATE TYPE "public"."hostel_allocation_state" AS ENUM('reserved', 'checked_in', 'checked_out', 'cancelled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."hostel_roll_call_entry_status" AS ENUM('present', 'approved_leave', 'late', 'missing', 'sick', 'excused');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS "btree_gist";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hostel_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"policies" jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_by_id" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hostel_policies" ADD CONSTRAINT "hostel_policies_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hostel_policies" ADD CONSTRAINT "hostel_policies_updated_by_id_user_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM pg_constraint WHERE conname = 'hostel_policies_tenant_unique'
     AND conrelid = 'hostel_policies'::regclass
 ) THEN
   ALTER TABLE "hostel_policies" ADD CONSTRAINT "hostel_policies_tenant_unique" UNIQUE ("tenant_id");
 END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hostels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"branch_id" uuid,
	"code" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"address" text,
	"phone" varchar(50),
	"email" varchar(255),
	"gender_policy" varchar(20) DEFAULT 'mixed' NOT NULL,
	"age_min" integer,
	"age_max" integer,
	"policy_snapshot" jsonb,
	"warden_employee_id" uuid,
	"emergency_contact_name" varchar(255),
	"emergency_contact_phone" varchar(50),
	"capacity" integer DEFAULT 0 NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hostels" ADD CONSTRAINT "hostels_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hostels" ADD CONSTRAINT "hostels_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hostels" ADD CONSTRAINT "hostels_warden_employee_id_employee_profiles_id_fk" FOREIGN KEY ("warden_employee_id") REFERENCES "public"."employee_profiles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM pg_constraint WHERE conname = 'hostels_tenant_code_unique'
     AND conrelid = 'hostels'::regclass
 ) THEN
   ALTER TABLE "hostels" ADD CONSTRAINT "hostels_tenant_code_unique" UNIQUE ("tenant_id","code");
 END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hostels_tenant_branch_idx" ON "hostels" ("tenant_id","branch_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hostel_zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"hostel_id" uuid NOT NULL,
	"parent_zone_id" uuid,
	"zone_type" varchar(20) DEFAULT 'floor' NOT NULL,
	"code" varchar(50),
	"name" varchar(255) NOT NULL,
	"curfew_time" time,
	"roll_call_time" time,
	"visitor_hours" jsonb,
	"emergency_assembly_point" text,
	"charge_policy_override" jsonb,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hostel_zones" ADD CONSTRAINT "hostel_zones_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hostel_zones" ADD CONSTRAINT "hostel_zones_hostel_id_hostels_id_fk" FOREIGN KEY ("hostel_id") REFERENCES "public"."hostels"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hostel_zones" ADD CONSTRAINT "hostel_zones_parent_zone_id_hostel_zones_id_fk" FOREIGN KEY ("parent_zone_id") REFERENCES "public"."hostel_zones"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM pg_constraint WHERE conname = 'hostel_zones_tenant_hostel_code_unique'
     AND conrelid = 'hostel_zones'::regclass
 ) THEN
   ALTER TABLE "hostel_zones" ADD CONSTRAINT "hostel_zones_tenant_hostel_code_unique" UNIQUE ("tenant_id","hostel_id","code");
 END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hostel_zones_hostel_idx" ON "hostel_zones" ("hostel_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hostel_room_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"code" varchar(30) NOT NULL,
	"default_capacity" integer,
	"amenities" jsonb,
	"eligible_gender_policy" varchar(20) DEFAULT 'mixed' NOT NULL,
	"eligible_cohort_ids" jsonb,
	"base_charge" numeric(12,2) DEFAULT '0' NOT NULL,
	"deposit_amount" numeric(12,2) DEFAULT '0' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"is_accessible" boolean DEFAULT false NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hostel_room_categories" ADD CONSTRAINT "hostel_room_categories_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM pg_constraint WHERE conname = 'hostel_room_categories_tenant_code_unique'
     AND conrelid = 'hostel_room_categories'::regclass
 ) THEN
   ALTER TABLE "hostel_room_categories" ADD CONSTRAINT "hostel_room_categories_tenant_code_unique" UNIQUE ("tenant_id","code");
 END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hostel_rooms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"hostel_id" uuid NOT NULL,
	"zone_id" uuid,
	"category_id" uuid,
	"code" varchar(50) NOT NULL,
	"name" varchar(255),
	"is_accessible" boolean DEFAULT false NOT NULL,
	"facilities" jsonb,
	"responsible_employee_id" uuid,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hostel_rooms" ADD CONSTRAINT "hostel_rooms_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hostel_rooms" ADD CONSTRAINT "hostel_rooms_hostel_id_hostels_id_fk" FOREIGN KEY ("hostel_id") REFERENCES "public"."hostels"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hostel_rooms" ADD CONSTRAINT "hostel_rooms_zone_id_hostel_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."hostel_zones"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hostel_rooms" ADD CONSTRAINT "hostel_rooms_category_id_hostel_room_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."hostel_room_categories"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hostel_rooms" ADD CONSTRAINT "hostel_rooms_responsible_employee_id_employee_profiles_id_fk" FOREIGN KEY ("responsible_employee_id") REFERENCES "public"."employee_profiles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM pg_constraint WHERE conname = 'hostel_rooms_tenant_hostel_code_unique'
     AND conrelid = 'hostel_rooms'::regclass
 ) THEN
   ALTER TABLE "hostel_rooms" ADD CONSTRAINT "hostel_rooms_tenant_hostel_code_unique" UNIQUE ("tenant_id","hostel_id","code");
 END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hostel_rooms_hostel_zone_category_idx" ON "hostel_rooms" ("hostel_id","zone_id","category_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hostel_beds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"code" varchar(50) NOT NULL,
	"is_accessible" boolean DEFAULT false NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hostel_beds" ADD CONSTRAINT "hostel_beds_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hostel_beds" ADD CONSTRAINT "hostel_beds_room_id_hostel_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."hostel_rooms"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM pg_constraint WHERE conname = 'hostel_beds_tenant_room_code_unique'
     AND conrelid = 'hostel_beds'::regclass
 ) THEN
   ALTER TABLE "hostel_beds" ADD CONSTRAINT "hostel_beds_tenant_room_code_unique" UNIQUE ("tenant_id","room_id","code");
 END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hostel_beds_room_idx" ON "hostel_beds" ("room_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hostel_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"student_id" text NOT NULL,
	"session_year_id" uuid,
	"requested_start_date" date NOT NULL,
	"requested_end_date" date NOT NULL,
	"preferred_category_ids" jsonb,
	"preferred_room_id" uuid,
	"priority_reason" text,
	"guardian_consent_status" varchar(20) DEFAULT 'not_required' NOT NULL,
	"decision" varchar(20) DEFAULT 'pending' NOT NULL,
	"decision_reason" text,
	"decided_by_id" text,
	"decided_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "hostel_applications_date_range_check" CHECK ("requested_end_date" > "requested_start_date")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hostel_applications" ADD CONSTRAINT "hostel_applications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hostel_applications" ADD CONSTRAINT "hostel_applications_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hostel_applications" ADD CONSTRAINT "hostel_applications_session_year_id_session_years_id_fk" FOREIGN KEY ("session_year_id") REFERENCES "public"."session_years"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hostel_applications" ADD CONSTRAINT "hostel_applications_preferred_room_id_hostel_rooms_id_fk" FOREIGN KEY ("preferred_room_id") REFERENCES "public"."hostel_rooms"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hostel_applications" ADD CONSTRAINT "hostel_applications_decided_by_id_user_id_fk" FOREIGN KEY ("decided_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hostel_applications_tenant_student_session_idx" ON "hostel_applications" ("tenant_id","student_id","session_year_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hostel_applications_tenant_decision_idx" ON "hostel_applications" ("tenant_id","decision");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hostel_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"application_id" uuid,
	"student_id" text NOT NULL,
	"bed_id" uuid NOT NULL,
	"effective_start_date" date NOT NULL,
	"effective_end_date" date NOT NULL,
	"state" "hostel_allocation_state" DEFAULT 'reserved' NOT NULL,
	"charge_snapshot" jsonb,
	"source_allocation_id" uuid,
	"checked_in_at" timestamp,
	"checked_out_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "hostel_allocations_date_range_check" CHECK ("effective_end_date" > "effective_start_date")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hostel_allocations" ADD CONSTRAINT "hostel_allocations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hostel_allocations" ADD CONSTRAINT "hostel_allocations_application_id_hostel_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."hostel_applications"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hostel_allocations" ADD CONSTRAINT "hostel_allocations_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hostel_allocations" ADD CONSTRAINT "hostel_allocations_bed_id_hostel_beds_id_fk" FOREIGN KEY ("bed_id") REFERENCES "public"."hostel_beds"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hostel_allocations" ADD CONSTRAINT "hostel_allocations_source_allocation_id_hostel_allocations_id_fk" FOREIGN KEY ("source_allocation_id") REFERENCES "public"."hostel_allocations"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hostel_allocations_tenant_bed_idx" ON "hostel_allocations" ("tenant_id","bed_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hostel_allocations_tenant_student_idx" ON "hostel_allocations" ("tenant_id","student_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hostel_allocations_tenant_state_idx" ON "hostel_allocations" ("tenant_id","state");
--> statement-breakpoint
-- One bed cannot have overlapping reserved/checked_in allocations.
DO $$ BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM pg_constraint WHERE conname = 'hostel_allocations_bed_no_overlap'
     AND conrelid = 'hostel_allocations'::regclass
 ) THEN
   ALTER TABLE "hostel_allocations" ADD CONSTRAINT "hostel_allocations_bed_no_overlap" EXCLUDE USING gist ("tenant_id" WITH =, "bed_id" WITH =, daterange("effective_start_date","effective_end_date",'[)') WITH &&) WHERE ("state" IN ('reserved','checked_in'));
 END IF;
END $$;
--> statement-breakpoint
-- One student cannot hold overlapping reserved/checked_in allocations.
DO $$ BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM pg_constraint WHERE conname = 'hostel_allocations_student_no_overlap'
     AND conrelid = 'hostel_allocations'::regclass
 ) THEN
   ALTER TABLE "hostel_allocations" ADD CONSTRAINT "hostel_allocations_student_no_overlap" EXCLUDE USING gist ("tenant_id" WITH =, "student_id" WITH =, daterange("effective_start_date","effective_end_date",'[)') WITH &&) WHERE ("state" IN ('reserved','checked_in'));
 END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hostel_allocation_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"allocation_id" uuid NOT NULL,
	"event_type" varchar(30) NOT NULL,
	"actor_id" text NOT NULL,
	"reason" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hostel_allocation_events" ADD CONSTRAINT "hostel_allocation_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hostel_allocation_events" ADD CONSTRAINT "hostel_allocation_events_allocation_id_hostel_allocations_id_fk" FOREIGN KEY ("allocation_id") REFERENCES "public"."hostel_allocations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hostel_allocation_events" ADD CONSTRAINT "hostel_allocation_events_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hostel_allocation_events_tenant_allocation_idx" ON "hostel_allocation_events" ("tenant_id","allocation_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hostel_roll_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"hostel_id" uuid NOT NULL,
	"call_date" date NOT NULL,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"opened_by_id" text NOT NULL,
	"closed_by_id" text,
	"closed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hostel_roll_calls" ADD CONSTRAINT "hostel_roll_calls_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hostel_roll_calls" ADD CONSTRAINT "hostel_roll_calls_hostel_id_hostels_id_fk" FOREIGN KEY ("hostel_id") REFERENCES "public"."hostels"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hostel_roll_calls" ADD CONSTRAINT "hostel_roll_calls_opened_by_id_user_id_fk" FOREIGN KEY ("opened_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hostel_roll_calls" ADD CONSTRAINT "hostel_roll_calls_closed_by_id_user_id_fk" FOREIGN KEY ("closed_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM pg_constraint WHERE conname = 'hostel_roll_calls_tenant_hostel_date_unique'
     AND conrelid = 'hostel_roll_calls'::regclass
 ) THEN
   ALTER TABLE "hostel_roll_calls" ADD CONSTRAINT "hostel_roll_calls_tenant_hostel_date_unique" UNIQUE ("tenant_id","hostel_id","call_date");
 END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hostel_roll_call_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"roll_call_id" uuid NOT NULL,
	"allocation_id" uuid NOT NULL,
	"status" "hostel_roll_call_entry_status" NOT NULL,
	"noted_by_id" text NOT NULL,
	"note" text,
	"noted_at" timestamp DEFAULT now() NOT NULL,
	"last_updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hostel_roll_call_entries" ADD CONSTRAINT "hostel_roll_call_entries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hostel_roll_call_entries" ADD CONSTRAINT "hostel_roll_call_entries_roll_call_id_hostel_roll_calls_id_fk" FOREIGN KEY ("roll_call_id") REFERENCES "public"."hostel_roll_calls"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hostel_roll_call_entries" ADD CONSTRAINT "hostel_roll_call_entries_allocation_id_hostel_allocations_id_fk" FOREIGN KEY ("allocation_id") REFERENCES "public"."hostel_allocations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hostel_roll_call_entries" ADD CONSTRAINT "hostel_roll_call_entries_noted_by_id_user_id_fk" FOREIGN KEY ("noted_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM pg_constraint WHERE conname = 'hostel_roll_call_entries_tenant_rollcall_allocation_unique'
     AND conrelid = 'hostel_roll_call_entries'::regclass
 ) THEN
   ALTER TABLE "hostel_roll_call_entries" ADD CONSTRAINT "hostel_roll_call_entries_tenant_rollcall_allocation_unique" UNIQUE ("tenant_id","roll_call_id","allocation_id");
 END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hostel_roll_call_entries_allocation_idx" ON "hostel_roll_call_entries" ("allocation_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hostel_leave_passes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"allocation_id" uuid NOT NULL,
	"student_id" text NOT NULL,
	"destination" text,
	"reason" text,
	"start_date_time" timestamp NOT NULL,
	"expected_return_at" timestamp NOT NULL,
	"actual_return_at" timestamp,
	"guardian_approval_required" boolean DEFAULT false NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"created_by_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hostel_leave_passes" ADD CONSTRAINT "hostel_leave_passes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hostel_leave_passes" ADD CONSTRAINT "hostel_leave_passes_allocation_id_hostel_allocations_id_fk" FOREIGN KEY ("allocation_id") REFERENCES "public"."hostel_allocations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hostel_leave_passes" ADD CONSTRAINT "hostel_leave_passes_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hostel_leave_passes" ADD CONSTRAINT "hostel_leave_passes_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hostel_leave_passes_tenant_status_idx" ON "hostel_leave_passes" ("tenant_id","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hostel_leave_passes_allocation_idx" ON "hostel_leave_passes" ("allocation_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hostel_leave_pass_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"leave_pass_id" uuid NOT NULL,
	"approver_id" text NOT NULL,
	"approver_role" varchar(20) NOT NULL,
	"decision" varchar(20) NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hostel_leave_pass_approvals" ADD CONSTRAINT "hostel_leave_pass_approvals_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hostel_leave_pass_approvals" ADD CONSTRAINT "hostel_leave_pass_approvals_leave_pass_id_hostel_leave_passes_id_fk" FOREIGN KEY ("leave_pass_id") REFERENCES "public"."hostel_leave_passes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hostel_leave_pass_approvals" ADD CONSTRAINT "hostel_leave_pass_approvals_approver_id_user_id_fk" FOREIGN KEY ("approver_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hostel_leave_pass_returns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"leave_pass_id" uuid NOT NULL,
	"allocation_id" uuid NOT NULL,
	"returned_at" timestamp NOT NULL,
	"recorded_by_id" text NOT NULL,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hostel_leave_pass_returns" ADD CONSTRAINT "hostel_leave_pass_returns_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hostel_leave_pass_returns" ADD CONSTRAINT "hostel_leave_pass_returns_leave_pass_id_hostel_leave_passes_id_fk" FOREIGN KEY ("leave_pass_id") REFERENCES "public"."hostel_leave_passes"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hostel_leave_pass_returns" ADD CONSTRAINT "hostel_leave_pass_returns_allocation_id_hostel_allocations_id_fk" FOREIGN KEY ("allocation_id") REFERENCES "public"."hostel_allocations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hostel_leave_pass_returns" ADD CONSTRAINT "hostel_leave_pass_returns_recorded_by_id_user_id_fk" FOREIGN KEY ("recorded_by_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM pg_constraint WHERE conname = 'hostel_leave_pass_returns_tenant_leave_pass_unique'
     AND conrelid = 'hostel_leave_pass_returns'::regclass
 ) THEN
   ALTER TABLE "hostel_leave_pass_returns" ADD CONSTRAINT "hostel_leave_pass_returns_tenant_leave_pass_unique" UNIQUE ("tenant_id","leave_pass_id");
 END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hostel_escalations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"allocation_id" uuid,
	"escalation_type" varchar(30) NOT NULL,
	"trigger_date" date NOT NULL,
	"tier" integer DEFAULT 1 NOT NULL,
	"recipient_type" varchar(20) NOT NULL,
	"channel" varchar(10) DEFAULT 'log' NOT NULL,
	"acknowledged_at" timestamp,
	"acknowledged_by_id" text,
	"closure_reason" text,
	"idempotency_key" varchar(100) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hostel_escalations" ADD CONSTRAINT "hostel_escalations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hostel_escalations" ADD CONSTRAINT "hostel_escalations_allocation_id_hostel_allocations_id_fk" FOREIGN KEY ("allocation_id") REFERENCES "public"."hostel_allocations"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hostel_escalations" ADD CONSTRAINT "hostel_escalations_acknowledged_by_id_user_id_fk" FOREIGN KEY ("acknowledged_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM pg_constraint WHERE conname = 'hostel_escalations_tenant_idempotency_key_unique'
     AND conrelid = 'hostel_escalations'::regclass
 ) THEN
   ALTER TABLE "hostel_escalations" ADD CONSTRAINT "hostel_escalations_tenant_idempotency_key_unique" UNIQUE ("tenant_id","idempotency_key");
 END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hostel_escalations_tenant_type_date_idx" ON "hostel_escalations" ("tenant_id","escalation_type","trigger_date");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "hostel_charge_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"allocation_id" uuid NOT NULL,
	"fee_structure_id" uuid,
	"invoice_id" uuid,
	"invoice_item_id" uuid,
	"charge_type" varchar(20) NOT NULL,
	"amount" numeric(12,2) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hostel_charge_links" ADD CONSTRAINT "hostel_charge_links_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hostel_charge_links" ADD CONSTRAINT "hostel_charge_links_allocation_id_hostel_allocations_id_fk" FOREIGN KEY ("allocation_id") REFERENCES "public"."hostel_allocations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hostel_charge_links" ADD CONSTRAINT "hostel_charge_links_fee_structure_id_fee_structures_id_fk" FOREIGN KEY ("fee_structure_id") REFERENCES "public"."fee_structures"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hostel_charge_links" ADD CONSTRAINT "hostel_charge_links_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "hostel_charge_links" ADD CONSTRAINT "hostel_charge_links_invoice_item_id_invoice_items_id_fk" FOREIGN KEY ("invoice_item_id") REFERENCES "public"."invoice_items"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "hostel_charge_links_tenant_allocation_idx" ON "hostel_charge_links" ("tenant_id","allocation_id");
