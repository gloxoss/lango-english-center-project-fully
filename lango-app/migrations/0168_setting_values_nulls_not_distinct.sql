-- 0168_setting_values_nulls_not_distinct.sql — TENANT-WIDE KEYS ARE UNIQUE TOO.
--
-- SETTINGS-CORE-FIX-01 SCF-10-02. `setting_values` is unique on
-- (tenant_id, branch_id, key), but Postgres treats NULLs as distinct by
-- default and a tenant-wide row has branch_id IS NULL. So the constraint did
-- not cover the commonest case: two tenant-wide rows for the same key could
-- both exist, and every reader would then get whichever row the planner
-- returned. In practice the write path upserts, which is why no duplicate
-- exists today — the database was simply not the thing preventing it.
--
-- NULLS NOT DISTINCT (Postgres 15+; dev and VPS run 17) closes that.
--
-- PRE-CHECK — must return 0 rows before applying:
--   SELECT tenant_id, key, count(*) FROM setting_values
--    WHERE branch_id IS NULL GROUP BY tenant_id, key HAVING count(*) > 1;
--
-- Verified 0 rows on schoolos_audit and schoolos (dev) on 2026-09-25. The DO
-- block re-runs it and RAISEs rather than repairing: two tenant-wide rows for
-- one key means the school has two contradictory answers and only a human can
-- say which one is real.
--
-- The old UNIQUE CONSTRAINT is replaced by an equivalent unique INDEX — that
-- is the only way to express NULLS NOT DISTINCT. No row is read, written or
-- deleted. Idempotent: guarded on the index name, so a re-run is a no-op.

DO $$
DECLARE
  dupe_groups int;
BEGIN
  SELECT count(*) INTO dupe_groups
  FROM (
    SELECT tenant_id, key
    FROM setting_values
    WHERE branch_id IS NULL
    GROUP BY tenant_id, key
    HAVING count(*) > 1
  ) d;

  IF dupe_groups > 0 THEN
    RAISE EXCEPTION
      '0168: % tenant-wide setting key(s) have more than one row. Decide which value is correct and delete the other, then re-run.',
      dupe_groups;
  END IF;
END $$;

ALTER TABLE setting_values
  DROP CONSTRAINT IF EXISTS setting_values_tenant_branch_key_unique;

CREATE UNIQUE INDEX IF NOT EXISTS setting_values_tenant_branch_key_unique
  ON setting_values (tenant_id, branch_id, key) NULLS NOT DISTINCT;
