CREATE TYPE "public"."plan_tier" AS ENUM('trial', 'basic', 'standard', 'premium');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'suspended', 'cancelled');--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "plan_tier" "plan_tier" DEFAULT 'trial' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "subscription_status" "subscription_status" DEFAULT 'active' NOT NULL;