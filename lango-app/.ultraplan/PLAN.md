# UltraPlan Master Plan — Phase 6: Workforce Operations, HR & Payroll

## 1. What We're Building
A Moroccan-compliant HR & Payroll engine for SchoolOS. Covers the full employee lifecycle from HR profile setup → salary template assignment → monthly payroll calculation (CNSS/AMO/IR) → payroll lock & GL posting → payslip PDF generation, plus a leave request & approval workflow.

## 2. Ponytail Scope (Ship minimum that works; nothing speculative)
- ✅ **IN SCOPE**: Employee HR profiles, salary templates, payroll runs, payslip generation, leave categories, leave requests/approvals, HR dashboard, employee self-service payslip tab.
- ❌ **OUT OF SCOPE (this phase)**: Salary advances, retroactive corrections, CNSS statutory XML export, payroll payment bank file generation. → Add in Phase 6B when explicitly requested.

## 3. Database Changes (Migration 0041)

| New Table | Purpose |
|---|---|
| `employee_profiles` | CNSS number, bank RIB, contract type, dependants |
| `salary_components` | Named earning/deduction components with formula keys |
| `salary_templates` | Named groups of components |
| `salary_template_components` | Junction: template ↔ component |
| `employee_salary_assignments` | Employee ↔ template + base salary + effective date |
| `payroll_periods` | Month/year period with draft/locked status |
| `payroll_run_lines` | Per-employee gross, deductions, net for a period |
| `payslips` | Immutable payslip record linked to run line |
| `leave_categories` | Annual, Sick, Maternity, Unpaid |
| `employee_leave_balances` | Accrued / used / remaining per employee per year |
| `leave_requests` | Employee leave submission + approval workflow |

## 4. Moroccan Payroll Formula (Stateless, Pure Function)

```
Gross = Base + Transport Allowance + Seniority Bonus + ...
CNSS Employee  = min(Gross × 4.48%, 6000 DH × 4.48%)   → capped
AMO Employee   = Gross × 2.26%                            → no cap
Net Taxable    = Gross − CNSS_Employee − (40% abatement, min 180/mo, max 2500/mo)
IR             = progressive bracket on annual Net Taxable ÷ 12
Net Salary     = Gross − CNSS_Employee − AMO_Employee − IR
CNSS Employer  = min(Gross × 8.98%, 6000 DH × 8.98%)
AMO Employer   = Gross × 3.26%
Total Employer Cost = Gross + CNSS_Employer + AMO_Employer
```

## 5. API Surface (10 routes, no extras)

```
GET/POST  /api/hr/employee-profiles
GET/POST  /api/hr/salary-templates
POST      /api/hr/payroll/periods
GET       /api/hr/payroll/periods/[id]/lines
POST      /api/hr/payroll/periods/[id]/calculate
POST      /api/hr/payroll/periods/[id]/lock
GET       /api/hr/payslips
GET       /api/hr/payslips/[id]/pdf
GET/POST  /api/hr/leave/requests
PATCH     /api/hr/leave/requests/[id]
GET       /api/hr/leave/balances
GET/POST  /api/hr/leave/categories
```

## 6. New Pages & Components

| File | Purpose |
|---|---|
| `src/app/.../dashboard/hr/page.tsx` | HR Admin Dashboard |
| `src/components/hr/HrDashboardStats.tsx` | Stats overview cards |
| `src/components/hr/EmployeeProfilesList.tsx` | Employee HR profile list + edit |
| `src/components/hr/LeaveApprovalsTable.tsx` | Pending leave requests approvals |
| `src/components/hr/EmployeePayslipList.tsx` | Employee's own payslip list |
| `src/components/hr/EmployeeLeaveRequestForm.tsx` | Leave submission form |
| `src/libs/services/payroll-engine.ts` | Pure Moroccan gross-to-net calculator |

## 7. Dependency Graph & Execution Order

```
[Section 01: DB Migration 0041 + Payroll Engine]    ← DO FIRST
         |
         +---> [Section 02: HR Employee Profiles API]  ←─┐
         |                                                 │
         +---> [Section 03: Payroll Run + GL Posting]  ←──┤ (parallel)
         |                                                 │
         +---> [Section 04: Leave Management API]      ←──┘
                    |
                    └──> [Section 05: HR Dashboard + Self-Service]  ← DO LAST
```

## 8. Verification Plan
- **Unit Tests** (`src/libs/services/__tests__/payroll-engine.test.ts`): 5 test cases for Moroccan formula edge cases (CNSS cap, IR brackets, zero dependants).
- **Integration Tests** (`src/app/api/hr/hr-payroll.test.ts`): Payroll lock posts balanced GL entry; leave approval decrements balance; employee cannot view other's payslip (403).
- **TypeScript**: `npx tsc --noEmit` → 0 errors.
- **Vitest Suite**: All 15 test files passing cleanly.

## 9. Review Notes
- Self-review: 8/8 quality categories PASSED (Completeness, Consistency, Feasibility, Security, Scalability, Edge Cases, UX, Ponytail Compliance).
- Ponytail compliance: 4 features explicitly deferred (salary advance, retroactive corrections, CNSS XML export, bank payment file). No bloat added.

## 10. Traceability
| Requirement | PRD Section | Section | Tasks | Status |
|---|---|---|---|---|
| DB migration for HR/payroll tables | 4.6A | 01 | 01-01, 01-02 | Covered |
| Moroccan CNSS/AMO/IR payroll formula | 4.6B | 01 | 01-03 | Covered |
| HR employee profiles API | 4.6A | 02 | 02-01 | Covered |
| Salary templates API | 4.6A | 02 | 02-02 | Covered |
| Monthly payroll run lifecycle (draft→lock) | 4.6B | 03 | 03-01, 03-02 | Covered |
| Payroll → GL journal auto-posting | 4.6B | 03 | 03-02 | Covered |
| Payslip PDF download | 4.6B | 03 | 03-03 | Covered |
| Leave categories + balance tracking | 4.6C | 04 | 04-01 | Covered |
| Leave request + approval workflow | 4.6C | 04 | 04-02 | Covered |
| HR admin dashboard (`/dashboard/hr`) | 4.6D | 05 | 05-01 | Covered |
| Employee self-service payslip + leave tab | 4.6E | 05 | 05-02, 05-03 | Covered |
| Portal manifest HR navigation items | — | 05 | 05-04 | Covered |
