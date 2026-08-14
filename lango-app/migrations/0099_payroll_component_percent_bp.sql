-- 0099_payroll_component_percent_bp
--
-- Additive, forward-only, tenant-safe fix for the versioned salary-component
-- schema. `salary_component_versions` stores `percent_of` but no basis-point
-- rate, so percent-type components could not carry their rate into the typed
-- expression engine (which computes `cents * bp / 10000`). This column lets a
-- percent component declare its rate (1% = 100 bp) next to its base key.
--
-- Safe to re-run; does not rewrite or drop any prior migration.

ALTER TABLE "salary_component_versions" ADD COLUMN IF NOT EXISTS "percent_bp" integer;
