CREATE TYPE "public"."inquiry_source" AS ENUM('walk_in', 'phone', 'web', 'referral');
CREATE TYPE "public"."inquiry_interest_level" AS ENUM('low', 'medium', 'high');
CREATE TYPE "public"."inquiry_status" AS ENUM('new', 'contacted', 'qualified', 'converted', 'lost');
CREATE TYPE "public"."inquiry_follow_up_type" AS ENUM('call', 'email', 'meeting', 'note');

CREATE TABLE "inquiries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"contact_name" varchar(255) NOT NULL,
	"phone" varchar(50),
	"email" varchar(255),
	"source" "inquiry_source" DEFAULT 'walk_in' NOT NULL,
	"interest_level" "inquiry_interest_level" DEFAULT 'medium',
	"status" "inquiry_status" DEFAULT 'new' NOT NULL,
	"assigned_to_id" text,
	"notes" text,
	"converted_applicant_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "inquiry_follow_ups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"inquiry_id" uuid NOT NULL,
	"type" "inquiry_follow_up_type" NOT NULL,
	"notes" text NOT NULL,
	"scheduled_for" timestamp,
	"completed_at" timestamp,
	"created_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_assigned_to_id_user_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_converted_applicant_id_applicants_id_fk" FOREIGN KEY ("converted_applicant_id") REFERENCES "public"."applicants"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "inquiry_follow_ups" ADD CONSTRAINT "inquiry_follow_ups_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "inquiry_follow_ups" ADD CONSTRAINT "inquiry_follow_ups_inquiry_id_inquiries_id_fk" FOREIGN KEY ("inquiry_id") REFERENCES "public"."inquiries"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "inquiry_follow_ups" ADD CONSTRAINT "inquiry_follow_ups_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
