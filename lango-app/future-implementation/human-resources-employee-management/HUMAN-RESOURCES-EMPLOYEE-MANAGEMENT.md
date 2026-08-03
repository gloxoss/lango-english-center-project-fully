# Human Resources & Employee Management — Future Addon

**Status: planned, not started.** This document evaluates the RamomSchool
Employee pages shown on 2026-08-01 against the real Lango/SchoolOS codebase and
defines the useful version for this product. It is not an instruction to copy
the reference UI or its data model blindly.

## Decision in one sentence

Build **Advanced HR & Employee Management** as a paid addon, while keeping
basic staff accounts, roles, authentication, and teacher management in core.

That boundary matters: every school must be able to create an administrator,
teacher, accountant, or receptionist account even without buying HR. The addon
earns its place by adding the employment and organizational layer around those
accounts: departments, job titles, employee profiles, contracts, lifecycle,
documents, reporting, and eventually attendance/payroll integrations.

## What the reference pages contain

The screenshots show one Employee module with these visible functions:

1. **Employee List**, separated into tabs for Admin, Teacher, Accountant,
   Librarian, and Receptionist.
2. **Add Department** — maintain organizational units such as Administration,
   Finance, Teaching, Admissions, or IT.
3. **Add Designation** — maintain job titles such as Director, Coordinator,
   Senior Teacher, Accountant, or Receptionist.
4. **Add Employee** — create the employee's personal/employment record and,
   where needed, their application login.
5. **Login Deactivate** — disable access without deleting the employee record.
6. List utilities: search, pagination, view/delete actions, and export/print.

The reference combines three different concepts in one module:

- **Application role**: what the person is allowed to do (teacher, accountant).
- **Designation**: their job title in the organization (Head Teacher, Finance
  Manager).
- **Department**: the unit they work in (Academic, Finance, Admissions).

Our implementation must keep those concepts separate. A designation must not
grant permissions, and changing a department must not silently change access.

## Where Lango is today (verified in the code)

Lango already has a meaningful foundation:

- Staff are real tenant-scoped rows in `user`; they are not mock records.
- Existing roles include `school_admin`, `teacher`, `accountant`,
  `receptionist`, and `guard` (plus non-staff roles).
- Existing fields include name, email, phone, photo, national ID, status,
  qualification, salary, employee ID, specialization, workload hours, hire
  date, and JSON documents.
- `/api/users` already supports tenant-scoped list/create/update/delete and
  records audit events.
- `/dashboard/settings/staff` already renders a basic staff roster with search,
  role filtering, status, employee ID, and contact details.
- `/dashboard/settings/users` already provides account creation and editing.
- Teachers have a substantially richer dedicated API and management page.
- Inactive users are rejected by `requireRequestContext`, so `userStatus =
  inactive` already has real login-blocking effect.
- Finance expenses already recognize a salary category, but there is no payroll
  engine.

### What is incomplete or structurally weak

- There are no `departments` or `designations` tables and no employee links to
  either.
- Staff-specific fields are mixed into the shared `user` table. Several are
  explicitly documented as stopgaps in `MIGRATION-NOTES.md`.
- The staff roster's action menu is visual only; it has no working actions.
- The generic user form captures only name, email, phone, role, and status. It
  is not an employee onboarding form.
- Creating a row through `/api/users` does not by itself provide a complete,
  explicit invite/set-password onboarding journey.
- The API's hard DELETE is too dangerous for normal employee offboarding. It
  can remove the identity that historical audit, finance, assignment, or
  academic records conceptually refer to.
- Roles are inconsistent across surfaces: the database supports receptionist
  and guard, while some UI validation/forms expose only admin, teacher, and
  accountant.
- `librarian` is not currently an application role. Library itself is already a
  separate future addon, so a librarian permission set should only be introduced
  with that addon—not added merely because it appears in the reference.
- There is no real employee attendance data; the dashboard explicitly returns
  no fabricated staff-attendance rate.
- There is no payroll, leave, shift, contract-history, or appraisal model.

## Why this addon would be valuable

The current app can answer “who has an account?” but cannot reliably answer:

- Who works in which department and under which job title?
- Who is still employed versus merely unable to log in?
- When did a contract start or end?
- Which employee documents are missing or expiring?
- Who manages whom?
- What staff data should appear in an HR export or payroll preparation report?

This addon turns account records into an actual workforce system. It becomes
especially valuable for multi-branch schools, larger language centers, and
school groups; a very small center can continue using core staff accounts only.

## Addon boundary

### Remains core (never paywalled)

- Creating the minimum staff login accounts required to operate the school.
- Role-based permissions and tenant isolation.
- Activating/deactivating login access safely.
- Password reset, lockout, audit logs, and future 2FA.
- Teacher assignment to classes/subjects and basic teacher management.
- A minimal staff directory (name, role, contact, active/inactive).

### Belongs to the HR addon

- Departments and designations.
- Rich employee profiles and employment details.
- Employee onboarding/offboarding workflows.
- Contract and HR-document management.
- Reporting structure/manager assignment.
- HR exports and workforce analytics.
- Future leave, staff attendance, shifts, appraisal, and payroll preparation.

Login deactivation appears in the reference Employee module, but the underlying
security action remains core. The addon may provide a better offboarding screen
that calls the core deactivation operation.

## Page-by-page implementation plan

### 1. Employee Directory

Route: `/dashboard/hr/employees`

- One unified list with filters for role, department, designation, branch,
  employment status, and login status.
- Columns: photo, employee ID, name, branch, department, designation,
  application role, phone/email, employment status, and login status.
- Role tabs may be offered as shortcuts, but the data remains one list. Avoid
  five separately implemented pages as in the reference.
- Actions: view profile, edit employment details, deactivate/reactivate login,
  start offboarding, and archive.
- Never use normal hard delete. Only a tightly controlled anonymization or
  retention workflow may erase a former employee later.
- CSV/XLSX/PDF/print export must honor the active filters and tenant boundary.
  Export is useful, but lower priority than correct employee data.

### 2. Employee Profile

Route: `/dashboard/hr/employees/[id]`

Sections:

- Identity/contact: photo, legal name, preferred name, phone, email, address,
  date of birth, gender, national ID (access-restricted).
- Employment: employee ID, branch, department, designation, manager, hire date,
  employment type, employment status, contract dates, workload.
- Access: application role, last login, login status, invitation status, reset
  access, deactivate/reactivate. HR details and permissions are edited through
  separate controls.
- Documents: contract, CIN/passport, diplomas/certificates, and other HR files,
  with document type, uploaded date, optional expiry date, and visibility.
- History: audited changes to department, designation, employment status, and
  access state.

Salary must be permission-restricted (school admin and an explicit HR/payroll
permission), not visible to every staff-directory user.

### 3. Add/Edit Employee Wizard

Route: `/dashboard/hr/employees/new`

1. **Personal information** — identity and contact fields.
2. **Employment information** — branch, department, designation, manager,
   employee ID, hire date, contract/employment type, workload.
3. **Access account** — optional login account, role, invitation channel. A
   person may be an employee without needing an application login.
4. **Documents** — actual uploads, not decorative placeholders.
5. **Review and create** — show exactly which profile and account records will
   be created.

Recommended access flow: email/SMS invite allowing the employee to set their
own password. Do not have an administrator invent and relay a permanent
password.

### 4. Departments

Route: `/dashboard/hr/departments`

- Fields: name, optional code, branch scope (all branches or selected branch),
  department head, description, status.
- Support parent department only if a real customer needs nested structures;
  do not add hierarchy in version 1 by default.
- A department with employees cannot be deleted. It can be deactivated after
  employees are reassigned.
- Department membership never grants application permissions.

### 5. Designations / Job Titles

Route: `/dashboard/hr/designations`

- Fields: title, optional code, department (optional), description, status.
- Designation is a reusable job title, not an application role.
- A title in use cannot be deleted; deactivate it for future selection while
  preserving employee history.
- Do not hard-code “Principal,” “Librarian,” etc. Schools define the titles
  that match their organization and language.

### 6. Access & Offboarding

Route: `/dashboard/hr/access`

- Filterable list of employee login state: invited, active, locked, inactive,
  or never provisioned.
- Actions: resend invite, reset access, unlock, deactivate, reactivate.
- Offboarding scenario:
  1. Record last working date and reason (restricted field).
  2. Immediately or on the scheduled date, deactivate login.
  3. Reassign classes, approvals, open attendance flags, and management duties.
  4. Preserve historical records and audit history.
  5. Mark employment ended, then archive the profile.
- Login status and employment status are independent. An employee on leave may
  remain employed but have login temporarily disabled.

### 7. HR Overview (phase 2)

Route: `/dashboard/hr`

- Headcount by department, branch, designation, and employment status.
- New hires and departures.
- Missing/expiring contract or identity documents.
- No employee-attendance KPI until real staff attendance is implemented.
- No salary totals unless the viewer has the dedicated sensitive-data
  permission.

## Data model recommendation

Keep Better Auth identity/account data in `user`, but stop growing that table
with every HR concern.

### `employeeProfiles`

- `id`, `tenantId`, `userId` (nullable and unique when present)
- `branchId`, `employeeId`
- `departmentId`, `designationId`, `managerEmployeeId`
- `employmentType`, `employmentStatus`
- `hireDate`, `probationEndDate`, `contractStartDate`, `contractEndDate`
- `workloadHours`, optional restricted compensation fields
- timestamps and archive metadata

`userId` is nullable because a cleaner model allows an employee record without
an application login. Existing staff rows can be migrated one-to-one.

### Supporting tables

- `departments`
- `designations`
- `employeeDocuments`
- `employeeEmploymentHistory` (or a generic audited change/event table)
- Optional later: `employeeLeaveRequests`, `employeeAttendance`,
  `employeeCompensationHistory`, `payrollRuns`

Every table must carry `tenantId`; branch-scoped records must also carry
`branchId` or a clear all-branches scope. Foreign keys and API checks must
prevent cross-tenant assignment.

## Roles and permissions

Do not turn every designation into a database role. Application roles should
stay few and permission-focused.

- `school_admin`: full school HR administration by default.
- Future `hr_manager` capability: manage employee records but not necessarily
  finance, academics, or system settings. Prefer a permission/capability layer
  before adding many rigid roles to the role enum.
- `accountant`: compensation/payroll access only when explicitly granted.
- Employees: view/edit limited parts of their own profile in a later self-service
  phase.
- `librarian`: add only as part of the Library addon permission design.

Sensitive fields (national ID, salary, contracts, offboarding reason) require
field/section-level authorization; simply being able to view the staff directory
is not enough.

## Main business scenarios

### Hire with login

HR creates an employee profile, assigns branch/department/designation, selects
an application role, uploads documents, and sends an invite. The employee sets
their password; the audit log records both profile creation and access grant.

### Hire without login

Create the HR profile without `userId`. This suits cleaners, drivers, external
trainers, or other staff who need HR tracking but no SchoolOS access. A login
can be provisioned later without duplicating the employee.

### Teacher already exists

When enabling the addon, migrate/link the existing teacher `user` to one
`employeeProfile`; retain teacher class/subject relationships unchanged. HR
must extend teacher management, not replace its academic responsibilities.

### Change job without changing permissions

Changing “English Teacher” to “Academic Coordinator” records designation
history but does not automatically grant admin rights. Access is reviewed and
changed separately if authorized.

### Addon deactivated

- Hide HR pages and block HR addon APIs.
- Preserve all HR data read-only; never delete employee records.
- Keep core staff accounts, login status, roles, and teacher functions working.
- When reactivated, the prior HR data becomes available again.

## What not to copy from the reference

- Do not maintain separate database models for Admin, Teacher, Accountant,
  Librarian, and Receptionist; they are employees with different access roles.
- Do not confuse designation with permissions.
- Do not hard-delete employees as the normal list action.
- Do not add Librarian before the Library addon defines its permissions.
- Do not create fake employee-attendance or payroll numbers merely to fill a
  dashboard.
- Do not put every HR field on the shared authentication `user` table.
- Do not require a login account for every employee.

## Suggested implementation order

1. Implement real addon licensing/gating from `subscription-licensing/`.
2. Add HR tables and migrate existing staff into `employeeProfiles` safely.
3. Implement departments and designations APIs/pages.
4. Implement employee directory, profile, and add/edit wizard.
5. Implement invite/access lifecycle and safe offboarding.
6. Add document storage and expiry tracking.
7. Add exports and HR overview.
8. Consider leave/staff attendance/payroll only as separately scoped later
   phases after their business rules are agreed.

## Open decisions before implementation

1. Is this intended only for employees who use SchoolOS, or all workers and
   contractors? Recommendation: all workers, with optional login linkage.
2. Which employment types are needed in Morocco (permanent, fixed-term,
   part-time, contractor, internship, substitute)? Confirm with the actual
   schools before freezing an enum.
3. Should compensation/payroll remain inside this addon or become a separate
   Payroll addon? Recommendation: HR stores employment/compensation basics;
   full payroll is separate due to accounting and Moroccan legal complexity.
4. Who may see salary, national ID, contracts, and offboarding reasons?
5. Is HR purchased per school tenant or per branch? Recommendation: per tenant,
   with all activated branches covered.

