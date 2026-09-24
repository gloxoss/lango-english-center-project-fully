# REL-INTEGRATION-01: Collision & Conflict Matrix

**Generated:** 2026-09-24T23:55:00Z  
**Release Base:** `origin/student-directory-hardening` (`f42c2bc`)  
**Auditor:** Agent B (REL-INTEGRATION-01 Replacement Executor)

---

## 1. Global Collision Overview
We cross-analyzed all changed application and infrastructure files across the 17 unmerged trusted campaigns. 

Out of hundreds of modified files, **only 7 pairwise intersections** exist. The codebase demonstrates high modularity and domain separation across subsystems.

---

## 2. Collision Pairs Detail & Semantic Analysis

### Pair 1: `AUD-FINANCE-01` ↔ `AUD-SETTINGS-01`
- **Files Involved (4)**:
  - `.agent-hub/CHANGELOG.md`
  - `lango-app/locales/ar.json`
  - `lango-app/locales/en.json`
  - `lango-app/locales/fr.json`
- **Semantic Overlap**:
  - Both campaigns implement S-7 i18n localization compliance.
  - `AUD-SETTINGS-01` adds keys under `Settings`, `Users`, `Roles`, `Permissions`, and `Organization`.
  - `AUD-FINANCE-01` adds keys under `Finance`, `Cashier`, `Invoices`, `Receipts`, and `PaymentReversals`.
- **Textual Conflict Risk**: Low. Top-level JSON namespace keys are mutually disjoint.
- **Dependency**: None.
- **Risk Severity**: **Low**.
- **Integration Order**: Integrate `AUD-SETTINGS-01` first, then apply `AUD-FINANCE-01` additive keys. Run `npm run check:i18n` and `npm run check:i18n:keys`.

---

### Pair 2: `AUD-RECEPTION-01` ↔ `AUD-TEACHER-01`
- **Files Involved (2)**:
  - `lango-app/src/app/api/students/route.ts`
  - `lango-app/src/features/students/ui/students-list-client.tsx`
- **Semantic Overlap**:
  - `src/app/api/students/route.ts`:
    - `AUD-RECEPTION-01` unblocks receptionists to search student directory with least-privilege projection (name, matricule, class, status) without financial or private notes.
    - `AUD-TEACHER-01` enforces teacher role scoping (teachers only see students in their assigned classes; financial balance columns are completely masked/omitted).
  - `students-list-client.tsx`:
    - Role-adaptive column definitions (receptionist quick lookup vs teacher class roster).
- **Textual Conflict Risk**: Moderate. Both modify projection queries in `GET /api/students`.
- **Known Semantic Compatibility**: **CONFIRMED COMPATIBLE**. Both campaigns enforce complementary role boundaries under `requireRequestContext()`.
- **Dependency**: Both depend on `context.ts` role checks.
- **Risk Severity**: **Medium** (requires careful manual integration of the role projection block).
- **Integration Order**: Integrate `AUD-RECEPTION-01` first, then layer `AUD-TEACHER-01`.

---

### Pair 3 & 4: `AUD-FINANCE-01` ↔ `AUD-RECEPTION-01` & `AUD-TEACHER-01`
- **Files Involved (1)**:
  - `lango-app/src/app/api/students/route.ts`
- **Semantic Overlap**:
  - `AUD-FINANCE-01` provides cashier-specific fields (`balance`, `invoicesDueCount`, `lastPaymentDate`) to authorized billing staff.
  - `AUD-TEACHER-01` strips these exact fields for teachers to protect family financial privacy.
  - `AUD-RECEPTION-01` strips these fields for front-desk receptionists.
- **Textual Conflict Risk**: Moderate.
- **Semantic Compatibility**: **COMPATIBLE**. Role-based field selection in `students/route.ts` cleanly resolves via role branching:
  ```ts
  if (ctx.role === 'teacher') return projectTeacherFields(student);
  if (ctx.role === 'receptionist') return projectReceptionistFields(student);
  if (isFinanceRole(ctx.role)) return projectFinanceFields(student);
  ```
- **Risk Severity**: **Medium**.
- **Integration Order**: Integrate `AUD-RECEPTION-01` and `AUD-TEACHER-01` first, followed by `AUD-FINANCE-01`.

---

### Pair 5, 6 & 7: `AUD-LIVE-01` ↔ `AUD-SETTINGS-01` ↔ `AUD-CREDENTIALS-01`
- **Files Involved (1)**:
  - `lango-app/tsconfig.json`
- **Semantic Overlap**:
  - Minor compiler option adjustments (paths or strictness flags).
- **Textual Conflict Risk**: Trivial.
- **Risk Severity**: **Low**.
- **Integration Order**: Merged cleanly at any stage.

---

## 3. High-Risk Integration Boundaries

### 3.1 Auth & Context (`src/libs/api/context.ts`)
- `AUD-SAFETY-01` enforces `user.branchId` pin on visitor check-in/out.
- `AUD-SETTINGS-01` enforces tenant-level boundaries on user invitations and role updates.
- **Verdict**: Non-overlapping files; both adhere strictly to `requireRequestContext()` invariants.

### 3.2 Finance Definitions (`src/libs/finance/definitions.ts`)
- `AUD-FINANCE-01`, `AUD-ANALYTICS-01`, `FIX-DASH-FIN-KPI-01` all consume `casablancaTodayIso()` and `invoicedInvoiceCondition`.
- **Verdict**: `AUD-FINANCE-01` is the authoritative source; `AUD-ANALYTICS-01` conforms strictly to it without contradictory overrides.

### 3.3 Database Schema & Migrations
- `AUD-FINANCE-01` contains the sole pending migration: `0156_fine_assessment_unique.sql`.
- **Verdict**: No migration numbering collision exists. Must execute in sequence after base `0155`.
