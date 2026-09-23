-- Migration: 0147_matricule_tenant_scope.sql
-- Matricules are per-school identifiers: two tenants may both legitimately
-- hold "STD-2026-0001". The global unique constraint on "user".matricule made
-- one leftover row in any tenant permanently block every other school's first
-- reservation (root cause of the deterministic 409 in the gate2 behavioral
-- suite). Scope the uniqueness to the tenant.
-- Hand-written, forward-only, idempotent.

ALTER TABLE "user" DROP CONSTRAINT IF EXISTS "user_matricule_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "user_tenant_matricule_unique"
  ON "user" ("tenant_id", "matricule");
