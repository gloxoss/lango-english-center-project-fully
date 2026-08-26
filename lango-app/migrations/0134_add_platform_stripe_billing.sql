ALTER TYPE "public"."subscription_status" ADD VALUE IF NOT EXISTS 'trialing';
ALTER TYPE "public"."subscription_status" ADD VALUE IF NOT EXISTS 'past_due';
ALTER TYPE "public"."subscription_status" ADD VALUE IF NOT EXISTS 'unpaid';
ALTER TYPE "public"."subscription_status" ADD VALUE IF NOT EXISTS 'canceled';

ALTER TABLE "tenants" ADD COLUMN "stripe_customer_id" text;
ALTER TABLE "tenants" ADD COLUMN "stripe_subscription_id" text;
ALTER TABLE "tenants" ADD COLUMN "stripe_price_id" text;
ALTER TABLE "tenants" ADD COLUMN "stripe_current_period_end" timestamp;

CREATE UNIQUE INDEX "tenants_stripe_customer_id_unique" ON "tenants" ("stripe_customer_id");
CREATE UNIQUE INDEX "tenants_stripe_subscription_id_unique" ON "tenants" ("stripe_subscription_id");
