# Payroll & Workforce Operations — Retain / Migrate / Replace / Retire Matrix

Audit date: 2026-08-09 · Audited against `migrations/*.sql`, `src/models/Schema.ts`,
`src/features/hr/models/hr-schema.ts`, live API routes, pages, tests and the add-on registry.

Legend: **Retain** = keep and extend · **Migrate** = move data/semantics into a new shape ·
**Replace** = delete the old implementation and build the new one in its place ·
**Retire** = stop using; preserved read-only or removed behind a guard.

---

## 1. Schema / tables

| Table | Origin migration | Verdict | Action |
|---|---|---|---|
| `salary_components` | 0043 | **Retain** | Keep as the live component catalog. Add `salary_component_versions` for effective-dated immutable versions. |
| `salary_templates` | 0043 | **Retain** | Keep as the named structure header. Add `salary_structure_versions` + `salary_structure_components` for versioned structures. |
| `salary_template_components` | 0043 | **Migrate** | Superseded by `salary_structure_components`. Kept for read-compat; new writes go to the versioned structure tables. |
| `employee_salary_assignments` | 0043 | **Retain** | Keep as the live effective-dated assignment. Add approved-override + pay-frequency columns. `user.salary` remains a legacy mirror (see below). |
| `payroll_periods` | 0043 | **Retain (extend)** | The period doubles as the **payroll run**. Extend status enum to the full lifecycle and add approver/poster/reversal columns. |
| `payroll_run_lines` | 0043 | **Retain (extend)** | Keep as the per-employee summary row; add regulation/version/proration/payment columns. Component detail moves to `payroll_result_lines`. |
| `payslips` | 0043 | **Retain (extend)** | Add payslip number, status, immutable flag. Link to reversal/replacement. |
| `leave_categories` | 0043 | **Retain** | Keep categories. Policy/accrual moves to `employee_leave_policies`. |
| `employee_leave_balances` | 0043 | **Retain (extend)** | Keep the per-year balance; balances now **derive** from the append-only `employee_leave_balance_transactions` ledger. |
| `leave_requests` | 0043 (+0072) | **Retain (extend)** | Add `under_review`/`in_progress` statuses; self-approval and overlap checks enforced in the service + reservation ledger. |
| `departments`, `designations`, `employee_documents`, `employee_employment_events`, `employee_invitations`, extended `employee_profiles` | 0073/0074/0075 | **Retain** | HR-owned identity foundation. Payroll references `employee_profiles` only — never creates a second employee table. |
| `salary_advances` | **none (Drizzle-only)** | **Migrate → backfill** | Table exists in `hr-schema.ts` and is queried by live routes but has **no migration SQL**. Migration 0092 creates it to match. |
| `salary_advance_transactions` | **none (Drizzle-only)** | **Migrate → backfill** | Same. 0092 creates it. |
| `employee_awards` | **none (Drizzle-only)** | **Migrate → backfill** | Same. 0092 creates it. |
| `employee_profile_edit_requests` | **none (Drizzle-only)** | **Migrate → backfill** | Same. 0092 creates it. |
| — | — | **New** | `payroll_regulation_packs`, `payroll_regulation_versions`, `payroll_settings_versions`, `salary_component_versions`, `salary_structure_versions`, `salary_structure_components`, `employee_payroll_profiles`, `payroll_adjustments`, `payroll_result_lines`, `payroll_calculation_traces`, `payroll_postings`, `payroll_posting_lines`, `salary_payment_batches`, `salary_payments`, `employee_leave_policies`, `employee_leave_policy_assignments`, `employee_leave_balance_transactions`, `salary_advance_policies`, `salary_advance_repayment_schedules`, `award_definitions` (all in migration 0092). |

## 2. Services / engine

| Artifact | Verdict | Action |
|---|---|---|
| `src/libs/services/payroll-engine.ts` (`calculatePayslipLine`) | **Replace** | Hard-coded 2024 Morocco constants become a **reference** effective-dated regulation version with provenance (`CGI 2024`, `status: reference/unvalidated`). New `src/features/workforce/services/` engine computes componentized, traceable results. `calculatePayslipLine` is kept as a thin backward-compat shim delegating to the reference regulation so existing routes/tests keep passing. |
| `src/features/hr/services/payslips.ts` | **Retain (extend)** | Keep list/get/HTML render; extend with payslip number + regulation provenance. |
| `src/features/hr/services/employee-context.ts` (`resolveEmployeeContext`) | **Retain** | The self-service identity source. All `/api/employee/me/payroll*` routes gate on it. |
| `src/features/accounting/services/posting-service.ts` | **Retain (consume)** | Accounting's **published contract** `postAccountingVoucher` (balanced, payload-bound idempotent, fiscal-period enforced). Payroll consumes it — never inserts journal entries directly. |

## 3. API routes

| Route group | Verdict | Action |
|---|---|---|
| `/api/hr/payroll/periods`, `/[id]/calculate`, `/[id]/lines`, `/[id]/lock` | **Retain (extend)** | Keep; gate on the `payroll-workforce` add-on + granular capabilities; extend calculate to the new engine and lifecycle. |
| `/api/hr/payslips`, `/api/hr/salary-templates`, `/api/hr/salary-assignments` | **Retain (extend)** | Add add-on gating + sensitive-detail capability; redact bank/CNSS from non-privileged projections. |
| `/api/hr/leave/*` | **Retain (extend)** | Add policy/accrual/approve routes; reservation ledger. |
| `/api/employee/me/*` (home, profile, leave, leave/[id]/cancel, advances, awards, payroll, time, documents, requests, preferences) | **Retain (fix)** | `preferences` is an in-memory no-op → route to `portal_preferences`. `advances`/`awards`/`requests` depend on the missing tables → fixed by the 0092 backfill. |
| — | **New** | `/api/hr/payroll/{regulations,settings,structures,adjustments,runs/[id]/{review,approve,post,pay,close},payments,batches}`, `/api/hr/advances`, `/api/hr/awards`, `/api/hr/leave/{policies,balances}`, `/api/employee/me/{payslips,ytd,advances/recovery}`. |

## 4. Pages

| Page | Verdict | Action |
|---|---|---|
| `dashboard/hr/*`, `dashboard/workforce/*` | **Retain but currently static mock** | Wire the live data-fetching for the key pages (runs, payslips, advances, leave, awards, self-service). Full browser acceptance is **pending** (see MANUAL-TESTING §2). |
| — | **New** | Payroll runs/periods and payments pages under `dashboard/workforce/payroll/*` (scaffold; browser-pending). |

## 5. Permissions

| Capability | Verdict | Action |
|---|---|---|
| `hr.read`, `hr.manage` (coarse) | **Retain** | Backward-compat umbrella. |
| — | **New** | `payroll.configure`, `payroll.calculate`, `payroll.review`, `payroll.approve`, `payroll.post`, `payroll.sensitive.read`, `payroll.payment.prepare`, `payroll.payment.approve`, `payroll.payment.reconcile`, `payroll.leave.manage`, `payroll.advances.manage`, `payroll.awards.manage`, `payroll.self.read`. `school_admin` gets all (via `ALL_PERMISSIONS`); `accountant` deliberately does **not** (unchanged). Maker/checker is enforced in services, not just capability grants. |

## 6. Add-on registry

| Add-on | Verdict | Action |
|---|---|---|
| `payroll-workforce` (registered, `enabled:false`, no dir) | **Migrate → build** | Mark built (`enabled:true`), add `requires: ['human-resources']`; enforce the dependency at activation (super-admin grant + school_admin toggle) and at runtime (`requireWorkforceAddon`). |
| `human-resources` | **Retain (dependency)** | Payroll routes also gate on it; deactivating HR blocks new payroll transactions while preserving data. |

## 7. Tests

| Test file | Verdict | Action |
|---|---|---|
| `src/libs/services/__tests__/payroll-engine.test.ts` (8 cases) | **Retain (extend)** | Keep as the reference-regulation golden cases; add engine tests for proration, unpaid leave, net/employer equations, rounding, cycles. |
| `periods/[id]/calculate/calculate.test.ts` | **Retain** | DB upsert idempotency stays valid. |

## 8. Migrations

- **New:** `migrations/0092_payroll_workforce_operations.sql` — single hand-written, idempotent, forward-only migration: the four-table **backfill** first (advances/awards/edit-requests), then regulation/settings, versioned components/structures, payroll profiles, adjustments, run/result/trace, posting refs, payment batches, leave ledger, advance schedules, award definitions. Extends `payroll_periods`/`payroll_run_lines`/`payslips`/`leave_requests`/`employee_leave_balances`. References HR-owned `employee_profiles`. Next journal index: **93**, `when` **1787200000008** (re-verified at write time).
- **Never** `drizzle-kit generate`; never rewrite 0043/0073/0074/0075/0072; never touch another agent's applied migration.
