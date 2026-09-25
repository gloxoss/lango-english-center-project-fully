-- ENH-ADMIN-DASH-01 P0 data fix: assign Atlas rows to real branches.
-- Root cause: seed created every user/class without branch_id, so any
-- per-branch dashboard query (eq(user.branchId, ...)) returned zero rows.
-- Plan (class-level assignment drives everything else):
--   Siège - Casablanca : classes 1ère, 2nde, Terminale      -> 149 students
--   Annexe Maarif      : class  3ème                        ->  51 students
-- Staff and applicants distributed deterministically.
BEGIN;

UPDATE classes
SET branch_id = '85a226a2-dc24-463a-898c-47bbde0aaf8d'::uuid   -- Annexe Maarif
WHERE tenant_id = '9c496194-2fcc-41f3-ad8a-fd728850f168'
  AND name = '3ème';

UPDATE classes
SET branch_id = 'a5d6ddc6-db50-4872-8c8f-271ba6693bc5'::uuid   -- Siège
WHERE tenant_id = '9c496194-2fcc-41f3-ad8a-fd728850f168'
  AND name IN ('1ère', '2nde', 'Terminale');

-- Students + any user with a class section follow their class's branch.
UPDATE "user" u
SET branch_id = c.branch_id
FROM class_sections cs
JOIN classes c ON c.id = cs.class_id
WHERE u.class_section_id = cs.id
  AND u.tenant_id = '9c496194-2fcc-41f3-ad8a-fd728850f168'
  AND u.branch_id IS NULL;

-- Staff without a section: ~every 4th to Maarif, rest to Siège.
WITH ranked AS (
  SELECT u.id, row_number() OVER (ORDER BY u.id) AS rn
  FROM "user" u
  WHERE u.tenant_id = '9c496194-2fcc-41f3-ad8a-fd728850f168'
    AND u.branch_id IS NULL
    AND u.role NOT IN ('student')
)
UPDATE "user" u
SET branch_id = CASE WHEN ranked.rn % 4 = 0
  THEN '85a226a2-dc24-463a-898c-47bbde0aaf8d'::uuid
  ELSE 'a5d6ddc6-db50-4872-8c8f-271ba6693bc5'::uuid END
FROM ranked
WHERE ranked.id = u.id;

-- Applicants: 13 Siège / 7 Maarif.
WITH ranked AS (
  SELECT ad.id, row_number() OVER (ORDER BY ad.application_date, ad.id) AS rn
  FROM applicants ad
  WHERE ad.tenant_id = '9c496194-2fcc-41f3-ad8a-fd728850f168'
    AND ad.branch_id IS NULL
)
UPDATE applicants ad
SET branch_id = CASE WHEN ranked.rn % 3 = 0
  THEN '85a226a2-dc24-463a-898c-47bbde0aaf8d'::uuid
  ELSE 'a5d6ddc6-db50-4872-8c8f-271ba6693bc5'::uuid END
FROM ranked
WHERE ranked.id = ad.id;

COMMIT;

-- Verification: totals must reconcile.
WITH atlas AS (
  SELECT '9c496194-2fcc-41f3-ad8a-fd728850f168'::uuid AS t,
         'a5d6ddc6-db50-4872-8c8f-271ba6693bc5'::uuid AS siege,
         '85a226a2-dc24-463a-898c-47bbde0aaf8d'::uuid AS maarif
)
SELECT 'students' AS metric,
  count(*) FILTER (WHERE u.branch_id = atlas.siege) AS siege,
  count(*) FILTER (WHERE u.branch_id = atlas.maarif) AS maarif,
  count(*) FILTER (WHERE u.branch_id IS NULL) AS unassigned,
  count(*) AS total
FROM "user" u CROSS JOIN atlas
WHERE u.tenant_id = atlas.t AND u.role = 'student' AND u.user_status = 'active'
UNION ALL
SELECT 'staff',
  count(*) FILTER (WHERE u.branch_id = atlas.siege),
  count(*) FILTER (WHERE u.branch_id = atlas.maarif),
  count(*) FILTER (WHERE u.branch_id IS NULL),
  count(*)
FROM "user" u CROSS JOIN atlas
WHERE u.tenant_id = atlas.t AND u.role NOT IN ('student','parent','alumni')
UNION ALL
SELECT 'classes',
  count(*) FILTER (WHERE c.branch_id = atlas.siege),
  count(*) FILTER (WHERE c.branch_id = atlas.maarif),
  count(*) FILTER (WHERE c.branch_id IS NULL),
  count(*)
FROM classes c CROSS JOIN atlas
WHERE c.tenant_id = atlas.t
UNION ALL
SELECT 'invoices',
  count(*) FILTER (WHERE u.branch_id = atlas.siege),
  count(*) FILTER (WHERE u.branch_id = atlas.maarif),
  count(*) FILTER (WHERE u.branch_id IS NULL),
  count(*)
FROM invoices i JOIN "user" u ON u.id = i.student_id CROSS JOIN atlas
WHERE i.tenant_id = atlas.t
UNION ALL
SELECT 'applicants',
  count(*) FILTER (WHERE ad.branch_id = atlas.siege),
  count(*) FILTER (WHERE ad.branch_id = atlas.maarif),
  count(*) FILTER (WHERE ad.branch_id IS NULL),
  count(*)
FROM applicants ad CROSS JOIN atlas
WHERE ad.tenant_id = atlas.t;

-- Director stays tenant-wide (branch-pinned admins would be confined by the API).
