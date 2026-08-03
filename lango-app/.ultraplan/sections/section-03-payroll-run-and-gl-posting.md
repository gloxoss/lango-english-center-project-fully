# Section 03: 6B Monthly Payroll Run API + GL Journal Posting

## Risk: 🔴 RED — Financial accuracy and immutability guarantees required.

## Overview
Build the payroll run API lifecycle: create draft period, calculate per-employee gross-to-net using the engine from Section 01, review, lock (atomic transaction that posts GL journal debit/credit and generates payslip records). Payslip PDF download endpoint.

## Dependencies
- Depends on: Sections 01, 02
- Blocks: Section 05

## Success Criteria
- Draft period → calculate → lock is fully atomic; partial lock leaves no orphaned payslip lines.
- Locked payroll posts balanced GL entry: SUM(debits) == SUM(credits).
- Locking a locked period returns 409 CONFLICT.
- `npx tsc --noEmit` → 0 errors.

## Tasks

### [03-01] Build Payroll Period & Draft Run API
**File**: `src/app/api/hr/payroll/periods/route.ts`
**Action**:
- `POST /api/hr/payroll/periods` — Create draft period for year/month (enforces unique constraint).
- `GET /api/hr/payroll/periods` — List periods with status.
- `GET /api/hr/payroll/periods/[id]/lines` — List calculated run lines for period.
**Verify**: POST creates period with status='draft'; duplicate year/month returns 409.

### [03-02] Build Calculate & Lock Endpoints
**File**: `src/app/api/hr/payroll/periods/[id]/calculate/route.ts`
**File**: `src/app/api/hr/payroll/periods/[id]/lock/route.ts`
**Action**:
- `POST .../calculate`: For every active employee with a salary assignment, call `calculatePayslipLine()`, upsert into `payroll_run_lines`.
- `POST .../lock`: Atomic transaction:
  1. Check period is not already locked (409 if locked).
  2. Verify all employees have a run line.
  3. Sum total net salary, CNSS employer, AMO employer.
  4. Post GL journal: Debit 6111 (gross salaries), Credit 4432 (net payable), Credit 4441 (CNSS payable), Credit 4442 (AMO payable).
  5. Create `payslips` records (one per run_line).
  6. Set period status = 'locked', locked_at = now().
  All steps in a single `db.transaction()` — rollback on any error.
**Verify**: Lock posts balanced GL entry (debit total = credit total).

### [03-03] Build Payslip Download Endpoint
**File**: `src/app/api/hr/payslips/[id]/route.ts`
**Action**: 
- `GET /api/hr/payslips` — Scoped list: employee sees own, hr.manage sees all.
- `GET /api/hr/payslips/[id]/pdf` — Returns payslip HTML (bulletin de paie format with employee name, period, gross, deductions, net) — renders inline or triggers download.
**Verify**: Employee cannot fetch another employee's payslip (403).
