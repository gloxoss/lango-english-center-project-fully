-- 0166_session_year_guards.sql — AT MOST ONE CURRENT YEAR, NO OVERLAPPING YEARS.
--
-- SETTINGS-CORE-FIX-01 SCF-02-02 (plan invariant 2). "Which year is current"
-- was two rules in the app (the flagged `is_default` row, and the row whose
-- date range contains today) and NO rule in the database: a second default row
-- or two overlapping years were both accepted silently. The app now reads
-- `is_default` through one helper (libs/services/school-year.ts); these two
-- constraints are what make that answer unambiguous.
--
-- PRE-CHECK — run this before applying. Both queries must return 0 rows:
--
--   SELECT tenant_id, count(*) FROM session_years WHERE is_default
--     GROUP BY tenant_id HAVING count(*) > 1;
--
--   SELECT a.tenant_id, a.name, b.name FROM session_years a
--     JOIN session_years b ON a.tenant_id = b.tenant_id AND a.id < b.id
--    WHERE daterange(a.start_date, a.end_date, '[]')
--       && daterange(b.start_date, b.end_date, '[]');
--
-- Verified 0 rows on schoolos_audit, schoolos (dev) and the VPS on 2026-09-25.
-- The DO block below re-runs both checks and RAISES rather than repairing: a
-- school with two overlapping years has a real scheduling decision to make,
-- and silently rewriting a date range would move students between years.
--
-- Both statements are idempotent — re-running the migration is a no-op.
-- No row is written, updated or deleted, and no trigger is bypassed.

DO $$
DECLARE
  dup_defaults int;
  overlap_pairs int;
BEGIN
  SELECT count(*) INTO dup_defaults
  FROM (
    SELECT tenant_id FROM session_years WHERE is_default GROUP BY tenant_id HAVING count(*) > 1
  ) d;

  IF dup_defaults > 0 THEN
    RAISE EXCEPTION
      '0166: % tenant(s) have more than one default session year. Clear the extra flag (keep exactly one is_default), then re-run.',
      dup_defaults;
  END IF;

  SELECT count(*) INTO overlap_pairs
  FROM session_years a
  JOIN session_years b
    ON a.tenant_id = b.tenant_id
   AND a.id < b.id
   AND daterange(a.start_date, a.end_date, '[]') && daterange(b.start_date, b.end_date, '[]');

  IF overlap_pairs > 0 THEN
    RAISE EXCEPTION
      '0166: % overlapping session-year pair(s). Correct the date ranges first — this migration will not guess which year a student belongs to.',
      overlap_pairs;
  END IF;
END $$;

-- One current year per tenant. Partial index: only the flagged row is unique.
CREATE UNIQUE INDEX IF NOT EXISTS session_years_one_default_per_tenant
  ON session_years (tenant_id)
  WHERE is_default;

-- No two years of the same tenant may cover the same day. '[)' vs '[]' does
-- not matter here: the app compares dates inclusively
-- (start_date <= today AND end_date >= today), so '[]' is the honest range.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'session_years_no_overlap'
      AND conrelid = 'session_years'::regclass
  ) THEN
    ALTER TABLE session_years
      ADD CONSTRAINT session_years_no_overlap
      EXCLUDE USING gist (tenant_id WITH =, daterange(start_date, end_date, '[]') WITH &&);
  END IF;
END $$;
