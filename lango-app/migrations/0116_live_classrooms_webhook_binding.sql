-- Live Classrooms add-on hardening (P1-4 webhook provider binding).
-- Hand-written (never drizzle-kit generate). Idempotent: safe to rerun.
--
-- Adds a per-profile webhook-secret reference so webhook signature
-- verification is bound to the SPECIFIC provider profile the delivery claims
-- to be for, never a single global provider-wide secret. Mirrors the
-- existing credential_ref convention: this column stores a reference key
-- name (or a clearly-labeled dev value) resolved from env at verification
-- time — the raw secret value is never persisted in this column.

--> statement-breakpoint
ALTER TABLE "live_class_provider_profiles" ADD COLUMN IF NOT EXISTS "webhook_secret_ref" varchar(120);
