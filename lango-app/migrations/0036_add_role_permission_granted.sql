-- role_permissions could only express "granted"; the mere existence of a row
-- meant yes. That made it impossible for a school to revoke a default
-- permission from a role, which is the main thing the table is for.
--
-- Defaults to true so every pre-existing row keeps its current meaning.
ALTER TABLE "role_permissions" ADD COLUMN "granted" boolean DEFAULT true NOT NULL;
