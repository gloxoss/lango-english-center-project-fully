-- Adds the columns the students/users API already returns. These are stopgaps on
-- "user" - see MIGRATION-NOTES.md for what each should eventually become.
--
-- drizzle-kit also emitted FK renames and index rebuilds alongside these ALTERs.
-- They were stripped: they are introspection artifacts, not real changes. Postgres
-- truncates identifiers at 63 chars, so the FK names in 0000 were already stored
-- truncated, and drizzle read the truncated form back and offered to "fix" it. One
-- of the rebuilt indexes was also wrong - it assigned date_ops to the text column
-- student_id and text_ops to date.
ALTER TABLE "user" ADD COLUMN "matricule" varchar(50);--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "user_status" "status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "qualification" varchar(255);--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "salary" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "last_login" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "level" varchar(100);--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "class_name" varchar(100);--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "payment_status" varchar(50);--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_matricule_unique" UNIQUE("matricule");
