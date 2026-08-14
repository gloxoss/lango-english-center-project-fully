-- Live Classrooms add-on hardening (P0-1 durable single-use join grants).
-- Hand-written (never drizzle-kit generate). Idempotent: safe to rerun.
-- Adds the durable join-grant table used by join-service for atomic one-time
-- redemption. Only the SHA-256 hash of the token nonce is stored — the raw
-- nonce/token is never persisted.

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "live_class_join_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"auth_session_id" text,
	"role" varchar(20) NOT NULL,
	"nonce_hash" varchar(64) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"redeemed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "live_class_join_grants_nonce_unique" ON "live_class_join_grants" ("tenant_id","session_id","user_id","nonce_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "live_class_join_grants_expiry_idx" ON "live_class_join_grants" ("tenant_id","expires_at") WHERE "redeemed_at" IS NULL;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "live_class_join_grants" ADD CONSTRAINT "live_class_join_grants_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "live_class_join_grants" ADD CONSTRAINT "live_class_join_grants_session_id_live_class_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "live_class_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "live_class_join_grants" ADD CONSTRAINT "live_class_join_grants_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
