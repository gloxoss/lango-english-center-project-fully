ALTER TABLE "alumni_events" ADD COLUMN IF NOT EXISTS "is_published" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "alumni_events" ADD COLUMN IF NOT EXISTS "capacity" integer;--> statement-breakpoint
ALTER TABLE "alumni_events" ADD COLUMN IF NOT EXISTS "target_cohort_session_year_id" uuid;--> statement-breakpoint
ALTER TABLE "alumni_events" ADD COLUMN IF NOT EXISTS "target_branch_id" uuid;--> statement-breakpoint
ALTER TABLE "alumni_events" ADD COLUMN IF NOT EXISTS "attachment_url" varchar(500);--> statement-breakpoint
ALTER TABLE "alumni_events" ADD COLUMN IF NOT EXISTS "is_cancelled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "alumni_events" ADD COLUMN IF NOT EXISTS "cancellation_reason" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "alumni_events" ADD CONSTRAINT "alumni_events_target_cohort_fk" FOREIGN KEY ("target_cohort_session_year_id") REFERENCES "public"."session_years"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "alumni_events" ADD CONSTRAINT "alumni_events_target_branch_fk" FOREIGN KEY ("target_branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
ALTER TABLE "alumni_event_rsvps" ADD COLUMN IF NOT EXISTS "is_waitlisted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "alumni_event_rsvps" ADD COLUMN IF NOT EXISTS "waitlist_position" integer;--> statement-breakpoint
ALTER TABLE "alumni_event_rsvps" ADD COLUMN IF NOT EXISTS "checked_in" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "alumni_event_rsvps" ADD COLUMN IF NOT EXISTS "checked_in_at" timestamp;--> statement-breakpoint
ALTER TABLE "alumni_event_rsvps" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now() NOT NULL;
