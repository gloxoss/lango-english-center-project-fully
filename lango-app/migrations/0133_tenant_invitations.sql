-- 0133_tenant_invitations.sql — Teammate invitations for self-serve and admin team growth.
-- Allows tenant admins to invite colleagues via secure email tokens with 7-day TTL.
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenant_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"token" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"invited_by_id" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenant_invitations" DROP CONSTRAINT IF EXISTS "tenant_invitations_token_unique";
ALTER TABLE "tenant_invitations" ADD CONSTRAINT "tenant_invitations_token_unique" UNIQUE ("token");
--> statement-breakpoint
ALTER TABLE "tenant_invitations" DROP CONSTRAINT IF EXISTS "tenant_invitations_tenant_id_tenants_id_fk";
ALTER TABLE "tenant_invitations" ADD CONSTRAINT "tenant_invitations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tenant_invitations" DROP CONSTRAINT IF EXISTS "tenant_invitations_invited_by_id_user_id_fk";
ALTER TABLE "tenant_invitations" ADD CONSTRAINT "tenant_invitations_invited_by_id_user_id_fk" FOREIGN KEY ("invited_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_invitations_tenant_id_idx" ON "tenant_invitations" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_invitations_token_idx" ON "tenant_invitations" ("token");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tenant_invitations_email_idx" ON "tenant_invitations" ("email");
