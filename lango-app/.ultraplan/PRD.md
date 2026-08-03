# Product Requirements Document (PRD) — Phase 6: Workforce Operations, HR & Payroll

## 1. What We're Building
SchoolOS Phase 6 delivers the complete employee HR lifecycle and Moroccan-compliant payroll engine: employee profiles, salary templates, monthly payroll runs with gross-to-net calculation, payslip PDF generation, leave management with approval workflows, and automatic GL journal posting to the Phase 4 double-entry ledger.

## 2. The Problem
Currently SchoolOS stores only a single `user.salary` flat number — no payroll structure, no CNSS/AMO/IR deductions, no payslip history, no leave tracking. School administrators cannot pay staff correctly or generate the mandatory Moroccan payslip (Bulletin de Paie).

## 3. Who It's For
- **HR Admins / School Directors**: Managing employee contracts, salary templates, and payroll runs.
- **Accountants**: Locking payroll and reviewing GL postings from salary journals.
- **All Staff / Employees**: Viewing payslips and submitting leave requests via self-service.

## 4. What It Does

### 6A: HR Employee Profiles & Salary Templates
- **Employee HR Profile**: CNSS registration number, AMO affiliation, bank RIB (for wire transfer), contract type (CDI/CDD/Vacation Filler), dependants count.
- **Salary Components**: Define named components: Base Salary (fixed), Transport Allowance (fixed DH), CNSS Employee deduction (4.48% formula), AMO Employee deduction (2.26% formula), IR Income Tax (progressive bracket formula).
- **Salary Templates**: Group salary components into reusable templates; assign templates to employees with effective date tracking.

### 6B: Monthly Payroll Run Engine
- **Draft Run Creation**: HR admin creates a draft payroll run for a given month/year.
- **Gross-to-Net Calculation**: System computes per-employee: Gross = Base + Allowances. Employee deductions = CNSS (4.48% ≤ 6,000 DH cap) + AMO (2.26%) + IR (progressive brackets after 40% professional expenses abatement). Net = Gross – deductions.
- **Multi-Stage Lifecycle**: Draft → Review → Approve → Lock → GL Journal Post → Payslips Generated.
- **Payslip PDF Generator**: Moroccan-format bulletin de paie per employee, downloadable from HR dashboard and employee self-service.

### 6C: Leave Management & Approval Engine
- **Leave Categories**: Annual Paid Leave (18 days/year), Sick Leave (capped), Maternity/Paternity Leave, Unpaid Leave.
- **Leave Balance Tracking**: Annual leave balance per employee (accrued, used, remaining).
- **Request & Approval Workflow**: Employee submits → HR/Manager approves or rejects → Balance updated → Calendar marked.

### 6D: HR & Payroll Admin Dashboard (`/dashboard/hr`)
- **Stats Overview**: Headcount, total monthly payroll cost, pending leave requests count, CNSS employer contribution.
- **Payroll Calculator Modal**: Run new payroll month, see gross/net preview, approve and lock.
- **Leave Approvals Table**: Pending leave requests with approve/reject quick actions.

### 6E: Employee Self-Service (via existing portals)
- Added tab in `TeacherPortal` and general staff portal for payslips download and leave request submission.

## 5. What It Does NOT Do (ponytail: YAGNI this phase)
- No salary advances or repayment schedules (Phase 6B).
- No retroactive payroll corrections (correction via next period, not reversal).
- No statutory CNSS XML export file (add when accountant explicitly requests it).
- No CNSS/IR payment tracking to tax authorities (just employee deduction calculation).

## 6. How It Connects
- Reads `user` table for existing staff records.
- Posts locked payroll GL journal entries into Phase 4 `journalEntries` / `journalEntryLines`.
- Payslip files stored via existing upload/document pattern.

## 7. How We'll Know It Works
- Moroccan gross-to-net formula produces correct CNSS/AMO/IR deductions (unit tested).
- Payroll lock prevents edits and posts balanced GL journal automatically.
- Leave approvals correctly deduct from employee leave balance.
- 0 TypeScript errors, 0 Vitest test failures.

## 8. Business Model
Payroll & Workforce Operations is a **separately licensed paid add-on** available on Standard and Premium tiers.
