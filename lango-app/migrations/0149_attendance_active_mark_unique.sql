-- 0149_attendance_active_mark_unique.sql — ONE AUTHORITATIVE ACTIVE MARK.
--
-- Roll-call previously used delete+insert per student, with no database-level
-- uniqueness: concurrent submissions could create duplicate active marks.
-- This migration establishes one authoritative active mark per
-- (tenant, student, date, period, class_section) — section-scoped rows only.
--
-- Duplicate reconciliation (safety net; 0 groups found in the acceptance
-- database at authoring time): the LATEST row by (updated_at, created_at, id)
-- is kept; older duplicates are VOIDED with an explicit reason — never
-- deleted, so conflicting historical evidence stays answerable.
--
-- Legacy NULL-section rows are excluded: their historical section identity is
-- unknowable and PostgreSQL treats NULLs as distinct anyway. New writes always
-- carry a section (strict context enforcement in the API).
--
-- Hand-written, forward-only, idempotent.

WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY tenant_id, student_id, date, period, class_section_id
           ORDER BY updated_at DESC NULLS LAST, created_at DESC, id DESC
         ) AS rn
  FROM attendance
  WHERE is_voided = false
    AND class_section_id IS NOT NULL
)
UPDATE attendance
SET is_voided = true,
    void_reason = 'Deduplicated by migration 0149 (duplicate active mark; latest kept)',
    updated_at = now()
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS attendance_active_mark_unique
  ON attendance (tenant_id, student_id, date, period, class_section_id)
  WHERE is_voided = false AND class_section_id IS NOT NULL;
