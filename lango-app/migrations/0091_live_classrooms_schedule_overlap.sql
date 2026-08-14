-- 0091_live_classrooms_schedule_overlap.sql
--
-- P1-2: make schedule-overlap protection DB-authoritative.
--
-- `assertNoLiveSessionOverlap` in session-service is a friendly pre-check only;
-- it is NOT concurrency-safe (two concurrent INSERTs can both pass the read and
-- then both commit). These EXCLUDE constraints make the database the final
-- arbiter: a conflicting insert/update aborts with SQLSTATE 23P01
-- (exclusion_violation), which session-service maps to HTTP 409
-- LIVE_SESSION_CONFLICT.
--
-- Two constraint families, both tenant-scoped and both limited to active
-- statuses (draft/scheduled/waiting/live/failed/expired block a slot;
-- cancelled/ended free it):
--   1. teacher_overlap  — a teacher cannot teach two sessions whose
--                          [start, end) ranges overlap;
--   2. section_overlap  — a class section cannot host two sessions whose
--                          [start, end) ranges overlap.
-- Range semantics are [start, end): an end at 11:00 and a start at 11:00 do NOT
-- conflict (adjacent sessions are allowed), matching the service pre-check.
--
-- btree_gist lets plain uuid/text equality participate in the GiST exclusion
-- index. If pre-existing overlapping rows exist, these statements FAIL loudly
-- instead of silently deleting or renumbering production data; resolve the
-- conflicts manually before applying.
--
-- NOTE: class_section_id is nullable; NULL never equals anything in a GiST
-- equality, so the section constraint only protects rows that actually carry a
-- class section (which the application requires for scheduled sessions).

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE live_class_sessions
  ADD CONSTRAINT live_class_sessions_teacher_overlap_excl
  EXCLUDE USING gist (
    tenant_id WITH =,
    teacher_user_id WITH =,
    tsrange(scheduled_start, scheduled_end, '[)') WITH &&
  )
  WHERE (status NOT IN ('cancelled', 'ended'));

ALTER TABLE live_class_sessions
  ADD CONSTRAINT live_class_sessions_section_overlap_excl
  EXCLUDE USING gist (
    tenant_id WITH =,
    class_section_id WITH =,
    tsrange(scheduled_start, scheduled_end, '[)') WITH &&
  )
  WHERE (status NOT IN ('cancelled', 'ended'));

COMMENT ON CONSTRAINT live_class_sessions_teacher_overlap_excl ON live_class_sessions IS
  'A teacher cannot have two overlapping live-class sessions (exclusion_violation 23P01 -> 409 LIVE_SESSION_CONFLICT).';
COMMENT ON CONSTRAINT live_class_sessions_section_overlap_excl ON live_class_sessions IS
  'A class section cannot host two overlapping live-class sessions (exclusion_violation 23P01 -> 409 LIVE_SESSION_CONFLICT).';
