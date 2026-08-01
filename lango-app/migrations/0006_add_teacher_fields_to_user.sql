ALTER TABLE "user" ADD COLUMN "employee_id" varchar(50);--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "specialization" varchar(255);--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "cycle" varchar(100);--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "subjects" varchar(100)[];--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "assigned_classes" varchar(100)[];--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "workload_hours" integer;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "hire_date" date;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "documents" jsonb;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_employee_id_unique" UNIQUE("employee_id");