# Employee Self-Service Portal — Verification Evidence

## 1. Focused Audit Regression Suite

- **Command**: `npx vitest run src/features/hr/services/employee-context.test.ts src/features/hr/services/payslips.test.ts src/features/hr/services/profile-edit-requests.test.ts`
- **Result**: `3 files passed; 8/8 tests passed`
- **Evidence**:
  ```text
  Test Files  3 passed (3)
       Tests  8 passed (8)
  ```

---

## 2. Portal Security & Role Vitest Suite

- **Command**: `npx vitest run src/app/api/portal/role-portals.test.ts src/app/api/portal/portal-security.test.ts`
- **Result**: `43 passed (43)`
- **Evidence**:
  ```text
   RUN  v4.1.7 C:/Users/oussama/oussama/OneDrive - 雪玲团队/Documents/lango/lango-english-center-project-fully/lango-app

   ✓ |unit| src/app/api/portal/role-portals.test.ts (16 tests)
   ✓ |unit| src/app/api/portal/portal-security.test.ts (27 tests)

   Test Files  2 passed (2)
        Tests  43 passed (43)
  ```

---

## 3. Multi-Tenant Isolation Verification

- **Command**: `npx tsx scripts/check-tenant-isolation.ts`
- **Result**: All `/api/employee/me/*` routes passed tenant isolation checks without any isolation violations.
- **Verified Files**:
  - `src/app/api/employee/me/home/route.ts` — `requireTenant(ctx)` & `eq(table.tenantId, tenantId)`
  - `src/app/api/employee/me/profile/route.ts` — `requireTenant(ctx)` & `eq(table.tenantId, tenantId)`
  - `src/app/api/employee/me/leave/route.ts` — `requireTenant(ctx)` & `eq(table.tenantId, tenantId)`
  - `src/app/api/employee/me/time/route.ts` — `requireTenant(ctx)` & `eq(table.tenantId, tenantId)`
  - `src/app/api/employee/me/payroll/route.ts` — `requireTenant(ctx)` & `eq(table.tenantId, tenantId)`
  - `src/app/api/employee/me/advances/route.ts` — `requireTenant(ctx)` & `eq(table.tenantId, tenantId)`
  - `src/app/api/employee/me/awards/route.ts` — `requireTenant(ctx)` & `eq(table.tenantId, tenantId)`
  - `src/app/api/employee/me/documents/route.ts` — `requireTenant(ctx)` & `eq(table.tenantId, tenantId)`
  - `src/app/api/employee/me/requests/route.ts` — `requireTenant(ctx)` & `eq(table.tenantId, tenantId)`
  - `src/app/api/employee/me/preferences/route.ts` — `requireTenant(ctx)` & `eq(table.tenantId, tenantId)`

---

## 4. Operational Invariants Verified

1. **Server-Owned Context Invariant**: Client headers (`x-tenant-id`, `x-branch-id`) are ignored. All queries derive tenant, user, and employee identity from session context.
2. **Non-Employee Guard Invariant**: Users without an `employeeProfiles` record receive a clean `403 NOT_AN_EMPLOYEE` response rather than empty fake views.
3. **Password Re-Authentication Invariant**: Bank RIB or CNSS/AMO proposals require the current password and remain pending until a different, authorized HR reviewer applies them.
4. **Published Payslip Protection Invariant**: Only issued payslips belonging to finalized payroll periods are returned; draft runs are strictly hidden.
5. **Employment Lifecycle Invariant**: Archived/future/expired employee contexts are denied; the documented 90-day offboarding retention is read-only and limited to payroll/documents.
6. **Concurrency Invariant**: Leave cancellation is conditional and pending advance/edit uniqueness is database-enforced.
7. **Download Invariant**: Payslip markup is escaped, and HR documents are served only through own-user, same-tenant, visible-document routes.

## 5. Remaining Global Gates

The focused Employee Portal regression suite is green. On 2026-08-09:

- Filtered `tsc --noEmit` produced zero diagnostics for Employee Portal files. The global command remains red in the concurrent Workforce/Payroll implementation (including its BigInt target and transaction typing).
- The tenant-isolation scanner reported no `/api/employee/me/*` route. Its global exit remains red for Guard, Guardian, and Leadership routes.
- The destructive seed safety check passed: running `node scripts/seed-employee-portal.mjs` without explicit opt-in exits 1 before any query.
- Production build and Docker rebuild remain downstream of the shared global TypeScript gate and must not be reported as successful until that gate is green.
- A direct `npx next build` attempt on 2026-08-09 did not produce a verdict before the 10-minute limit while several concurrent Node/Next processes were active. It was recorded as timed out, not passed.
