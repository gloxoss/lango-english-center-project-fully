-- ENH-ADMIN-DASH-01 per-branch reference values for the manual test guide
WITH atlas AS (
  SELECT '9c496194-2fcc-41f3-ad8a-fd728850f168'::uuid AS t,
         'a5d6ddc6-db50-4872-8c8f-271ba6693bc5'::uuid AS siege,
         '85a226a2-dc24-463a-898c-47bbde0aaf8d'::uuid AS maarif
), scope AS (
  SELECT atlas.t, atlas.siege, atlas.maarif, u.id AS uid, u.branch_id AS bid
  FROM "user" u CROSS JOIN atlas
  WHERE u.tenant_id = atlas.t AND u.role = 'student' AND u.user_status = 'active'
)
SELECT 'active_students' AS metric,
  count(*) FILTER (WHERE bid = siege) AS siege,
  count(*) FILTER (WHERE bid = maarif) AS maarif,
  count(*) AS total
FROM scope
UNION ALL
SELECT 'payments_count', count(*) FILTER (WHERE s.bid = siege), count(*) FILTER (WHERE s.bid = maarif), count(*)
FROM payments p JOIN scope s ON s.uid = p.student_id
WHERE p.tenant_id = (SELECT t FROM atlas)
UNION ALL
SELECT 'payments_amount', 0,0,0
UNION ALL
SELECT 'invoices_count', count(*) FILTER (WHERE s.bid = siege), count(*) FILTER (WHERE s.bid = maarif), count(*)
FROM invoices i JOIN scope s ON s.uid = i.student_id
WHERE i.tenant_id = (SELECT t FROM atlas)
UNION ALL
SELECT 'today_attendance_marks', count(*) FILTER (WHERE s.bid = siege), count(*) FILTER (WHERE s.bid = maarif), count(*)
FROM attendance a JOIN scope s ON s.uid = a.student_id
WHERE a.tenant_id = (SELECT t FROM atlas) AND a.date = current_date AND a.is_voided = false;

-- amounts
WITH atlas AS (
  SELECT '9c496194-2fcc-41f3-ad8a-fd728850f168'::uuid AS t,
         'a5d6ddc6-db50-4872-8c8f-271ba6693bc5'::uuid AS siege,
         '85a226a2-dc24-463a-898c-47bbde0aaf8d'::uuid AS maarif
), scope AS (
  SELECT atlas.t, atlas.siege, atlas.maarif, u.id AS uid, u.branch_id AS bid
  FROM "user" u CROSS JOIN atlas
  WHERE u.tenant_id = atlas.t AND u.role = 'student' AND u.user_status = 'active'
)
SELECT 'payments_mad' AS metric,
  round(sum(p.amount) FILTER (WHERE s.bid = siege))::text AS siege,
  round(sum(p.amount) FILTER (WHERE s.bid = maarif))::text AS maarif,
  round(sum(p.amount))::text AS total
FROM payments p JOIN scope s ON s.uid = p.student_id
WHERE p.tenant_id = (SELECT t FROM atlas)
UNION ALL
SELECT 'invoiced_net_mad',
  round(sum(i.net_amount) FILTER (WHERE s.bid = siege))::text,
  round(sum(i.net_amount) FILTER (WHERE s.bid = maarif))::text,
  round(sum(i.net_amount))::text
FROM invoices i JOIN scope s ON s.uid = i.student_id
WHERE i.tenant_id = (SELECT t FROM atlas)
UNION ALL
SELECT 'outstanding_mad',
  round(sum(greatest(i.net_amount - i.paid_amount,0)) FILTER (WHERE s.bid = siege))::text,
  round(sum(greatest(i.net_amount - i.paid_amount,0)) FILTER (WHERE s.bid = maarif))::text,
  round(sum(greatest(i.net_amount - i.paid_amount,0)))::text
FROM invoices i JOIN scope s ON s.uid = i.student_id
WHERE i.tenant_id = (SELECT t FROM atlas)
  AND i.status IN ('pending','partial','overdue');

-- attendance states today
WITH atlas AS (
  SELECT '9c496194-2fcc-41f3-ad8a-fd728850f168'::uuid AS t,
         'a5d6ddc6-db50-4872-8c8f-271ba6693bc5'::uuid AS siege,
         '85a226a2-dc24-463a-898c-47bbde0aaf8d'::uuid AS maarif
), scope AS (
  SELECT atlas.siege, atlas.maarif, u.id AS uid, u.branch_id AS bid
  FROM "user" u CROSS JOIN atlas
  WHERE u.tenant_id = atlas.t AND u.role = 'student' AND u.user_status = 'active'
)
SELECT a.status, count(*) FILTER (WHERE s.bid = siege) AS siege, count(*) FILTER (WHERE s.bid = maarif) AS maarif
FROM attendance a JOIN scope s ON s.uid = a.student_id
WHERE a.tenant_id = (SELECT t FROM atlas) AND a.date = current_date AND a.is_voided = false
GROUP BY a.status;

-- sections expected vs marked today (for attendance completeness truth)
SELECT c.name, c.branch_id = 'a5d6ddc6-db50-4872-8c8f-271ba6693bc5' AS is_siege,
  (SELECT count(DISTINCT a.class_section_id) FROM attendance a
    JOIN "user" u2 ON u2.id = a.student_id
    JOIN class_sections cs2 ON cs2.id = u2.class_section_id
    WHERE cs2.class_id = c.id AND a.date = current_date AND a.is_voided = false) AS sections_marked
FROM classes c
WHERE c.tenant_id = '9c496194-2fcc-41f3-ad8a-fd728850f168';
