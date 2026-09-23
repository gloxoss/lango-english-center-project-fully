-- 0143_platform_support_tickets.sql
-- Hand-written, forward-only, idempotent.
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "platform_support_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"school_name" varchar(255) NOT NULL,
	"subject" varchar(255) NOT NULL,
	"category" varchar(50) NOT NULL,
	"priority" varchar(20) NOT NULL,
	"status" varchar(20) DEFAULT 'new' NOT NULL,
	"contact_name" varchar(255) NOT NULL,
	"contact_email" varchar(255) NOT NULL,
	"last_message" text NOT NULL,
	"messages_count" integer DEFAULT 1 NOT NULL,
	"assigned_to" varchar(255),
	"first_responded_at" timestamp,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "platform_support_tickets_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_support_tickets_tenant_id_idx" ON "platform_support_tickets" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_support_tickets_status_idx" ON "platform_support_tickets" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_support_tickets_priority_idx" ON "platform_support_tickets" ("priority");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_support_tickets_category_idx" ON "platform_support_tickets" ("category");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "platform_support_ticket_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"sender_type" varchar(20) NOT NULL,
	"sender_name" varchar(255) NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "platform_support_ticket_messages_ticket_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "platform_support_tickets"("id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_support_ticket_messages_ticket_id_idx" ON "platform_support_ticket_messages" ("ticket_id");
