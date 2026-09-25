-- 0166_scanner_device_identity.sql — A PAIRED DEVICE IS AN IDENTITY, NOT A ROW.
--
-- scanner_devices held a `secret_key` that was generated at pairing, stored in
-- PLAIN TEXT, returned once, and then never used: no scan route authenticated a
-- device, and last_seen_at was never updated. "Paired terminals" were decorative,
-- so any authenticated operator could scan as any device, from any branch, for
-- any class.
--
-- A device is now something that can prove it is itself:
--   * the secret is stored as a HASH — the raw value exists only in the pairing
--     response, exactly like a badge token (see identity_badge_credentials);
--   * `status` replaces the boolean-only `is_disabled`, so a device can be
--     disabled temporarily or revoked permanently;
--   * `room_label` optionally binds a fixed kiosk to a room, so a classroom
--     kiosk can resolve its own session instead of being told;
--   * `last_seen_at` becomes meaningful once devices actually report in.
--
-- ADDITIVE AND NON-DESTRUCTIVE: four nullable/defaulted columns are added and no
-- existing column is dropped or rewritten. `secret_key` is left in place so
-- nothing breaks mid-deploy; it is simply no longer read.
--
-- CONSEQUENCE, deliberate: existing device rows have no secret_hash, so they
-- cannot authenticate and must be re-paired. That is the correct direction to
-- fail — a device we cannot identify is not a device we should trust. The old
-- plaintext `secret_key` values were never verifiable anyway.
--
-- Hand-written, forward-only, idempotent.

ALTER TABLE "scanner_devices" ADD COLUMN IF NOT EXISTS "secret_hash" text;--> statement-breakpoint
ALTER TABLE "scanner_devices" ADD COLUMN IF NOT EXISTS "secret_prefix" varchar(12);--> statement-breakpoint
ALTER TABLE "scanner_devices" ADD COLUMN IF NOT EXISTS "room_label" varchar(100);--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "scanner_devices"
    ADD COLUMN "status" varchar(20) NOT NULL DEFAULT 'active';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;--> statement-breakpoint

-- A hashed secret must be unique per tenant: two devices sharing a hash would be
-- indistinguishable, which is the same as having no identity at all.
CREATE UNIQUE INDEX IF NOT EXISTS "scanner_devices_secret_hash_unique"
  ON "scanner_devices" ("secret_hash")
  WHERE "secret_hash" IS NOT NULL;--> statement-breakpoint

-- The authentication lookup: device presents a secret, we hash it and find the row.
CREATE INDEX IF NOT EXISTS "scanner_devices_tenant_hash_idx"
  ON "scanner_devices" ("tenant_id", "secret_hash");--> statement-breakpoint

-- Keep the boolean in step with the new status so nothing reading is_disabled
-- silently disagrees with what the API enforces.
UPDATE "scanner_devices" SET "is_disabled" = true WHERE "status" <> 'active';
