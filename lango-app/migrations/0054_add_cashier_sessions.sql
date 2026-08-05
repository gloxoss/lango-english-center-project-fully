CREATE TYPE "cashier_session_status" AS ENUM('open', 'closed', 'reconciled');

CREATE TABLE "cashier_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"cashier_id" text NOT NULL,
	"opened_at" timestamp DEFAULT now() NOT NULL,
	"closed_at" timestamp,
	"starting_float" numeric(14, 2) DEFAULT 0 NOT NULL,
	"expected_cash" numeric(14, 2) DEFAULT 0 NOT NULL,
	"actual_cash" numeric(14, 2) DEFAULT 0,
	"total_collected" numeric(14, 2) DEFAULT 0 NOT NULL,
	"status" "cashier_session_status" DEFAULT 'open' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "cashier_sessions" ADD CONSTRAINT "cashier_sessions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "cashier_sessions" ADD CONSTRAINT "cashier_sessions_cashier_id_user_id_fk" FOREIGN KEY ("cashier_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;

CREATE INDEX "cashier_sessions_tenant_cashier_idx" ON "cashier_sessions" USING btree ("tenant_id","cashier_id");
CREATE INDEX "cashier_sessions_status_idx" ON "cashier_sessions" USING btree ("status");
