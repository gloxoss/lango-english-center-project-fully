# Section 04: 6C Leave Management API & Approval Workflow

## Risk: 🟡 YELLOW — Standard CRUD with balance tracking.

## Overview
Build leave categories API, leave balance tracking, leave request submission, and manager approval/rejection workflow. Balance is decremented atomically on approval.

## Dependencies
- Depends on: Section 01
- Blocks: Section 05

## Success Criteria
- Approving a leave request atomically decrements `employee_leave_balances.used_days`.
- Rejecting does not change balance.
- Employee cannot request more days than remaining balance (validated server-side).
- `npx tsc --noEmit` → 0 errors.

## Tasks

### [04-01] Build Leave Categories & Balances API
**File**: `src/app/api/hr/leave/categories/route.ts`
**File**: `src/app/api/hr/leave/balances/route.ts`
**Action**:
- `GET /api/hr/leave/categories` — List leave categories for tenant.
- `POST /api/hr/leave/categories` — Create category (name, days_per_year, is_paid). Requires `hr.manage`.
- `GET /api/hr/leave/balances` — Returns employee's leave balances for current year (accrued, used, remaining).
**Verify**: Leave balance returns correct remaining = accrued - used.

### [04-02] Build Leave Request Submission & Approval API
**File**: `src/app/api/hr/leave/requests/route.ts`
**File**: `src/app/api/hr/leave/requests/[id]/route.ts`
**Action**:
- `POST /api/hr/leave/requests` — Employee submits request (category, start_date, end_date). Validates: end_date >= start_date; days_requested <= remaining balance. Creates record with status='pending'.
- `GET /api/hr/leave/requests` — Employee sees own; `hr.manage` sees all pending.
- `PATCH /api/hr/leave/requests/[id]` — Approve or reject. On approve: atomic transaction updates status + increments `used_days`.
**Verify**: Approve atomically updates both request status and leave balance.

### [04-03] Build Leave Calendar & Balance Summary Component
**File**: `src/components/hr/LeaveApprovalsTable.tsx`
**Action**: Table of pending leave requests with employee name, category, dates, days, and Approve/Reject action buttons. Shows remaining balance for each employee in the row.
**Verify**: Renders correctly with mock data, 0 TypeScript errors.
