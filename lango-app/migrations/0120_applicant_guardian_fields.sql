-- Bug 2.5: the admission wizard's "create tutor" mini-form only collected
-- name/phone/email, so the guardian created at approval time lost occupation/
-- address/comm-prefs. Store them on the applicant through the wizard so the
-- approval handler can copy them onto the real guardian. Hand-written,
-- idempotent: safe to rerun.

ALTER TABLE "applicants" ADD COLUMN IF NOT EXISTS "occupation" varchar(255);
--> statement-breakpoint
ALTER TABLE "applicants" ADD COLUMN IF NOT EXISTS "address" text;
--> statement-breakpoint
ALTER TABLE "applicants" ADD COLUMN IF NOT EXISTS "email_opt_in" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "applicants" ADD COLUMN IF NOT EXISTS "sms_opt_in" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "applicants" ADD COLUMN IF NOT EXISTS "preferred_language" varchar(10);
