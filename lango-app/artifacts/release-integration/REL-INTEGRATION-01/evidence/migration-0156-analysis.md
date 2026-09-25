# Evidence: Migration 0156 Historical Preservation & Replay Safety Analysis

## 1. Migration Overview
- **Campaign**: `AUD-FINANCE-01` (`origin/audit/agent-a/AUD-FINANCE-01-student-billing-cashier`)
- **Commit**: `85f057148e59e5ee956e5d30cbec0eba43fd3773`
- **Migration File**: `lango-app/migrations/0156_fine_assessment_unique.sql`
- **Journal Index**: `idx: 157, version: 7, tag: 0156_fine_assessment_unique` in `_journal.json`
- **Target Base Prior State**: Target base `origin/student-directory-hardening` (`f42c2bc`) ends at `idx: 156, tag: 0155_attendance_rate_nullable`.

---

## 2. Numbering & Collision Check
- **Base Migration Top**: `0155_attendance_rate_nullable.sql`
- **Pending Migration**: `0156_fine_assessment_unique.sql`
- **Collision Assessment**: **ZERO COLLISION**. Tag `0156` sequentially follows `0155`. No other pending branch contains an `0156` or higher migration file.

---

## 3. S-19 Non-Destructive Invariant & Historical Preservation
The core requirement of finding S-19 is:
> *Never delete or drop historical fine assessments. De-duplicate by linking duplicate entries to the authoritative keeper record via `superseded_by_id`, then enforce uniqueness going forward.*

### DDL & Data Transformation Inspection:
```sql
-- 1. Add non-destructive provenance columns
ALTER TABLE "fine_assessments" ADD COLUMN IF NOT EXISTS "superseded_by_id" uuid;
ALTER TABLE "fine_assessments" ADD COLUMN IF NOT EXISTS "superseded_at" timestamp;

-- 2. Idempotent window function linking duplicate assessments to the earliest keeper
WITH ranked AS (
  SELECT "id",
         FIRST_VALUE("id") OVER (PARTITION BY "tenant_id", "invoice_id", "fine_policy_id"
           ORDER BY "assessed_at", "id") AS keeper_id,
         ROW_NUMBER() OVER (PARTITION BY "tenant_id", "invoice_id", "fine_policy_id"
           ORDER BY "assessed_at", "id") AS row_number
  FROM "fine_assessments"
  WHERE "invoice_id" IS NOT NULL
)
UPDATE "fine_assessments" AS assessment
SET "superseded_by_id" = ranked.keeper_id,
    "superseded_at" = now()
FROM ranked
WHERE assessment."id" = ranked."id"
  AND ranked.row_number > 1
  AND assessment."superseded_by_id" IS NULL;

-- 3. Partial unique index protecting future inserts while allowing historical records
DROP INDEX IF EXISTS "fine_assessments_invoice_policy_unique";
CREATE UNIQUE INDEX IF NOT EXISTS "fine_assessments_invoice_policy_unique"
  ON "fine_assessments" ("tenant_id", "invoice_id", "fine_policy_id")
  WHERE "invoice_id" IS NOT NULL AND "superseded_by_id" IS NULL;

-- 4. Foreign key linkage on invoice_items
ALTER TABLE "invoice_items" ADD COLUMN IF NOT EXISTS "fine_assessment_id" uuid;
CREATE UNIQUE INDEX IF NOT EXISTS "invoice_items_fine_assessment_unique"
  ON "invoice_items" ("tenant_id", "fine_assessment_id")
  WHERE "fine_assessment_id" IS NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invoice_items_fine_assessment_fk') THEN
    ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_fine_assessment_fk"
      FOREIGN KEY ("fine_assessment_id") REFERENCES "fine_assessments" ("id") ON DELETE RESTRICT;
  END IF;
END $$;
```

---

## 4. Replay Safety Verification
- **`ADD COLUMN IF NOT EXISTS`**: Safe against re-runs.
- **`DROP INDEX IF EXISTS` / `CREATE UNIQUE INDEX IF NOT EXISTS`**: Fully idempotent index creation.
- **`WHERE assessment.superseded_by_id IS NULL`**: Prevents re-updating already superseded records on repeated migration runs.
- **`IF NOT EXISTS (SELECT 1 FROM pg_constraint ...)`**: Safe dynamic constraint addition.
- **Data Deletion**: **0 DELETIONS**. All historical assessments remain intact in the table.

## 5. Migration Execution Verdict
**STATUS: SAFE TO EXECUTE**.
Must be executed in migration slot `0156` prior to booting the integrated SchoolOS application containing the updated Finance ORM models.
