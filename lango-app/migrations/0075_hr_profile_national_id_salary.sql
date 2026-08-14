-- Advanced HR add-on: nationalId/salary on employee_profiles so that no-login
-- employees (cleaners, drivers, external trainers) carry sensitive HR data
-- without a linked user row. Linked employees mirror these on user too.
-- Hand-written (never drizzle-kit generate). Idempotent: safe to rerun.
ALTER TABLE "employee_profiles" ADD COLUMN IF NOT EXISTS "national_id" varchar(100);
--> statement-breakpoint
ALTER TABLE "employee_profiles" ADD COLUMN IF NOT EXISTS "salary" numeric(10, 2);
