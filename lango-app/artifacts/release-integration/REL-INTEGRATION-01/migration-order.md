# REL-INTEGRATION-01: Database Migration Execution Order

**Generated:** 2026-09-24T23:55:00Z  
**Release Base:** `origin/student-directory-hardening` (`f42c2bc`)  
**Auditor:** Agent B (REL-INTEGRATION-01 Replacement Executor)

---

## 1. Migration Inventory
Across all 24 inventoried campaign branches, exactly **one campaign** introduces database migration files:
- **Campaign**: `AUD-FINANCE-01` (`origin/audit/agent-a/AUD-FINANCE-01-student-billing-cashier`)
- **Commit SHA**: `85f057148e59e5ee956e5d30cbec0eba43fd3773`
- **Migration SQL**: `lango-app/migrations/0156_fine_assessment_unique.sql`
- **Metadata Journal**: `lango-app/migrations/meta/_journal.json`

All other 23 branches contain **zero database migration files**.

---

## 2. Base & Target Sequence State

| Step | Index | Tag | Origin / Branch | Status |
|---|---|---|---|---|
| Prior Base Top | `idx: 156` | `0155_attendance_rate_nullable` | `origin/student-directory-hardening` | **APPLIED IN BASE** |
| **Next In Sequence** | **`idx: 157`** | **`0156_fine_assessment_unique`** | **`origin/audit/agent-a/AUD-FINANCE-01...`** | **PENDING EXECUTION** |

---

## 3. Migration Safety & Compliance Audit

### 3.1 Numbering & Collision Check
- **Base Top:** `0155`
- **Pending Migration:** `0156`
- **Numbering Collision:** **NONE**. Tag `0156` is strictly sequential. No other branch claims or creates tag `0156`.

### 3.2 S-19 Historical Preservation Invariant
- Finding S-19 forbids deleting historical duplicate fine assessments.
- **Implementation Audit:**
  - `ALTER TABLE "fine_assessments" ADD COLUMN IF NOT EXISTS "superseded_by_id" uuid;`
  - `ALTER TABLE "fine_assessments" ADD COLUMN IF NOT EXISTS "superseded_at" timestamp;`
  - An idempotent window function identifies duplicates partitioned by `(tenant_id, invoice_id, fine_policy_id)` and updates `superseded_by_id` to point to the earliest assessment ID.
  - Future uniqueness is enforced via a partial unique index:
    ```sql
    CREATE UNIQUE INDEX IF NOT EXISTS "fine_assessments_invoice_policy_unique"
      ON "fine_assessments" ("tenant_id", "invoice_id", "fine_policy_id")
      WHERE "invoice_id" IS NOT NULL AND "superseded_by_id" IS NULL;
    ```
- **Destructive Changes:** **0 DELETIONS, 0 DROPS**. Complete historical data is preserved.

### 3.3 Replay Safety
- Uses `IF NOT EXISTS` for all column additions, index creations, and foreign key constraints.
- The window update applies only `WHERE assessment."superseded_by_id" IS NULL`, preventing churn on re-execution.
- Fully replay-safe in staging and production CI environments.

---

## 4. Required Execution Order

When integrating `AUD-FINANCE-01` into the release branch:
1. Ensure the database has applied through `0155_attendance_rate_nullable`.
2. Apply `0156_fine_assessment_unique.sql`:
   ```bash
   npm run db:migrate
   ```
3. Verify index creation and foreign key linkage:
   ```sql
   SELECT indexname FROM pg_indexes WHERE tablename = 'fine_assessments' AND indexname = 'fine_assessments_invoice_policy_unique';
   ```
4. Verify historical fine assessment records retain `superseded_by_id` provenance linkage without record loss.
