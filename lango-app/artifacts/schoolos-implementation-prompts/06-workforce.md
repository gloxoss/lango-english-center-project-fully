# 06 — Workforce Operations Prompt Pack

## Domain contract

Employee identity/profile, employment assignment, access membership, attendance, compensation, payroll, leave, and advances are related but separate records. Use effective dates and approval workflows. Compensation data is private and requires dedicated capabilities.

## WF-01 — HR overview and employee directory

**Routes:** `/dashboard/hr`, `/employees`, `/employees/[id]`. **Objective:** find staff, understand current assignment/status, and surface HR tasks. **Layout:** workforce metrics with freshness; directory filters; profile tabs for employment, contact, documents, attendance, leave, payroll summary, access, timeline. **Actions:** add employee, change assignment, request document, offboard. **States:** applicant, active, on leave, suspended, ended, access mismatch. **Acceptance:** sensitive tabs separately authorized; headcount derived from effective assignments. **Exclude:** showing salary in directory rows.

## WF-02 — Departments, designations, and employment setup

**Routes:** `/dashboard/hr/departments`, `/designations`, `/employment-types`. **Objective:** maintain reusable organization definitions and reporting lines. **Actions:** create, reorder, assign manager, archive unused. **States:** in use, circular reporting line, archived. **Acceptance:** prevent cycles and preserve historical labels. **Exclude:** deleting referenced definitions.

## WF-03 — Employee onboarding wizard

**Route:** `/dashboard/employees/new`. **Objective:** create a person/employment assignment, collect documents, optionally provision access, and assign role/branch without duplication. **Layout:** identity → employment → documents → access → review. **Actions:** save draft, match existing person, invite after approval. **States:** duplicate identity, missing contract, access pending. **Acceptance:** canonical identity match and transactional finalization. **Exclude:** emailing passwords.

## WF-04 — Access lifecycle and offboarding

**Routes:** `/dashboard/hr/access`, `/employees/[id]/offboarding`. **Objective:** align employment status with system access and assigned assets/tasks. **Layout:** mismatch queue and dated checklist. **Actions:** schedule end, transfer responsibilities, revoke sessions/access, preserve records. **States:** future end, access still active, unresolved responsibility. **Acceptance:** revocation idempotent; records retained per policy. **Exclude:** deleting the user/person record.

## WF-05 — Salary templates and employee assignment

**Routes:** `/dashboard/payroll/templates`, `/salary-assignments`. **Objective:** define versioned earnings/deductions and assign effective compensation packages. **Layout:** component editor with calculation examples; assignment timeline and approval. **Actions:** create version, simulate gross/net, submit/approve assignment. **States:** invalid formula, overlapping assignment, future-effective, locked by payroll. **Acceptance:** decimal-safe, restricted formulas, historical version snapshot. **Exclude:** retroactively editing completed payroll.

## WF-06 — Payroll runs, review, and payslips

**Routes:** `/dashboard/payroll/runs`, `/runs/[id]`, `/payments`, `/payslips`. **Objective:** calculate, review exceptions, approve, finalize, pay, and distribute payroll. **Layout:** run checklist, employee calculation table, exception queue, totals/reconciliation, approval history. **Actions:** create, calculate, rerun draft, approve, finalize, export payment file, mark paid, publish payslips. **States:** draft, calculating, exceptions, approved, finalized, paid, reversed adjustment. **Acceptance:** finalized run immutable, calculation trace per line, segregation of duties, secure payslips. **Exclude:** deleting a finalized run.

## WF-07 — Salary advances

**Routes:** `/dashboard/advances/my-application`, `/advances/manage`, `/advances/[id]`. **Objective:** request, assess, approve, disburse, and recover advances through payroll. **Layout:** employee request/repayment preview; manager queue with affordability/policy evidence. **Actions:** submit, approve/reject, schedule recovery, cancel before disbursement. **States:** pending, approved, disbursed, recovering, settled, default exception. **Acceptance:** no self-approval, recovery linked to payroll lines. **Exclude:** automated approval based on opaque scoring.

## WF-08 — Leave categories, requests, calendar, and reports

**Routes:** `/dashboard/leave/categories`, `/leave/my-application`, `/leave/manage`, `/leave/calendar`, `/leave/reports`. **Objective:** define policies, request leave, resolve approvals, calculate balances, and plan coverage. **Layout:** policy versions; request timeline; manager queue; privacy-safe team calendar. **Actions:** request, attach evidence, approve/reject, withdraw, correct balance with reason. **States:** insufficient balance, overlap, pending evidence, approved, cancelled. **Acceptance:** effective policy snapshot, business-day calendar, no medical detail on team calendar. **Exclude:** exposing leave reason broadly.

## WF-09 — Awards and recognition

**Routes:** `/dashboard/hr/awards`, `/awards/new`. **Objective:** record policy-based staff recognition with optional private/public visibility. **Actions:** nominate, approve, publish, attach certificate. **States:** draft, approved, private, published, withdrawn. **Acceptance:** consent for public recognition and audit. **Exclude:** competitive employee scoring dashboards.

## Verification prompt

Test employment/access mismatch, effective dates, compensation privacy, payroll rounding and finalization, duplicate run prevention, approval separation, advance recovery, leave balance boundaries, offboarding session revocation, employee self-service object scope, and secure document downloads.
