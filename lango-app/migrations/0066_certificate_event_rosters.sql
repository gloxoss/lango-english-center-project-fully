DO $$ BEGIN
 CREATE TYPE "public"."certificate_event_roster_status" AS ENUM('going', 'attended', 'not_going');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "certificate_event_rosters" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "event_name" varchar(255) NOT NULL,
  "participant_id" varchar(255) NOT NULL,
  "status" "certificate_event_roster_status" DEFAULT 'attended' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "certificate_event_rosters" ADD CONSTRAINT "certificate_event_rosters_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "certificate_event_rosters_tenant_idx" ON "certificate_event_rosters" ("tenant_id");
CREATE UNIQUE INDEX IF NOT EXISTS "certificate_event_rosters_tenant_event_participant_idx" ON "certificate_event_rosters" ("tenant_id","event_name","participant_id");
