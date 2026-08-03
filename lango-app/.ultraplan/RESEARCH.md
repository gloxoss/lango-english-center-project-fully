# UltraPlan Research — Phase 6: Workforce Operations, HR & Payroll

## 1. Existing Database Foundations (from Schema.ts audit)
- `user` table: has `salary`, `hireDate`, `workloadHours`, `jobTitle`, `department` — stopgap, not a payroll structure.
- `journalEntries` + `journalEntryLines` + `chartOfAccounts` — Phase 4 GL is live and ready to receive payroll postings.
- `feeDiscounts`, `creditNotes` — pattern for immutable financial records we must replicate for locked payslips.

## 2. Moroccan Statutory Payroll Formula (Source: CNSS / DGI)

| Component | Rate / Rule |
|---|---|
| **CNSS Employee** | 4.48% of gross salary, capped when gross > 6,000 DH/month |
| **AMO Employee** | 2.26% of gross salary (no cap) |
| **CNSS Employer** | 8.98% of gross salary, capped at 6,000 DH |
| **AMO Employer** | 3.26% of gross salary |
| **IR (Income Tax)** | Progressive brackets: 0% ≤ 30,000 DH/yr, 10% ≤ 50,000, 20% ≤ 60,000, 30% ≤ 80,000, 34% ≤ 180,000, 38% > 180,000. Abatement: 40% professional expenses (min 2,160, max 30,000) |
| **Net Salary** | Gross – CNSS Employee – AMO Employee – IR |

## 3. New Database Tables Required
```sql
-- Migration 0041
employee_profiles          -- CNSS no, bank RIB, contract type, dependants count
salary_components          -- name, type (earning/deduction), is_statutory, rate_type (fixed/percent/formula)
salary_templates           -- template name, components list
employee_salary_assignments -- employee -> template, effective_date
payroll_periods            -- month, year, tenant, status (draft/locked)
payroll_runs               -- period, initiator, calculation snapshot JSON, status, locked_at
payroll_run_lines          -- per-employee: gross, cnss_emp, amo_emp, ir, net, cnss_employer, amo_employer
payslips                   -- immutable, linked to run_line, pdf_path, issued_at
leave_categories           -- annual_leave, sick, maternity, unpaid — days_per_year
employee_leave_balances    -- accrued, used, remaining per category per year
leave_requests             -- employee, category, dates, status (pending/approved/rejected), approver
```

## 4. API Surface (ponytail: minimum routes that cover all 3 portals + admin)
```
POST  /api/hr/payroll/runs          -- Create draft run for a period
POST  /api/hr/payroll/runs/[id]/calculate   -- Compute gross/net for all employees
POST  /api/hr/payroll/runs/[id]/lock        -- Approve + lock + post GL journal
GET   /api/hr/payslips              -- List payslips (scoped to employee or all for admin)
GET   /api/hr/payslips/[id]/pdf     -- Download payslip PDF
POST  /api/hr/leave/requests        -- Submit leave request
GET   /api/hr/leave/requests        -- List requests (employee sees own, manager sees team)
PATCH /api/hr/leave/requests/[id]   -- Approve/reject
GET   /api/hr/leave/balances        -- Employee leave balance view
GET   /api/hr/employee-profiles     -- Admin HR profile list
POST  /api/hr/employee-profiles     -- Create/update HR profile
```

## 5. Ponytail Simplifications Applied
- No salary advance module in this phase (YAGNI — add in Phase 6B).
- No retroactive payroll correction in this phase (lock is final; correction via next period).
- No CNSS statutory export XML in this phase (add when accountant needs it).
- PDF payslip uses server-side HTML-to-PDF via Puppeteer/html2pdf (already in exports pattern).
