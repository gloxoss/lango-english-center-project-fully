-- §12.7 Backfill: withdraw orphaned library copies whose parent bibliographic
-- record has been soft-deleted (library_bibliographic_records.deleted_at IS NOT
-- NULL) but whose copy still counts as available/loaned. Prevents ghost copies
-- from inflating libraryOverview totals and from being circulated.
-- Hand-written (never drizzle-kit generate). Idempotent: safe to rerun — only
-- touches copies still in a non-withdrawn state.

--> statement-breakpoint
UPDATE "library_copies" AS c
SET "state" = 'withdrawn',
    "withdrawn_at" = now(),
    "updated_at" = now()
FROM "library_editions" AS e
JOIN "library_bibliographic_records" AS r ON r."id" = e."record_id"
WHERE c."edition_id" = e."id"
  AND r."deleted_at" IS NOT NULL
  AND c."state" <> 'withdrawn';
