# Advanced HR & Employee Management — Corrected Implementation Plan

Read `future-implementation/_shared/APP-CONTEXT-AND-UI-SYSTEM.md` and the source specification before implementation.

## 0. Corrected starting point

This is not greenfield. The repository already has `employeeProfiles`, payroll periods and lines, salary assignments, leave categories/balances/requests, payslips, employee self-service routes, and workforce pages. The present `employeeProfiles` table is payroll-oriented and requires `userId`; it cannot represent workers without accounts and lacks department, designation, manager, lifecycle, branch, and contract history.

Extend the existing HR domain. Do not introduce a second employee-profile table or duplicate leave/payroll/self-service services.

## 1. Scope and decisions

- HR covers all workers and contractors; `userId` becomes nullable.
- Core identity, roles, account activation, teacher academic assignments, and minimal staff directory remain available without the add-on.
- Departments/designations never grant permissions.
- Full payroll remains in the existing payroll implementation; this project only integrates employment data with it.
- Compensation, national ID, contracts, and offboarding reasons require dedicated sensitive-data capabilities.
- Version 1 employment types: `permanent`, `fixed_term`, `part_time`, `contractor`, `internship`, `substitute`; store configurable/display labels rather than Moroccan legal conclusions.

## 2. Data model and migration

Prefer a feature schema under `src/features/hr/models/` and re-export it. Safely evolve the existing table:

- `departments`: tenant, optional branch, name/code, head employee, description, active/archive state.
- `designations`: tenant, optional department, title/code, description, active/archive state.
- Extend `employeeProfiles`: nullable unique `userId`, branch, stable tenant-scoped `employeeId`, department, designation, manager employee, employment type/status, hire/probation/contract/end dates, workload, archive fields.
- `employeeDocuments`: employee, document type, immutable asset/blob reference, issue/expiry dates, visibility, uploader.
- `employeeEmploymentEvents`: immutable hire/change/transfer/leave/end/archive/access-change timeline with actor and reason.
- `employeeInvitations`: optional account-provisioning lifecycle with hashed token, expiry, consumption and audit fields, unless an existing Better Auth invitation primitive is found and reused.

Migration must preserve current payroll profile IDs and data, backfill one profile for every existing staff user idempotently, and resolve the current global `user.employeeId` uniqueness mismatch in favor of tenant-scoped profile uniqueness. Never delete historical identities.

## 3. Services and API

Create shared HR services used by admin and self-service surfaces:

- `/api/hr/departments` and `/[id]`
- `/api/hr/designations` and `/[id]`
- `/api/hr/employees`, `/[id]`, `/[id]/history`, `/[id]/documents`
- `/api/hr/employees/[id]/provision-access`
- `/api/hr/employees/[id]/offboard`
- `/api/hr/employees/[id]/reactivate`
- HR overview/export endpoints with sensitive columns opt-in and permission-gated

Use transactions for profile + optional account + history creation. Reassignment checks must cover department/designation/manager/branch tenant ownership. Prevent manager cycles. Offboarding preserves the user and history, deactivates access through the core mechanism, and reports unresolved assignments before commit.

## 4. Permissions and entitlement

Add narrowly scoped capabilities: `hr.employee.read`, `hr.employee.manage`, `hr.organization.manage`, `hr.documents.read`, `hr.documents.manage`, `hr.sensitive.read`, `hr.access.manage`, `hr.export`. Retain compatibility with existing `hr.read`/`hr.manage` while migrating call sites deliberately. Gate advanced pages/APIs with `requireAddon(tenantId, 'human-resources')`; do not gate core account administration or teacher management.

## 5. UI

- `/dashboard/hr/employees`: real unified directory and filters.
- `/dashboard/hr/employees/new`: five-step create wizard with review.
- `/dashboard/hr/employees/[id]`: overview, employment, access, documents, history.
- `/dashboard/hr/departments`
- `/dashboard/hr/designations`
- `/dashboard/hr/access`: invitations, lockout, login state, offboarding.
- Upgrade `/dashboard/hr` using real headcount/document/lifecycle data only.

Do not display salary/national ID/document data to generic directory readers. Reuse the existing employee self-service portal and services.

## 6. Phases

1. Schema evolution, backfill, compatibility adapter and permissions.
2. Department/designation CRUD and archive protections.
3. Employee directory/profile/wizard, including no-login employees.
4. Documents, invitation/provisioning, access and offboarding.
5. Overview, exports, self-service reconciliation and addon-disable behavior.

## 7. Acceptance

- Existing employee self-service, leave, payroll and teacher workflows still work.
- Existing staff receive exactly one profile; rerunning migration creates no duplicates.
- A worker can exist without a login and later be linked exactly once.
- Department/designation changes do not alter application permissions.
- Offboarding blocks login but preserves payroll, academic and audit references.
- Sensitive fields are absent from unauthorized API payloads, not merely hidden in UI.
- Manager cycles, cross-tenant foreign IDs and deletion of referenced organizational records fail safely.
- Disabling the add-on hides advanced HR while core staff accounts remain operational.
- Live two-tenant sweep, migration rerun, Docker build/migrate, `tsc --noEmit`, and tenant isolation checks pass.

