# Migration Order & Database Safety Audit — REL-INTEGRATION-01
**Target Base:** `origin/student-directory-hardening` (`f42c2bc4`)  
**Base Migration Count:** 157 migrations (`0000_...` through `0155_attendance_rate_nullable.sql`)  
**Generated:** 2026-09-24T23:55:00Z  

---

## 1. Migration Inventory Across All 24 Campaigns

Across all 24 campaigns examined, **exactly 1 campaign** introduces new schema migrations: **`AUD-FINANCE-01`**. All other 23 campaigns contain purely application-layer, API-layer, and UI-layer changes with zero database schema migrations.

| Campaign ID | Branch | Migration File | Journal Entry | Numbering Collision | Safety Rating |
|---|---|---|---|---|---|
| **AUD-FINANCE-01** | `origin/audit/agent-a/AUD-FINANCE-01-student-billing-cashier` | `lango-app/migrations/0156_fine_assessment_unique.sql` | `tag: "0156_fine_assessment_unique"`, idx: 156 | **None (Next in sequence: 0155 -> 0156)** | **100% Safe (Non-destructive, Replay-safe)** |

---

## 2. In-Depth Analysis of Migration 0156 (`0156_fine_assessment_unique.sql`)

### 2.1 Purpose & S-19 Historical Preservation
Migration 0156 resolves issue **S-19** (Fine assessment duplicate billing and race prevention).
A naive implementation would delete duplicate historical assessments or wipe unlinked duplicates, destroying audit trails.
Migration 0156 adheres strictly to SchoolOS Data Preservation Invariants:
1. **Zero Deletions:** No `DELETE FROM fine_assessments` is executed.
2. **Historical Duplicates Linked:** Adds `superseded_by_id uuid` and `superseded_at timestamp`.
3. **Deterministic Keeper Selection:**
   ```sql
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
   ```
4. **Partial Unique Index:**
   ```sql
   CREATE UNIQUE INDEX IF NOT EXISTS "fine_assessments_invoice_policy_unique"
     ON "fine_assessments" ("tenant_id", "invoice_id", "fine_policy_id")
     WHERE "invoice_id" IS NOT NULL AND "superseded_by_id" IS NULL;
   ```
   This allows historical superseded records to remain untouched while strictly prohibiting future un-superseded duplicate assessments on the same invoice.
5. **Foreign Key Integrity:**
   Enforces `invoice_items_fine_assessment_fk` with `ON DELETE RESTRICT` inside an idempotent `DO $$ BEGIN ... END $$;` block.

### 2.2 Replay Safety & Idempotency
- Uses `ADD COLUMN IF NOT EXISTS` for all three added columns.
- Uses `DROP INDEX IF EXISTS` prior to recreating index.
- Uses `CREATE UNIQUE INDEX IF NOT EXISTS`.
- Uses defensive `IF NOT EXISTS (SELECT 1 FROM pg_constraint ...)` before adding foreign keys.
- Safe to run repeatedly against development, staging, or production databases without error.

---

## 3. Required Execution Sequence

1. **Pre-requisite:** Database must be at baseline `0155_attendance_rate_nullable.sql` (standard target base level).
2. **Execution Timing:** Apply migration `0156_fine_assessment_unique.sql` simultaneously with the integration of `AUD-FINANCE-01` (Step 16 in the master integration order).
3. **Verification Command:**
   ```bash
   cd lango-app && npm run db:migrate
   # Run fine run idempotency verification:
   npx vitest run src/features/finance/__tests__/payment-idempotency.test.ts
   ```
