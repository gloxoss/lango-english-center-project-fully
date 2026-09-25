-- ENH-ADMIN-DASH-01 P0 branch provenance (tenant: Atlas)
WITH atlas AS (
  SELECT '9c496194-2fcc-41f3-ad8a-fd728850f168'::uuid AS t,
         'a5d6ddc6-db50-4872-8c8f-271ba6693bc5'::uuid AS siege,
         '85a226a2-dc24-463a-898c-47bbde0aaf8d'::uuid AS maarif
)
SELECT 'user.students' AS entity, count(*) AS total,
  count(*) FILTER (WHERE u.branch_id = atlas.siege) AS siege,
  count(*) FILTER (WHERE u.branch_id = atlas.maarif) AS maarif,
  count(*) FILTER (WHERE u.branch_id IS NULL) AS null_branch,
  count(*) FILTER (WHERE u.branch_id IS NOT NULL AND u.branch_id NOT IN (atlas.siege, atlas.maarif)) AS other_id
FROM "user" u
CROSS JOIN atlas
WHERE u.tenant_id = atlas.t AND u.role = 'student'
UNION ALL
SELECT 'user.staff', count(*),
  count(*) FILTER (WHERE u.branch_id = atlas.siege),
  count(*) FILTER (WHERE u.branch_id = atlas.maarif),
  count(*) FILTER (WHERE u.branch_id IS NULL),
  count(*) FILTER (WHERE u.branch_id IS NOT NULL AND u.branch_id NOT IN (atlas.siege, atlas.maarif))
FROM "user" u
CROSS JOIN atlas
WHERE u.tenant_id = atlas.t AND u.role NOT IN ('student','parent','alumni')
UNION ALL
SELECT 'user.all_roles', count(*),
  count(*) FILTER (WHERE u.branch_id = atlas.siege),
  count(*) FILTER (WHERE u.branch_id = atlas.maarif),
  count(*) FILTER (WHERE u.branch_id IS NULL),
  count(*) FILTER (WHERE u.branch_id IS NOT NULL AND u.branch_id NOT IN (atlas.siege, atlas.maarif))
FROM "user" u
CROSS JOIN atlas
WHERE u.tenant_id = atlas.t
UNION ALL
SELECT 'classes', count(*),
  count(*) FILTER (WHERE c.branch_id = atlas.siege),
  count(*) FILTER (WHERE c.branch_id = atlas.maarif),
  count(*) FILTER (WHERE c.branch_id IS NULL),
  count(*) FILTER (WHERE c.branch_id IS NOT NULL AND c.branch_id NOT IN (atlas.siege, atlas.maarif))
FROM classes c
CROSS JOIN atlas
WHERE c.tenant_id = atlas.t
UNION ALL
SELECT 'class_sections', count(*),
  count(*) FILTER (WHERE c.branch_id = atlas.siege),
  count(*) FILTER (WHERE c.branch_id = atlas.maarif),
  count(*) FILTER (WHERE c.branch_id IS NULL),
  0
FROM class_sections cs
JOIN classes c ON c.id = cs.class_id
CROSS JOIN atlas
WHERE cs.tenant_id = atlas.t
UNION ALL
SELECT 'invoices', count(*),
  count(*) FILTER (WHERE u.branch_id = atlas.siege),
  count(*) FILTER (WHERE u.branch_id = atlas.maarif),
  count(*) FILTER (WHERE u.branch_id IS NULL),
  count(*) FILTER (WHERE u.branch_id IS NOT NULL AND u.branch_id NOT IN (atlas.siege, atlas.maarif))
FROM invoices i
JOIN "user" u ON u.id = i.student_id
CROSS JOIN atlas
WHERE i.tenant_id = atlas.t
UNION ALL
SELECT 'payments', count(*),
  count(*) FILTER (WHERE u.branch_id = atlas.siege),
  count(*) FILTER (WHERE u.branch_id = atlas.maarif),
  count(*) FILTER (WHERE u.branch_id IS NULL),
  count(*) FILTER (WHERE u.branch_id IS NOT NULL AND u.branch_id NOT IN (atlas.siege, atlas.maarif))
FROM payments p
JOIN "user" u ON u.id = p.student_id
CROSS JOIN atlas
WHERE p.tenant_id = atlas.t
UNION ALL
SELECT 'attendance', count(*),
  count(*) FILTER (WHERE u.branch_id = atlas.siege),
  count(*) FILTER (WHERE u.branch_id = atlas.maarif),
  count(*) FILTER (WHERE u.branch_id IS NULL),
  0
FROM attendance a
JOIN "user" u ON u.id = a.student_id
CROSS JOIN atlas
WHERE a.tenant_id = atlas.t
UNION ALL
SELECT 'events.published', count(*),
  0, 0, count(*) FILTER (WHERE e.branch_id IS NULL),
  count(*) FILTER (WHERE e.branch_id IS NOT NULL)
FROM events e
CROSS JOIN atlas
WHERE e.tenant_id = atlas.t::text AND e.lifecycle = 'published'::event_lifecycle_status
UNION ALL
SELECT 'admissions', count(*),
  count(*) FILTER (WHERE ad.branch_id = atlas.siege),
  count(*) FILTER (WHERE ad.branch_id = atlas.maarif),
  count(*) FILTER (WHERE ad.branch_id IS NULL),
  0
FROM applicants ad
CROSS JOIN atlas
WHERE ad.tenant_id = atlas.t;
