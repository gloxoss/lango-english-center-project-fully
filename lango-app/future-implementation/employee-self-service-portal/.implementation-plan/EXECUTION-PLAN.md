# Employee Self-Service Portal — Execution Plan

## 1. Executive Summary & Domain Boundaries

The **Employee Self-Service Portal** provides an additive self-service workspace for all staff members who hold an active `employeeProfiles` record (e.g. teachers, accountants, receptionists, librarians, workforce staff). Operational roles (`school_admin`, `teacher`, `accountant`, etc.) are retained; self-service is granted based on the presence of a server-validated `employeeProfiles` context.

### Domain Boundaries
- **HR Domain**: Owns employee identity, contract history, employment status, department, designation, manager, and direct employee document metadata.
- **Payroll & Workforce Domain**: Owns salary structure, payslip calculation, leave ledgers, salary advances, and employee awards.
- **Employee Self-Service Domain**: Owns employee-originated requests (leave, advance, sensitive profile edit proposals), privacy-safe employee projections (own payslips, own leave balances, own attendance punches), sensitive re-authentication enforcement, and portal UI views (`/dashboard/workforce/me/*` or `/dashboard/employee/*`).

---

## 2. Codebase Audit & Reuse/Extend/Replace/New Matrix

| Component | Target Location | Action | Reason / Specs |
|---|---|---|---|
| Employee Context Resolver | `src/features/hr/services/employee-context.ts` | **Extend** | Reuses `resolveEmployeeContext` with added support for active status check & offboarded retention period. |
| DB Schemas | `src/features/hr/models/hr-schema.ts` | **Extend** | Add tables for `salaryAdvances`, `salaryAdvanceTransactions`, `employeeAwards`, and `employeeProfileEditRequests`. |
| Me Home API | `src/app/api/employee/me/home/route.ts` | **Extend** | Returns aggregated employee summary: leave balances, latest published payslip, current clock punch status, active advances, and today's schedule. |
| Me Profile API | `src/app/api/employee/me/profile/route.ts` | **Extend** | Handles safe profile edits directly (preferred name, contact, emergency contacts) and routes sensitive edits (Bank RIB, tax/CNSS ID) through `employeeProfileEditRequests` requiring password re-authentication. |
| Me Leave API & Cancel | `src/app/api/employee/me/leave/route.ts` & `[id]/cancel/route.ts` | **Extend** | Provides own leave requests list, submission of new leave requests using `createLeaveRequest`, and cancellation of pending leave. |
| Me Time API | `src/app/api/employee/me/time/route.ts` | **Extend** | Exposes punch events & paired session history for employee's own record. |
| Me Payroll API & Download | `src/app/api/employee/me/payroll/route.ts` & `[payslipId]/download/route.ts` | **Extend** | Exposes published payslips (`payslips.status === 'published'`), net salary summaries, and PDF download endpoint. |
| Me Advances API | `src/app/api/employee/me/advances/route.ts` | **New** | Exposes active salary advance applications, repayment schedules, transaction history, and new advance request submission. |
| Me Awards API | `src/app/api/employee/me/awards/route.ts` | **New** | Exposes employee recognition & monetary award history. |
| Me Documents API | `src/app/api/employee/me/documents/route.ts` | **New** | Exposes visible HR/employee documents and download capabilities. |
| Me Requests API | `src/app/api/employee/me/requests/route.ts` | **New** | Exposes pending and past profile edit & document requests. |
| Me Preferences API | `src/app/api/employee/me/preferences/route.ts` | **New** | Handles self-service workspace preferences (locale, layout, notifications). |
| Portal Manifest & Widgets | `src/features/portal/services/portal-manifest.ts` | **Extend** | Adds self-service nav items and quick actions for users with an active employee context. |
| Employee Portal UI | `src/app/[locale]/(dashboard)/dashboard/workforce/me/*` | **New / Extend** | Provides stateful React views using slate/blue palette, tabbed navigation (Overview, Profile, Leave, Payroll & Advances, Time & Attendance, Documents & Requests). |

---

## 3. Server-Owned Context & Security Architecture

1. **Server-Derived Context**: All `/api/employee/me/*` routes call `requireRequestContext(request)` and `requireTenant(ctx)`. Client headers like `x-tenant-id` or `x-branch-id` are ignored for authorization.
2. **Identity Link**: `resolveEmployeeContext(tenantId, userId)` verifies that the authenticated user maps to an active `employeeProfiles` record.
3. **Sensitive Re-authentication**: Updating bank details (RIB), CNSS number, or identity tax numbers requires entering current account password. Safe fields (phone, address, emergency contact) are updated or queued for HR review.
4. **Tenant Isolation**: Every query filters by `eq(table.tenantId, tenantId)` and `eq(table.userId, ctx.userId)` (or `employeeId`).
5. **Published Payslip Protection**: Only published payslips (`status = 'published'`) are accessible to the employee. Draft or unapproved payroll lines are hidden.

---

## 4. Verification & Testing Strategy

1. **TypeScript Type Check**: `npx tsc --noEmit` (0 errors).
2. **Vitest Unit & Integration Suite**: Run security & portal foundation vitest tests.
3. **Tenant Isolation Script**: `npx tsx scripts/check-tenant-isolation.ts`.
4. **Next.js Production Build**: `npx next build`.
