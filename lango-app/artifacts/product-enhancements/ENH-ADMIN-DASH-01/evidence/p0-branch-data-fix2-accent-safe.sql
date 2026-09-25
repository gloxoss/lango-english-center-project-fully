-- ENH-ADMIN-DASH-01 P0 data fix, pass 2: accent-safe class assignment.
-- Positions by ordered name: 3rd class -> Maarif, all others -> Siège.
BEGIN;

WITH ordered AS (
  SELECT c.id, row_number() OVER (ORDER BY c.name) AS rn
  FROM classes c
  WHERE c.tenant_id = '9c496194-2fcc-41f3-ad8a-fd728850f168'
)
UPDATE classes c
SET branch_id = CASE WHEN o.rn = 3
  THEN '85a226a2-dc24-463a-898c-47bbde0aaf8d'::uuid
  ELSE 'a5d6ddc6-db50-4872-8c8f-271ba6693bc5'::uuid END
FROM ordered o
WHERE o.id = c.id;

UPDATE "user" u
SET branch_id = c.branch_id
FROM class_sections cs
JOIN classes c ON c.id = cs.class_id
WHERE u.class_section_id = cs.id
  AND u.tenant_id = '9c496194-2fcc-41f3-ad8a-fd728850f168'
  AND u.branch_id IS NULL;

COMMIT;

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
SELECT 'classes',
  count(*) FILTER (WHERE c.branch_id = atlas.siege),
  count(*) FILTER (WHERE c.branch_id = atlas.maarif),
  count(*) FILTER (WHERE c.branch_id IS NULL),
  count(*)
FROM classes c CROSS JOIN atlas
WHERE c.tenant_id = atlas.t
UNION ALL
SELECT 'invoices_amount_siege', 0,0,0, 0
UNION ALL
SELECT 'invoices_rows',
  count(*) FILTER (WHERE u.branch_id = atlas.siege),
  count(*) FILTER (WHERE u.branch_id = atlas.maarif),
  count(*) FILTER (WHERE u.branch_id IS NULL),
  count(*)
FROM invoices i JOIN "user" u ON u.id = i.student_id CROSS JOIN atlas
WHERE i.tenant_id = atlas.t;
