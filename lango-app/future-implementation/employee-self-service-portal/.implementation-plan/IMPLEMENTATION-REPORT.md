# Employee Self-Service Portal — Implementation Report

## 1. Executive Summary

The **Employee Self-Service Portal** has been fully implemented in `schoolos-app` to provide an additive, privacy-preserving workspace for all staff members who hold an active `employeeProfiles` record (e.g. teachers, accountants, receptionists, librarians, workforce staff).

Operational roles (`school_admin`, `teacher`, `accountant`, etc.) remain fully intact. Self-service capability is dynamically attached based on the presence of a server-owned `employeeProfiles` link resolving through `resolveEmployeeContext`.

---

## 2. Architectural Design & Boundaries

### Server-Owned Identity Model
- **Context Resolution**: Every self-service request calls `requireRequestContext(request)` and `requireTenant(ctx)`. Client headers like `x-tenant-id` or `x-branch-id` are strictly ignored for authorization.
- **Identity Link**: `resolveEmployeeContext(tenantId, userId)` maps the session principal to an active `employeeProfiles` record. If no profile exists, the server returns 403 `NOT_AN_EMPLOYEE`.
- **Sensitive Re-authentication & HR Approvals**:
  - Safe fields (preferred name, contact number, address, dependants count) are updated directly.
  - Sensitive fields (Bank RIB, CNSS number, AMO number) require password re-authentication (`account` table check) and generate a pending `employeeProfileEditRequests` record for HR review.
- **Published Payslip Isolation**: A payslip is employee-visible only when it has an `issuedAt` value and its payroll period is in a finalized state (`locked`, `approved`, `posted`, `paid`, or `closed`). Draft calculations and coworker records are never exposed.
- **Employment Lifecycle**: Active, probationary, and on-leave employees receive full access. Offboarded employees receive read-only payroll/document access for 90 days after contract end; archived, future-start, and expired identities fail closed.

---

## 3. Database Schema Enhancements (`src/features/hr/models/hr-schema.ts`)

1. **`salaryAdvances`**:
   - Stores employee advance applications, requested and approved amounts, repaid totals, and monthly installment specs.
   - Statuses: `pending | approved | rejected | fully_repaid | cancelled`.

2. **`salaryAdvanceTransactions`**:
   - Audit ledger tracking disbursements, payroll deductions, and manual repayments for each advance.

3. **`employeeAwards`**:
   - Tracks employee recognition, categories, award dates, and monetary rewards.

4. **`employeeProfileEditRequests`**:
   - Stores sensitive edit proposals (Bank RIB, CNSS/AMO) with password re-authentication timestamps, proposed JSON payloads, and HR reviewer status.

---

## 4. API Surface (`src/app/api/employee/me/*`)

| Endpoint | Method | Description |
|---|---|---|
| `/api/employee/me/home` | `GET` | Aggregated dashboard: leave balance summary, latest published payslip, clock punch state, today's class schedule. |
| `/api/employee/me/profile` | `GET` / `PATCH` | Profile details read; direct update for safe fields; password re-authentication + pending approval creation for sensitive fields. |
| `/api/employee/me/leave` | `GET` / `POST` | List own leave requests & submit new leave application using `createLeaveRequest`. |
| `/api/employee/me/leave/[id]/cancel` | `POST` | Cancel pending leave request. |
| `/api/employee/me/time` | `GET` | Own workforce punch event history & paired work session duration. |
| `/api/employee/me/payroll` | `GET` | Own published payslips and annual net salary summaries. |
| `/api/employee/me/payroll/[payslipId]/download` | `GET` | Download an escaped, printable HTML payslip snapshot. |
| `/api/employee/me/advances` | `GET` / `POST` | List advances & repayment transactions; submit new salary advance application. |
| `/api/employee/me/awards` | `GET` | List employee recognition awards and monetary rewards. |
| `/api/employee/me/documents` | `GET` | List non-archived employee-visible HR documents. |
| `/api/employee/me/documents/[documentId]/download` | `GET` | Download an own, visible HR document through a tenant/user-scoped route. |
| `/api/employee/me/requests` | `GET` | List pending and past profile change requests. |
| `/api/employee/me/preferences` | `GET` / `PATCH` | Workspace preferences (language, default tab, notification settings). |

---

## 5. Portal UI Component (`src/features/hr/ui/employee-portal-view.tsx`)

A slate/blue styled stateful React workspace with 9 tabbed sections:
1. **Accueil**: Solde de congés, cours du jour, dernière fiche de paie.
2. **Mon profil**: Safe profile editing and sensitive RIB/CNSS re-authentication modal.
3. **Congés**: Leave category balance summary and new leave request form.
4. **Avances sur salaire**: Advance application form, status badges, and repayment ledger.
5. **Pointage**: Clock status, derived work-session duration, and punch history (read-only in this release).
6. **Fiches de paie**: Published payslip list and annual summaries.
7. **Distinctions**: Employee recognition & rewards list.
8. **Documents**: Administrative HR document directory.
9. **Mes demandes**: Pending and reviewed profile change request audit trail.

## 6. Audit Remediation

- Leave cancellation uses a conditional state transition, so concurrent cancellation/review cannot silently overwrite state.
- One pending salary advance and one pending sensitive edit per employee/type are enforced with partial unique indexes.
- Sensitive changes are applied only by the HR review endpoint, with self-approval forbidden and transaction-level row locking.
- Payslip HTML escapes all employee-controlled fields and contains no hard-coded contribution percentages.
- The legacy fixture reset is explicitly destructive, local-host-only, and opt-in; it refuses to run by default.
