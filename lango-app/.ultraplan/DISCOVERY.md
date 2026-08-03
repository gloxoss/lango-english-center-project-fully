# UltraPlan Discovery — Phase 6: Workforce Operations, HR & Payroll

## Project Idea
Phase 6: Workforce Operations, HR & Payroll
Goal: Complete employee HR lifecycle, statutory CNSS/IR payroll processing, leave management, and payslip generation.
- **HR & Employee Profiles**: Employee contract details (CDI/CDD/VAC), CNSS/AMO registration number, bank RIB, dependants count, base salary.
- **Leave Management**: Leave categories (Paid, Sick, Maternity/Paternity, Unpaid), leave balance tracking, request & approval workflows.
- **Salary Templates & Allowances**: Salary component definitions (Base, Seniority bonus, Transportation allowance, CNSS/AMO deductions, IR tax).
- **Payroll Runs & Payslip Generator**: Monthly payroll batch run, gross-to-net calculations, printable bulletin de paie (PDF payslip), General Ledger expense posting.
- **Employee Self-Service**: Employee dashboard view for downloading payslips and requesting leave.

## Codebase Context
- **Tech Stack**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Drizzle ORM, PostgreSQL.
- **Existing User Model**: `user.salary`, `hireDate`, `workloadHours`, `jobTitle`, `department`.
- **Existing Ledgers**: `journalEntries`, `journalEntryLines`, `chartOfAccounts` in `src/models/Schema.ts`.

## Discovery Q&A

<!-- Categories: 9 total -->

### Category 5, 6 & 7: Self-Service, Accounting Integration & UI Vision
- **Q5: Employee Self-Service**: Dedicated Employee Self-Service tab in portal to view payslips, leave balances, and submit leave requests.
- **Q6: Payroll & GL Integration**: Automatic double-entry GL journal posting on payroll locking (Debit 6111 Salary Expense, Credit 4432 Staff Payable / 4441 CNSS payable).
- **Q7: Dashboard UI**: Glassmorphic HR & Payroll dashboard at `/dashboard/hr` with stats overview, monthly payroll calculator modal, leave approvals table, and printable payslip generator.

## Discovery Summary
- Total questions asked: 7
- Categories fully covered: Core Requirements, Statutory Rules, Payroll Lifecycle, Leave Management, Accounting Integration, UX Vision.
- Key themes identified:
  - Moroccan statutory payroll formula (CNSS 4.48% capped 6,000 DH + AMO 2.26% + IR progressive brackets).
  - New migration `0041_add_hr_payroll_tables.sql` with `employee_profiles`, `salary_components`, `salary_templates`, `payroll_runs`, `payslips`, `leave_categories`, `leave_requests`.
  - Multi-stage payroll lifecycle (Draft → Calculate → Approve → Lock + GL Post → PDF Payslips).
  - Leave request workflow with manager approval and balance tracking.
  - Automatic GL journal posting on payroll lock linking to Phase 4 double-entry ledger.
  - Glassmorphic HR dashboard UI + Employee self-service payslip/leave tab.


