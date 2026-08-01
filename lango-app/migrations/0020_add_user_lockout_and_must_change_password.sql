ALTER TABLE "user" ADD COLUMN "failed_login_count" integer DEFAULT 0 NOT NULL;
ALTER TABLE "user" ADD COLUMN "locked_until" timestamp;
ALTER TABLE "user" ADD COLUMN "must_change_password" boolean DEFAULT false NOT NULL;
