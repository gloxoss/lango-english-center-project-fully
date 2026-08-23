-- Reconcile seeded timetable double-bookings (PRODUCT-REVIEW-AND-FIXES.md §6.11).
--
-- Root cause: the class_schedule_slots seed scheduled the same subject teacher
-- across all four classes at the same day/time (8+d:00). The same teacher was
-- therefore double-booked on up to four class-sections simultaneously, and the
-- shared room label collided too. The seed (seed-full.ts) now staggers each
-- class's start time by its index; this script applies the identical fix to an
-- already-seeded database so the live dev data matches.
--
-- Idempotent: re-running simply recomputes the same staggered times.
--
-- Usage:  docker exec -i schoolos-db psql -U schoolos -d schoolos < scripts/reconcile-timetable-conflicts.sql

BEGIN;

UPDATE class_schedule_slots s
SET
  start_time = lpad((split_part(s.start_time, ':', 1)::int + ord.ord)::text, 2, '0') || ':' || split_part(s.start_time, ':', 2),
  end_time   = lpad((split_part(s.end_time,   ':', 1)::int + ord.ord)::text, 2, '0') || ':' || split_part(s.end_time,   ':', 2),
  updated_at = now()
FROM class_sections cs
JOIN classes c ON c.id = cs.class_id
JOIN (VALUES
  ('3ème',      0),
  ('2nde',      1),
  ('1ère',      2),
  ('Terminale', 3)
) AS ord(name, ord) ON ord.name = c.name
WHERE s.class_section_id = cs.id
  AND c.name IN ('3ème', '2nde', '1ère', 'Terminale');

COMMIT;
