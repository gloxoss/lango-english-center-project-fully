# Payroll & Workforce Operations — Future Addon

**Status: planned, not started.** This specification covers the RamomSchool
Human Resource submenu shown on 2026-08-01: Payroll, Advance Salary, Leave, and
Award. It compares those screens with SchoolOS and defines the complete
Morocco-first logic required for a trustworthy implementation.

## Product and addon decision

Build a separately licensed **Payroll & Workforce Operations** addon containing:

- Salary components, structures/templates, and employee assignments
- Effective-dated statutory/tax/social-contribution rules
- Payroll periods, calculation, review, approval, posting, payment, and payslips
- Employee salary advances and repayment schedules
- Employee leave categories, policies, balances, requests, approvals, calendar,
  and payroll effects
- Employee awards/recognition with optional approved monetary rewards
- Employee self-service and sensitive audit/reporting

This is distinct from the existing planned **Human Resources & Employee
Management** addon:

- HR owns the employee profile, employment/contract history, department,
  designation, manager, branch, and employment status.
- Payroll & Workforce owns compensation calculation, payroll results, leave
  balances/requests, advances, awards, payslips, and payment lifecycle.

Technically, Payroll requires the HR employee-profile foundation. Commercially,
it may be sold separately or in an HR suite bundle. Activating Payroll must
either activate the required HR foundation or clearly block until the dependency
is present; it must never duplicate employee identity/employment data.

## What the reference pages imply

Visible reference navigation:

- **Payroll**
  - Salary Template
  - Salary Assign
  - Salary Payment
- **Advance Salary**
  - My Application
  - Manage Application
- **Leave**
  - Category
  - My Application
  - Manage Application
- **Award**

Those labels cover the surface, but not the hard parts: effective tax versions,
gross-to-net calculations, retroactivity, proration, locked payroll results,
maker/checker controls, leave accrual/carryover, advance recovery, accounting
posting, payment reconciliation, corrected payslips, statutory export, or data
privacy. This plan includes those missing rules.

## Where SchoolOS is today (verified)

### Existing foundations

- Tenant-scoped staff accounts and roles.
- `user.salary`, `hireDate`, `workloadHours`, status, branch, and employee ID.
- A generic Finance expense category named `salary`.
- Audit logging, tenant isolation, document upload patterns, and French/Arabic
  localization foundations.
- Student leave requests exist, but are student-specific.
- Planned HR addon defines `employeeProfiles`, employment history, compensation
  history, contract dates, department/designation, and manager.

### Gaps and unsafe shortcuts

- `user.salary` is one stopgap number, not a salary structure or dated contract.
- A generic salary expense is not payroll: it has no employee breakdown,
  earnings/deductions, liabilities, tax, CNSS/AMO, payslip, or payment state.
- The current generic expense API permits hard deletion; posted payroll must
  never be deleted that way.
- There are no payroll periods/runs/results/payslips or statutory rule versions.
- No employee bank/RIB, CNSS registration, tax situation, dependants, or payroll
  eligibility profile.
- No employee leave categories, policies, accruals, balances, calendar, or
  payroll integration. Student leave tables must not be reused.
- No salary advance, recovery ledger, or double-deduction protection.
- No award/recognition records.
- No employee attendance/shift data. Payroll must not invent absence deductions
  from the student attendance domain.
- Existing role checks are too coarse for salary privacy and segregation of
  payroll preparation, approval, and payment.

## Compliance architecture (Morocco first, international later)

Payroll rules change. Never hard-code current percentages or brackets directly
inside calculation functions.

### Effective-dated regulations

Store versioned rule sets with:

- jurisdiction (`MA` initially), effective-from/to dates, publication/source
- IR brackets, deductions/allowances, family/dependant rules and exemptions
- employee/employer social contributions, ceilings/floors and bases
- AMO and other applicable contributions
- professional training/employer contributions where applicable
- rounding order/method, annualization/de-annualization and cumulative rules
- declaration/export mappings

Each finalized payroll result stores the exact regulation version and input
snapshot used. A new law applies prospectively unless an explicit audited
retroactive recalculation is run.

### Official-source policy

Before production, a Moroccan payroll/accounting professional must validate
rules against the current official sources, including:

- Ministry of Economy and Finance / DGI Code Général des Impôts and annual
  Finance Law/circulars
- Moroccan Labour Code from the Ministry of Justice legal portal
- CNSS/AMO rules and the current DAMANCOM declaration/payment specifications

The software must display rule source, effective date, and validation status.
“Configured” is not the same as “legally certified.”

### International architecture

Do not generalize Morocco tables into vague universal fields. Use a jurisdiction
adapter/rule-pack interface so future countries can define their own taxes,
social contributions, leave laws, payslip labels, currencies, and declarations.

## Page architecture

### 1. Workforce & Payroll Overview

Route: `/dashboard/workforce`

- Current payroll period and status.
- Employees included/excluded with reasons.
- Gross, employee deductions, employer contributions, net payable, and total
  employer cost—visible only to authorized payroll users.
- Pending leave/advance approvals, advances outstanding, upcoming leave, awards.
- Warnings: missing HR assignment, bank/RIB, CNSS/payroll profile, salary
  structure, invalid rule pack, overlapping assignment, negative net pay,
  unposted prior period, or unreconciled payment.
- No payroll totals for ordinary managers or staff-directory viewers.

### 2. Payroll Settings & Regulation Packs

Route: `/dashboard/workforce/payroll/settings`

- Company/tenant payroll identity, CNSS/employer identifiers, fiscal/calendar
  settings, currency, pay frequency, cut-off/payment day, default rounding.
- Effective-dated Morocco rule packs with source URLs/documents and approval.
- Payslip numbering and display policy.
- Accounting mappings: salary expense, employee payable, tax/social liabilities,
  employer contributions, advances receivable, bank/cash clearing.
- Bank export configuration, DAMANCOM/statutory export configuration when exact
  formats are implemented and validated.
- Holiday calendar and leave-payroll cut-off policy.
- Configuration changes are versioned and audited; published versions are
  immutable.

### 3. Salary Components

Route: `/dashboard/workforce/payroll/components`

Component types:

- Earnings: base salary, fixed allowance, overtime, bonus, award, commission,
  benefit-in-kind, reimbursement (non-taxable only when rules justify it).
- Employee deductions: absence/unpaid leave, advance recovery, loan, tax/social
  withholding, authorized deductions.
- Employer contributions: employer CNSS/AMO/other costs.
- Informational/statistical values: taxable gross, contribution base, YTD values.

Fields:

- Code/name, type, fixed/percentage/formula, amount/base, taxable/contributable
  flags, employer/employee side, proratable, recurring/one-off, currency,
  rounding, effective dates, display/order, accounting mapping.
- Formulas use a constrained, typed expression system with allowlisted inputs
  and dependency-cycle detection—never `eval`, raw JavaScript, or SQL.
- Published/in-use component versions are immutable.

### 4. Salary Structures / Templates

Route: `/dashboard/workforce/payroll/structures`

- Named, versioned combinations of earning/deduction/contribution components.
- Applicability by employment type, branch, role/designation, or explicit
  assignment; no automatic permission changes.
- Preview calculation using safe sample inputs.
- Validate duplicate components, circular formula dependencies, missing bases,
  overlapping effective dates, and incompatible regulation versions.
- Draft → reviewed → published → retired lifecycle.
- A structure is a reusable calculation recipe, not an employee's contract.

### 5. Salary Assignments

Route: `/dashboard/workforce/payroll/assignments`

- Assign a published structure/version to an employee with effective dates.
- Employee-specific base amount, allowances, deductions, pay frequency, cost
  center/branch, and approved overrides.
- Link to HR employment/compensation change reason and approval.
- Prevent overlapping active assignments for the same pay frequency.
- Future-dated changes are supported; historical runs keep their old snapshot.
- Bulk assignment/change with preview and per-employee validation.
- Migrating `user.salary`: treat as unverified opening base salary requiring
  review, not automatically legally correct payroll data.

### 6. One-off & Recurring Adjustments

Route: `/dashboard/workforce/payroll/adjustments`

- Bonus, overtime, award payment, correction, reimbursement, deduction, or
  recovery outside the standard structure.
- Effective payroll period, evidence/attachment, amount/units/rate, tax/social
  treatment derived from component configuration, requester/approver.
- Recurring adjustments have start/end dates and remaining occurrence limits.
- No adjustment may modify a finalized payroll; create an off-cycle or next-run
  correction.

### 7. Payroll Periods & Runs

Route: `/dashboard/workforce/payroll/runs`

Statuses:

`draft → calculating → calculated → under_review → approved → posted → paid → closed`

Exceptional: `failed`, `cancelled` before posting, and `reversed` after posting.

Flow:

1. Open period and freeze cut-off inputs.
2. Select eligible active employees/assignments.
3. Snapshot HR, salary, leave, advance, award, adjustment, and rule-pack inputs.
4. Calculate gross-to-net per employee.
5. Show blocking errors/warnings and variance versus prior period.
6. Payroll preparer reviews; authorized approver approves.
7. Generate immutable payslips.
8. Post accounting/finance liabilities and expense entries atomically.
9. Produce bank/cash payment batch.
10. Reconcile payments and close.

Recalculation before approval is allowed and versioned. After posting, never
overwrite: reverse and replace or run an off-cycle correction.

### 8. Payroll Run Review

Route: `/dashboard/workforce/payroll/runs/[id]`

- Summary totals and employee grid.
- Columns: prior/current gross/net variance, additions/deductions, payable,
  exception badges, payment state.
- Drill-down calculation trace showing every component, base, rate, formula
  version, rounding, and source input.
- Filters for missing data, negative/zero net, high variance, new hires,
  departures, unpaid leave, advances, one-offs.
- Maker cannot approve their own run if separation-of-duties policy is enabled.

### 9. Payslips

Route: `/dashboard/workforce/payroll/payslips`

- Authorized payroll list plus employee self-service access to own slips only.
- Earnings, deductions, employer contributions (optional display), gross,
  taxable/contribution bases, net, payment method/reference, YTD totals.
- French/Arabic templates with truthful labels and exact regulation period.
- PDF generation via the shared document engine if useful, but payroll data and
  lifecycle remain in this addon.
- Corrected slip links to the reversed/replacement result; no silent editing.
- Payslip download/access events are audited with reasonable privacy retention.

### 10. Salary Payments & Reconciliation

Route: `/dashboard/workforce/payroll/payments`

- Create payment batch only from approved/posted payable results.
- Methods: bank transfer, cash, cheque, other controlled options.
- Generate bank-specific export only through validated adapters; preview totals
  and account masking.
- States: prepared, approved, exported, submitted, partially_paid, paid, failed,
  reversed.
- Import/match bank result or record authorized manual confirmation.
- Prevent double payment with unique result/payment allocation constraints.
- Cash payments require receipt/reference and stronger approval/audit.

### 11. Employee Payroll Self-Service

Route: `/dashboard/workforce/me/payroll`

- Own payslips, year-to-date summary, payment status, and approved compensation
  view according to policy.
- No visibility into colleagues or payroll run totals.
- Secure request for correction/question linked to the payslip; never edit
  payroll from the request itself.

## Salary advance pages and logic

### 12. My Salary Advances

Route: `/dashboard/workforce/me/advances`

- View eligibility policy, available limit if configured, submitted/approved/
  paid/recovery status, outstanding balance and repayment schedule.
- New request: amount, reason category (minimized), desired disbursement date,
  repayment installments/start period, optional attachment.
- Preview planned payroll deductions and consent/acknowledgment.
- Employee may cancel only before approval/disbursement.

### 13. Manage Salary Advances

Route: `/dashboard/workforce/advances`

Statuses:

`draft → submitted → under_review → approved → disbursed → recovering → settled`

Exceptional: rejected, cancelled before disbursement, written_off/reversed only
through restricted accounting action.

- Eligibility checks: active employment, salary assignment, policy limit,
  outstanding advances, expected remaining employment/contract, projected net
  pay, and minimum-net safeguards.
- Approval does not equal payment. Disbursement creates a receivable/advance
  ledger entry and payment reference.
- Repayment creates scheduled payroll deductions. Actual recovery is recorded
  only when a posted payroll deduction/result settles it.
- One source-of-truth ledger prevents the double-update bug common when both
  payroll deduction and payment logic mutate “returned amount.”
- Early repayment and adjusted schedules use explicit transactions, not direct
  balance edits.

## Employee leave pages and logic

### 14. Leave Categories

Route: `/dashboard/workforce/leave/categories`

- Types such as annual, sick, maternity/paternity, unpaid, compassionate,
  training, and custom—with legal validation before defaults are finalized.
- Fields: paid/unpaid/partially paid, unit (day/half-day/hour), evidence rules,
  notice, minimum/maximum duration, consecutive-day handling, holiday/weekend
  counting, carryover, expiry, negative balance, gender/eligibility only where
  lawful and necessary, payroll component mapping.
- Legal leave entitlements are not freely removable by a tenant admin. System
  defaults are versioned by jurisdiction; school policies may be more generous.

### 15. Leave Policies & Assignments

Route: `/dashboard/workforce/leave/policies`

- Versioned allocations/accrual rules by employment type, tenure, contract,
  branch/jurisdiction, or explicit assignment.
- Annual/front-loaded/monthly accrual, prorating for join/leave dates,
  carry-forward cap/expiry, probation restrictions, opening balances.
- Policy assignment effective dates cannot overlap.
- Balance transactions are append-only: allocation, accrual, adjustment,
  reservation, consumption, cancellation, expiry, carryover.

### 16. My Leave

Route: `/dashboard/workforce/me/leave`

- Balance cards by category, pending reservations, history, team calendar with
  privacy-safe visibility.
- Request dates/partial days, category, reason, handover/cover, attachment.
- Real-time calculation of requested units, holidays/weekends, balance, and
  projected pay effect.
- Prevent overlapping requests; allow cancellation/change request by policy.
- Medical documents are sensitive protected files, not visible to ordinary
  managers beyond necessary approval information.

### 17. Manage Leave

Route: `/dashboard/workforce/leave/requests`

- Manager/HR queues, filters, conflict/team-coverage view, calendar.
- Approval chain based on manager/HR rules; requester cannot self-approve.
- Pending request reserves balance; approval consumes/reserves definitively;
  rejection/cancellation releases it.
- Approved unpaid/partially paid leave produces payroll input only for the
  applicable open period. If payroll is already posted, create a correction for
  a later/off-cycle run.
- Return-from-leave and supporting-document follow-up when relevant.

### 18. Leave Calendar & Reports

Route: `/dashboard/workforce/leave/calendar`

- Team/branch calendar with privacy-aware labels.
- Absence/coverage conflicts, upcoming leave, balance/liability reports.
- No reuse of student attendance/leave records.

## Awards pages and logic

### 19. Awards & Recognition

Route: `/dashboard/workforce/awards`

- Award definitions: name, category, description, eligibility, approval,
  certificate/badge option, monetary/non-monetary, visibility.
- Grant flow: nominate employee, evidence/achievement period, reviewers,
  announcement visibility, optional reward.
- Status: nominated, under_review, approved, granted, rejected, revoked.
- Monetary reward becomes a one-off payroll earning only after award approval
  and payroll-component mapping; it is not paid directly by changing salary.
- Non-monetary recognition can integrate later with Certificate Management.
- Private disciplinary/performance data must not appear in public recognition.

## Payroll calculation model

For each employee and period:

1. Resolve active employment and salary assignment as of the period.
2. Resolve published structure/components and regulation version.
3. Calculate proration from join/end dates and approved work schedule.
4. Apply approved recurring/one-off earnings.
5. Apply approved paid/unpaid leave and other time inputs.
6. Determine contribution/tax bases.
7. Calculate employee deductions and employer contributions in configured order.
8. Apply advance recovery and other authorized deductions with minimum-net rules.
9. Round at defined component/stage boundaries.
10. Produce gross, taxable bases, deductions, net pay, liabilities, employer cost.
11. Store full input/result/calculation trace snapshot.

Calculation must be deterministic: same inputs + same versions = same result.

## Finance/accounting integration

The current `expenses` table is not a general ledger. Version 1 may post a
locked payroll expense summary plus linked liability/payment records, but must
not create an ordinary deletable expense that can drift from payroll.

Recommended posting model:

- Debit salary/benefit/employer-contribution expenses.
- Credit employee net-pay payable, tax/social contribution payables, advance
  receivable recovery, and other liabilities as configured.
- Payment clears employee payable against bank/cash.
- Statutory payment clears corresponding liabilities.
- Reversal creates equal/opposite entries and keeps original history.

If SchoolOS does not build a real ledger, clearly label this as payroll subledger
and export/accounting integration—not full accounting.

## Recommended data model

### Configuration/versioning

- `payrollRegulationPacks`, `payrollRegulationVersions`
- `salaryComponents`, `salaryComponentVersions`
- `salaryStructures`, `salaryStructureVersions`, `salaryStructureComponents`
- `payrollSettingsVersions`, `payrollCalendars`

### Employee compensation

- `salaryAssignments` (employee profile, structure version, dates, overrides)
- `payrollAdjustments` and attachments/approvals
- restricted `employeePayrollProfiles` (CNSS/tax/bank/RIB/dependant inputs)

### Runs/results/payments

- `payrollPeriods`, `payrollRuns`, `payrollRunEmployees`
- `payrollResults`, `payrollResultLines`, `payrollCalculationTraces`
- `payslips`, `payrollPostings`, `payrollPostingLines`
- `salaryPaymentBatches`, `salaryPayments`, reconciliation events

### Advances

- `salaryAdvancePolicies`, `salaryAdvanceRequests`
- `salaryAdvanceTransactions` append-only ledger
- `salaryAdvanceRepaymentSchedules` and payroll allocations

### Leave

- `employeeLeaveCategories`, `employeeLeavePolicies`, policy assignments
- `employeeLeaveBalanceTransactions` append-only ledger
- `employeeLeaveRequests`, approval events, attachments, payroll allocations
- `holidayCalendars`, holidays

### Awards

- `awardDefinitions`, `employeeAwards`, award approval/evidence records

All tables are tenant-scoped. Employee, branch, policy, component, actor,
approver, payment, and finance links must be tenant-consistent.

## Permissions and segregation of duties

Capabilities—not job titles alone:

- Payroll configure
- Payroll prepare/calculate
- Payroll view sensitive detail
- Payroll approve
- Payroll post
- Payroll payment prepare/approve/reconcile
- Advance request/review/approve/disburse
- Leave request/manager approve/HR administer
- Award nominate/approve/grant
- Own payslip/advance/leave access

Recommended high-risk separation:

- Preparer cannot approve the same payroll run.
- Payment preparer cannot be sole payment approver.
- Employee cannot approve own leave/advance/award.
- Salary/bank/tax details are field/section protected, encrypted where practical,
  masked in lists/logs, and excluded from broad staff APIs.

## Lifecycle, immutability, and corrections

- Draft/config records can change until published/in use.
- Published structure/regulation versions are immutable.
- Calculated runs may be recalculated with version history before approval.
- Approved/posted results are immutable.
- Posted payroll is corrected through reversal/replacement or off-cycle entries.
- Paid payroll requires payment reversal/recovery workflows, never deletion.
- Leave and advance balances derive from append-only transactions, not mutable
  counters alone.
- Addon deactivation preserves data, slips, balances, and verification/audit;
  blocks new transactions/calculations, and must not erase liabilities.

## Privacy and security

- Payroll, bank, national/social IDs, tax data, medical leave documents, and
  advances are highly sensitive.
- Never return salary fields from general `/api/users` endpoints once payroll
  exists; use dedicated permission-checked endpoints.
- Encrypt especially sensitive fields/assets where the architecture supports it.
- Mask bank/RIB and identifiers in UI; never log calculation inputs wholesale.
- Rate-limit exports and record who exported what.
- Payslip/bank files use tenant-bound authorized downloads and retention limits.
- Require recent authentication/2FA later for high-risk approval/export actions.
- Maintain immutable audit trails without storing unnecessary medical/reason text.

## Open-source inspirations

See `REFERENCE-REPOSITORIES-AND-COMPLIANCE.md` beside this plan.

- **Frappe HR**: primary workflow/domain inspiration for structures, payroll
  runs, taxation, leave, advances, approvals, and employee self-service. GPL-3.0:
  do not copy code into SchoolOS without a deliberate licensing decision.
- **Payroll Engine**: MIT-licensed inspiration for effective-dated regulations,
  payroll layers, cases, forecasts, pay-run jobs/results, and traceability.
- **OCA Payroll**: inspiration for payroll-accounting, contract advantages, and
  public-holiday integration. AGPL-3.0: inspiration only.

## Suggested implementation order

1. Implement addon licensing/dependency enforcement.
2. Build HR employee-profile/employment-history foundation.
3. Obtain Moroccan payroll professional review and encode testable rule-pack
   fixtures from official sources—no live payroll yet.
4. Build components, structures, assignments, payroll calendar/settings.
5. Build deterministic calculation engine with trace/golden tests.
6. Build payroll runs, review/approval, immutable results and payslips.
7. Build subledger/finance posting and payment reconciliation.
8. Build leave categories/policies/balances/requests and payroll integration.
9. Build salary advances and append-only recovery ledger.
10. Build awards and certificate/payroll integrations.
11. Build self-service, exports, statutory adapters, reports, and security
    hardening.
12. Pilot in shadow mode beside a professional's existing payroll for multiple
    periods; reconcile every employee before production use.

## Mandatory test strategy

- Golden gross-to-net cases validated by a Moroccan payroll professional.
- Effective-date boundary and retroactive rule tests.
- Join/end/leave proration, unpaid leave, leap year, month-length tests.
- Component dependency/cycle/rounding tests.
- Advance disbursement/recovery/early repayment/double-deduction tests.
- Leave accrual/carryover/reservation/cancellation/overlap tests.
- Payroll idempotency, concurrent run, double-payment and reversal tests.
- Tenant isolation and salary/medical/bank field authorization tests.
- Property tests: totals balance, net equation, posting debits=credits when a
  double-entry subledger exists, same inputs produce same results.

## Decisions required before implementation

1. Is Payroll sold only with HR or can it auto-enable the HR foundation?
2. Monthly payroll only for version 1, or weekly/hourly too?
3. Which employee types/contracts and pay components exist at the first school?
4. Which bank payment/export formats are actually needed?
5. Is DAMANCOM export required in version 1, and what exact current specification
   will be used?
6. Which Morocco statutory rules and leave categories must be legally supported
   at launch, confirmed by whom?
7. Should leave/advances/awards be one commercial addon with Payroll or separately
   activatable submodules? Recommendation: one Workforce addon initially, with
   internal capability flags for future packaging.
8. What maker/checker roles exist at small schools where one administrator wears
   several hats?
9. Does SchoolOS need cash payroll, bank payroll, or both?
10. How many parallel shadow payroll periods are required before go-live?

