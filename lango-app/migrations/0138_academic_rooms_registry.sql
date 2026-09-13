-- 0138_academic_rooms_registry.sql — promotes academic_rooms from a name/capacity
-- stub to the real room registry that backs the Salles screen. The UI used to
-- invent building, floor, code and equipment client-side (MOCK_ROOMS); these are
-- the columns that let it stop.
--
-- No occupancy column on purpose: whether a room is busy right now is derived
-- from class_schedule_slots at read time so it cannot drift from the timetable.
-- `status` is only the admin decision to pull a room out of service.
-- Hand-written, forward-only, idempotent.
--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "academic_room_status" AS ENUM ('available', 'maintenance');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
ALTER TABLE "academic_rooms" ADD COLUMN IF NOT EXISTS "code" varchar(50);
--> statement-breakpoint
ALTER TABLE "academic_rooms" ADD COLUMN IF NOT EXISTS "building" varchar(100);
--> statement-breakpoint
ALTER TABLE "academic_rooms" ADD COLUMN IF NOT EXISTS "floor" varchar(50);
--> statement-breakpoint
ALTER TABLE "academic_rooms" ADD COLUMN IF NOT EXISTS "equipment" text[] DEFAULT '{}'::text[] NOT NULL;
--> statement-breakpoint
ALTER TABLE "academic_rooms" ADD COLUMN IF NOT EXISTS "status" "academic_room_status" DEFAULT 'available' NOT NULL;
--> statement-breakpoint
-- Codes are optional, so the uniqueness guarantee is partial: two rooms may both
-- have no code, but two rooms in one tenant may not share a code.
CREATE UNIQUE INDEX IF NOT EXISTS "academic_rooms_tenant_code_unique"
  ON "academic_rooms" ("tenant_id", "code") WHERE "code" IS NOT NULL;
