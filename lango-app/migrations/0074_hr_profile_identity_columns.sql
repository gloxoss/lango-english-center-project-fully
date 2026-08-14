-- Advanced HR add-on: identity/contact columns on employee_profiles so that
-- no-login employees (cleaners, drivers, external trainers) carry a name and
-- contact without a linked user row. Linked employees mirror these on user.
-- Hand-written (never drizzle-kit generate). Idempotent: safe to rerun.
ALTER TABLE "employee_profiles" ADD COLUMN IF NOT EXISTS "first_name" varchar(100);
--> statement-breakpoint
ALTER TABLE "employee_profiles" ADD COLUMN IF NOT EXISTS "last_name" varchar(100);
--> statement-breakpoint
ALTER TABLE "employee_profiles" ADD COLUMN IF NOT EXISTS "email" varchar(255);
--> statement-breakpoint
ALTER TABLE "employee_profiles" ADD COLUMN IF NOT EXISTS "phone" varchar(50);
--> statement-breakpoint
ALTER TABLE "employee_profiles" ADD COLUMN IF NOT EXISTS "photo_url" text;
