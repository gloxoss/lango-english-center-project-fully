-- Role Portals Foundation — session/user referential integrity (core feature)
-- Hand-written (never drizzle-kit generate). Idempotent: safe to rerun.
-- Binds portal_active_contexts to the real authenticated session and user, and
-- portal_preferences / portal_activity_events to their user, so a deleted
-- session or user can never strand a portal row that a later request would
-- re-read as an active context. Existing orphans are purged first so the FK
-- can be added over current data. See
-- future-implementation/role-portals-foundation/.implementation-plan/PLAN.md.

--> statement-breakpoint
DELETE FROM "portal_active_contexts" pac
WHERE NOT EXISTS (SELECT 1 FROM "user" u WHERE u."id" = pac."user_id")
   OR NOT EXISTS (SELECT 1 FROM "session" s WHERE s."id" = pac."session_id");
--> statement-breakpoint
DELETE FROM "portal_preferences" pp
WHERE NOT EXISTS (SELECT 1 FROM "user" u WHERE u."id" = pp."user_id");
--> statement-breakpoint
DELETE FROM "portal_activity_events" pae
WHERE NOT EXISTS (SELECT 1 FROM "user" u WHERE u."id" = pae."user_id");
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "portal_active_contexts" ADD CONSTRAINT "portal_active_contexts_user_id_user_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "portal_active_contexts" ADD CONSTRAINT "portal_active_contexts_session_id_session_fk" FOREIGN KEY ("session_id") REFERENCES "public"."session"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "portal_preferences" ADD CONSTRAINT "portal_preferences_user_id_user_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object OR duplicate_table THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "portal_activity_events" ADD CONSTRAINT "portal_activity_events_user_id_user_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object OR duplicate_table THEN null;
END $$;
